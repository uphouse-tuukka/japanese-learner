import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Exercise, SessionMeta, SessionSummary } from '$lib/types';
import {
  completeSessionRecord,
  getProgressJournal,
  getRecentSessionSummaries,
  getSessionExercises,
  getUserById,
  insertExerciseResults,
  updateProgressJournal,
} from '$lib/server/db';
import { generateSessionSummary, generateUpdatedJournal } from '$lib/server/ai';
import { checkBudget, recordUsageEvent } from '$lib/server/token-limiter';
import { processSessionCompletion } from '$lib/server/gamification';

type ResultPayload = {
  exerciseId: string;
  answerText: string;
  isCorrect: boolean;
};

type CompleteRequest = {
  userId?: string;
  sessionId?: string;
  results?: ResultPayload[];
  lessonTopic?: string;
  category?: string;
  keyPhrases?: string[];
  culturalNote?: string;
  localDate?: string;
};

function calculateMaxCombo(results: ResultPayload[]): number {
  let currentCombo = 0;
  let maxCombo = 0;
  for (const result of results) {
    if (result.isCorrect) {
      currentCombo += 1;
      if (currentCombo > maxCombo) {
        maxCombo = currentCombo;
      }
      continue;
    }
    currentCombo = 0;
  }
  return maxCombo;
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

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function inferLessonTopic(exercises: Exercise[], fallback = 'travel_japanese'): string {
  const firstTitle = exercises[0]?.title?.trim();
  if (firstTitle) {
    return firstTitle;
  }
  const firstContext = exercises[0]?.englishContext?.trim();
  if (firstContext) {
    return firstContext;
  }
  return fallback;
}

function deriveKeyPhrasesFromExercises(exercises: Exercise[]): string[] {
  const seen = new Set<string>();
  for (const exercise of exercises) {
    const romaji = exercise.romaji?.trim();
    if (romaji) {
      seen.add(romaji);
    }
    if (seen.size >= 8) {
      break;
    }
  }
  return Array.from(seen);
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = (await request.json()) as CompleteRequest;
    const userId = String(body.userId ?? '').trim();
    const sessionId = String(body.sessionId ?? '').trim();
    const results = Array.isArray(body.results) ? body.results : [];

    if (!userId || !sessionId) {
      return json({ ok: false, error: 'Missing userId or sessionId.' }, { status: 400 });
    }

    await insertExerciseResults({
      userId,
      sessionId,
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
    const requestedLessonTopic = String(body.lessonTopic ?? '').trim();
    const lessonTopic = requestedLessonTopic || inferLessonTopic(exercises);
    const category = String(body.category ?? '').trim() || undefined;
    const culturalNote = String(body.culturalNote ?? '').trim() || undefined;
    const requestKeyPhrases = toStringList(body.keyPhrases);
    const keyPhrases =
      requestKeyPhrases.length > 0
        ? requestKeyPhrases.slice(0, 10)
        : deriveKeyPhrasesFromExercises(exercises);
    const exerciseTypes = Array.from(new Set(exercises.map((exercise) => exercise.type)));

    let summary: SessionSummary;
    let handoffNotes: string[] = [];
    let summaryTokenInput = 0;
    let summaryTokenOutput = 0;
    const budgetCheck = await checkBudget(userId);
    if (!budgetCheck.allowed || !user || exercises.length === 0) {
      summary = buildFallbackSummary(userId, sessionId, results);
      handoffNotes = summary.nextSteps ?? [];
    } else {
      try {
        const progressJournal = await getProgressJournal(userId);
        const recentSessions = await getRecentSessionSummaries(userId, 5);
        const recentSessionsCompact = recentSessions.map((s) => ({
          topic: s.topic,
          accuracy: s.accuracy,
          keyPhrases: s.keyPhrases.slice(0, 5),
          exerciseTypes: s.exerciseTypes,
        }));
        const recentlyRecommendedPromotion = recentSessions.some(
          (s) => s.hadLevelUpRecommendation === true,
        );
        const summaryInput = {
          sessionId,
          userId,
          userLevel: user.level,
          japaneseWritingEnabled: user.japaneseWritingEnabled,
          lessonTopic,
          progressJournal,
          recentSessions: recentSessionsCompact,
          exercises,
          results,
          suppressPromotion: recentlyRecommendedPromotion,
        };
        const aiResult = await generateSessionSummary(summaryInput);
        summary = aiResult.summary;
        handoffNotes = aiResult.handoffNotes;
        summaryTokenInput = aiResult.tokenUsage.tokensIn;
        summaryTokenOutput = aiResult.tokenUsage.tokensOut;
        // Fire-and-forget — do not block the main response on journal generation.
        void generateUpdatedJournal({
          currentJournal: progressJournal,
          sessionSummary: summary,
          sessionMeta: {
            category,
            topic: lessonTopic,
            exerciseTypes,
            keyPhrases,
          },
          userLevel: user.level,
        })
          .then(async (journalResult) => {
            if (!journalResult?.journal) {
              return;
            }
            try {
              await updateProgressJournal(userId, journalResult.journal);
              await recordUsageEvent({
                userId,
                sessionId,
                model: journalResult.tokenUsage.model,
                tokensIn: journalResult.tokenUsage.tokensIn,
                tokensOut: journalResult.tokenUsage.tokensOut,
              });
            } catch (err) {
              console.error('[session/complete] Background journal update failed:', err);
            }
          })
          .catch((journalError) => {
            console.error('[api/session/complete] journal update failed (non-fatal)', {
              error: journalError,
            });
          });
        await recordUsageEvent({
          userId,
          sessionId,
          model: aiResult.tokenUsage.model,
          tokensIn: aiResult.tokenUsage.tokensIn,
          tokensOut: aiResult.tokenUsage.tokensOut,
        });
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

    await completeSessionRecord(sessionId, {
      summary: JSON.stringify({
        summaryText: summary.summary,
        category,
        topic: lessonTopic,
        accuracy: summary.accuracy,
        strengths: summary.strengths,
        weaknesses: summary.weaknesses,
        nextSteps: summary.nextSteps,
        handoffNotes: handoffNotes.length > 0 ? handoffNotes : undefined,
        exerciseTypes,
        keyPhrases,
        culturalNote,
        miniLesson: summary.miniLesson ?? null,
        hadLevelUpRecommendation: !!summary.levelUpRecommendation,
      } satisfies SessionMeta),
      tokenInput: summaryTokenInput,
      tokenOutput: summaryTokenOutput,
    });

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
    console.error('[api/session/complete] failed', { error });
    return json({ ok: false, error: 'Failed to complete session.' }, { status: 500 });
  }
};
