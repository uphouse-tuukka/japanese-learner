<script lang="ts">
  let {
    currentXp,
    nextMilestone,
    xpRemaining,
  }: {
    currentXp: number;
    nextMilestone: { name: string; nameJa: string; xpThreshold: number } | null;
    xpRemaining: number;
  } = $props();

  const milestoneThresholds = [
    50, 200, 500, 1000, 2000, 3500, 5000, 7500, 10000, 15000, 25000, 50000,
  ];

  const previousThreshold = $derived.by(() => {
    if (!nextMilestone) return 0;

    const index = milestoneThresholds.findIndex(
      (threshold) => threshold === nextMilestone.xpThreshold,
    );
    if (index <= 0) return 0;
    return milestoneThresholds[index - 1];
  });

  const progressPercent = $derived.by(() => {
    if (!nextMilestone) {
      return 100;
    }

    const nextThreshold = nextMilestone.xpThreshold;
    const prevThreshold = previousThreshold;
    const segment = nextThreshold - prevThreshold;
    if (segment <= 0) {
      return 0;
    }

    const raw = ((currentXp - prevThreshold) / segment) * 100;
    return Math.min(100, Math.max(0, raw));
  });
</script>

<div class="milestone-progress" aria-live="polite">
  {#if nextMilestone}
    <div class="milestone-header">
      <span class="next-label">Next milestone:</span>
      <span class="milestone-name-en">{nextMilestone.name}</span>
      <span class="milestone-name-ja">({nextMilestone.nameJa})</span>
    </div>

    <div
      class="progress-track"
      role="progressbar"
      aria-label={`Progress to ${nextMilestone.name}`}
      aria-valuemin={previousThreshold}
      aria-valuemax={nextMilestone.xpThreshold}
      aria-valuenow={Math.max(previousThreshold, Math.min(currentXp, nextMilestone.xpThreshold))}
    >
      <div class="progress-fill" style={`width: ${progressPercent}%`}></div>
    </div>

    <div class="xp-remaining">{xpRemaining} ink left</div>
  {:else}
    <div class="all-achieved">All milestones achieved! 🎉</div>
  {/if}
</div>

<style>
  .milestone-progress {
    display: grid;
    gap: var(--space-2);
  }

  .milestone-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .next-label {
    font-size: var(--text-xs);
    color: var(--text-bokashi);
    font-weight: var(--weight-medium);
  }

  .milestone-name-en {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-sumi);
    line-height: var(--leading-tight);
  }

  .milestone-name-ja {
    font-size: var(--text-xs);
    color: var(--text-bokashi);
    font-weight: var(--weight-normal);
  }

  .progress-track {
    position: relative;
    height: 6px;
    background: var(--bg-kinu);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent-shu);
    border-radius: var(--radius-sm);
    transition: width var(--duration-slow) var(--ease-out);
  }

  .xp-remaining {
    font-size: var(--text-sm);
    color: var(--text-bokashi);
    line-height: 1;
  }

  .all-achieved {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--accent-gold);
    line-height: var(--leading-tight);
  }
</style>
