<script lang="ts">
  import type { Snippet } from 'svelte';

  type ResultState = 'correct' | 'incorrect' | 'neutral';

  interface Props {
    state: ResultState;
    title: string;
    aiVerified?: boolean;
    showReward?: boolean;
    children?: Snippet;
    className?: string;
    ariaLive?: 'off' | 'polite' | 'assertive';
  }

  let {
    state,
    title,
    aiVerified = false,
    showReward = true,
    children,
    className = '',
    ariaLive = 'polite',
  }: Props = $props();
</script>

<section class={`exercise-result-panel ${state} ${className}`.trim()} aria-live={ariaLive}>
  <div class="exercise-result-panel__header">
    <p class="exercise-result-panel__title">{title}</p>
    {#if aiVerified}
      <span class="exercise-result-panel__badge">AI verified</span>
    {/if}
    {#if showReward && state === 'correct'}
      <span class="exercise-result-panel__reward">+10 墨</span>
    {/if}
  </div>

  {#if children}
    <div class="exercise-result-panel__details">
      {@render children()}
    </div>
  {/if}
</section>

<style>
  .exercise-result-panel {
    display: grid;
    gap: var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-lg);
    padding: var(--exercise-result-padding, var(--space-4));
    background: var(--bg-washi);
    animation: exercise-result-reveal 300ms var(--ease-out);
  }

  .exercise-result-panel.correct {
    border-color: var(--state-success);
    background: var(--accent-matcha-wash);
  }

  .exercise-result-panel.incorrect {
    border-color: var(--state-error);
    background: var(--accent-shu-wash);
  }

  .exercise-result-panel__header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .exercise-result-panel__title {
    margin: 0;
    color: var(--text-sumi);
    font-size: var(--text-lg);
    font-weight: var(--weight-medium);
  }

  .exercise-result-panel.correct .exercise-result-panel__title {
    color: var(--state-success);
  }

  .exercise-result-panel.incorrect .exercise-result-panel__title {
    color: var(--state-error);
  }

  .exercise-result-panel__badge {
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-2);
    background: var(--bg-white);
    color: var(--state-success);
    font-size: var(--text-xs);
    font-weight: var(--weight-regular);
  }

  .exercise-result-panel__reward {
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
    font-weight: var(--weight-regular);
  }

  .exercise-result-panel__details {
    display: grid;
    gap: var(--space-2);
  }

  .exercise-result-panel__details :global(p) {
    margin: 0;
  }

  @keyframes exercise-result-reveal {
    from {
      opacity: 0;
      transform: translateY(8px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
