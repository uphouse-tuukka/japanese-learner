<script lang="ts">
  import type { MissionWithProgress } from '$lib/types';

  type Props = {
    mission: MissionWithProgress;
    onClick?: () => void;
  };

  let { mission, onClick }: Props = $props();

  function handleActivate(): void {
    onClick?.();
  }
</script>

<div class="mission-node-wrap">
  <button
    type="button"
    class="mission-node"
    class:completed={mission.completedImmersion}
    class:available={mission.unlocked && !mission.completedImmersion}
    class:locked={!mission.unlocked}
    aria-label={mission.title}
    aria-disabled={!mission.unlocked}
    onclick={handleActivate}
  >
    <span class="emoji">{mission.badgeEmoji}</span>

    {#if mission.completedImmersion}
      <span class="overlay completed-overlay" aria-hidden="true">✓</span>
    {:else if !mission.unlocked}
      <span class="overlay locked-overlay" aria-hidden="true">🔒</span>
    {/if}
  </button>

  <p class="mission-title">{mission.title}</p>
</div>

<style>
  .mission-node-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    width: 7rem;
    flex: 0 0 auto;
  }

  .mission-node {
    width: 44px;
    height: 44px;
    border-radius: 999px;
    border: 2px solid var(--border-mid);
    background: var(--bg-kinu);
    color: var(--text-sumi);
    display: grid;
    place-items: center;
    position: relative;
    transition:
      transform var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out),
      background-color var(--duration-fast) var(--ease-out);
  }

  .mission-node:hover {
    position: relative;
    z-index: 10;
    transform: scale(1.06);
  }

  .mission-node.completed {
    background: var(--accent-matcha-wash);
    border-color: var(--accent-matcha);
  }

  .mission-node.available {
    background: var(--bg-shoji);
    border-color: var(--accent-gold);
  }

  .mission-node.locked {
    background: var(--bg-kinu);
    border-color: var(--border-mid);
    color: var(--text-usuzumi);
  }

  .emoji {
    font-size: var(--text-lg);
    line-height: 1;
  }

  .overlay {
    position: absolute;
    right: -4px;
    bottom: -4px;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    font-size: var(--text-xs);
    border: 1px solid var(--border-light);
  }

  .completed-overlay {
    background: var(--accent-matcha);
    color: var(--bg-shoji);
    border-color: var(--accent-matcha);
    font-weight: var(--weight-bold);
  }

  .locked-overlay {
    background: var(--bg-washi);
    color: var(--text-bokashi);
  }

  .mission-title {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-bokashi);
    text-align: center;
    line-height: var(--leading-tight);
    max-width: 100%;
  }
</style>
