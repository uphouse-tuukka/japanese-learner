<script lang="ts">
  import type { Snippet } from 'svelte';

  type StatusTone = 'neutral' | 'warning' | 'error' | 'success';

  interface Props {
    tone?: StatusTone;
    role?: 'status' | 'alert' | 'note';
    children: Snippet;
    className?: string;
  }

  let { tone = 'neutral', role = 'status', children, className = '' }: Props = $props();
</script>

<div class={`exercise-status-panel ${tone} ${className}`.trim()} {role}>
  {@render children()}
</div>

<style>
  .exercise-status-panel {
    display: grid;
    gap: var(--space-2);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
    background: var(--bg-kinu);
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }

  .exercise-status-panel.success {
    border-color: var(--state-success);
    background: var(--accent-matcha-wash);
    color: var(--state-success);
  }

  .exercise-status-panel.warning {
    border-color: var(--state-warning);
    background: var(--accent-gold-wash);
    color: var(--text-bokashi);
  }

  .exercise-status-panel.error {
    border-color: var(--state-error);
    background: var(--accent-shu-wash);
    color: var(--state-error);
  }

  .exercise-status-panel :global(p) {
    margin: 0;
  }
</style>
