import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jsonError, readJsonBody, requireStringField } from '$lib/server/api';
import { matchSelectedUser } from '$lib/server/selected-user';
import type { SessionSummary } from '$lib/types';
import {
  claimSessionCompletion,
  completeSessionRecord,
  getProgressJournal,
  getUserById,
  insertExerciseResults,
  resetSessionCompletionClaim,
  updateProgressJournal,
} from '$lib/server/db';
import { generateUpdatedJournal } from '$lib/server/ai';
import { runBackgroundTask } from '$lib/server/background-task';
import { recordUsageEvent } from '$lib/server/token-limiter';
import { processSessionCompletion } from '$lib/server/gamification';
import { calculateMaxCombo } from '$lib/utils/results';

type ResultPayload = {
  exerciseId: string;
  answerText: string;
  isCorrect: boolean;
};

type CompleteRequest = {
  userId?: string;
  sessionId?: string;
  results?: unknown;
  localDate?: string;
};

function isResultPayload(value: unknown): value is ResultPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const result = value as Record<string, unknown>;
  return (
    typeof result.exerciseId === 'string' &&
    result.exerciseId.trim().length > 0 &&
    typeof result.answerText === 'string' &&
    typeof result.isCorrect === 'boolean'
  );
}

function parseResults(value: unknown): ResultPayload[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  if (!value.every(isResultPayload)) {
    return null;
  }

  return value;
}

function buildSummary(userId: string, sessionId: string, results: ResultPayload[]): SessionSummary {
  const total = results.length;
  const correct = results.filter((result) => result.isCorrect).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return buildSummaryFromAccuracy(
    userId,
    sessionId,
    `Practice complete: ${correct}/${total} correct (${accuracy}%).`,
    accuracy,
  );
}

function buildSummaryFromAccuracy(
  userId: string,
  sessionId: string,
  summary: string,
  accuracy: number,
): SessionSummary {
  return {
    sessionId,
    userId,
    summary,
    strengths:
      accuracy >= 70 ? ['Consistent results in review mode'] : ['You completed a full review set'],
    weaknesses:
      accuracy >= 70
        ? ['Aim for faster recall next time']
        : ['Review incorrect items and retry soon'],
    accuracy,
    generatedAt: new Date().toISOString(),
  };
}

function buildIdempotentSummary(
  userId: string,
  sessionId: string,
  storedSummary: string | null,
  retryResults: ResultPayload[],
): SessionSummary {
  const fallback = buildSummary(userId, sessionId, retryResults);
  const normalizedSummary = storedSummary?.trim();
  if (!normalizedSummary) {
    return fallback;
  }

  const accuracyMatch = normalizedSummary.match(/\((\d{1,3})%\)/);
  const parsedAccuracy = accuracyMatch ? Number(accuracyMatch[1]) : fallback.accuracy;
  const accuracy = Number.isFinite(parsedAccuracy)
    ? Math.max(0, Math.min(100, Math.round(parsedAccuracy)))
    : fallback.accuracy;
  return buildSummaryFromAccuracy(userId, sessionId, normalizedSummary, accuracy);
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  let claimedCompletion: {
    userId: string;
    sessionId: string;
    claimedAt: string;
    finalized: boolean;
  } | null = null;

  try {
    const bodyResult = await readJsonBody(request);
    if (!bodyResult.ok) {
      return jsonError(bodyResult.error, 400);
    }

    const body = bodyResult.value as CompleteRequest;
    const userIdResult = requireStringField(body, 'userId');
    const sessionIdResult = requireStringField(body, 'sessionId');

    if (!userIdResult.ok || !sessionIdResult.ok) {
      return jsonError('Missing userId or sessionId.', 400);
    }

    const selectedUser = matchSelectedUser(cookies, userIdResult.value);
    if (!selectedUser.ok) {
      return jsonError(selectedUser.error, selectedUser.status);
    }

    const userId = selectedUser.userId;
    const sessionId = sessionIdResult.value;
    const results = parseResults(body.results);

    if (!results) {
      return jsonError('Missing or invalid results.', 400);
    }

    const completionClaim = await claimSessionCompletion(userId, sessionId);
    if (completionClaim.status === 'not_found') {
      return jsonError('Session not found.', 404);
    }
    if (completionClaim.status === 'busy') {
      return jsonError('Session completion is already in progress.', 409);
    }
    if (completionClaim.status === 'already_completed') {
      return json({
        ok: true,
        state: 'done',
        summary: buildIdempotentSummary(
          userId,
          sessionId,
          completionClaim.session.summary,
          results,
        ),
        xp: null,
      });
    }
    claimedCompletion = {
      userId,
      sessionId,
      claimedAt: completionClaim.claimedAt,
      finalized: false,
    };

    await insertExerciseResults({
      userId,
      sessionId,
      completionClaimedAt: claimedCompletion.claimedAt,
      mode: 'practice',
      results: results.map((result) => ({
        exerciseId: result.exerciseId,
        answerText: result.answerText,
        isCorrect: result.isCorrect,
      })),
    });

    const summary = buildSummary(userId, sessionId, results);
    const journalUpdateTask = async () => {
      const [progressJournal, user] = await Promise.all([
        getProgressJournal(userId),
        getUserById(userId),
      ]);
      if (!user) {
        return;
      }

      const journalResult = await generateUpdatedJournal({
        currentJournal: progressJournal,
        sessionSummary: summary,
        sessionMeta: {
          category: 'practice_review',
          topic: 'practice_review',
          exerciseTypes: [],
          keyPhrases: [],
        },
        userLevel: user.level,
      });
      await updateProgressJournal(userId, journalResult.journal);
      await recordUsageEvent({
        userId,
        sessionId,
        model: journalResult.tokenUsage.model,
        tokensIn: journalResult.tokenUsage.tokensIn,
        tokensOut: journalResult.tokenUsage.tokensOut,
      });
    };
    const completedSession = await completeSessionRecord(sessionId, {
      summary: summary.summary,
      completionClaimedAt: claimedCompletion.claimedAt,
    });
    if (!completedSession) {
      claimedCompletion = null;
      return jsonError('Session completion is already in progress.', 409);
    }
    claimedCompletion.finalized = true;

    try {
      runBackgroundTask('practice-complete-journal-update', journalUpdateTask, {
        route: 'api/practice/complete',
        sessionId,
        userId,
      });
    } catch (telemetryError) {
      console.error('[api/practice/complete] post-completion telemetry failed (non-fatal)', {
        error: telemetryError,
        sessionId,
        userId,
      });
    }

    let xpBreakdown: Awaited<ReturnType<typeof processSessionCompletion>> | null = null;
    try {
      const maxCombo = calculateMaxCombo(results);
      xpBreakdown = await processSessionCompletion(userId, sessionId, results, maxCombo);
    } catch (xpError) {
      console.error('[api/practice/complete] xp processing failed (non-fatal)', {
        error: xpError,
        sessionId,
        userId,
      });
    }

    return json({ ok: true, state: 'done', summary, xp: xpBreakdown });
  } catch (error) {
    if (claimedCompletion && !claimedCompletion.finalized) {
      await resetSessionCompletionClaim(
        claimedCompletion.userId,
        claimedCompletion.sessionId,
        claimedCompletion.claimedAt,
      );
    }
    console.error('[api/practice/complete] failed', { error });
    return json({ ok: false, error: 'Failed to complete practice session.' }, { status: 500 });
  }
};
