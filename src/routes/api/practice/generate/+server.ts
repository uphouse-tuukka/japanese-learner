import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import {
  attachExercisesToSession,
  createSessionRecord,
  deleteStaleGhostSessions,
} from '$lib/server/db';
import { getDebugExercises } from '$lib/server/debug-exercises';
import { buildPracticeSession } from '$lib/server/practice';
import type { ExerciseType } from '$lib/types';

type GenerateRequest = {
  userId?: string;
  exerciseCount?: number;
  debugExerciseType?: string;
};

const EXERCISE_TYPES: ExerciseType[] = [
  'multiple_choice',
  'translation',
  'fill_blank',
  'reorder',
  'reading',
  'listening',
];

function isExerciseType(value: string): value is ExerciseType {
  return EXERCISE_TYPES.includes(value as ExerciseType);
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = (await request.json()) as GenerateRequest;
    const userId = String(body.userId ?? '').trim();
    const exerciseCount = typeof body.exerciseCount === 'number' ? body.exerciseCount : undefined;
    const debugExerciseType =
      typeof body.debugExerciseType === 'string' ? body.debugExerciseType.trim() : undefined;

    if (!userId) {
      return json({ ok: false, error: 'Missing userId.' }, { status: 400 });
    }

    if (debugExerciseType && dev && !isExerciseType(debugExerciseType)) {
      return json({ ok: false, error: 'Invalid debugExerciseType.' }, { status: 400 });
    }

    await deleteStaleGhostSessions(userId);

    if (debugExerciseType && dev && isExerciseType(debugExerciseType)) {
      const debugExercises = getDebugExercises(debugExerciseType, exerciseCount ?? 6);
      const session = await createSessionRecord({
        userId,
        mode: 'practice',
        status: 'planned',
        model: 'debug',
      });
      await attachExercisesToSession(session.id, debugExercises);

      return json({
        ok: true,
        state: 'active',
        session,
        lesson: null,
        exercises: debugExercises,
      });
    }

    const practicePlan = await buildPracticeSession(userId, { exerciseCount });
    const session = await createSessionRecord({
      userId,
      mode: 'practice',
      status: 'planned',
      model: practicePlan.model,
    });
    await attachExercisesToSession(session.id, practicePlan.exercises);

    return json({
      ok: true,
      state: 'active',
      session,
      lesson: practicePlan.lesson,
      exercises: practicePlan.exercises,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate practice session.';
    console.error('[api/practice/generate] failed', { error });
    return json({ ok: false, error: message }, { status: 500 });
  }
};
