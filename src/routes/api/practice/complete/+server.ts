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
summary: `Practice complete: ${correct}/${total} correct (${accuracy}%).`,
strengths: accuracy >= 70 ? ['Consistent results in review mode'] : ['You completed a full review set'],
weaknesses: accuracy >= 70 ? ['Aim for faster recall next time'] : ['Review incorrect items and retry soon'],
nextSteps: ['Repeat one weak exercise type', 'Do another quick practice set today'],
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
mode: 'practice',
results: results.map((result) => ({
exerciseId: result.exerciseId,
answerText: result.answerText,
isCorrect: result.isCorrect
}))
});

const summary = buildSummary(userId, sessionId, results);
await completeSessionRecord({ sessionId, summary: summary.summary });

return json({ ok: true, state: 'done', summary });
} catch (error) {
console.error('[api/practice/complete] failed', { error });
return json({ ok: false, error: 'Failed to complete practice session.' }, { status: 500 });
}
};
