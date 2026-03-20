<script lang="ts">
import type { SessionSummary as SessionSummaryType } from '$lib/types';

let { summary, score = summary?.accuracy || 0 } = $props<{ summary: SessionSummaryType; score?: number }>();
const celebrate = $derived(score >= 80);

let displayScore = $state(0);

$effect(() => {
	let startTime: number;
	let animationFrame: number;
	const duration = 1500;
	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	if (prefersReducedMotion) {
		displayScore = score;
		return;
	}

	const animate = (timestamp: number) => {
		if (!startTime) startTime = timestamp;
		const progress = Math.min((timestamp - startTime) / duration, 1);
		
		const ease = 1 - Math.pow(1 - progress, 4); // easeOutQuart
		
		displayScore = Math.floor(ease * score);

		if (progress < 1) {
			animationFrame = requestAnimationFrame(animate);
		} else {
			displayScore = score;
		}
	};

	animationFrame = requestAnimationFrame(animate);

	return () => {
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
		}
	};
});
</script>

<section class="card summary" aria-live="polite">
	<header class="summary-header">
		<h2>Session complete</h2>
		
		<div class="score-container" class:celebrate>
			{#if celebrate}
				<div class="ink-bloom"></div>
				<div class="hanko-stamp">合格</div>
			{:else}
				<div class="practice-stamp">練習</div>
			{/if}
			<p class="score">{displayScore}%</p>
		</div>
		
		{#if celebrate}
		<p class="celebrate-text">🎉 Excellent work. Great consistency.</p>
		{/if}
	</header>

	<p class="summary-text">{summary.summary}</p>

	<div class="grid">
		<section class="stagger-1 stagger-item">
			<h3>Strengths</h3>
			<ul>
				{#each summary.strengths as item}
				<li>{item}</li>
				{/each}
			</ul>
		</section>
		<section class="stagger-2 stagger-item">
			<h3>Areas to improve</h3>
			<ul>
				{#each summary.weaknesses as item}
				<li>{item}</li>
				{/each}
			</ul>
		</section>
		<section class="stagger-3 stagger-item">
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

.summary-header {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	padding: var(--space-4) 0 var(--space-2);
}

header h2 {
	margin: 0;
	color: var(--text-sumi);
}

.summary-text {
	text-align: center;
	color: var(--text-bokashi);
	margin-top: 0;
}

.score-container {
	position: relative;
	margin-top: var(--space-6);
	margin-bottom: var(--space-4);
	display: flex;
	justify-content: center;
	align-items: center;
	min-height: 120px;
}

.score {
	font-size: 4rem;
	font-weight: var(--weight-bold);
	color: var(--text-sumi);
	z-index: 2;
	position: relative;
	font-family: 'Noto Sans JP', sans-serif;
	line-height: 1;
	margin: 0;
}

.celebrate-text {
	margin-top: var(--space-2);
	color: var(--state-success);
	margin-bottom: 0;
}

.grid {
	display: grid;
	gap: var(--space-6);
	grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
	margin-top: var(--space-2);
}

ul {
	padding-left: 1.25rem;
	margin: 0;
	display: grid;
	gap: var(--space-2);
	color: var(--text-bokashi);
}

h3 {
	margin-bottom: var(--space-3);
	color: var(--text-sumi);
	font-size: 1.125rem;
}

.actions {
	display: flex;
	gap: var(--space-3);
	flex-wrap: wrap;
	justify-content: center;
	margin-top: var(--space-4);
}

/* Animations and Elements */
.stagger-item {
	opacity: 1;
}

.hanko-stamp {
	position: absolute;
	right: -40px;
	top: -15px;
	width: 54px;
	height: 54px;
	border: 3px solid var(--accent-shu);
	border-radius: 4px;
	color: var(--accent-shu);
	font-weight: var(--weight-bold);
	font-size: 1.5rem;
	display: flex;
	align-items: center;
	justify-content: center;
	font-family: 'Noto Sans JP', serif;
	line-height: 1;
	transform: rotate(15deg);
	z-index: 3;
	opacity: 0.85;
}

.practice-stamp {
	position: absolute;
	right: -40px;
	top: -5px;
	color: var(--text-usuzumi);
	font-weight: var(--weight-light);
	font-size: 1.5rem;
	font-family: 'Noto Sans JP', serif;
	z-index: 3;
	opacity: 0.6;
}

.ink-bloom {
	position: absolute;
	width: 220px;
	height: 220px;
	background: radial-gradient(circle, var(--accent-shu) 0%, transparent 70%);
	opacity: 0.08;
	border-radius: 50%;
	z-index: 1;
}

@media (prefers-reduced-motion: no-preference) {
	.stagger-item {
		opacity: 0;
		animation: fade-slide-up var(--duration-normal) var(--ease-out) forwards;
	}

	.stagger-1 { animation-delay: 200ms; }
	.stagger-2 { animation-delay: 400ms; }
	.stagger-3 { animation-delay: 600ms; }

	@keyframes fade-slide-up {
		0% {
			opacity: 0;
			transform: translateY(15px);
		}
		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.ink-bloom {
		animation: bloom 2.5s var(--ease-out) forwards;
		transform: scale(0);
	}

	@keyframes bloom {
		0% { transform: scale(0.5); opacity: 0; }
		50% { opacity: 0.12; }
		100% { transform: scale(1); opacity: 0.08; }
	}

	.hanko-stamp {
		animation: stamp-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
		animation-delay: 1.2s;
		opacity: 0;
		transform: scale(1.5) rotate(0deg);
	}

	@keyframes stamp-in {
		0% {
			opacity: 0;
			transform: scale(1.8) rotate(0deg);
		}
		100% {
			opacity: 0.85;
			transform: scale(1) rotate(15deg);
		}
	}

	.practice-stamp {
		animation: fade-in-slow 1.5s var(--ease-out) forwards;
		animation-delay: 1s;
		opacity: 0;
	}

	@keyframes fade-in-slow {
		0% { opacity: 0; transform: translateY(5px); }
		100% { opacity: 0.6; transform: translateY(0); }
	}
}
</style>
