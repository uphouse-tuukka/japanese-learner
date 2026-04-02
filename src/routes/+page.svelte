<script lang="ts">
  import MilestoneProgress from '$lib/components/MilestoneProgress.svelte';
  import UserSelector from '$lib/components/UserSelector.svelte';
  import { type GamificationStats } from '$lib/types';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();
  let writingEnabled = $state(false);
  let writingTogglePending = $state(false);
  let writingToggleError = $state<string | null>(null);

  const selectedUser = $derived<PageData['selectedUser']>(data.selectedUser);
  const isReadyForJapan = $derived(selectedUser?.level === 'ready_for_japan');
  const fallbackFirstMilestone: NonNullable<GamificationStats['nextMilestone']> = {
    key: 'first_ink',
    name: 'First Stroke',
    nameJa: '一筆',
    description: 'Your first confident brush mark on the learning path.',
    xpThreshold: 10,
  };

  const gamification = $derived.by(() => {
    const value = data.gamification;
    if (value) {
      return value;
    }

    return {
      totalXp: 0,
      currentStreak: 0,
      longestStreak: 0,
      dailyGoalMet: false,
      nextMilestone: fallbackFirstMilestone,
      xpToNextMilestone: fallbackFirstMilestone.xpThreshold,
    } satisfies GamificationStats;
  });

  $effect(() => {
    writingEnabled = data.selectedUser?.japaneseWritingEnabled ?? false;
    writingTogglePending = false;
    writingToggleError = null;
  });

  async function toggleJapaneseWriting(): Promise<void> {
    if (!selectedUser || writingTogglePending) return;

    const nextEnabled = !writingEnabled;
    writingEnabled = nextEnabled;
    writingToggleError = null;
    writingTogglePending = true;

    try {
      const response = await fetch('/api/user/writing-toggle', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          enabled: nextEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error(`Writing toggle request failed: ${response.status}`);
      }
    } catch (error) {
      console.error('dashboard.writing_toggle_failed', {
        userId: selectedUser.id,
        enabled: nextEnabled,
        error: error instanceof Error ? error.message : String(error),
      });
      writingEnabled = !nextEnabled;
      writingToggleError = 'Could not update writing preference. Please try again.';
    } finally {
      writingTogglePending = false;
    }
  }
</script>

