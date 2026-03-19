<script lang="ts">
import type { PageData } from './$types';

let { data } = $props<{ data: PageData }>();
</script>

<main class="history-page page-transition">
<section class="card">
<h1>History</h1>
<p>Session history for the active learner.</p>
</section>

<section class="card">
{#if data.history.length === 0}
<p>No sessions yet.</p>
{:else}
<table>
<thead>
<tr>
<th>Date</th>
<th>Mode</th>
<th>Status</th>
<th>Accuracy</th>
<th>Exercises</th>
</tr>
</thead>
<tbody>
{#each data.history as item}
<tr>
<td>{new Date(item.session.createdAt).toLocaleString()}</td>
<td>{item.session.mode}</td>
<td>{item.session.status}</td>
<td>{item.accuracy}%</td>
<td>{item.exerciseCount}</td>
</tr>
{/each}
</tbody>
</table>
{/if}
</section>
</main>

<style>
.history-page {
display: grid;
gap: var(--space-4);
}
table {
width: 100%;
border-collapse: collapse;
}
th,
td {
padding: var(--space-2);
border-bottom: 1px solid var(--border-light);
text-align: left;
}
</style>
