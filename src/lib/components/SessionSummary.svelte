<script lang="ts">
  import {
    LEVEL_LABELS,
    LEVEL_ORDER,
    type SessionSummary as SessionSummaryType,
    type UserLevel,
    type SessionXpBreakdown,
    // type Milestone,
  } from '$lib/types';
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
      <p class="celebrate-text">🎉 Excellent work. Great consistency.</p>
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
            <span>Perfect score ✦</span>
            <span>+{xpBreakdown.perfectBonusXp}墨</span>
          </div>
        {/if}
        {#if xpBreakdown.streakBonusXp > 0}
          <div class="xp-row highlight">
            <span>Streak bonus 🔥</span>
            <span>+{xpBreakdown.streakBonusXp}墨</span>
          </div>
        {/if}
        {#if xpBreakdown.comboBonusXp > 0}
          <div class="xp-row highlight">
            <span>Combo bonus ⚡</span>
            <span>+{xpBreakdown.comboBonusXp}墨</span>
          </div>
        {/if}
      </div>
    </section>
  {/if}

  <div class="grid">
    <section class="stagger-2 stagger-item">
      <h3>Strengths</h3>
      <ul>
        {#each summary.strengths as item}
          <li>{item}</li>
        {/each}
      </ul>
    </section>
    <section class="stagger-3 stagger-item">
      <h3>Areas to improve</h3>
      <ul>
        {#each summary.weaknesses as item}
          <li>{item}</li>
        {/each}
      </ul>
    </section>
    <section class="stagger-4 stagger-item">
      <h3>Next steps</h3>
      <ul>
        {#each summary.nextSteps as item}
          <li>{item}</li>
        {/each}
      </ul>
    </section>
  </div>

  {#if xpBreakdown?.newMilestones?.length}
    {#each xpBreakdown.newMilestones as milestone}
      <section class="milestone-card stagger-milestone stagger-item">
        <div class="milestone-content">
          <div class="milestone-header">
            <h3 class="milestone-jp">{milestone.nameJa}</h3>
            <span class="milestone-label">Milestone Unlocked</span>
          </div>
          <h4 class="milestone-en">{milestone.name}</h4>
          <p class="milestone-desc">{milestone.description}</p>
        </div>
        <div class="milestone-decoration">✦</div>
      </section>
    {/each}
  {/if}

  {#if recommendation && levelUpStatus !== 'declined'}
    <section class="level-up-card stagger-5 stagger-item" aria-label="Level up recommendation">
      <div class="confetti-container" aria-hidden="true">
        <div class="confetti c1"></div>
        <div class="confetti c2"></div>
        <div class="confetti c3"></div>
        <div class="confetti c4"></div>
      </div>

      <div class="level-up-content">
        <div class="level-up-header">
          <span class="level-up-icon">🎉</span>
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
          <div class="level-arrow">➜</div>
          <div class="level-box new">
            <span class="label">Next Level</span>
            <span class="value">
              {nextLevelLabel}
              {#if recommendation.recommendedLevel === 'ready_for_japan'}
                🇯🇵
              {/if}
            </span>
            <div class="sparkle s1">✦</div>
            <div class="sparkle s2">✦</div>
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

  .grid > * {
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
    font-size: 1.125rem;
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
    font-size: 2.5rem;
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
    box-shadow: 0 4px 12px rgba(216, 181, 97, 0.2);
  }

  .milestone-header {
    margin-bottom: var(--space-2);
  }

  .milestone-label {
    display: inline-block;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent-gold);
    border: 1px solid var(--accent-gold);
    padding: 2px 6px;
    border-radius: 4px;
    margin-top: var(--space-2);
    background: #fff;
  }

  .milestone-jp {
    font-family: 'Noto Sans JP', serif;
    font-size: 2rem;
    font-weight: var(--weight-bold);
    color: var(--text-sumi);
    margin: 0;
    line-height: 1.2;
  }

  .milestone-en {
    font-size: 1.1rem;
    color: var(--text-bokashi);
    font-weight: var(--weight-medium);
    margin: 0 0 var(--space-3) 0;
  }

  .milestone-desc {
    font-size: 0.95rem;
    color: var(--text-sumi);
    margin: 0;
    line-height: 1.5;
    max-width: 80%;
    margin: 0 auto;
  }

  .milestone-decoration {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    color: var(--accent-gold);
    font-size: 1.5rem;
    opacity: 0.5;
  }

  /* Level Up Card */
  .level-up-card {
    margin-top: var(--space-6);
    margin-bottom: var(--space-2);
    background: linear-gradient(to bottom, #fffdf5, #fff);
    border: 2px solid var(--accent-shu);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    position: relative;
    overflow: hidden;
    box-shadow: 0 8px 20px rgba(194, 59, 34, 0.15);
  }

  .level-up-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: linear-gradient(90deg, var(--accent-shu), #e6b422, var(--accent-shu));
    background-size: 200% 100%;
    animation: shimmer 3s infinite linear;
  }

  @keyframes shimmer {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: -100% 0;
    }
  }

  .level-up-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .level-up-icon {
    font-size: 1.5rem;
    animation: bounce 1s infinite alternate ease-in-out;
  }

  @keyframes bounce {
    0% {
      transform: translateY(0);
    }
    100% {
      transform: translateY(-4px);
    }
  }

  .level-up-card h3 {
    margin: 0;
    color: var(--accent-shu);
    font-size: 1.5rem;
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
    font-size: 1.05rem;
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
    box-shadow: 0 4px 12px rgba(194, 59, 34, 0.3);
    transform: scale(1.1);
  }

  .label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.8;
    margin-bottom: 2px;
  }

  .value {
    font-weight: 800;
    font-size: 1.1rem;
  }

  .level-arrow {
    color: #e6b422;
    font-size: 1.5rem;
    font-weight: bold;
  }

  .sparkle {
    position: absolute;
    color: #ffd700;
    font-size: 0.8rem;
    animation: twinkle 1.5s infinite ease-in-out;
  }
  .sparkle.s1 {
    top: -5px;
    right: -5px;
    animation-delay: 0s;
  }
  .sparkle.s2 {
    bottom: -5px;
    left: -5px;
    animation-delay: 0.5s;
  }

  @keyframes twinkle {
    0%,
    100% {
      transform: scale(0.8) rotate(0deg);
      opacity: 0.6;
    }
    50% {
      transform: scale(1.3) rotate(180deg);
      opacity: 1;
    }
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
    font-size: 1.1rem;
    padding: 0.8rem 2rem;
    border-radius: var(--radius-full, 9999px);
    border: none;
    cursor: pointer;
    box-shadow:
      0 4px 0 #9a2b16,
      0 8px 10px rgba(0, 0, 0, 0.1);
    transition:
      transform 0.1s,
      box-shadow 0.1s;
    width: 100%;
    max-width: 280px;
  }

  .btn-celebrate:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow:
      0 6px 0 #9a2b16,
      0 12px 16px rgba(0, 0, 0, 0.15);
  }

  .btn-celebrate:active {
    transform: translateY(4px);
    box-shadow:
      0 0 0 #9a2b16,
      inset 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .btn-gentle {
    background: transparent;
    border: none;
    color: var(--text-bokashi);
    cursor: pointer;
    font-size: 0.9rem;
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
    background: #fffdf5;
    border: 1px solid #e6b422;
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
    font-size: 0.9rem;
    transform: rotate(-10deg);
  }

  .success-message strong {
    display: block;
    color: var(--accent-shu);
    font-size: 1.1rem;
  }

  .success-message .sub {
    font-size: 0.85rem;
    color: var(--text-bokashi);
  }

  .error-message {
    color: var(--accent-shu);
    font-size: 0.9rem;
    text-align: center;
  }

  .btn-text {
    background: none;
    border: none;
    color: var(--text-bokashi);
    cursor: pointer;
    text-decoration: underline;
    padding: 0 var(--space-2);
    font-size: 0.9rem;
  }

  /* Confetti decoration */
  .confetti-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: hidden;
    z-index: 0;
  }
  .confetti {
    position: absolute;
    width: 8px;
    height: 8px;
    background: #ffd700;
    opacity: 0.6;
  }
  .c1 {
    top: 20%;
    left: 10%;
    transform: rotate(15deg);
    background: var(--accent-shu);
  }
  .c2 {
    top: 15%;
    right: 15%;
    transform: rotate(-30deg);
    background: #e6b422;
  }
  .c3 {
    bottom: 30%;
    left: 20%;
    transform: rotate(45deg);
    background: #e6b422;
  }
  .c4 {
    bottom: 25%;
    right: 10%;
    transform: rotate(-10deg);
    background: var(--accent-shu);
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
