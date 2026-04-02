<script lang="ts">
  import { goto } from '$app/navigation';
  import type { Mission, MissionCompleteResponse, MissionMode } from '$lib/types';

  let { data, mission, mode, onTryAgain } = $props<{
    data: MissionCompleteResponse;
    mission: Mission;
    mode: MissionMode;
    onTryAgain?: () => void;
  }>();

  const isImmersion = $derived(mode === 'immersion');
  const passed = $derived(data.passed ?? true);

  async function backToMissions(): Promise<void> {
    await goto('/missions');
  }

  async function primaryAction(): Promise<void> {
    await goto('/missions');
  }

  async function tryAgainAction(): Promise<void> {
    if (onTryAgain) {
      onTryAgain();
      return;
    }

    await goto('/missions');
  }
</script>

<section class="completion card">
  {#if isImmersion && passed}
    <header class="banner success">
      <h2>Mission Complete!</h2>
    </header>
  {:else if isImmersion && !passed}
    <header class="banner not-passed">
      <h2>Not Quite...</h2>
      <p>You need 80% correct to pass and earn the badge.</p>
    </header>
  {:else}
    <header class="banner practice">
      <h2>Practice Complete</h2>
    </header>
  {/if}

  <section class="stats">
    <article class="stat">
      <strong>{data.exchanges}</strong>
      <span>exchanges</span>
    </article>
    <article class="stat">
      <strong>{data.correctResponses}</strong>
      <span>correct</span>
    </article>
    <article class="stat">
      <strong>{data.score}%</strong>
      <span>score</span>
    </article>
  </section>

  <section class="xp-card">
    <h3>XP breakdown</h3>
    <p>
      <span>{isImmersion ? 'Mission completion' : 'Practice completion'}</span><strong
        >+{data.xpBreakdown.missionCompletion}</strong
      >
    </p>
    <p><span>Correct responses</span><strong>+{data.xpBreakdown.correctResponses}</strong></p>
    {#if isImmersion}
      <p><span>Natural phrasing</span><strong>+{data.xpBreakdown.naturalPhrasing}</strong></p>
    {/if}
    <p class="total"><span>Total</span><strong>+{data.xpBreakdown.total}</strong></p>
  </section>

  {#if isImmersion && data.badgeEarned}
    <section class="badge-card earned">
      <p class="badge-emoji">{data.badgeEarned.badgeEmoji}</p>
      <p class="badge-name">{data.badgeEarned.badgeName}</p>
      <p class="badge-statement">{data.confidenceStatement ?? mission.badgeStatement}</p>
      <p class="badge-note">Badge added to your profile ✓</p>
    </section>
  {:else if isImmersion && !passed}
    <section class="badge-card locked">
      <p class="badge-locked-label">Locked</p>
      <p class="badge-name muted">{mission.badgeEmoji} {mission.badgeName}</p>
      <p class="badge-statement muted">Score 80% or higher to earn this badge</p>
    </section>
  {:else}
    <section class="badge-card locked">
      <p class="badge-locked-label">Locked</p>
      <p class="badge-name muted">{mission.badgeEmoji} {mission.badgeName}</p>
      <p class="badge-statement muted">Complete in Immersion Mode to unlock</p>
    </section>
  {/if}

  <footer class="actions">
    <button type="button" class="btn-secondary" onclick={backToMissions}>Back to Missions</button>
    {#if isImmersion && !passed}
      <button type="button" class="btn-primary" onclick={tryAgainAction}>Try Again →</button>
    {:else}
      <button type="button" class="btn-primary" onclick={primaryAction}>
        {isImmersion ? 'Next Mission →' : 'Try in Immersion Mode →'}
      </button>
    {/if}
  </footer>
</section>

<style>
  .completion {
    display: grid;
    gap: var(--space-4);
  }

  .banner {
    padding: var(--space-4);
    border-radius: var(--radius-lg);
  }

  .banner.success {
    background: var(--accent-matcha-wash);
  }

  .banner.practice {
    background: var(--bg-washi);
  }

  .banner.not-passed {
    background: var(--accent-shu-wash);
  }

  .banner h2 {
    margin: 0;
    font-size: var(--text-xl);
    text-align: center;
  }

  .banner.not-passed p {
    margin: var(--space-2) 0 0;
    text-align: center;
    color: var(--text-bokashi);
    font-weight: var(--weight-medium);
  }

  .stats {
    display: flex;
    justify-content: center;
    gap: var(--space-6);
    flex-wrap: wrap;
  }

  .stat {
    display: grid;
    gap: var(--space-1);
    text-align: center;
  }

  .stat strong {
    font-size: var(--text-lg);
  }

  .stat span {
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .xp-card {
    display: grid;
    gap: var(--space-2);
    background: var(--bg-washi);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
  }

  .xp-card h3,
  .xp-card p {
    margin: 0;
  }

  .xp-card p {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    color: var(--text-bokashi);
  }

  .xp-card .total {
    border-top: 1px solid var(--border-light);
    padding-top: var(--space-2);
    color: var(--text-sumi);
    font-weight: var(--weight-semibold);
  }

  .xp-card .total strong {
    color: var(--accent-shu);
  }

  .badge-card {
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    border: 1px solid var(--border-light);
    text-align: center;
    display: grid;
    gap: var(--space-1);
  }

  .badge-card.earned {
    background: var(--accent-gold-wash);
    border-color: var(--accent-gold);
  }

  .badge-card.locked {
    background: var(--bg-kinu);
    border-color: var(--border-mid);
  }

  .badge-emoji,
  .badge-name,
  .badge-statement,
  .badge-note {
    margin: 0;
  }

  .badge-emoji {
    font-size: var(--text-2xl);
  }

  .badge-locked-label {
    font-size: var(--text-sm);
    color: var(--text-usuzumi);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    font-weight: var(--weight-medium);
  }

  .badge-name {
    font-size: var(--text-lg);
    color: var(--text-sumi);
  }

  .badge-statement {
    color: var(--accent-matcha);
    font-size: var(--text-sm);
  }

  .badge-note,
  .muted {
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
  }

  .actions {
    display: flex;
    justify-content: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
</style>
