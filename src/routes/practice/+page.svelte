<script lang="ts">
import { goto } from '$app/navigation';
import type { PageData } from './$types';

let { data } = $props<{ data: PageData }>();

let selectedTopic = $state('');
let selectedDifficulty = $state('');

const hasMultipleTopics = $derived(data.exerciseCount.byTopic.length > 1);
const canPractice = $derived(data.can_practice);

function formatDate(value: string | null): string {
if (!value) return 'Not completed';
return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

async function startPracticeSession(): Promise<void> {
const query = new URLSearchParams();
if (selectedTopic) query.set('topic', selectedTopic);
if (selectedDifficulty) query.set('difficulty', selectedDifficulty);

await goto(`/practice/session${query.toString() ? `?${query.toString()}` : ''}`);
}
</script>

<main class="page-transition practice-hub">
<section class="card hero">
<p class="hero-kicker">Practice Mode</p>
<h1>Zero-AI review sessions</h1>
<p>
Review material with zero AI usage. Practice exercises from your previous sessions and curated
content.
</p>
<div class="hero-meta">
<span class="pill">Learner: {data.user.name}</span>
<span class="pill">Level: {data.user.level}</span>
<span class="pill">Pool size: {data.exerciseCount.total} exercises</span>
</div>
</section>

<section class="card">
<h2>Practice options</h2>
<div class="filters">
{#if hasMultipleTopics}
<div>
<label for="topic-filter">Topic focus (optional)</label>
<select id="topic-filter" bind:value={selectedTopic}>
<option value="">Mixed topics</option>
{#each data.exerciseCount.byTopic as item}
<option value={item.topic}>{item.topic} ({item.count})</option>
{/each}
</select>
</div>
{/if}

<div>
<label for="difficulty-filter">Difficulty preference</label>
<select id="difficulty-filter" bind:value={selectedDifficulty}>
<option value="">Any difficulty</option>
<option value="1">Difficulty 1</option>
<option value="2">Difficulty 2</option>
<option value="3">Difficulty 3</option>
<option value="4">Difficulty 4</option>
<option value="5">Difficulty 5</option>
</select>
</div>
</div>

<button class="btn btn-primary" onclick={startPracticeSession} disabled={!canPractice}>
Start Practice Session
</button>

{#if !canPractice}
<p class="helper-text">
Not enough practice material yet. Complete a few AI sessions first to build your exercise pool.
</p>
{/if}
</section>

<section class="stats-grid">
<article class="card">
<h2>Practice stats</h2>
<ul class="stats-list">
<li>
<span>Completed practice sessions</span>
<strong>{data.practiceStats.sessionCount}</strong>
</li>
<li>
<span>Exercises reviewed</span>
<strong>{data.practiceStats.exercisesReviewed}</strong>
</li>
<li>
<span>Average score</span>
<strong>{data.practiceStats.averageScore === null ? '—' : `${data.practiceStats.averageScore}%`}</strong>
</li>
</ul>
</article>

<article class="card">
<h2>Recent practice history</h2>
{#if data.history.length === 0}
<p class="helper-text">No practice history yet. Start your first zero-AI review session.</p>
{:else}
<ul class="history-list">
{#each data.history as item}
<li>
<div>
<p class="history-title">Session {item.id.slice(0, 8)}</p>
<small>{formatDate(item.createdAt)}</small>
</div>
<div class="history-values">
<span>{item.exerciseCount} exercises</span>
<span>{item.status}</span>
<span>{item.score === null ? '—' : `${item.score}%`}</span>
</div>
</li>
{/each}
</ul>
{/if}
</article>
</section>
</main>

<style>
.practice-hub {
max-width: var(--content-wide);
margin: 0 auto;
padding: var(--space-8) var(--space-4) var(--space-16);
display: grid;
gap: var(--space-6);
}

.hero-kicker {
margin: 0 0 var(--space-2);
font-size: var(--text-xs);
font-weight: var(--weight-semibold);
letter-spacing: var(--tracking-wider);
text-transform: uppercase;
color: var(--text-bokashi);
}

.hero-meta {
display: flex;
flex-wrap: wrap;
gap: var(--space-2);
margin-top: var(--space-4);
}

.pill {
display: inline-flex;
align-items: center;
padding: var(--space-1) var(--space-3);
border-radius: 999px;
border: 1px solid var(--border-light);
background: var(--bg-washi);
font-size: var(--text-sm);
}

.filters {
display: grid;
gap: var(--space-4);
grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
margin-bottom: var(--space-4);
}

.helper-text {
margin-top: var(--space-3);
color: var(--text-bokashi);
}

.stats-grid {
display: grid;
gap: var(--space-4);
grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
}

.stats-list,
.history-list {
list-style: none;
display: grid;
gap: var(--space-3);
padding: 0;
margin: 0;
}

.stats-list li {
display: flex;
justify-content: space-between;
align-items: baseline;
padding-bottom: var(--space-2);
border-bottom: 1px solid var(--border-light);
}

.history-list li {
display: flex;
justify-content: space-between;
gap: var(--space-2);
align-items: center;
padding: var(--space-3);
border: 1px solid var(--border-light);
border-radius: var(--radius-md);
background: var(--bg-washi);
}

.history-title {
margin: 0;
font-weight: var(--weight-medium);
}

.history-values {
display: flex;
gap: var(--space-2);
font-size: var(--text-sm);
color: var(--text-bokashi);
}
</style>
