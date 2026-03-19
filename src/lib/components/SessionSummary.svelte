<script lang="ts">
import type { SessionSummary as SessionSummaryType } from '$lib/types';

let { summary, score = summary.accuracy } = $props<{ summary: SessionSummaryType; score?: number }>();
const celebrate = $derived(score >= 80);
</script>

<section class="card summary" aria-live="polite">
<header>
<h2>Session complete</h2>
<p class="score">Score: {score}%</p>
{#if celebrate}
<p class="celebrate">🎉 Excellent work. Great consistency.</p>
{/if}
</header>

<p>{summary.summary}</p>

<div class="grid">
<section>
<h3>Strengths</h3>
<ul>
{#each summary.strengths as item}
<li>{item}</li>
{/each}
</ul>
</section>
<section>
<h3>Areas to improve</h3>
<ul>
{#each summary.weaknesses as item}
<li>{item}</li>
{/each}
</ul>
</section>
<section>
<h3>Next steps</h3>
<ul>
{#each summary.nextSteps as item}
<li>{item}</li>
{/each}
</ul>
</section>
</div>

<div class="actions">
<a class="btn btn-secondary" href="/">Return Home</a>
<a class="btn btn-primary" href="/practice">Try Practice Mode</a>
</div>
</section>

<style>
.summary {
display: grid;
gap: var(--space-4);
}

header h2,
header p {
margin: 0;
}

.score {
color: var(--text-bokashi);
margin-top: var(--space-2);
}

.celebrate {
margin-top: var(--space-2);
color: var(--state-success);
}

.grid {
display: grid;
gap: var(--space-4);
grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}

ul {
padding-left: 1rem;
margin: 0;
display: grid;
gap: var(--space-1);
}

.actions {
display: flex;
gap: var(--space-3);
flex-wrap: wrap;
}
</style>
