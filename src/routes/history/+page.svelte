<script lang="ts">
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
	let expandedIds = $state<string[]>([]);

	const sessions = $derived(data.sessions);
	const stats = $derived(data.stats);
	const user = $derived(data.user);
	const hasSessions = $derived(sessions.length > 0);
	const averageScoreLabel = $derived(
		stats.averageScore > 0 ? `${stats.averageScore.toFixed(1)}%` : 'No scored sessions'
	);

	function toggleExpanded(sessionId: string): void {
		if (expandedIds.includes(sessionId)) {
			expandedIds = expandedIds.filter((id) => id !== sessionId);
			return;
		}
		expandedIds = [...expandedIds, sessionId];
	}

	function isExpanded(sessionId: string): boolean {
		return expandedIds.includes(sessionId);
	}

	function formatDate(value: string): string {
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return 'Unknown date';
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(parsed);
	}

	function scoreLabel(score: number | null): string {
		if (score === null) return 'Not available';
		return `${score.toFixed(1)}%`;
	}

	function scoreWidth(score: number | null): number {
		if (score === null) return 0;
		return Math.max(0, Math.min(100, score));
	}

	function scoreClass(score: number | null): 'great' | 'good' | 'needs-work' | 'unknown' {
		if (score === null) return 'unknown';
		if (score >= 80) return 'great';
		if (score >= 60) return 'good';
		return 'needs-work';
	}

	function listOrFallback(values: string[], fallback: string): string[] {
		return values.length > 0 ? values : [fallback];
	}
</script>

