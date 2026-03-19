<script lang="ts">
import ProgressBar from '$lib/components/ProgressBar.svelte';
import SessionRenderer from '$lib/components/SessionRenderer.svelte';
import SessionSummary from '$lib/components/SessionSummary.svelte';
import {
session,
exercises,
answers,
currentIndex,
summary,
startSession,
answerExercise,
nextExercise,
completeSession,
resetSession
} from '$lib/stores/session';
import type { Exercise, ExerciseAnswerPayload, Session } from '$lib/types';
import type { PageData } from './$types';

type UiState = 'idle' | 'loading' | 'active' | 'completing' | 'done' | 'budget_exhausted' | 'error';
type GenerateResponse = { ok: boolean; state: 'active' | 'budget_exhausted'; session: Session | null; exercises: Exercise[]; error?: string };
type CompleteResponse = { ok: boolean; state: 'done'; summary: import('$lib/types').SessionSummary; error?: string };

let { data } = $props<{ data: PageData }>();
let uiState = $state<UiState>('idle');
let errorMessage = $state('');

$effect(() => {
if (!data.budget.allowed && uiState === 'idle') {
uiState = 'budget_exhausted';
}
});

const totalExercises = $derived($exercises.length);
const currentExercise = $derived($exercises[$currentIndex] ?? null);
const progressCurrent = $derived(Math.min($currentIndex + 1, Math.max($exercises.length, 1)));

async function startLearning(): Promise<void> {
uiState = 'loading';
errorMessage = '';
resetSession();
try {
const response = await fetch('/api/session/generate', {
method: 'POST',
headers: { 'content-type': 'application/json' },
body: JSON.stringify({ userId: data.selectedUserId, exerciseCount: 6 })
});
const payload = (await response.json()) as GenerateResponse;
if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'Failed to generate session');
if (payload.state === 'budget_exhausted' || !payload.session) {
uiState = 'budget_exhausted';
return;
}
startSession(payload.session, payload.exercises);
uiState = 'active';
} catch (error) {
errorMessage = error instanceof Error ? error.message : 'Unknown error';
uiState = 'error';
}
}

async function onAnswer(payload: ExerciseAnswerPayload): Promise<void> {
if (!currentExercise) return;
answerExercise($currentIndex, payload);
const isLast = $currentIndex >= $exercises.length - 1;
if (!isLast) {
nextExercise();
return;
}
await finalizeSession();
}

async function finalizeSession(): Promise<void> {
if (!$session) {
errorMessage = 'Session missing. Start again.';
uiState = 'error';
return;
}
uiState = 'completing';
try {
const response = await fetch('/api/session/complete', {
method: 'POST',
headers: { 'content-type': 'application/json' },
body: JSON.stringify({ userId: data.selectedUserId, sessionId: $session.id, results: $answers })
});
const payload = (await response.json()) as CompleteResponse;
if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'Failed to complete session');
completeSession(payload.summary);
uiState = 'done';
} catch (error) {
errorMessage = error instanceof Error ? error.message : 'Unknown error';
uiState = 'error';
}
}
</script>

<main class="learn-page page-transition">
<section class="card">
<h1>Learn</h1>
<p>Generate a guided learning session and complete all exercises.</p>
</section>

{#if uiState === 'idle'}
<section class="card">
<button class="btn btn-primary" onclick={startLearning}>Generate session</button>
</section>
{:else if uiState === 'loading'}
<section class="card"><p>Generating session...</p></section>
{:else if uiState === 'budget_exhausted'}
<section class="card"><p>Daily token budget exhausted. Try again tomorrow.</p></section>
{:else if uiState === 'active' || uiState === 'completing'}
<section class="card"><ProgressBar current={progressCurrent} total={totalExercises} label="Session progress" /></section>
{#if currentExercise}<SessionRenderer exercise={currentExercise} onAnswer={onAnswer} />{/if}
{:else if uiState === 'done' && $summary}
<SessionSummary summary={$summary} />
{:else if uiState === 'error'}
<section class="card"><p>{errorMessage}</p><button class="btn btn-secondary" onclick={startLearning}>Try again</button></section>
{/if}
</main>

<style>
.learn-page { display: grid; gap: var(--space-4); }
</style>
