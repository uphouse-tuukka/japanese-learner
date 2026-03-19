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
} from '$lib/stores/session.svelte';
import type { Exercise, ExerciseAnswerPayload, Session } from '$lib/types';
import type { PageData } from './$types';

type UiState = 'idle' | 'loading' | 'active' | 'completing' | 'done' | 'error';
type GenerateResponse = { ok: boolean; state: 'active'; session: Session | null; exercises: Exercise[]; error?: string };
type CompleteResponse = { ok: boolean; state: 'done'; summary: import('$lib/types').SessionSummary; error?: string };

let { data } = $props<{ data: PageData }>();
let uiState = $state<UiState>('idle');
let errorMessage = $state('');

const totalExercises = $derived($exercises.length);
const currentExercise = $derived($exercises[$currentIndex] ?? null);
const progressCurrent = $derived(Math.min($currentIndex + 1, Math.max($exercises.length, 1)));

async function startPractice(): Promise<void> {
uiState = 'loading';
errorMessage = '';
resetSession();
try {
const response = await fetch('/api/practice/generate', {
method: 'POST',
headers: { 'content-type': 'application/json' },
body: JSON.stringify({ userId: data.selectedUserId, exerciseCount: 6 })
});
const payload = (await response.json()) as GenerateResponse;
if (!response.ok || !payload.ok || !payload.session) throw new Error(payload.error ?? 'Failed to generate practice session');
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
await finalizePractice();
}

async function finalizePractice(): Promise<void> {
if (!$session) {
errorMessage = 'Session missing. Start again.';
uiState = 'error';
return;
}
uiState = 'completing';
try {
const response = await fetch('/api/practice/complete', {
method: 'POST',
headers: { 'content-type': 'application/json' },
body: JSON.stringify({ userId: data.selectedUserId, sessionId: $session.id, results: $answers })
});
const payload = (await response.json()) as CompleteResponse;
if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'Failed to complete practice session');
completeSession(payload.summary);
uiState = 'done';
} catch (error) {
errorMessage = error instanceof Error ? error.message : 'Unknown error';
uiState = 'error';
}
}
</script>

<main class="practice-page page-transition">
<section class="card">
<h1>Practice</h1>
<p>Run a focused review session with weighted practice exercises.</p>
<button class="btn btn-primary" onclick={startPractice}>Start practice</button>
</section>

{#if uiState === 'loading'}
<section class="card"><p>Generating practice session...</p></section>
{:else if uiState === 'active' || uiState === 'completing'}
<section class="card"><ProgressBar current={progressCurrent} total={totalExercises} label="Practice progress" /></section>
{#if currentExercise}<SessionRenderer exercise={currentExercise} onAnswer={onAnswer} />{/if}
{:else if uiState === 'done' && $summary}
<SessionSummary summary={$summary} />
{:else if uiState === 'error'}
<section class="card"><p>{errorMessage}</p></section>
{/if}

<section class="card">
<h2>Recent practice history</h2>
{#if data.history.length === 0}
<p>No completed practice sessions yet.</p>
{:else}
<ul>
{#each data.history as item}
<li><strong>{new Date(item.session.createdAt).toLocaleString()}</strong> - {item.correctCount}/{item.exerciseCount} correct ({item.accuracy}%)</li>
{/each}
</ul>
{/if}
</section>
</main>

<style>
.practice-page { display: grid; gap: var(--space-4); }
</style>
