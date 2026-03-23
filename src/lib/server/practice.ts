import { randomUUID } from 'node:crypto';
import { getDb } from '$lib/server/db';
import type { Exercise, SessionPlan } from '$lib/types';

type PracticeOptions = {
  exerciseCount?: number;
  now?: Date;
};

type CandidateExercise = {
  exercise: Exercise;
  wrongCount: number;
  inRecentSessions?: boolean;
  correctCount?: number;
  lastSeenAt?: string | null;
};

function requireUserId(userId: string): string {
  const normalized = userId.trim();
  if (!normalized) {
    throw new Error('[practice] userId is required');
  }
  return normalized;
}

export function toExerciseCount(requested?: number): number {
  const fallback = 6;
  if (typeof requested !== 'number' || !Number.isFinite(requested)) {
    return fallback;
  }
  return Math.min(12, Math.max(4, Math.round(requested)));
}

function getCandidateWeight(item: CandidateExercise): number {
  let weight = 1;
  weight += item.wrongCount * 2;
  if (item.inRecentSessions) {
    weight += 1;
  }
  return weight;
}

export function scoreCandidate(item: CandidateExercise): number {
  return getCandidateWeight(item);
}

function shuffleInPlace<T>(items: T[]): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }
}

function pickWeightedExercises(candidates: CandidateExercise[], target: number): Exercise[] {
  const pool = candidates.slice();
  const selected: Exercise[] = [];

  while (pool.length > 0 && selected.length < target) {
    const totalWeight = pool.reduce((sum, item) => sum + getCandidateWeight(item), 0);
    let roll = Math.random() * totalWeight;
    let selectedIndex = 0;

    for (let index = 0; index < pool.length; index += 1) {
      roll -= getCandidateWeight(pool[index]);
      if (roll <= 0) {
        selectedIndex = index;
        break;
      }
    }

    const [picked] = pool.splice(selectedIndex, 1);
    selected.push(picked.exercise);
  }

  shuffleInPlace(selected);
  return selected;
}

export function pickTopExercises(candidates: CandidateExercise[], target: number): Exercise[] {
  return pickWeightedExercises(candidates, target);
}

async function getPracticeCandidates(userId: string): Promise<CandidateExercise[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT
e.id,
e.content_json,
SUM(CASE WHEN r.is_correct = 0 THEN 1 ELSE 0 END) AS wrong_count,
MAX(
  CASE
    WHEN r.session_id IN (
      SELECT id
      FROM sessions
      WHERE user_id = ?
        AND mode = 'ai'
        AND status = 'completed'
      ORDER BY datetime(COALESCE(completed_at, created_at)) DESC
      LIMIT 3
    ) THEN 1
    ELSE 0
  END
) AS in_recent_sessions
FROM user_exercise_results r
JOIN sessions s ON s.id = r.session_id
JOIN exercises e ON e.id = r.exercise_id
WHERE r.user_id = ?
  AND s.user_id = ?
  AND s.mode = 'ai'
  AND s.status = 'completed'
GROUP BY e.id, e.content_json
`,
    args: [userId, userId, userId],
  });

  return (result.rows as Array<Record<string, unknown>>)
    .map((row): CandidateExercise | null => {
      try {
        const exercise = JSON.parse(String(row.content_json)) as Exercise;
        return {
          exercise,
          wrongCount: Number(row.wrong_count ?? 0),
          inRecentSessions: Number(row.in_recent_sessions ?? 0) > 0,
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
      'No completed AI sessions found yet. Finish at least one AI learning session before practice mode.',
    );
  }

  const exercises = pickWeightedExercises(candidates, Math.min(targetCount, candidates.length));
  if (exercises.length === 0) {
    throw new Error('No practice exercises available from your completed AI sessions yet.');
  }

  const plan: SessionPlan = {
    id: `practice-${randomUUID()}`,
    userId: validatedUserId,
    mode: 'practice',
    createdAt: now.toISOString(),
    model: 'practice-review',
    lesson: {
      topic: 'Review from your previous AI sessions',
      explanation:
        'This practice session reuses exercises from your completed AI lessons. Exercises are selected with weighted randomness so weaker and recently practiced items appear more often while keeping variety.',
      culturalNote:
        'Repetition and correction are important in Japanese learning. Short, frequent review sessions are more effective than cramming.',
      keyPhrases: [
        {
          japanese: '復習',
          romaji: 'fukushuu',
          english: 'review',
          usage: 'Used for studying material again to improve retention.',
        },
        {
          japanese: 'もう一度',
          romaji: 'mou ichido',
          english: 'one more time',
          usage: 'Use when you want to repeat an exercise or phrase.',
        },
        {
          japanese: '大丈夫です',
          romaji: 'daijoubu desu',
          english: 'It is okay / I am fine',
          usage: 'Common reassuring phrase useful in travel conversations.',
        },
      ],
    },
    exercises,
    tokenUsage: {
      input: 0,
      output: 0,
    },
    metadata: {
      focus: 'review_past_ai_session_exercises',
      exerciseCount: exercises.length,
      selectionStrategy: 'weighted_random_without_replacement',
      candidateCount: candidates.length,
    },
  };

  console.warn('[practice] built practice session', {
    userId: validatedUserId,
    sessionId: plan.id,
    exerciseCount: exercises.length,
    candidateCount: candidates.length,
  });

  return plan;
}
