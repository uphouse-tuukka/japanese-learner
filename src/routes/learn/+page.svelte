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
import type { Exercise, ExerciseAnswerPayload, Lesson, Session } from '$lib/types';
import type { PageData } from './$types';

type UiState =
| 'idle'
| 'loading'
| 'lesson'
| 'active'
| 'completing'
| 'done'
| 'budget_exhausted'
| 'error';

type GenerateResponse = {
ok: boolean;
state: 'active' | 'budget_exhausted';
session: Session | null;
lesson: Lesson | null;
exercises: Exercise[];
error?: string;
};

type CompleteResponse = {
ok: boolean;
state: 'done';
summary: import('$lib/types').SessionSummary;
error?: string;
};

let { data } = $props<{ data: PageData }>();
let uiState = $state<UiState>('idle');
let errorMessage = $state('');
let lesson = $state<Lesson | null>(null);

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
lesson = null;
resetSession();

try {
const response = await fetch('/api/session/generate', {
method: 'POST',
headers: { 'content-type': 'application/json' },
body: JSON.stringify({ userId: data.selectedUserId, exerciseCount: 6 })
});

const payload = (await response.json()) as GenerateResponse;
if (payload.state === 'budget_exhausted' || !payload.session) {
uiState = 'budget_exhausted';
return;
}
if (!response.ok || !payload.ok || !payload.lesson) {
throw new Error(payload.error ?? 'Failed to generate session');
}

lesson = payload.lesson;
startSession(payload.session, payload.exercises);
uiState = 'lesson';
} catch (error) {
errorMessage = error instanceof Error ? error.message : 'Unknown error';
uiState = 'error';
}
}

function beginExercises(): void {
if (!lesson) {
errorMessage = 'Lesson data missing. Please generate a new session.';
uiState = 'error';
return;
}
uiState = 'active';
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
<p>Start an AI teaching session: learn one practical topic, then answer focused questions.</p>
</section>

{#if uiState === 'idle'}
<section class="card">
<button class="btn btn-primary" onclick={startLearning}>Start learning</button>
</section>
{:else if uiState === 'loading'}
<section class="card"><p>Generating your teaching session...</p></section>
{:else if uiState === 'budget_exhausted'}
<section class="card"><p>Daily token budget exhausted. Try again tomorrow.</p></section>
{:else if uiState === 'lesson' && lesson}
<section class="card lesson-card">
<p class="lesson-label">Today's lesson</p>
<h2>{lesson.topic}</h2>
<p>{lesson.explanation}</p>
<div class="cultural-note">
<h3>Cultural note</h3>
<p>{lesson.culturalNote}</p>
</div>
<div>
<h3>Key phrases</h3>
<div class="key-phrases">
{#each lesson.keyPhrases as phrase}
<article class="key-phrase">
<p class="jp">{phrase.japanese}</p>
<p class="romaji">{phrase.romaji}</p>
<p class="en">{phrase.english}</p>
<p class="usage">{phrase.usage}</p>
</article>
{/each}
</div>
</div>
<button class="btn btn-primary" onclick={beginExercises}>I'm ready for questions</button>
</section>
{:else if uiState === 'active' || uiState === 'completing'}
<section class="card"><ProgressBar current={progressCurrent} total={totalExercises} label="Session progress" /></section>
{#if currentExercise}
<SessionRenderer exercise={currentExercise} onAnswer={onAnswer} />
{/if}
{:else if uiState === 'done' && $summary}
<SessionSummary summary={$summary} />
{:else if uiState === 'error'}
<section class="card">
<p>{errorMessage}</p>
<button class="btn btn-secondary" onclick={startLearning}>Try again</button>
</section>
{/if}
</main>

<style>
.learn-page {
display: grid;
gap: var(--space-4);
}

.lesson-card {
display: grid;
gap: var(--space-4);
}

.lesson-label {
font-size: var(--text-xs);
text-transform: uppercase;
letter-spacing: var(--tracking-wide);
color: var(--text-usuzumi);
margin: 0;
}

.cultural-note {
padding: var(--space-3);
background: var(--bg-washi);
border-radius: var(--radius-md);
}

.key-phrases {
display: grid;
gap: var(--space-3);
}

.key-phrase {
border: 1px solid var(--border-light);
border-radius: var(--radius-md);
padding: var(--space-3);
display: grid;
gap: var(--space-1);
}

.jp {
font-size: var(--text-xl);
margin: 0;
}

.romaji,
.en,
.usage {
margin: 0;
}

.romaji {
color: var(--text-usuzumi);
}

.usage {
font-size: var(--text-sm);
}
</style>
