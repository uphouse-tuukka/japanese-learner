import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { SessionSummary } from '$lib/types';
import { completeSessionRecord, insertExerciseResults } from '$lib/server/db';

type ResultPayload = {
exerciseId: string;
answerText: string;
isCorrect: boolean;
};

type CompleteRequest = {
userId?: string;
sessionId?: string;
results?: ResultPayload[];
};

function buildSummary(userId: string, sessionId: string, results: ResultPayload[]): SessionSummary {
const total = results.length;
const correct = results.filter((result) => result.isCorrect).length;
const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

return {
sessionId,
userId,
summary: `You answered ${correct} out of ${total} correctly (${accuracy}%).`,
strengths: accuracy >= 70 ? ['Good recall of basic sentence patterns'] : ['You completed the session'],
weaknesses:
accuracy >= 70
? ['Work on speed and confidence']
: ['Review core vocabulary and repeat short exercises'],
nextSteps: ['Review mistakes once', 'Do one short session tomorrow', 'Keep your streak alive'],
accuracy,
generatedAt: new Date().toISOString()
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
mode: 'ai',
results: results.map((result) => ({
exerciseId: result.exerciseId,
answerText: result.answerText,
isCorrect: result.isCorrect
}))
});

const summary = buildSummary(userId, sessionId, results);
await completeSessionRecord(sessionId, { summary: summary.summary });

return json({ ok: true, state: 'done', summary });
} catch (error) {
console.error('[api/session/complete] failed', { error });
return json({ ok: false, error: 'Failed to complete session.' }, { status: 500 });
}
};
