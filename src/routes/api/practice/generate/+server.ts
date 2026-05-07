import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { jsonError, readJsonBody, requireStringField } from '$lib/server/api';
import {
  attachExercisesToSession,
  createSessionRecord,
  deleteStaleGhostSessions,
} from '$lib/server/db';
import { getDebugExercises } from '$lib/server/debug-exercises';
import { buildPracticeSession } from '$lib/server/practice';
import { matchSelectedUser } from '$lib/server/selected-user';
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

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const bodyResult = await readJsonBody(request);
    if (!bodyResult.ok) {
      return jsonError(bodyResult.error, 400);
    }

    const body = bodyResult.value as GenerateRequest;
    const userIdResult = requireStringField(body, 'userId');
    if (!userIdResult.ok) {
      return jsonError('Missing userId.', 400);
    }

    const selectedUser = matchSelectedUser(cookies, userIdResult.value);
    if (!selectedUser.ok) {
      return jsonError(selectedUser.error, selectedUser.status);
    }

    const userId = selectedUser.userId;
    const exerciseCount = typeof body.exerciseCount === 'number' ? body.exerciseCount : undefined;
    const debugExerciseTypeValue =
      typeof body.debugExerciseType === 'string' ? body.debugExerciseType.trim() : undefined;
    const debugExerciseType =
      dev && debugExerciseTypeValue && isExerciseType(debugExerciseTypeValue)
        ? debugExerciseTypeValue
        : undefined;

    if (dev && debugExerciseTypeValue && !debugExerciseType) {
      return jsonError('Invalid debugExerciseType.', 400);
    }

    await deleteStaleGhostSessions(userId);

    if (debugExerciseType) {
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
