import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { SessionSummary } from '$lib/types';
import {
  completeSessionRecord,
  getProgressJournal,
  getUserById,
  insertExerciseResults,
  updateProgressJournal,
} from '$lib/server/db';
import { generateUpdatedJournal } from '$lib/server/ai';
import { recordUsageEvent } from '$lib/server/token-limiter';
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

function runJournalUpdateInBackground(
  userId: string,
  sessionId: string,
  summary: SessionSummary,
): void {
  void (async () => {
    try {
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
    } catch (journalError) {
      console.error('[api/practice/complete] journal update failed (non-fatal)', {
        error: journalError,
        sessionId,
        userId,
      });
    }
  })().catch((err) => console.error('[practice/complete] Background journal update failed:', err));
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
      mode: 'practice',
      results: results.map((result) => ({
        exerciseId: result.exerciseId,
        answerText: result.answerText,
        isCorrect: result.isCorrect,
      })),
    });

    const summary = buildSummary(userId, sessionId, results);
    runJournalUpdateInBackground(userId, sessionId, summary);
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
