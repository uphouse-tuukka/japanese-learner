import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jsonError, readJsonBody, requireStringField } from '$lib/server/api';
import { matchSelectedUser } from '$lib/server/selected-user';
import type { SessionMeta, SessionReviewIntent, SessionSummary } from '$lib/types';
import {
  claimSessionCompletion,
  completeSessionRecord,
  getLatestCompletedLearningSessionSummary,
  getProgressJournal,
  getRecentSessionSummaries,
  getSession,
  getSessionExercises,
  getUserById,
  insertExerciseResults,
  resetSessionCompletionClaim,
} from '$lib/server/db';
import { generateSessionSummary, generateUpdatedJournal } from '$lib/server/ai';
import { runBackgroundTask } from '$lib/server/background-task';
import { logError } from '$lib/server/logger';
import { persistGeneratedJournal } from '$lib/server/progress-journal';
import { checkBudget, recordUsageEvent } from '$lib/server/token-limiter';
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

function buildFallbackSummary(
  userId: string,
  sessionId: string,
  results: ResultPayload[],
): SessionSummary {
  const total = results.length;
  const correct = results.filter((result) => result.isCorrect).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    sessionId,
    userId,
    summary: `You answered ${correct} out of ${total} correctly (${accuracy}%).`,
    strengths:
      accuracy >= 70 ? ['Good recall of basic sentence patterns'] : ['You completed the session'],
    weaknesses:
      accuracy >= 70
        ? ['Work on speed and confidence']
        : ['Review core vocabulary and repeat short exercises'],
    nextSteps: ['Review mistakes once', 'Do one short session tomorrow', 'Keep your streak alive'],
    accuracy,
    generatedAt: new Date().toISOString(),
  };
}

function deriveLegacyKeyPhrasesFromDetails(
  keyPhraseDetails: NonNullable<SessionMeta['keyPhraseDetails']>,
): string[] {
  return keyPhraseDetails
    .map((phrase) => phrase.japanese ?? phrase.romaji ?? phrase.english)
    .filter((phrase): phrase is string => !!phrase);
}

