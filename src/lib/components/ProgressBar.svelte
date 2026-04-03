<script lang="ts">
  let {
    current,
    total,
    label = 'Progress',
  } = $props<{ current: number; total: number; label?: string }>();

  const clampedCurrent = $derived(total > 0 ? Math.min(Math.max(current, 0), total) : 0);
  const percent = $derived(total > 0 ? Math.round((clampedCurrent / total) * 100) : 0);
</script>

<div class="progress-wrap" aria-label={label} role="group">
  <div class="progress-label-row">
    <span>{label}</span>
    <span>{clampedCurrent} / {total}</span>
  </div>
  <div
    class="progress-track"
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={total}
    aria-valuenow={clampedCurrent}
  >
    <div class="progress-fill" style={`width: ${percent}%`}></div>
  </div>
</div>

<style>
  .progress-wrap {
    display: grid;
    gap: var(--space-2);
  }

  .progress-label-row {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-sm);
    color: var(--text-bokashi);
  }

  .progress-track {
    height: 10px;
    border-radius: 999px;
    background-color: var(--bg-kinu);
    border: 1px solid var(--border-light);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background-color: var(--accent-matcha);
    transition: width var(--duration-slow) var(--ease-out);
  }
</style>
