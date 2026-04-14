<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import {
    LEVEL_LABELS,
    LEVEL_ORDER,
    type SessionSummary as SessionSummaryType,
    type UserLevel,
    type SessionXpBreakdown,
    // type Milestone,
  } from '$lib/types';
  import LessonKeyPhraseCard from '$lib/components/LessonKeyPhraseCard.svelte';
  import RichJapaneseText from '$lib/components/RichJapaneseText.svelte';

  let {
    summary,
    score = summary?.accuracy || 0,
    xpBreakdown,
  } = $props<{
    summary: SessionSummaryType;
    score?: number;
    xpBreakdown?: SessionXpBreakdown | null;
  }>();
  const celebrate = $derived(score >= 80);
  const recommendation = $derived(summary.levelUpRecommendation);
  const miniLesson = $derived(summary.miniLesson ?? null);
  const nextLevelLabel = $derived(
    recommendation ? LEVEL_LABELS[recommendation.recommendedLevel as UserLevel] : '',
  );

  const currentLevelKey = $derived.by(() => {
    if (!recommendation) return null;
    const nextIdx = LEVEL_ORDER.indexOf(recommendation.recommendedLevel as UserLevel);
    return nextIdx > 0 ? LEVEL_ORDER[nextIdx - 1] : null;
  });
  const currentLevelLabel = $derived(
    currentLevelKey ? LEVEL_LABELS[currentLevelKey as UserLevel] : '',
  );
  const displayedMilestones = $derived.by(() => {
    const milestones = xpBreakdown?.newMilestones ?? [];
    if (milestones.length <= 2) return milestones;
    return [milestones[milestones.length - 1]];
  });
  const hiddenMilestoneCount = $derived.by(() => {
    const milestones = xpBreakdown?.newMilestones ?? [];
    return milestones.length > 2 ? milestones.length - 1 : 0;
  });
  const isOnPracticePage = $derived($page.url.pathname === '/practice');

  let displayScore = $state(0);
  let displayXp = $state(0);
  let levelUpStatus = $state<'idle' | 'loading' | 'accepted' | 'declined' | 'error'>('idle');

  async function acceptLevelUp() {
    if (!recommendation) return;

    levelUpStatus = 'loading';

    try {
      const res = await fetch('/api/user/level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: summary.userId,
          level: recommendation.recommendedLevel,
        }),
      });

      if (!res.ok) throw new Error('Failed to update level');

      levelUpStatus = 'accepted';
    } catch (e) {
      console.error(e);
      levelUpStatus = 'error';
    }
  }

  function declineLevelUp() {
    levelUpStatus = 'declined';
  }

  $effect(() => {
    let startTime: number;
    let animationFrame: number;
    const duration = 1500;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const targetXp = xpBreakdown?.totalXp || 0;

    if (prefersReducedMotion) {
      displayScore = score;
      displayXp = targetXp;
      return;
    }

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      const ease = 1 - Math.pow(1 - progress, 4); // easeOutQuart

      displayScore = Math.floor(ease * score);
      displayXp = Math.floor(ease * targetXp);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        displayScore = score;
        displayXp = targetXp;
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
      <p class="celebrate-text">Excellent work. Great consistency.</p>
    {/if}
  </header>

  <p class="summary-text">{summary.summary}</p>

  {#if xpBreakdown}
    <section class="ink-earned-card stagger-1 stagger-item">
      <h4>墨 Ink Earned</h4>
      <div class="xp-total-container">
        <span class="xp-total">{displayXp}</span>
      </div>
      <div class="xp-breakdown">
        {#if xpBreakdown.exerciseXp > 0}
          <div class="xp-row">
            <span>Correct answers</span>
            <span>{xpBreakdown.exerciseXp}墨</span>
          </div>
        {/if}
        {#if xpBreakdown.sessionBonusXp > 0}
          <div class="xp-row">
            <span>Session complete</span>
            <span>+{xpBreakdown.sessionBonusXp}墨</span>
          </div>
        {/if}
        {#if xpBreakdown.perfectBonusXp > 0}
          <div class="xp-row highlight">
            <span>Perfect score</span>
            <span>+{xpBreakdown.perfectBonusXp}墨</span>
          </div>
        {/if}
        {#if xpBreakdown.streakBonusXp > 0}
          <div class="xp-row highlight">
            <span>Streak bonus</span>
            <span>+{xpBreakdown.streakBonusXp}墨</span>
          </div>
        {/if}
        {#if xpBreakdown.comboBonusXp > 0}
          <div class="xp-row highlight">
            <span>Combo bonus</span>
            <span>+{xpBreakdown.comboBonusXp}墨</span>
          </div>
        {/if}
      </div>
    </section>
  {/if}

  <div class="summary-insights-grid">
    <section class="stagger-2 stagger-item">
      <h3>What you're mastering</h3>
      <ul>
        {#each summary.strengths as item}
          <li>{item}</li>
        {/each}
      </ul>
    </section>
    <section class="stagger-3 stagger-item">
      <h3>What to work on</h3>
      <ul>
        {#each summary.weaknesses as item}
          <li>{item}</li>
        {/each}
      </ul>
    </section>
  </div>

  {#if miniLesson}
    <section class="stagger-4 stagger-item mini-lesson-block">
      <h3>One more useful phrase</h3>
      <LessonKeyPhraseCard phrase={miniLesson} />
    </section>
  {/if}

  {#if displayedMilestones.length}
    {#each displayedMilestones as milestone}
      <section class="milestone-card stagger-milestone stagger-item">
        <div class="milestone-content">
          <div class="milestone-header">
            <h3 class="milestone-jp">{milestone.nameJa}</h3>
            <span class="milestone-label">Milestone Unlocked</span>
          </div>
          <h4 class="milestone-en">{milestone.name}</h4>
          <p class="milestone-desc">{milestone.description}</p>
          {#if hiddenMilestoneCount > 0}
            <p class="milestone-extra-note">+{hiddenMilestoneCount} more milestones unlocked</p>
          {/if}
        </div>
      </section>
    {/each}
  {/if}

  {#if recommendation && levelUpStatus !== 'declined'}
    <section class="level-up-card stagger-5 stagger-item" aria-label="Level up recommendation">
      <div class="level-up-content">
        <div class="level-up-header">
          <span class="level-up-icon" aria-hidden="true"></span>
          <h3>Promotion Available!</h3>
        </div>

        <p class="level-up-reason">
          <RichJapaneseText text={recommendation.reason} />
        </p>

        <div class="level-transition">
          <div class="level-box old">
            <span class="label">Current</span>
            <span class="value">{currentLevelLabel}</span>
          </div>
          <div class="level-arrow" aria-hidden="true">→</div>
          <div class="level-box new">
            <span class="label">Next Level</span>
            <span class="value">
              {nextLevelLabel}
              {#if recommendation.recommendedLevel === 'ready_for_japan'}
                🇯🇵
              {/if}
            </span>
          </div>
        </div>

        <div class="level-actions">
          {#if levelUpStatus === 'accepted'}
            <div class="success-message">
              <span class="hanko-success">合格</span>
              <div>
                <strong>Omedetou!</strong>
                <span class="sub">Level updated successfully.</span>
              </div>
            </div>
          {:else if levelUpStatus === 'error'}
            <div class="error-message">
              Something went wrong. Please try again.
              <button class="btn-text" onclick={() => (levelUpStatus = 'idle')}>Retry</button>
            </div>
          {:else}
            <button
              class="btn btn-celebrate"
              onclick={acceptLevelUp}
              disabled={levelUpStatus === 'loading'}
            >
              {#if levelUpStatus === 'loading'}
                Updating...
              {:else}
                Accept Promotion
              {/if}
            </button>
            <button
              class="btn btn-gentle"
              onclick={declineLevelUp}
              disabled={levelUpStatus === 'loading'}
            >
              Not Yet
            </button>
          {/if}
        </div>
      </div>
    </section>
  {/if}

  <div class="actions">
    <a class="btn btn-secondary" href="/">Return Home</a>
    {#if isOnPracticePage}
      <button
        class="btn btn-primary"
        onclick={async () => {
          await invalidateAll();
          window.location.reload();
        }}
      >
        Practice Again
      </button>
    {:else}
      <a class="btn btn-primary" href="/practice">Try Practice Mode</a>
    {/if}
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
    overflow-wrap: break-word;
    word-break: break-word;
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
    font-size: var(--text-3xl);
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

  .summary-insights-grid {
    display: grid;
    gap: var(--space-6);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-top: var(--space-2);
  }

  .summary-insights-grid > * {
    min-width: 0;
  }

  ul {
    padding-left: 1.25rem;
    margin: 0;
    display: grid;
    gap: var(--space-2);
    color: var(--text-bokashi);
  }

  li {
    overflow-wrap: break-word;
    word-break: break-word;
  }

  h3 {
    margin-bottom: var(--space-3);
    color: var(--text-sumi);
    font-size: var(--text-md);
  }

  .mini-lesson-block {
    display: grid;
    gap: var(--space-3);
  }

  @media (max-width: 42rem) {
    .summary-insights-grid {
      grid-template-columns: 1fr;
    }
  }

  .actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
    justify-content: center;
    margin-top: var(--space-4);
  }

  /* Ink Earned Card */
  .ink-earned-card {
    background-color: var(--bg-kinu);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    border: 1px solid var(--border-light);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: var(--space-2);
  }

  .ink-earned-card h4 {
    margin: 0;
    color: var(--text-bokashi);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: var(--weight-medium);
  }

  .xp-total-container {
    margin: var(--space-2) 0 var(--space-4);
  }

  .xp-total {
    font-family: 'Noto Sans JP', sans-serif;
    font-size: var(--text-2xl);
    font-weight: var(--weight-bold);
    color: var(--text-sumi);
    line-height: 1;
  }

  .xp-breakdown {
    width: 100%;
    max-width: 300px;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }

  .xp-row {
    display: flex;
    justify-content: space-between;
    color: var(--text-bokashi);
    padding: 2px 0;
  }

  .xp-row.highlight {
    color: var(--accent-gold);
    font-weight: var(--weight-medium);
  }

  .xp-row span:last-child {
    font-variant-numeric: tabular-nums;
  }

  /* Milestone Card */
  .milestone-card {
    margin-top: var(--space-6);
    background-color: var(--accent-gold-wash);
    border: 2px solid var(--accent-gold);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    position: relative;
    overflow: hidden;
    text-align: center;
    box-shadow: var(--shadow-md);
  }

  .milestone-header {
    margin-bottom: var(--space-2);
  }

  .milestone-label {
    display: inline-block;
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent-gold);
    border: 1px solid var(--accent-gold);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    margin-top: var(--space-2);
    background: var(--bg-white);
  }

  .milestone-jp {
    font-family: 'Noto Sans JP', serif;
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    color: var(--text-sumi);
    margin: 0;
    line-height: 1.2;
  }

  .milestone-en {
    font-size: var(--text-md);
    color: var(--text-bokashi);
    font-weight: var(--weight-medium);
    margin: 0 0 var(--space-3) 0;
  }

  .milestone-desc {
    font-size: var(--text-base);
    color: var(--text-sumi);
    margin: 0;
    line-height: 1.5;
    max-width: 80%;
    margin: 0 auto;
  }

  .milestone-extra-note {
    margin: var(--space-3) 0 0 0;
    font-size: var(--text-sm, 0.875rem);
    color: var(--text-usuzumi);
  }

  /* Level Up Card */
  .level-up-card {
    margin-top: var(--space-6);
    margin-bottom: var(--space-2);
    background: linear-gradient(to bottom, var(--bg-shoji), var(--bg-white));
    border: 2px solid var(--accent-shu);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    position: relative;
    overflow: hidden;
    box-shadow: var(--shadow-lg);
  }

  .level-up-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: linear-gradient(90deg, var(--accent-shu), var(--accent-gold), var(--accent-shu));
  }

  .level-up-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .level-up-icon {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-shu);
  }

  .level-up-card h3 {
    margin: 0;
    color: var(--accent-shu);
    font-size: var(--text-xl);
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .level-up-content {
    position: relative;
    z-index: 1;
  }

  .level-up-reason {
    text-align: center;
    color: var(--text-sumi);
    margin-bottom: var(--space-6);
    line-height: 1.6;
    font-size: var(--text-md);
  }

  .level-transition {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }

  .level-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    position: relative;
  }

  .level-box.old {
    background: var(--bg-kinu);
    opacity: 0.7;
  }

  .level-box.new {
    background: var(--accent-shu);
    color: white;
    box-shadow: var(--shadow-md);
    transform: scale(1.1);
  }

  .label {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.8;
    margin-bottom: var(--space-1);
  }

  .value {
    font-weight: 800;
    font-size: var(--text-md);
  }

  .level-arrow {
    color: var(--accent-gold);
    font-size: var(--text-xl);
    font-weight: bold;
  }

  .level-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }

  .btn-celebrate {
    background: var(--accent-shu);
    color: white;
    font-weight: bold;
    font-size: var(--text-md);
    padding: var(--space-3) var(--space-8);
    border-radius: var(--radius-full, 9999px);
    border: none;
    cursor: pointer;
    box-shadow: var(--shadow-md);
    transition: box-shadow 0.1s;
    width: 100%;
    max-width: 280px;
  }

  .btn-gentle {
    background: transparent;
    border: none;
    color: var(--text-bokashi);
    cursor: pointer;
    font-size: var(--text-base);
    padding: var(--space-2);
  }
  .btn-gentle:hover {
    color: var(--text-sumi);
    text-decoration: underline;
  }

  .success-message {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    background: var(--bg-shoji);
    border: 1px solid var(--accent-gold);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    animation: pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes pop-in {
    from {
      transform: scale(0.8);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .hanko-success {
    font-family: 'Noto Sans JP', serif;
    font-weight: bold;
    color: var(--accent-shu);
    border: 2px solid var(--accent-shu);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--text-base);
    transform: rotate(-10deg);
  }

  .success-message strong {
    display: block;
    color: var(--accent-shu);
    font-size: var(--text-md);
  }

  .success-message .sub {
    font-size: var(--text-sm);
    color: var(--text-bokashi);
  }

  .error-message {
    color: var(--accent-shu);
    font-size: var(--text-base);
    text-align: center;
  }

  .btn-text {
    background: none;
    border: none;
    color: var(--text-bokashi);
    cursor: pointer;
    text-decoration: underline;
    padding: 0 var(--space-2);
    font-size: var(--text-base);
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
    border-radius: var(--radius-sm);
    color: var(--accent-shu);
    font-weight: var(--weight-bold);
    font-size: var(--text-xl);
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
    font-size: var(--text-xl);
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

    .stagger-1 {
      animation-delay: 200ms;
    }
    .stagger-2 {
      animation-delay: 400ms;
    }
    .stagger-3 {
      animation-delay: 600ms;
    }
    .stagger-4 {
      animation-delay: 800ms;
    }
    .stagger-5 {
      animation-delay: 1000ms;
    }
    .stagger-milestone {
      animation-delay: 1500ms;
    }

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
      0% {
        transform: scale(0.5);
        opacity: 0;
      }
      50% {
        opacity: 0.12;
      }
      100% {
        transform: scale(1);
        opacity: 0.08;
      }
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
      0% {
        opacity: 0;
        transform: translateY(5px);
      }
      100% {
        opacity: 0.6;
        transform: translateY(0);
      }
    }
  }
</style>
