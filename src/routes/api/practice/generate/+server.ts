import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { attachExercisesToSession, createSessionRecord } from '$lib/server/db';
import { buildPracticeSession } from '$lib/server/practice';

type GenerateRequest = {
userId?: string;
exerciseCount?: number;
};

export const POST: RequestHandler = async ({ request }) => {
try {
const body = (await request.json()) as GenerateRequest;
const userId = String(body.userId ?? '').trim();
const exerciseCount = typeof body.exerciseCount === 'number' ? body.exerciseCount : undefined;

if (!userId) {
return json({ ok: false, error: 'Missing userId.' }, { status: 400 });
}

const practicePlan = await buildPracticeSession(userId, { exerciseCount });
const session = await createSessionRecord({
userId,
mode: 'practice',
status: 'planned',
model: practicePlan.model
});
await attachExercisesToSession(session.id, practicePlan.exercises);

return json({
ok: true,
state: 'active',
session,
lesson: practicePlan.lesson,
exercises: practicePlan.exercises
});
} catch (error) {
const message = error instanceof Error ? error.message : 'Failed to generate practice session.';
console.error('[api/practice/generate] failed', { error });
return json({ ok: false, error: message }, { status: 500 });
}
};