function buildIdempotentSummary(
  userId: string,
  sessionId: string,
  storedSummary: string | null,
  results: ResultPayload[],
): SessionSummary {
  if (storedSummary) {
    try {
      const meta = JSON.parse(storedSummary) as Partial<SessionMeta>;
      return {
        sessionId,
        userId,
        summary: typeof meta.summaryText === 'string' ? meta.summaryText : storedSummary,
        strengths: Array.isArray(meta.strengths) ? meta.strengths : [],
        weaknesses: Array.isArray(meta.weaknesses) ? meta.weaknesses : [],
        nextSteps: Array.isArray(meta.nextSteps) ? meta.nextSteps : undefined,
        accuracy: typeof meta.accuracy === 'number' ? meta.accuracy : 0,
        generatedAt: new Date().toISOString(),
        miniLesson: meta.miniLesson ?? null,
        levelUpRecommendation: meta.levelUpRecommendation ?? null,
      };
    } catch {
      return {
        ...buildFallbackSummary(userId, sessionId, results),
        summary: storedSummary,
      };
    }
  }

  return buildFallbackSummary(userId, sessionId, results);
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

    const claimedSession = await getSession(sessionId);
    if (
      !claimedSession ||
      claimedSession.userId !== userId ||
      claimedSession.status !== 'completing'
    ) {
      throw new Error('Claimed Learning Session could not be loaded.');
    }
    const plannedCoverage = claimedSession.plannedCoverage;
    if (!plannedCoverage) {
      throw new Error('Learning Session is missing server-owned coverage metadata.');
    }

    await insertExerciseResults({
      userId,
      sessionId,
      completionClaimedAt: claimedCompletion.claimedAt,
      mode: 'ai',
      results: results.map((result) => ({
        exerciseId: result.exerciseId,
        answerText: result.answerText,
        isCorrect: result.isCorrect,
      })),
    });

    const user = await getUserById(userId);
    const sessionExercises = await getSessionExercises(sessionId);
    const exercises = sessionExercises.map((item) => item.exercise);
    const lessonTopic = plannedCoverage.lessonTopic;
    const category = plannedCoverage.category;
    const culturalNote = plannedCoverage.culturalNote;
    const keyPhraseDetails = plannedCoverage.keyPhraseDetails;
    const keyPhrases = deriveLegacyKeyPhrasesFromDetails(plannedCoverage.keyPhraseDetails);
    const exerciseTypes = Array.from(new Set(exercises.map((exercise) => exercise.type)));

    let summary: SessionSummary;
    let handoffNotes: string[] = [];
    let reviewIntents: SessionReviewIntent[] = [];
    let summaryTokenInput = 0;
    let summaryTokenOutput = 0;
    let summaryUsageEvent: {
      model: string;
      tokensIn: number;
      tokensOut: number;
    } | null = null;
    let journalUpdateTask: (() => Promise<void>) | null = null;
    const budgetCheck = await checkBudget(userId);
    if (!budgetCheck.allowed || !user || exercises.length === 0) {
      summary = buildFallbackSummary(userId, sessionId, results);
      handoffNotes = summary.nextSteps ?? [];
    } else {
      try {
        const [progressJournal, recentSessions, previousSessionSummary] = await Promise.all([
          getProgressJournal(userId),
          getRecentSessionSummaries(userId, 5),
          getLatestCompletedLearningSessionSummary(userId),
        ]);
        const recentSessionsCompact = recentSessions.map((s) => ({
          topic: s.topic,
          accuracy: s.accuracy,
          keyPhrases: s.keyPhrases.slice(0, 5),
          exerciseTypes: s.exerciseTypes,
        }));
        const previousSessionRecommendedPromotion =
          previousSessionSummary?.hadLevelUpRecommendation === true;
        const summaryInput = {
          sessionId,
          userId,
          userLevel: user.level,
          japaneseWritingEnabled: user.japaneseWritingEnabled,
          lessonTopic,
          lessonKeyPhrases: plannedCoverage.keyPhraseDetails,
          progressJournal,
          recentSessions: recentSessionsCompact,
          exercises,
          results,
          suppressPromotion: previousSessionRecommendedPromotion,
        };
        const aiResult = await generateSessionSummary(summaryInput);
        summary = aiResult.summary;
        handoffNotes = aiResult.handoffNotes;
        reviewIntents = aiResult.reviewIntents ?? [];
        summaryTokenInput = aiResult.tokenUsage.tokensIn;
        summaryTokenOutput = aiResult.tokenUsage.tokensOut;
        summaryUsageEvent = {
          model: aiResult.tokenUsage.model,
          tokensIn: aiResult.tokenUsage.tokensIn,
          tokensOut: aiResult.tokenUsage.tokensOut,
        };
        journalUpdateTask = async () => {
          const journalResult = await generateUpdatedJournal({
            currentJournal: progressJournal,
            sessionSummary: summary,
            sessionMeta: {
              category,
              topic: lessonTopic,
              exerciseTypes,
              keyPhrases,
            },
            userLevel: user.level,
          });
          await persistGeneratedJournal({
            userId,
            sessionId,
            currentJournal: progressJournal,
            journal: journalResult.journal,
            tokenUsage: journalResult.tokenUsage,
          });
        };
      } catch (error) {
        console.error('[api/session/complete] ai summary failed, using fallback', {
          error,
          sessionId,
          userId,
        });
        summary = buildFallbackSummary(userId, sessionId, results);
        handoffNotes = summary.nextSteps ?? [];
      }
    }

    const completedSession = await completeSessionRecord(sessionId, {
      summary: JSON.stringify({
        summaryText: summary.summary,
        category,
        learningObjectiveId: plannedCoverage.learningObjectiveId,
        topic: lessonTopic,
        accuracy: summary.accuracy,
        strengths: summary.strengths,
        weaknesses: summary.weaknesses,
        nextSteps: summary.nextSteps,
        handoffNotes: handoffNotes.length > 0 ? handoffNotes : undefined,
        reviewIntents: reviewIntents.length > 0 ? reviewIntents : undefined,
        exerciseTypes,
        keyPhrases,
        keyPhraseDetails: keyPhraseDetails.length > 0 ? keyPhraseDetails : undefined,
        culturalNote,
        miniLesson: summary.miniLesson ?? null,
        levelUpRecommendation: summary.levelUpRecommendation ?? null,
        hadLevelUpRecommendation: !!summary.levelUpRecommendation,
        coverageSource: 'server_generated_plan',
      } satisfies SessionMeta),
      tokenInput: summaryTokenInput,
      tokenOutput: summaryTokenOutput,
      completionClaimedAt: claimedCompletion.claimedAt,
    });
    if (!completedSession) {
      claimedCompletion = null;
      return jsonError('Session completion is already in progress.', 409);
    }
    claimedCompletion.finalized = true;

    if (summaryUsageEvent) {
      try {
        await recordUsageEvent({
          userId,
          sessionId,
          model: summaryUsageEvent.model,
          tokensIn: summaryUsageEvent.tokensIn,
          tokensOut: summaryUsageEvent.tokensOut,
        });
      } catch (telemetryError) {
        console.error('[api/session/complete] summary token telemetry failed (non-fatal)', {
          error: telemetryError,
          sessionId,
          userId,
        });
      }
    }

    if (journalUpdateTask) {
      try {
        await runBackgroundTask('session-complete-journal-update', journalUpdateTask, {
          route: 'api/session/complete',
          sessionId,
          userId,
        });
      } catch (error) {
        logError('api/session/complete', 'journal scheduling failed (non-fatal)', {
          error,
          sessionId,
          userId,
        });
      }
    }

    let xpBreakdown: Awaited<ReturnType<typeof processSessionCompletion>> | null = null;
    try {
      const maxCombo = calculateMaxCombo(results);
      xpBreakdown = await processSessionCompletion(userId, sessionId, results, maxCombo);
    } catch (xpError) {
      console.error('[api/session/complete] xp processing failed (non-fatal)', {
        error: xpError,
        sessionId,
        userId,
      });
    }

    return json({
      ok: true,
      state: 'done',
      summary: {
        ...summary,
        levelUpRecommendation: summary.levelUpRecommendation ?? null,
      },
      xp: xpBreakdown,
    });
  } catch (error) {
    if (claimedCompletion && !claimedCompletion.finalized) {
      await resetSessionCompletionClaim(
        claimedCompletion.userId,
        claimedCompletion.sessionId,
        claimedCompletion.claimedAt,
      );
    }
    console.error('[api/session/complete] failed', { error });
    return jsonError('Failed to complete session.', 500);
  }
};
