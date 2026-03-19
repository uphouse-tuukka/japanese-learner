import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { attachExercisesToSession, createSessionRecord, getRandomExercises } from '$lib/server/db';
import { ensureSeedExercisesLoaded } from '$lib/server/seed';

type GenerateRequest = {
userId?: string;
exerciseCount?: number;
};

export const POST: RequestHandler = async ({ request }) => {
try {
const body = (await request.json()) as GenerateRequest;
const userId = String(body.userId ?? '').trim();
const exerciseCount = Math.min(Math.max(Number(body.exerciseCount ?? 6), 1), 12);

if (!userId) {
return json({ ok: false, error: 'Missing userId.' }, { status: 400 });
}

await ensureSeedExercisesLoaded();
const exercises = await getRandomExercises(exerciseCount);
if (exercises.length === 0) {
return json({ ok: false, error: 'No exercises available.' }, { status: 500 });
}

const session = await createSessionRecord({
userId,
mode: 'ai',
status: 'planned',
model: 'seed'
});
await attachExercisesToSession(session.id, exercises);

return json({ ok: true, state: 'active', session, exercises });
} catch (error) {
console.error('[api/session/generate] failed', { error });
return json({ ok: false, error: 'Failed to generate session.' }, { status: 500 });
}
};
