<script lang="ts">
  import type { MissionMode } from '$lib/types';

  let { mode, onToggle, canToggle } = $props<{
    mode: MissionMode;
    onToggle: () => void;
    canToggle: boolean;
  }>();
</script>

<section class="mode-banner" class:immersion={mode === 'immersion'}>
  <p class="text">
    {#if mode === 'practice'}
      📖 Practice Mode
    {:else}
      🏆 Immersion Mode — Badges & XP earned here
    {/if}
  </p>

  {#if canToggle}
    <button type="button" class="toggle" onclick={onToggle}>
      {mode === 'practice' ? 'Switch to Immersion →' : 'Switch to Practice →'}
    </button>
  {/if}
</section>

<style>
  .mode-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-light);
    background: var(--bg-washi);
    min-height: 2.75rem;
  }

  .mode-banner.immersion {
    background: var(--accent-shu-wash);
    border-color: var(--accent-shu-soft);
  }

  .text {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-bokashi);
    font-weight: var(--weight-medium);
  }

  .toggle {
    border: none;
    background: transparent;
    padding: 0;
    margin: 0;
    color: var(--accent-shu);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .toggle:hover {
    color: var(--accent-shu-deep);
    text-decoration: underline;
  }
</style>
