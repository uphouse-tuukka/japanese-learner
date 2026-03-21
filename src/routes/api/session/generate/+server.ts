import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateSessionPlan } from '$lib/server/ai';
import {
  attachExercisesToSession,
  createSessionRecord,
  deleteStaleGhostSessions,
  getExerciseResultsForUser,
  getSessionsForUser,
} from '$lib/server/db';
import { checkBudget, recordUsageEvent } from '$lib/server/token-limiter';
import { getUser } from '$lib/server/users';
import type { Exercise, Lesson, Session, SessionMeta } from '$lib/types';

type GenerateRequest = {
  userId?: string;
  exerciseCount?: number;
};

type GenerateResponse = {
  ok: boolean;
  state: 'active' | 'budget_exhausted';
  session: Session | null;
  lesson: Lesson | null;
  exercises: Exercise[];
  budgetInfo?: Awaited<ReturnType<typeof checkBudget>>;
  error?: string;
};

type SessionHistoryItem = {
  date: string;
  topic: string;
  accuracy: number;
  strengths: string[];
  weaknesses: string[];
  nextSteps: string[];
  keyPhrases: string[];
};

function parseSessionMeta(summary: string | null): SessionMeta | null {
  if (!summary) {
    return null;
  }
  try {
    const parsed = JSON.parse(summary) as Partial<SessionMeta>;
    if (
      typeof parsed.summaryText !== 'string' ||
      typeof parsed.topic !== 'string' ||
      typeof parsed.accuracy !== 'number' ||
      !Array.isArray(parsed.strengths) ||
      !Array.isArray(parsed.weaknesses) ||
      !Array.isArray(parsed.nextSteps) ||
      !Array.isArray(parsed.exerciseTypes) ||
      !Array.isArray(parsed.keyPhrases)
    ) {
      return null;
    }
    return {
      summaryText: parsed.summaryText,
      topic: parsed.topic,
      accuracy: parsed.accuracy,
      strengths: parsed.strengths.map((item) => String(item)),
      weaknesses: parsed.weaknesses.map((item) => String(item)),
      nextSteps: parsed.nextSteps.map((item) => String(item)),
      exerciseTypes: parsed.exerciseTypes.map((item) => String(item)),
      keyPhrases: parsed.keyPhrases.map((item) => String(item)),
    };
  } catch {
    return null;
  }
}

