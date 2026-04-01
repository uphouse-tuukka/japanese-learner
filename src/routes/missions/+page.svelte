<script lang="ts">
  import MissionProgressTrack from '$lib/components/missions/MissionProgressTrack.svelte';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();

  type Mission = PageData['missions'][number];

  const categoryInfo: Record<string, { label: string; emoji: string }> = {
    greetings_basics: { label: 'Greetings & Basics', emoji: '👋' },
    food_dining: { label: 'Food & Dining', emoji: '🍜' },
    transport: { label: 'Transport', emoji: '🚃' },
    hotel_accommodation: { label: 'Hotel & Accommodation', emoji: '🏨' },
    shopping: { label: 'Shopping', emoji: '🛍️' },
    bars_nightlife: { label: 'Bars & Nightlife', emoji: '🍶' },
    emergencies_health: { label: 'Emergencies & Health', emoji: '🏥' },
  };

  const groupedByCategory = $derived.by(() => {
    const grouped = new Map<string, Mission[]>();

    for (const mission of data.missions) {
      const existing = grouped.get(mission.category) ?? [];
      grouped.set(mission.category, [...existing, mission]);
    }

    for (const [category, missions] of grouped) {
      grouped.set(
        category,
        [...missions].sort((a, b) => a.sequence - b.sequence),
      );
    }

    return grouped;
  });

  const categoryOrder = Object.keys(categoryInfo);

  const categoriesToRender = $derived.by(() => {
    const knownInOrder = categoryOrder.filter((category) => groupedByCategory.has(category));
    const unknownCategories = [...groupedByCategory.keys()]
      .filter((category) => !categoryOrder.includes(category))
      .sort((a, b) => a.localeCompare(b));

    return [...knownInOrder, ...unknownCategories];
  });

  const overallProgress = $derived.by(() => {
    const total = data.missions.length;
    const completed = data.missions.filter((mission: Mission) => mission.completedImmersion).length;
    return { completed, total };
  });

  const categoryProgress = $derived.by(() => {
    const progressMap = new Map<string, { completed: number; total: number; mastered: boolean }>();

    for (const [category, missions] of groupedByCategory) {
      const total = missions.length;
      const completed = missions.filter((mission) => mission.completedImmersion).length;
      progressMap.set(category, {
        completed,
        total,
        mastered: total > 0 && completed === total,
      });
    }

    return progressMap;
  });
</script>

<div class="missions-page page-transition">
  <header class="header">
    <div>
      <h1>Travel Missions</h1>
      <p class="subtitle">ミッション</p>
    </div>
  </header>

  <section class="card overview-card">
    <p class="overview-item">
      Overall progress:
      <strong>{overallProgress.completed}/{overallProgress.total}</strong>
      completed immersion missions
    </p>
    {#if data.unlockAllOverride}
      <p class="overview-item override-note">Dev override enabled: all missions unlocked.</p>
    {/if}
  </section>

  <section class="categories">
    {#each categoriesToRender as category (category)}
      {@const missions = groupedByCategory.get(category) ?? []}
      {@const info = categoryInfo[category] ?? { label: category, emoji: '🧭' }}
      {@const progress = categoryProgress.get(category) ?? {
        completed: 0,
        total: missions.length,
        mastered: false,
      }}

      <article class="card category-card">
        <div class="category-header">
          <h2>{info.emoji} {info.label}</h2>
          <p class="category-count">{progress.completed}/{progress.total}</p>
        </div>

        <MissionProgressTrack {missions} categoryMastered={progress.mastered} />
      </article>
    {/each}
  </section>
</div>

<style>
  .missions-page {
    display: grid;
    gap: var(--space-6);
    max-width: var(--content-width);
    margin: 0 auto;
    padding-bottom: var(--space-12);
  }

  .header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    border-bottom: 1px solid var(--border-light);
    padding-bottom: var(--space-4);
    margin-top: var(--space-4);
  }

  .subtitle {
    margin: var(--space-1) 0 0;
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
    letter-spacing: var(--tracking-wide);
  }

  .overview-card {
    display: grid;
    gap: var(--space-2);
  }

  .overview-item {
    margin: 0;
    color: var(--text-bokashi);
  }

  .overview-item strong {
    color: var(--text-sumi);
  }

  .override-note {
    color: var(--accent-shu);
    font-size: var(--text-sm);
  }

  .categories {
    display: grid;
    gap: var(--space-4);
  }

  .category-card {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-5);
  }

  .category-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .category-header h2 {
    font-size: var(--text-lg);
    margin: 0;
  }

  .category-count {
    margin: 0;
    color: var(--text-bokashi);
    font-size: var(--text-sm);
    white-space: nowrap;
  }
</style>
