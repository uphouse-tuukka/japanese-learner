import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Exercise, SessionMeta, SessionSummary } from '$lib/types';
import {
	completeSessionRecord,
	getSessionExercises,
	getUserById,
	insertExerciseResults
} from '$lib/server/db';
import { generateSessionSummary } from '$lib/server/ai';
import { checkBudget, recordUsageEvent } from '$lib/server/token-limiter';

type ResultPayload = {
exerciseId: string;
answerText: string;
isCorrect: boolean;
};

type CompleteRequest = {
userId?: string;
sessionId?: string;
results?: ResultPayload[];
lessonTopic?: string;
keyPhrases?: string[];
};

function buildFallbackSummary(userId: string, sessionId: string, results: ResultPayload[]): SessionSummary {
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

function toStringList(value: unknown): string[] {
if (!Array.isArray(value)) {
return [];
}
return value.map((item) => String(item).trim()).filter(Boolean);
}

function inferLessonTopic(exercises: Exercise[], fallback = 'travel_japanese'): string {
const firstTitle = exercises[0]?.title?.trim();
if (firstTitle) {
return firstTitle;
}
const firstContext = exercises[0]?.englishContext?.trim();
if (firstContext) {
return firstContext;
}
return fallback;
}

function deriveKeyPhrasesFromExercises(exercises: Exercise[]): string[] {
const seen = new Set<string>();
for (const exercise of exercises) {
const romaji = exercise.romaji?.trim();
if (romaji) {
seen.add(romaji);
}
if (seen.size >= 8) {
break;
}
}
return Array.from(seen);
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

		const user = await getUserById(userId);
		const sessionExercises = await getSessionExercises(sessionId);
		const exercises = sessionExercises.map((item) => item.exercise);
		const lessonTopic = String(body.lessonTopic ?? '').trim() || inferLessonTopic(exercises);
		const requestKeyPhrases = toStringList(body.keyPhrases);
		const keyPhrases = requestKeyPhrases.length > 0 ? requestKeyPhrases.slice(0, 10) : deriveKeyPhrasesFromExercises(exercises);
		const exerciseTypes = Array.from(new Set(exercises.map((exercise) => exercise.type)));

		let summary: SessionSummary;
		let summaryTokenInput = 0;
		let summaryTokenOutput = 0;
		const budgetCheck = await checkBudget(userId);
		if (!budgetCheck.allowed || !user || exercises.length === 0) {
			summary = buildFallbackSummary(userId, sessionId, results);
		} else {
try {
const aiResult = await generateSessionSummary({
sessionId,
userId,
userLevel: user.level,
lessonTopic,
exercises,
results
});
				summary = aiResult.summary;
				summaryTokenInput = aiResult.tokenUsage.tokensIn;
				summaryTokenOutput = aiResult.tokenUsage.tokensOut;
				await recordUsageEvent({
					userId,
					sessionId,
					model: aiResult.tokenUsage.model,
tokensIn: aiResult.tokenUsage.tokensIn,
tokensOut: aiResult.tokenUsage.tokensOut
});
} catch (error) {
console.error('[api/session/complete] ai summary failed, using fallback', { error, sessionId, userId });
summary = buildFallbackSummary(userId, sessionId, results);
}
		}

		await completeSessionRecord(sessionId, {
			summary: JSON.stringify({
				summaryText: summary.summary,
				topic: lessonTopic,
				accuracy: summary.accuracy,
				strengths: summary.strengths,
				weaknesses: summary.weaknesses,
				nextSteps: summary.nextSteps,
				exerciseTypes,
				keyPhrases
			} satisfies SessionMeta),
			tokenInput: summaryTokenInput,
			tokenOutput: summaryTokenOutput
		});
return json({ ok: true, state: 'done', summary });
} catch (error) {
console.error('[api/session/complete] failed', { error });
return json({ ok: false, error: 'Failed to complete session.' }, { status: 500 });
}
};
