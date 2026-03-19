import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateSessionPlan } from '$lib/server/ai';
import {
attachExercisesToSession,
createSessionRecord,
getSessionsForUser
} from '$lib/server/db';
import { checkBudget, recordUsageEvent } from '$lib/server/token-limiter';
import { getUser } from '$lib/server/users';
import type { Exercise, Lesson, Session } from '$lib/types';

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

export const POST: RequestHandler = async ({ request }) => {
try {
const body = (await request.json()) as GenerateRequest;
const userId = String(body.userId ?? '').trim();
const exerciseCount = Math.min(Math.max(Number(body.exerciseCount ?? 6), 4), 12);

if (!userId) {
return json({ ok: false, error: 'Missing userId.' }, { status: 400 });
}

const budgetCheck = await checkBudget(userId);
if (!budgetCheck.allowed) {
const response: GenerateResponse = {
ok: true,
state: 'budget_exhausted',
session: null,
lesson: null,
exercises: [],
budgetInfo: budgetCheck
};
return json(response, { status: 429 });
}

const user = await getUser(userId);
if (!user) {
return json({ ok: false, error: 'User not found.' }, { status: 404 });
}

const priorSessions = await getSessionsForUser(userId, 5);
const priorSummaries = priorSessions
.map((session) => session.summary ?? '')
.filter(Boolean)
.slice(-5);

const plan = await generateSessionPlan({
userId: user.id,
userName: user.name,
userLevel: user.level,
exerciseCount,
priorSummaries
});

const session = await createSessionRecord({
userId,
mode: 'ai',
status: 'planned',
model: plan.model,
tokenInput: plan.tokenUsage.input,
tokenOutput: plan.tokenUsage.output
});

await attachExercisesToSession(session.id, plan.exercises);
await recordUsageEvent({
userId,
sessionId: session.id,
model: plan.model,
tokensIn: plan.tokenUsage.input,
tokensOut: plan.tokenUsage.output
});

const response: GenerateResponse = {
ok: true,
state: 'active',
session,
lesson: plan.lesson,
exercises: plan.exercises
};
return json(response);
} catch (error) {
console.error('[api/session/generate] failed', { error });
return json({ ok: false, error: 'Failed to generate AI teaching session.' }, { status: 500 });
}
};
