<script lang="ts">
import { goto } from '$app/navigation';
import { onMount } from 'svelte';
import ProgressBar from '$lib/components/ProgressBar.svelte';
import SessionRenderer from '$lib/components/SessionRenderer.svelte';
import SessionSummary from '$lib/components/SessionSummary.svelte';
import { session, exercises, answers, currentIndex, summary, startSession, answerExercise, nextExercise, completeSession, resetSession } from '$lib/stores/session';
import type { ExerciseAnswerPayload, Session, SessionPlan, SessionSummary as SessionSummaryType } from '$lib/types';
import type { PageData } from './$types';

type GenerateResponse = {
ok: boolean;
session?: Session;
exercises?: SessionPlan['exercises'];
plan?: SessionPlan;
error?: string;
};

type CompleteResponse = {
ok: boolean;
summary?: SessionSummaryType;
error?: string;
};

let { data } = $props<{ data: PageData }>();
let uiState = $state<'loading' | 'active' | 'completing' | 'done' | 'error'>('loading');
let errorMessage = $state('');
let practiceContext = $state<{ topic: string | null; difficulty: number | null }>({ topic: null, difficulty: null });

const total = $derived($exercises.length);
const current = $derived(Math.min($currentIndex + 1, Math.max($exercises.length, 1)));
const exercise = $derived($exercises[$currentIndex] ?? null);

function toSessionAndExercises(payload: GenerateResponse): { session: Session; exercises: SessionPlan['exercises']; metadata: SessionPlan['metadata'] } | null {
if (payload.plan) {
const plan = payload.plan;
const sessionFromPlan: Session = {
id: plan.id,
userId: plan.userId,
mode: 'practice',
status: 'planned',
model: null,
tokenInput: 0,
tokenOutput: 0,
summary: null,
createdAt: plan.createdAt,
completedAt: null
};
return {
session: payload.session ?? sessionFromPlan,
exercises: plan.exercises,
metadata: plan.metadata
};
}

if (payload.session && payload.exercises) {
return {
session: payload.session,
exercises: payload.exercises,
metadata: {
focus: 'practice_review',
exerciseCount: payload.exercises.length,
selectionStrategy: 'practice_api_no_ai'
}
};
}

return null;
}

async function generatePracticeSession(): Promise<void> {
uiState = 'loading';
errorMessage = '';
resetSession();

try {
const params = new URLSearchParams(window.location.search);
const topic = params.get('topic');
const difficulty = params.get('difficulty');

const response = await fetch('/api/practice/generate', {
method: 'POST',
headers: { 'content-type': 'application/json' },
body: JSON.stringify({
topic: topic ?? undefined,
difficulty: difficulty ? Number(difficulty) : undefined
})
});

const payload = (await response.json()) as GenerateResponse;
if (!response.ok || !payload.ok) {
throw new Error(payload.error ?? 'Failed to generate practice session.');
}

const normalized = toSessionAndExercises(payload);
if (!normalized) {
throw new Error('Session plan missing from practice generate response.');
}

startSession(normalized.session, normalized.exercises);
practiceContext = {
topic: (normalized.metadata.topic as string | null | undefined) ?? null,
difficulty: (normalized.metadata.difficulty as number | null | undefined) ?? null
};
uiState = 'active';
} catch (error) {
errorMessage = error instanceof Error ? error.message : 'Failed to generate session.';
uiState = 'error';
}
}

function buildFallbackSummary(): SessionSummaryType {
const totalAnswers = $answers.length;
const correctAnswers = $answers.filter((item) => item.isCorrect).length;
const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

return {
sessionId: $session?.id ?? 'practice-session',
userId: data.user.id,
summary: `Practice complete: ${correctAnswers}/${totalAnswers} correct (${accuracy}%).`,
strengths: accuracy >= 75 ? ['Strong recall in this practice run.'] : ['You completed the full practice session.'],
weaknesses: accuracy < 75 ? ['Review missed answers from this session.'] : ['No major weak areas detected.'],
nextSteps: ['Back to Practice Hub', 'Try AI Session for fresh content'],
accuracy,
generatedAt: new Date().toISOString()
};
}

