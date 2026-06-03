<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    ariaLabel?: string;
    kicker?: string;
    meta?: Snippet;
    children: Snippet;
    actions?: Snippet;
    className?: string;
  }

  let { title, ariaLabel, kicker, meta, children, actions, className = '' }: Props = $props();
</script>

<section class={`card exercise-frame ${className}`.trim()} aria-label={ariaLabel ?? title}>
  <header class="exercise-frame__header">
    <div class="exercise-frame__heading">
      {#if kicker}
        <p class="exercise-frame__kicker">{kicker}</p>
      {/if}
      <h2>{title}</h2>
    </div>

    {#if meta}
      <div class="exercise-frame__meta">
        {@render meta()}
      </div>
    {/if}
  </header>

  <div class="exercise-frame__body">
    {@render children()}
  </div>

  {#if actions}
    <div class="exercise-actions">
      {@render actions()}
    </div>
  {/if}
</section>

<style>
  .exercise-frame {
    display: grid;
    gap: var(--exercise-frame-gap);
  }

  .exercise-frame__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .exercise-frame__heading {
    display: grid;
    gap: var(--space-1);
  }

  .exercise-frame__heading h2,
  .exercise-frame__kicker {
    margin: 0;
  }

  .exercise-frame__kicker {
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
  }

  .exercise-frame__meta {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-2);
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }

  .exercise-frame__body {
    display: grid;
    gap: var(--exercise-control-gap);
  }

  .exercise-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--exercise-action-gap);
  }

  @media (max-width: 37.5rem) {
    .exercise-frame__header,
    .exercise-actions {
      display: grid;
    }

    .exercise-frame__meta {
      justify-content: flex-start;
    }

    .exercise-actions :global(.btn) {
      width: 100%;
    }
  }
</style>