<section class="home page-transition">
  {#if !data.selectedUser}
    <article class="card block">
      <h1>Select learner</h1>
      <p>Choose who is studying today.</p>
      <UserSelector users={data.users} selectedUserId={null} maxUsers={data.maxUsers} />
    </article>
  {:else}
    <div class="dashboard">
      <header class="welcome-header">
        <h1>こんにちは、{data.selectedUser.name}さん</h1>
      </header>

      {#if isReadyForJapan}
        <article class="card ready-badge-card">
          <div class="ready-badge" aria-label="Ready for Japan achievement badge">
            <p class="badge-kana">日本準備完了</p>
            <p class="badge-title">Ready for Japan 🇯🇵</p>
            <p class="badge-subtitle">おめでとうございます！</p>
          </div>
        </article>
      {/if}

      <!-- Hero Card -->
      <article class="card hero-card">
        <div class="hero-content">
          <div class="hero-stats">
            <div class="streak-number-container">
              <span class="streak-number" class:is-zero={gamification.currentStreak === 0}>
                {gamification.currentStreak}
              </span>
            </div>

            <div class="streak-info">
              {#if gamification.currentStreak > 0}
                <span class="streak-label">Day Streak</span>
              {:else}
                <span class="streak-label">Start your streak</span>
              {/if}

              <div class="daily-goal">
                {#if gamification.dailyGoalMet}
                  <span class="goal-met">✓ Goal complete</span>
                {:else}
                  <span class="goal-pending">Today's goal: complete a session</span>
                {/if}
              </div>
            </div>
          </div>

          <div class="hero-actions">
            <a href="/learn" class="btn-primary start-button"> Start Today's Session </a>
            <a href="/practice" class="practice-link"> Practice weak points → </a>
          </div>
        </div>
      </article>

      <!-- Combined Stats Card -->
      <article class="card combined-stats-card">
        <div class="ink-stat">
          <div class="ink-value-group">
            <span class="ink-value">{gamification.totalXp}</span>
            <span class="ink-suffix">墨</span>
          </div>
          <span class="ink-label">Ink earned</span>
        </div>
        <div class="milestone-wrapper">
          <MilestoneProgress
            currentXp={gamification.totalXp}
            nextMilestone={gamification.nextMilestone}
            xpRemaining={gamification.xpToNextMilestone}
          />
        </div>
      </article>

      <!-- Settings Card -->
      <section class="card settings-card">
        <h2>Study settings</h2>
        <p class="settings-description">Choose how your learning sessions are generated.</p>

        <div class="toggle-row">
          <div>
            <p class="toggle-label">Japanese writing exercises</p>
            <p class="toggle-help">Practice writing in hiragana and katakana</p>
          </div>

          <button
            type="button"
            class="writing-switch"
            class:is-on={writingEnabled}
            role="switch"
            aria-checked={writingEnabled}
            aria-busy={writingTogglePending}
            disabled={writingTogglePending}
            onclick={toggleJapaneseWriting}
          >
            <span class="switch-thumb" aria-hidden="true"></span>
            <span class="switch-text">{writingEnabled ? 'On' : 'Off'}</span>
          </button>
        </div>

        {#if writingToggleError}
          <p class="error-message">{writingToggleError}</p>
        {/if}
      </section>
    </div>
  {/if}
</section>

<style>
  .home {
    display: grid;
    gap: var(--space-4);
    max-width: var(--content-width);
    margin: 0 auto;
    width: 100%;
  }

  .block {
    display: grid;
    gap: var(--space-3);
  }

  .error-message {
    font-size: var(--text-sm);
    color: var(--state-error);
  }

  /* Dashboard Layout */
  .dashboard {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .welcome-header h1 {
    font-size: var(--text-2xl);
    margin-bottom: var(--space-1);
  }

  /* Hero Card */
  .hero-card {
    padding: var(--space-6);
    background: white;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .hero-content {
    width: 100%;
    max-width: 24rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    margin: 0 auto;
    align-items: center;
  }

  .hero-stats {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--space-4);
  }

  .streak-number-container {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .streak-number {
    font-size: 3rem;
    font-weight: var(--weight-bold);
    color: var(--accent-shu);
    line-height: 1;
  }

  .streak-number.is-zero {
    color: var(--text-usuzumi);
  }

  .streak-info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-1);
  }

  .streak-label {
    font-size: var(--text-base);
    color: var(--text-sumi);
    font-weight: var(--weight-medium);
  }

  .daily-goal {
    font-size: var(--text-sm);
    display: flex;
    align-items: center;
  }

  .goal-met {
    color: var(--accent-matcha);
  }

  .goal-pending {
    color: var(--text-bokashi);
    opacity: 0.8;
  }

  .hero-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .start-button {
    width: 100%;
    justify-content: center;
    font-size: var(--text-base);
    padding: var(--space-3) var(--space-6);
  }

  .practice-link {
    font-size: var(--text-sm);
    color: var(--text-bokashi);
    text-align: center;
  }

  .practice-link:hover {
    color: var(--accent-shu);
  }

  /* Combined Stats Card */
  .combined-stats-card {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-5);
  }

  .ink-stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .ink-value-group {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .ink-value {
    font-size: var(--text-2xl);
    font-weight: var(--weight-bold);
    color: var(--text-sumi);
    line-height: 1;
  }

  .ink-suffix {
    font-size: var(--text-lg);
    color: var(--text-usuzumi);
    font-family: 'Noto Sans JP', sans-serif;
  }

  .ink-label {
    font-size: var(--text-sm);
    color: var(--text-bokashi);
    font-weight: var(--weight-medium);
  }

  .milestone-wrapper {
    width: 100%;
  }

  /* Ready Badge */
  .ready-badge-card {
    background:
      radial-gradient(
        circle at 20% 20%,
        color-mix(in srgb, var(--accent-shu) 16%, transparent),
        transparent 50%
      ),
      linear-gradient(
        120deg,
        var(--bg-kinu, #eee9df),
        color-mix(in srgb, var(--bg-shoji, #faf8f4) 82%, #d8b561 18%)
      );
    border: 1px solid color-mix(in srgb, #d8b561 65%, var(--border-light));
  }

  .ready-badge {
    display: grid;
    gap: var(--space-1);
    justify-items: center;
    text-align: center;
    padding: var(--space-2) 0;
    animation: badge-entry 640ms ease-out;
  }

  .badge-kana {
    margin: 0;
    font-family: 'Noto Sans JP', sans-serif;
    color: var(--accent-shu);
    letter-spacing: 0.08em;
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
  }

  .badge-title {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    color: var(--text-sumi);
  }

  .badge-subtitle {
    margin: 0;
    color: var(--text-bokashi);
    font-family: 'Noto Sans JP', sans-serif;
    font-size: var(--text-sm);
  }

  /* Settings Card */
  .settings-card {
    display: grid;
    gap: var(--space-3);
    background: var(--bg-kinu, #eee9df);
  }

  .settings-description {
    margin: 0;
    color: var(--text-bokashi);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    background: var(--bg-shoji, #faf8f4);
  }

  .toggle-label {
    margin: 0;
    color: var(--text-sumi);
    font-weight: var(--weight-medium);
  }

  .toggle-help {
    margin: var(--space-1) 0 0;
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }

  .writing-switch {
    display: inline-flex;
    position: relative;
    align-items: center;
    border: 1px solid var(--border-medium);
    background: var(--bg-kinu, #eee9df);
    border-radius: 999px;
    padding: 0;
    width: 4.5rem;
    height: 2.2rem;
    cursor: pointer;
    color: var(--text-bokashi);
    transition: all 0.2s ease;
  }

  .writing-switch:disabled {
    opacity: 0.7;
    cursor: progress;
  }

  .writing-switch.is-on {
    border-color: color-mix(in srgb, var(--accent-matcha) 80%, #0000);
    background: color-mix(in srgb, var(--accent-matcha) 20%, var(--bg-shoji, #faf8f4));
    color: color-mix(in srgb, var(--accent-matcha) 85%, var(--text-sumi));
  }

  .switch-thumb {
    position: absolute;
    left: 0.25rem;
    top: 50%;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    background: var(--accent-shu);
    box-shadow: 0 1px 4px color-mix(in srgb, var(--accent-shu) 40%, transparent);
    transform: translateY(-50%);
    transition:
      transform 0.2s cubic-bezier(0.2, 0, 0, 1),
      background 0.2s ease;
    z-index: 1;
  }

  .writing-switch.is-on .switch-thumb {
    transform: translate(2.4rem, -50%);
    background: var(--accent-matcha);
  }

  .switch-text {
    width: 100%;
    padding: 0 0.8rem 0 0.8rem;
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    text-align: right;
    user-select: none;
  }

  .writing-switch.is-on .switch-text {
    text-align: left;
  }

  @keyframes badge-entry {
    0% {
      opacity: 0;
      transform: translateY(6px) scale(0.98);
    }
    60% {
      opacity: 1;
      transform: translateY(0) scale(1.01);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (max-width: 44rem) {
    .toggle-row {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
