<script lang="ts">
  let { level }: { level: string } = $props();

  const LEVEL_LABELS: Record<string, string> = {
    absolute_beginner: 'Absolute Beginner',
    beginner: 'Beginner',
    elementary: 'Elementary',
    pre_intermediate: 'Pre-Intermediate',
    intermediate: 'Intermediate',
    upper_intermediate: 'Upper Intermediate',
    advanced: 'Advanced',
    ready_for_japan: 'Ready for Japan',
  };

  const displayName = $derived(LEVEL_LABELS[level] ?? 'Level');

  const tierClass = $derived.by(() => {
    if (level === 'absolute_beginner' || level === 'beginner') return 'tier-1';
    if (level === 'elementary' || level === 'pre_intermediate') return 'tier-2';
    if (level === 'intermediate' || level === 'upper_intermediate') return 'tier-3';
    if (level === 'advanced' || level === 'ready_for_japan') return 'tier-4';
    return 'tier-1';
  });
</script>

<div
  class={`level-badge ${tierClass}`}
  title={displayName}
  aria-label={`Current level: ${displayName}`}
>
  <span>{displayName}</span>
</div>

<style>
  .level-badge {
    width: 66px;
    height: 66px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    text-align: center;
    background: var(--bg-washi);
    position: relative;
    flex-shrink: 0;
  }

  .level-badge span {
    font-size: 9px;
    line-height: 1.15;
    font-weight: var(--weight-medium);
    color: var(--text-sumi);
    letter-spacing: 0.02em;
    max-width: 52px;
  }

  .tier-1 {
    border: 1px solid var(--text-sumi);
  }

  .tier-2 {
    border: 2px solid var(--text-sumi);
    box-shadow:
      inset 0 0 0 3px var(--bg-washi),
      inset 0 0 0 4px var(--border-light),
      0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .tier-3 {
    border: 2px solid var(--accent-shu);
    box-shadow:
      inset 0 0 0 3px var(--bg-washi),
      inset 0 0 0 4px color-mix(in srgb, var(--accent-shu) 45%, white),
      0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .tier-3 span {
    color: var(--accent-shu);
  }

  .tier-3::before,
  .tier-3::after {
    content: '';
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: var(--accent-shu);
    opacity: 0.7;
    top: 50%;
    transform: translateY(-50%);
  }

  .tier-3::before {
    left: 8px;
  }

  .tier-3::after {
    right: 8px;
  }

  .tier-4 {
    border: 2px solid var(--accent-gold);
    box-shadow:
      inset 0 0 0 3px var(--bg-washi),
      inset 0 0 0 4px color-mix(in srgb, var(--accent-gold) 55%, white),
      0 0 0 1px color-mix(in srgb, var(--accent-gold) 45%, transparent),
      0 2px 5px rgba(0, 0, 0, 0.12);
  }

  .tier-4 span {
    color: color-mix(in srgb, var(--accent-gold) 75%, var(--text-sumi));
    font-weight: var(--weight-bold);
  }

  .tier-4::before {
    content: '';
    position: absolute;
    inset: 8px;
    border-radius: 999px;
    border: 1px dashed color-mix(in srgb, var(--accent-gold) 70%, transparent);
    pointer-events: none;
  }
</style>