<section class="history-page">
	<header class="card page-header">
		<p class="eyebrow">Learning History</p>
		<h1>{user.name}'s Progress</h1>
		<p class="subtitle">Review completed sessions and keep your momentum visible.</p>
	</header>

	<section class="stats-grid" aria-label="Learning statistics">
		<article class="card stat-card">
			<h2>Total sessions</h2>
			<p class="stat-value">{stats.totalSessionsCompleted}</p>
		</article>

		<article class="card stat-card">
			<h2>Average score</h2>
			<p class="stat-value">{averageScoreLabel}</p>
		</article>

		<article class="card stat-card">
			<h2>Current streak</h2>
			<p class="stat-value">{stats.currentStreak} day{stats.currentStreak === 1 ? '' : 's'}</p>
		</article>

		<article class="card stat-card">
			<h2>Best streak</h2>
			<p class="stat-value">{stats.bestStreak} day{stats.bestStreak === 1 ? '' : 's'}</p>
		</article>

		<article class="card stat-card">
			<h2>Sessions this week</h2>
			<p class="stat-value">{stats.sessionsThisWeek}</p>
		</article>

		<article class="card stat-card">
			<h2>Sessions this month</h2>
			<p class="stat-value">{stats.sessionsThisMonth}</p>
		</article>

		<article class="card stat-card ratio-card">
			<h2>AI vs Practice</h2>
			<div class="ratio-row">
				<span>AI</span>
				<strong>{stats.breakdown.ai}</strong>
			</div>
			<div class="ratio-row">
				<span>Practice</span>
				<strong>{stats.breakdown.practice}</strong>
			</div>
		</article>
	</section>

	{#if hasSessions}
		<section class="sessions card" aria-label="Session history">
			{#each sessions as session (session.id)}
				<article class="session-card">
					<header class="session-header">
						<div>
							<p class="session-date">{formatDate(session.date)}</p>
							<h2 class="session-title">Session {session.id.slice(0, 8)}</h2>
						</div>
						<div class="badges">
							<span class={`badge mode ${session.mode}`}>
								{session.mode === 'ai' ? 'AI' : 'Practice'}
							</span>
							<span class={`badge status ${session.status}`}>{session.status}</span>
						</div>
					</header>

					<div class="score-block">
						<div class="score-row">
							<span>Score</span>
							<strong class={`score-pill ${scoreClass(session.score)}`}>{scoreLabel(session.score)}</strong>
						</div>
						<div class="score-track" aria-hidden="true">
							<div class={`score-fill ${scoreClass(session.score)}`} style={`width: ${scoreWidth(session.score)}%`}></div>
						</div>
					</div>

					<div class="topics">
						<h3>Topics covered</h3>
						<div class="topic-list">
							{#if session.topics.length > 0}
								{#each session.topics as topic}
									<span class="topic-chip">{topic}</span>
								{/each}
							{:else}
								<span class="topic-chip muted">No topics recorded</span>
							{/if}
						</div>
					</div>

					<div class="details">
						<button
							type="button"
							class="btn btn-secondary details-toggle"
							onclick={() => toggleExpanded(session.id)}
							aria-expanded={isExpanded(session.id)}
						>
							{isExpanded(session.id) ? 'Hide details' : 'Show details'}
						</button>

						{#if isExpanded(session.id)}
							<div class="details-grid">
								{#if session.summaryText}
									<section class="summary-block">
										<h4>Summary</h4>
										<p>{session.summaryText}</p>
									</section>
								{/if}
								<section>
									<h4>Strengths</h4>
									<ul>
										{#each listOrFallback(session.strengths, 'No strengths recorded yet') as item}
											<li>{item}</li>
										{/each}
									</ul>
								</section>
								<section>
									<h4>Weaknesses</h4>
									<ul>
										{#each listOrFallback(session.weaknesses, 'No weaknesses recorded yet') as item}
											<li>{item}</li>
										{/each}
									</ul>
								</section>
								<section>
									<h4>Focus areas</h4>
									<ul>
										{#each listOrFallback(session.focusAreas, 'No focus areas planned yet') as item}
											<li>{item}</li>
										{/each}
									</ul>
								</section>
							</div>
						{/if}
					</div>
				</article>
			{/each}
		</section>
	{:else}
		<section class="card empty-state">
			<h2>No sessions yet</h2>
			<p>Start your first session to unlock progress tracking and streaks.</p>
			<div class="empty-actions">
				<a href="/learn" class="btn btn-primary">Start learning</a>
				<a href="/practice" class="btn btn-secondary">Go to practice</a>
			</div>
		</section>
	{/if}
</section>

<style>
	.history-page {
		display: grid;
		gap: var(--space-6);
	}

	.page-header {
		display: grid;
		gap: var(--space-2);
	}

	.eyebrow {
		margin: 0;
		font-size: var(--text-sm);
		letter-spacing: var(--tracking-wider);
		text-transform: uppercase;
		color: var(--text-usuzumi);
	}

	.subtitle {
		margin: 0;
		color: var(--text-bokashi);
	}

	.stats-grid {
		display: grid;
		gap: var(--space-4);
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
	}

	.stat-card {
		display: grid;
		gap: var(--space-2);
	}

	.stat-card h2 {
		font-size: var(--text-sm);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--text-bokashi);
	}

	.stat-value {
		margin: 0;
		font-size: var(--text-xl);
		font-weight: var(--weight-semibold);
	}

	.ratio-card {
		gap: var(--space-3);
	}

	.ratio-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.sessions {
		display: grid;
		gap: 0;
		padding: 0;
		max-height: 65vh;
		overflow: auto;
	}

	.session-card {
		display: grid;
		gap: var(--space-4);
		padding: var(--space-5);
		border-bottom: 1px solid var(--border-light);
	}

	.session-card:last-child {
		border-bottom: 0;
	}

	.session-header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.session-date {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-usuzumi);
	}

	.session-title {
		margin-top: var(--space-1);
		font-size: var(--text-lg);
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.55rem;
		border-radius: var(--radius-md);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		border: 1px solid var(--border-light);
	}

	.badge.mode.ai {
		background: var(--accent-shu-wash);
		color: var(--accent-shu-deep);
		border-color: rgba(194, 59, 34, 0.25);
	}

	.badge.mode.practice {
		background: var(--accent-matcha-wash);
		color: var(--accent-matcha);
		border-color: rgba(91, 122, 94, 0.25);
	}

	.badge.status.completed {
		background: #eaf5ea;
		color: var(--state-success);
	}

	.badge.status.error {
		background: #fdf0ee;
		color: var(--state-error);
	}

	.badge.status.planned {
		background: var(--bg-washi);
		color: var(--text-bokashi);
	}

	.score-block {
		display: grid;
		gap: var(--space-2);
	}

	.score-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: var(--text-sm);
		color: var(--text-bokashi);
	}

	.score-pill {
		padding: 0.15rem 0.45rem;
		border-radius: var(--radius-md);
	}

	.score-pill.great {
		background: #eaf5ea;
		color: var(--state-success);
	}

	.score-pill.good {
		background: #fff5e7;
		color: var(--state-warning);
	}

	.score-pill.needs-work {
		background: #fdf0ee;
		color: var(--state-error);
	}

	.score-pill.unknown {
		background: var(--bg-washi);
		color: var(--text-bokashi);
	}

	.score-track {
		height: 0.6rem;
		border-radius: 999px;
		background: var(--bg-washi);
		overflow: hidden;
	}

	.score-fill {
		height: 100%;
		transition: width var(--duration-normal) var(--ease-out);
	}

	.score-fill.great {
		background: var(--state-success);
	}

	.score-fill.good {
		background: var(--state-warning);
	}

	.score-fill.needs-work {
		background: var(--state-error);
	}

	.score-fill.unknown {
		background: var(--border-mid);
	}

	.topics h3 {
		font-size: var(--text-sm);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--text-bokashi);
	}

	.topic-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.topic-chip {
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		font-size: var(--text-xs);
		background: var(--bg-kinu);
		border: 1px solid var(--border-light);
	}

	.topic-chip.muted {
		color: var(--text-usuzumi);
	}

	.details {
		display: grid;
		gap: var(--space-3);
	}

	.details-toggle {
		justify-self: start;
	}

	.details-grid {
		display: grid;
		gap: var(--space-3);
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		padding: var(--space-4);
		background: var(--bg-washi);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-md);
	}

	.summary-block {
		grid-column: 1 / -1;
	}

	.summary-block p {
		margin: 0;
		color: var(--text-bokashi);
	}

	.details-grid h4 {
		margin-bottom: var(--space-2);
		font-size: var(--text-sm);
	}

	.details-grid ul {
		list-style: disc;
		padding-left: var(--space-4);
		font-size: var(--text-sm);
		color: var(--text-bokashi);
		display: grid;
		gap: var(--space-1);
	}

	.empty-state {
		display: grid;
		justify-items: center;
		text-align: center;
		gap: var(--space-3);
		padding-block: var(--space-10);
	}

	.empty-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-3);
	}

	@media (max-width: 640px) {
		.history-page {
			gap: var(--space-4);
		}

		.sessions {
			max-height: none;
		}
	}
</style>
