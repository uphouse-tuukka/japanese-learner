import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jsonError, readJsonBody, requireStringField } from '$lib/server/api';
import { matchSelectedUser } from '$lib/server/selected-user';
import type { SessionSummary } from '$lib/types';
import {
  completeSessionRecord,
  getProgressJournal,
  getUserById,
  insertExerciseResults,
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

  return {
    sessionId,
    userId,
    summary: `Practice complete: ${correct}/${total} correct (${accuracy}%).`,
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

export const POST: RequestHandler = async ({ request, cookies }) => {
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

    await insertExerciseResults({
      userId,
      sessionId,
      mode: 'practice',
      results: results.map((result) => ({
        exerciseId: result.exerciseId,
        answerText: result.answerText,
        isCorrect: result.isCorrect,
      })),
    });

    const summary = buildSummary(userId, sessionId, results);
    runBackgroundTask(
      'practice-complete-journal-update',
      async () => {
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
      },
      { route: 'api/practice/complete', sessionId, userId },
    );
    await completeSessionRecord(sessionId, { summary: summary.summary });

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
    console.error('[api/practice/complete] failed', { error });
    return json({ ok: false, error: 'Failed to complete practice session.' }, { status: 500 });
  }
};
