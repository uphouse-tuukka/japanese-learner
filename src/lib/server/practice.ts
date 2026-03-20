import { randomUUID } from "node:crypto";
import { getDb } from "$lib/server/db";
import type { Exercise, SessionPlan } from "$lib/types";

type PracticeOptions = {
  exerciseCount?: number;
  now?: Date;
};

type CandidateExercise = {
  exercise: Exercise;
  wrongCount: number;
  correctCount: number;
  lastSeenAt: string | null;
};

function requireUserId(userId: string): string {
  const normalized = userId.trim();
  if (!normalized) {
    throw new Error("[practice] userId is required");
  }
  return normalized;
}

export function toExerciseCount(requested?: number): number {
  const fallback = 6;
  if (typeof requested !== "number" || !Number.isFinite(requested)) {
    return fallback;
  }
  return Math.min(12, Math.max(4, Math.round(requested)));
}

export function scoreCandidate(item: CandidateExercise): number {
  let score = 1;
  score += item.wrongCount * 5;
  score += Math.max(0, 3 - item.correctCount);
  if (!item.lastSeenAt) score += 3;
  return score;
}

export function pickTopExercises(
  candidates: CandidateExercise[],
  target: number,
): Exercise[] {
  return candidates
    .slice()
    .sort((a, b) => {
      const scoreDiff = scoreCandidate(b) - scoreCandidate(a);
      if (scoreDiff !== 0) return scoreDiff;
      const aTime = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
      const bTime = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
      return aTime - bTime;
    })
    .slice(0, target)
    .map((item) => item.exercise);
}

async function getPracticeCandidates(
  userId: string,
): Promise<CandidateExercise[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT
e.id,
e.content_json,
SUM(CASE WHEN r.is_correct = 0 THEN 1 ELSE 0 END) AS wrong_count,
SUM(CASE WHEN r.is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
MAX(r.created_at) AS last_seen_at
FROM user_exercise_results r
JOIN sessions s ON s.id = r.session_id
JOIN exercises e ON e.id = r.exercise_id
WHERE r.user_id = ?
  AND s.user_id = ?
  AND s.mode = 'ai'
  AND s.status = 'completed'
GROUP BY e.id, e.content_json
ORDER BY datetime(last_seen_at) DESC
`,
    args: [userId, userId],
  });

  return (result.rows as Array<Record<string, unknown>>)
    .map((row): CandidateExercise | null => {
      try {
        const exercise = JSON.parse(String(row.content_json)) as Exercise;
        return {
          exercise,
          wrongCount: Number(row.wrong_count ?? 0),
          correctCount: Number(row.correct_count ?? 0),
          lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
        };
      } catch {
        return null;
      }
    })
    .filter((row): row is CandidateExercise => row !== null);
}

export async function buildPracticeSession(
  userId: string,
  options: PracticeOptions = {},
): Promise<SessionPlan> {
  const validatedUserId = requireUserId(userId);
  const now = options.now ?? new Date();
  const targetCount = toExerciseCount(options.exerciseCount);

  const candidates = await getPracticeCandidates(validatedUserId);
  if (candidates.length === 0) {
    throw new Error(
      "No completed AI sessions found yet. Finish at least one AI learning session before practice mode.",
    );
  }

  const exercises = pickTopExercises(
    candidates,
    Math.min(targetCount, candidates.length),
  );
  if (exercises.length === 0) {
    throw new Error(
      "No practice exercises available from your completed AI sessions yet.",
    );
  }

  const plan: SessionPlan = {
    id: `practice-${randomUUID()}`,
    userId: validatedUserId,
    mode: "practice",
    createdAt: now.toISOString(),
    model: "practice-review",
    lesson: {
      topic: "Review from your previous AI sessions",
      explanation:
        "This practice session reuses exercises from your completed AI lessons. We prioritize items you previously answered incorrectly so you can improve weak spots.",
      culturalNote:
        "Repetition and correction are important in Japanese learning. Short, frequent review sessions are more effective than cramming.",
      keyPhrases: [
        {
          japanese: "復習",
          romaji: "fukushuu",
          english: "review",
          usage: "Used for studying material again to improve retention.",
        },
        {
          japanese: "もう一度",
          romaji: "mou ichido",
          english: "one more time",
          usage: "Use when you want to repeat an exercise or phrase.",
        },
        {
          japanese: "大丈夫です",
          romaji: "daijoubu desu",
          english: "It is okay / I am fine",
          usage: "Common reassuring phrase useful in travel conversations.",
        },
      ],
    },
    exercises,
    tokenUsage: {
      input: 0,
      output: 0,
    },
    metadata: {
      focus: "review_past_ai_session_exercises",
      exerciseCount: exercises.length,
      selectionStrategy: "prioritize_incorrect_then_least_recent",
      candidateCount: candidates.length,
    },
  };

  console.info("[practice] built practice session", {
    userId: validatedUserId,
    sessionId: plan.id,
    exerciseCount: exercises.length,
    candidateCount: candidates.length,
  });

  return plan;
}