async function completePracticeSession(): Promise<void> {
if (!$session) {
errorMessage = 'Missing practice session.';
uiState = 'error';
return;
}

uiState = 'completing';

try {
const response = await fetch('/api/practice/complete', {
method: 'POST',
headers: { 'content-type': 'application/json' },
body: JSON.stringify({
session_id: $session.id,
results: $answers.map((result) => ({
exerciseId: result.exerciseId,
answerText: result.answerText,
isCorrect: result.isCorrect
}))
})
});

const payload = (await response.json()) as CompleteResponse;
if (!response.ok || !payload.ok || !payload.summary) {
throw new Error(payload.error ?? 'Failed to complete practice session.');
}

completeSession(payload.summary);
uiState = 'done';
} catch (error) {
console.warn('[practice/session] Using local fallback summary', { error });
completeSession(buildFallbackSummary());
uiState = 'done';
}
}

async function handleAnswer(payload: ExerciseAnswerPayload): Promise<void> {
answerExercise($currentIndex, {
exerciseId: payload.exerciseId,
answerText: payload.answerText,
isCorrect: payload.isCorrect
});

const isLastExercise = $currentIndex >= $exercises.length - 1;
if (!isLastExercise) {
nextExercise();
return;
}

await completePracticeSession();
}

onMount(async () => {
await generatePracticeSession();
});
</script>

<main class="page-transition practice-session">
<header class="card intro">
<p class="mode-badge">Practice Mode · No AI tokens used</p>
<h1>Practice session</h1>
<p>Working set for {data.user.name} based on your existing exercises only.</p>
{#if practiceContext.topic || practiceContext.difficulty}
<small>
Focus: {practiceContext.topic ?? 'mixed'}
{#if practiceContext.difficulty} · Difficulty {practiceContext.difficulty}{/if}
</small>
{/if}
</header>

{#if uiState === 'loading'}
<section class="card">
<p>Preparing your zero-AI practice set…</p>
</section>
{:else if uiState === 'active' || uiState === 'completing'}
<section class="session-stack">
<ProgressBar current={current} total={total} />
{#if exercise}
<SessionRenderer exercise={exercise} onAnswer={handleAnswer} />
{/if}
{#if uiState === 'completing'}
<div class="card"><p>Saving results and generating summary…</p></div>
{/if}
</section>
{:else if uiState === 'done' && $summary}
<section class="session-stack">
<SessionSummary summary={$summary} />
<div class="card actions">
<button class="btn btn-secondary" onclick={() => goto('/practice')}>Back to Practice Hub</button>
<button class="btn btn-primary" onclick={() => goto('/learn')}>Try AI Session</button>
</div>
</section>
{:else}
<section class="card status error">
<h2>Could not start practice mode</h2>
<p>{errorMessage || 'Please try again.'}</p>
<div class="actions">
<button class="btn btn-secondary" onclick={generatePracticeSession}>Retry</button>
<button class="btn btn-ghost" onclick={() => goto('/practice')}>Back</button>
</div>
</section>
{/if}
</main>

<style>
.practice-session {
max-width: var(--content-width);
margin: 0 auto;
padding: var(--space-8) var(--space-4) var(--space-16);
display: grid;
gap: var(--space-6);
}

.intro {
display: grid;
gap: var(--space-2);
}

.mode-badge {
display: inline-flex;
width: fit-content;
padding: var(--space-1) var(--space-3);
border-radius: 999px;
font-size: var(--text-xs);
font-weight: var(--weight-semibold);
letter-spacing: var(--tracking-wider);
text-transform: uppercase;
color: var(--accent-matcha);
background: var(--accent-matcha-wash);
border: 1px solid var(--accent-matcha-soft);
}

.session-stack {
display: grid;
gap: var(--space-4);
}

.actions {
display: flex;
gap: var(--space-3);
flex-wrap: wrap;
}

.status.error {
border-color: color-mix(in oklab, var(--state-error) 35%, var(--border-light));
background-color: color-mix(in oklab, var(--accent-shu-wash) 60%, white);
}
</style>