function legacySummaryToHistory(summary: string): SessionHistoryItem {
  return {
    date: new Date().toISOString(),
    topic: 'travel_japanese',
    accuracy: 0,
    strengths: [],
    weaknesses: [],
    nextSteps: [],
    keyPhrases: summary.trim() ? [summary.trim().slice(0, 120)] : [],
  };
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = (await request.json()) as GenerateRequest;
    const userId = String(body.userId ?? '').trim();
    const exerciseCount = Math.min(Math.max(Number(body.exerciseCount ?? 6), 4), 12);

    if (!userId) {
      return json({ ok: false, error: 'Missing userId.' }, { status: 400 });
    }

    await deleteStaleGhostSessions(userId);

    const budgetCheck = await checkBudget(userId);
    if (!budgetCheck.allowed) {
      const response: GenerateResponse = {
        ok: true,
        state: 'budget_exhausted',
        session: null,
        lesson: null,
        exercises: [],
        budgetInfo: budgetCheck,
      };
      return json(response, { status: 429 });
    }

    const user = await getUser(userId);
    if (!user) {
      return json({ ok: false, error: 'User not found.' }, { status: 404 });
    }

    const priorSessions = await getSessionsForUser(userId, 10);
    const parsedSessionHistory: SessionHistoryItem[] = priorSessions
      .map((session) => {
        const parsedMeta = parseSessionMeta(session.summary);
        if (!parsedMeta) {
          return null;
        }
        return {
          date: session.createdAt,
          topic: parsedMeta.topic,
          accuracy: parsedMeta.accuracy,
          strengths: parsedMeta.strengths,
          weaknesses: parsedMeta.weaknesses,
          nextSteps: parsedMeta.nextSteps,
          keyPhrases: parsedMeta.keyPhrases,
        };
      })
      .filter((item): item is SessionHistoryItem => item !== null);

    const sessionHistory: SessionHistoryItem[] = priorSessions
      .map((session) => {
        const parsedMeta = parseSessionMeta(session.summary);
        if (parsedMeta) {
          return {
            date: session.createdAt,
            topic: parsedMeta.topic,
            accuracy: parsedMeta.accuracy,
            strengths: parsedMeta.strengths,
            weaknesses: parsedMeta.weaknesses,
            nextSteps: parsedMeta.nextSteps,
            keyPhrases: parsedMeta.keyPhrases,
          };
        }
        if (session.summary && session.summary.trim()) {
          const legacy = legacySummaryToHistory(session.summary);
          return {
            ...legacy,
            date: session.createdAt,
          };
        }
        return null;
      })
      .filter((item): item is SessionHistoryItem => item !== null);

    const latestParsedHistory = parsedSessionHistory.slice(0, 5);
    const recentAccuracy = latestParsedHistory.length
      ? Math.round(
          latestParsedHistory.reduce((sum, item) => sum + item.accuracy, 0) /
            latestParsedHistory.length,
        )
      : undefined;
    const coveredTopics = Array.from(
      new Set(latestParsedHistory.map((item) => item.topic.trim()).filter(Boolean)),
    );

    const exerciseResults = await getExerciseResultsForUser(userId);
    const totalResultCount = exerciseResults.length;
    const totalCorrectCount = exerciseResults.filter((item) => item.isCorrect).length;
    const overallAccuracy =
      totalResultCount > 0 ? Math.round((totalCorrectCount / totalResultCount) * 100) : 0;
    const byExercise = new Map<string, { total: number; correct: number }>();
    for (const row of exerciseResults) {
      const current = byExercise.get(row.exerciseId) ?? {
        total: 0,
        correct: 0,
      };
      current.total += 1;
      if (row.isCorrect) {
        current.correct += 1;
      }
      byExercise.set(row.exerciseId, current);
    }
    const weakExerciseIds: string[] = [];
    const strongExerciseIds: string[] = [];
    for (const [exerciseId, stats] of byExercise.entries()) {
      if (stats.total < 2) {
        continue;
      }
      const exerciseAccuracy = Math.round((stats.correct / stats.total) * 100);
      if (exerciseAccuracy < 50) {
        weakExerciseIds.push(exerciseId);
      }
      if (exerciseAccuracy >= 80) {
        strongExerciseIds.push(exerciseId);
      }
    }
    const recentWrongAnswers = exerciseResults
      .filter((item) => !item.isCorrect && item.answerText.trim())
      .slice(0, 5)
      .map((item) => item.answerText.trim());

    const plan = await generateSessionPlan({
      userId: user.id,
      userName: user.name,
      userLevel: user.level,
      exerciseCount,
      sessionHistory,
      recentAccuracy,
      coveredTopics,
      totalSessionCount: priorSessions.length,
      performanceInsights: {
        overallAccuracy,
        weakExerciseIds,
        strongExerciseIds,
        recentWrongAnswers,
      },
    });

    const session = await createSessionRecord({
      userId,
      mode: 'ai',
      status: 'planned',
      model: plan.model,
      tokenInput: plan.tokenUsage.input,
      tokenOutput: plan.tokenUsage.output,
    });

    await attachExercisesToSession(session.id, plan.exercises);
    await recordUsageEvent({
      userId,
      sessionId: session.id,
      model: plan.model,
      tokensIn: plan.tokenUsage.input,
      tokensOut: plan.tokenUsage.output,
    });

    const response: GenerateResponse = {
      ok: true,
      state: 'active',
      session,
      lesson: plan.lesson,
      exercises: plan.exercises,
    };
    return json(response);
  } catch (error) {
    console.error('[api/session/generate] failed', { error });
    return json({ ok: false, error: 'Failed to generate AI teaching session.' }, { status: 500 });
  }
};
