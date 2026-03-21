<script lang="ts">
  import { consumeInkAnimation, pendingInkAnimations } from '$lib/stores/gamification.svelte';
</script>

<div class="ink-feedback" aria-live="polite" aria-atomic="false">
  {#each $pendingInkAnimations as animation (animation.id)}
    <div class="ink-float" onanimationend={() => consumeInkAnimation(animation.id)}>
      +{animation.amount} 墨
    </div>
  {/each}
</div>

<style>
  .ink-feedback {
    position: absolute;
    right: var(--space-4);
    bottom: var(--space-4);
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-2);
    pointer-events: none;
    z-index: var(--z-above);
  }

  .ink-float {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-bokashi);
    line-height: 1;
    opacity: 0;
    animation: ink-float-up var(--ink-float-duration) var(--ease-out) forwards;
    will-change: transform, opacity;
  }

  @keyframes ink-float-up {
    from {
      transform: translateY(0);
      opacity: 1;
    }

    to {
      transform: translateY(-30px);
      opacity: 0;
    }
  }

  @keyframes ink-fade-brief {
    from {
      opacity: 1;
    }

    to {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ink-float {
      animation: ink-fade-brief var(--duration-normal) linear forwards;
      transform: none;
    }
  }
</style>
