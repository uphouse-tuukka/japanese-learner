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

/* — Loading animation state — */
const loadingMessages = [
'Your sensei is preparing today\u2019s lesson\u2026',
'Brewing green tea for the session\u2026 \uD83C\uDF75',
'Arranging the study materials\u2026',
'Writing today\u2019s lesson plan\u2026',
'Almost ready\u2026'
];
let loadingMsgIndex = $state(0);
let loadingMsgVisible = $state(true);

$effect(() => {
if (uiState !== 'loading') return;
loadingMsgIndex = 0;
loadingMsgVisible = true;
let timeoutId: ReturnType<typeof setTimeout>;
const intervalId = setInterval(() => {
loadingMsgVisible = false;
timeoutId = setTimeout(() => {
loadingMsgIndex = (loadingMsgIndex + 1) % loadingMessages.length;
loadingMsgVisible = true;
}, 400);
}, 2800);
return () => {
clearInterval(intervalId);
clearTimeout(timeoutId);
};
});

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
body: JSON.stringify({ userId: data.selectedUserId, exerciseCount: 10 })
});

	const payload = (await response.json()) as GenerateResponse;
	if (payload.state === 'budget_exhausted') {
		uiState = 'budget_exhausted';
		return;
	}
	if (!response.ok || !payload.ok) {
		throw new Error(payload.error ?? 'Failed to generate session');
	}
	if (!payload.session || !payload.lesson) {
		throw new Error('Failed to generate session');
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
<section class="card loading-card" aria-live="polite" aria-busy="true">
<div class="loading-visual">
<svg class="enso" viewBox="0 0 100 100" aria-hidden="true">
<circle class="enso-stroke" cx="50" cy="50" r="38" />
</svg>
<span class="enso-kanji" aria-hidden="true">学</span>
</div>
<p class="loading-text" style:opacity={loadingMsgVisible ? 1 : 0}>
{loadingMessages[loadingMsgIndex]}
</p>
<p class="sr-only">Generating your teaching session, please wait.</p>
</section>
{:else if uiState === 'budget_exhausted'}
<section class="card">
<p>
You've reached today's AI practice budget. Please try again tomorrow, and your learning session
will be ready.
</p>
</section>
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
{:else if uiState === 'active'}
<section class="card"><ProgressBar current={progressCurrent} total={totalExercises} label="Session progress" /></section>
{#if currentExercise}
<SessionRenderer exercise={currentExercise} onAnswer={onAnswer} />
{/if}
{:else if uiState === 'completing'}
<section class="card loading-card" aria-live="polite" aria-busy="true">
  <div class="loading-visual">
    <svg class="enso" viewBox="0 0 100 100" aria-hidden="true">
      <circle class="enso-stroke" cx="50" cy="50" r="38" />
    </svg>
    <span class="enso-kanji" aria-hidden="true">完</span>
  </div>
  <p class="loading-text">Preparing your session summary…</p>
  <p class="sr-only">Generating your session summary, please wait.</p>
</section>
{:else if uiState === 'done' && $summary}
<SessionSummary summary={$summary} />
{:else if uiState === 'error'}
<section class="card">
<p>{errorMessage || 'Failed to generate session'}</p>
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

.lesson-card h3 {
    margin: 0 0 var(--space-3) 0;
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

/* ── Loading animation: Ensō (禅円) ── */
.loading-card {
display: flex;
flex-direction: column;
align-items: center;
padding: var(--space-12) var(--space-6);
gap: var(--space-6);
}

.loading-visual {
position: relative;
width: 120px;
height: 120px;
display: flex;
align-items: center;
justify-content: center;
}

.enso {
position: absolute;
inset: 0;
width: 100%;
height: 100%;
transform: rotate(-120deg);
overflow: visible;
}

.enso-stroke {
fill: none;
stroke: var(--text-sumi);
stroke-width: 2.5;
stroke-linecap: round;
stroke-dasharray: 239;
stroke-dashoffset: 239;
animation: draw-enso 4s ease-in-out infinite;
}

@keyframes draw-enso {
0% { stroke-dashoffset: 239; opacity: 0; }
6% { stroke-dashoffset: 224; opacity: 0.6; }
50% { stroke-dashoffset: 20; opacity: 0.6; }
65% { stroke-dashoffset: 20; opacity: 0.6; }
92% { stroke-dashoffset: 20; opacity: 0; }
100% { stroke-dashoffset: 20; opacity: 0; }
}

.enso-kanji {
position: relative;
font-size: var(--text-3xl);
color: var(--accent-shu);
font-weight: var(--weight-light);
animation: kanji-breathe 4s ease-in-out infinite;
user-select: none;
}

@keyframes kanji-breathe {
0%, 100% { opacity: 0.4; transform: scale(0.96); }
50% { opacity: 0.9; transform: scale(1.04); }
}

.loading-text {
color: var(--text-bokashi);
font-size: var(--text-base);
text-align: center;
transition: opacity 0.4s var(--ease-in-out);
min-height: 1.6em;
margin: 0;
}
</style>
