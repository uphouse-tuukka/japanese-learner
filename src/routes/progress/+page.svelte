<script lang="ts">
  import LevelBadge from '$lib/components/LevelBadge.svelte';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();

  function getAccuracyColor(accuracy: number) {
    if (accuracy >= 80) return 'var(--accent-matcha)';
    if (accuracy >= 50) return 'var(--state-warning)';
    return 'var(--accent-shu)';
  }

  const typeLabels: Record<string, string> = {
    multiple_choice: 'Multiple Choice',
    translation: 'Translation',
    fill_blank: 'Fill in the Blank',
    reorder: 'Word Order',
    reading: 'Reading',
    listening: 'Listening',
  };

  function buildCalendarData(activityDates: string[]) {
    const toLocalDateKey = (value: Date): string => value.toLocaleDateString('sv-SE');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = toLocalDateKey(today);
    const currentDay = today.getDay();
    const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
    const weeksToShow = 12;
    const daysTotal = weeksToShow * 7;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysSinceMonday - (weeksToShow - 1) * 7);
    const days = [];
    const activeSet = new Set(activityDates);
    for (let i = 0; i < daysTotal; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = toLocalDateKey(d);
      days.push({
        dateStr,
        isToday: dateStr === todayKey,
        isFuture: d.getTime() > today.getTime(),
        isActive: activeSet.has(dateStr),
        label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d),
      });
    }
    return days;
  }

  function buildMilestoneGallery(
    milestones: Array<{
      key: string;
      name: string;
      nameJa: string;
      icon: string;
      xpThreshold: number;
    }>,
    unlockedMilestones: Array<{ milestoneKey: string; createdAt: string }>,
    totalXp: number,
  ) {
    const unlockedMap = new Map(unlockedMilestones.map((m) => [m.milestoneKey, m]));
    return milestones.map((m) => {
      const unlocked = unlockedMap.get(m.key);
      return {
        ...m,
        isUnlocked: totalXp >= m.xpThreshold,
        achievedAt: unlocked ? new Date(unlocked.createdAt).toLocaleDateString() : null,
      };
    });
  }

  function buildSkillBreakdown(
    items: Array<{ type: string; totalCount: number; correctCount: number; accuracy: number }>,
  ) {
    return items
      .map((item) => ({
        ...item,
        label: typeLabels[item.type] || item.type,
        accuracyPct: item.accuracy,
      }))
      .sort((a, b) => b.totalCount - a.totalCount);
  }

  function buildHistoryList(
    history: Array<{
      session: { createdAt: string; mode: string };
      accuracy: number;
      exerciseCount: number;
    }>,
  ) {
    return history.map((h) => ({
      ...h,
      dateLabel: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(h.session.createdAt)),
      modeLabel: h.session.mode,
      accuracyPct: h.accuracy,
    }));
  }
</script>

<div class="progress-page page-transition">
  {#if !data.lazy}
    <header class="header-section">
      <h1>Progress</h1>
    </header>
    <p class="empty-state">Select a user to view progress.</p>
  {:else}
    {#await data.lazy}
      <!-- SHIMMER SKELETON -->
      <header class="header-section">
        <h1>Progress</h1>
        <div class="header-badges">
          <div class="total-ink-badge">
            <span class="shimmer-block" style="width: 4rem; height: 2.25rem;"></span>
            <span class="shimmer-block" style="width: 6rem; height: 1rem;"></span>
          </div>
          <span
            class="shimmer-block"
            style="width: 5rem; height: 2.5rem; border-radius: var(--radius-md);"
          ></span>
        </div>
      </header>

      <section class="card section-streak">
        <div class="section-header">
          <h2>Consistency</h2>
          <div class="streak-stats">
            <span class="shimmer-block" style="width: 10rem; height: 1rem;"></span>
          </div>
        </div>
        <div class="calendar-container">
          <div class="calendar-grid skeleton-calendar">
            {#each Array(84) as _}
              <div class="day-cell shimmer-cell"></div>
            {/each}
          </div>
        </div>
      </section>

      <section class="section-milestones">
        <h2>Milestones</h2>
        <div class="milestone-grid">
          {#each Array(6) as _}
            <article class="card milestone-card locked">
              <div class="milestone-icon">
                <span class="shimmer-block" style="width: 2.5rem; height: 2.5rem;"></span>
              </div>
              <div class="milestone-content">
                <span class="shimmer-block" style="width: 80%; height: 0.875rem;"></span>
                <span
                  class="shimmer-block"
                  style="width: 60%; height: 0.75rem; margin-top: var(--space-1);"
                ></span>
              </div>
            </article>
          {/each}
        </div>
      </section>

      <section class="card section-skills">
        <h2>Skill Breakdown</h2>
        <div class="skills-list">
          {#each Array(4) as _}
            <div class="skill-row">
              <div class="skill-info">
                <span class="shimmer-block" style="width: 6rem; height: 0.875rem;"></span>
                <span class="shimmer-block" style="width: 4rem; height: 0.625rem; margin-top: 2px;"
                ></span>
              </div>
              <div class="skill-bar-container">
                <div
                  class="shimmer-block"
                  style="width: 60%; height: 100%; border-radius: 4px;"
                ></div>
              </div>
              <span class="shimmer-block" style="width: 2rem; height: 0.875rem;"></span>
            </div>
          {/each}
        </div>
      </section>

      <section class="section-history">
        <h2>Recent Sessions</h2>
        <div class="card history-table-container">
          <table class="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mode</th>
                <th>Accuracy</th>
                <th>Exercises</th>
              </tr>
            </thead>
            <tbody>
              {#each Array(3) as _}
                <tr>
                  <td><span class="shimmer-block" style="width: 5rem; height: 0.875rem;"></span></td
                  >
                  <td
                    ><span
                      class="shimmer-block"
                      style="width: 4rem; height: 1.25rem; border-radius: 12px;"
                    ></span></td
                  >
                  <td
                    ><span class="shimmer-block" style="width: 2.5rem; height: 0.875rem;"
                    ></span></td
                  >
                  <td
                    ><span class="shimmer-block" style="width: 1.5rem; height: 0.875rem;"
                    ></span></td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {:then resolved}
      <!-- REAL CONTENT -->
      {@const gamification = resolved.gamification || {
        totalXp: 0,
        currentStreak: 0,
        longestStreak: 0,
        dailyGoalMet: false,
        nextMilestone: null,
        xpToNextMilestone: 0,
      }}
      {@const userLevel = resolved.user?.level ?? 'absolute_beginner'}
      {@const calendar = buildCalendarData(resolved.activityDates)}
      {@const milestones = buildMilestoneGallery(
        resolved.milestones,
        resolved.unlockedMilestones,
        gamification.totalXp,
      )}
      {@const skills = buildSkillBreakdown(resolved.exerciseTypeBreakdown)}
      {@const history = buildHistoryList(resolved.history)}

      <header class="header-section">
        <h1>Progress</h1>
        <div class="header-badges">
          <div class="total-ink-badge">
            <span class="ink-val">{gamification.totalXp}</span>
            <span class="ink-unit">墨 ink earned</span>
          </div>
          <LevelBadge level={userLevel} />
        </div>
      </header>

      <section class="card section-streak">
        <div class="section-header">
          <h2>Consistency</h2>
          <div class="streak-stats">
            <span>Current streak: <strong>{gamification.currentStreak} days</strong></span>
            <span class="separator">·</span>
            <span>Longest: <strong>{gamification.longestStreak} days</strong></span>
          </div>
        </div>
        <div class="calendar-container">
          <div class="day-labels">
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
          </div>
          <div class="calendar-grid">
            {#each calendar as day}
              <div
                class="day-cell"
                class:active={day.isActive}
                class:today={day.isToday}
                class:future={day.isFuture}
                title={`${day.label}${day.isActive ? ' - Active' : ''}`}
              ></div>
            {/each}
          </div>
        </div>
      </section>

      <section class="section-milestones">
        <h2>Milestones</h2>
        <div class="milestone-grid">
          {#each milestones as m}
            <article class="card milestone-card" class:locked={!m.isUnlocked}>
              <div class="milestone-icon">
                <span class="kanji-decorative" title={m.nameJa}>{m.icon}</span>
              </div>
              <div class="milestone-content">
                <h3 title={m.name}>{m.name}</h3>
                <p class="milestone-ja" title={m.nameJa}>{m.nameJa}</p>
                {#if m.isUnlocked}
                  <p class="achieved-date">Achieved {m.achievedAt || 'Earned'}</p>
                {:else}
                  <p class="locked-text">Locked • {m.xpThreshold} ink</p>
                {/if}
              </div>
            </article>
          {/each}
        </div>
      </section>

      <section class="card section-skills">
        <h2>Skill Breakdown</h2>
        <div class="skills-list">
          {#each skills as skill}
            <div class="skill-row">
              <div class="skill-info">
                <span class="skill-name">{skill.label}</span>
                <span class="skill-meta">{skill.totalCount} attempts</span>
              </div>
              <div class="skill-bar-container">
                <div
                  class="skill-bar"
                  style:width={`${skill.accuracyPct}%`}
                  style:background-color={getAccuracyColor(skill.accuracy)}
                ></div>
              </div>
              <span class="skill-pct" style:color={getAccuracyColor(skill.accuracy)}>
                {skill.accuracyPct}%
              </span>
            </div>
          {/each}
          {#if skills.length === 0}
            <p class="empty-state">Complete exercises to see your skill breakdown.</p>
          {/if}
        </div>
      </section>

      <section class="section-history">
        <h2>Recent Sessions</h2>
        <div class="card history-table-container">
          {#if history.length > 0}
            <table class="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mode</th>
                  <th>Accuracy</th>
                  <th>Exercises</th>
                </tr>
              </thead>
              <tbody>
                {#each history as session}
                  <tr>
                    <td class="col-date">{session.dateLabel}</td>
                    <td class="col-mode">
                      <span class="mode-badge">{session.modeLabel}</span>
                    </td>
                    <td class="col-acc" style:color={getAccuracyColor(session.accuracy)}>
                      {session.accuracyPct}%
                    </td>
                    <td class="col-count">{session.exerciseCount}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {:else}
            <p class="empty-state">No sessions recorded yet.</p>
          {/if}
        </div>
      </section>
    {/await}
  {/if}
</div>

<style>
  .progress-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    max-width: var(--content-width);
    margin: 0 auto;
    padding-bottom: var(--space-12);
  }

  /* --- Shimmer --- */
  .shimmer-block {
    display: inline-block;
    background: linear-gradient(
      90deg,
      var(--bg-kinu) 25%,
      color-mix(in srgb, var(--bg-kinu) 60%, white) 50%,
      var(--bg-kinu) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
    border-radius: 4px;
  }

  .shimmer-cell {
    animation: shimmer 1.5s ease-in-out infinite;
    background: linear-gradient(
      90deg,
      var(--bg-kinu) 25%,
      color-mix(in srgb, var(--bg-kinu) 60%, white) 50%,
      var(--bg-kinu) 75%
    );
    background-size: 200% 100%;
  }

  .skeleton-calendar {
    padding-left: 2.5rem;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* --- Header --- */
  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid var(--border-light);
    padding-bottom: var(--space-4);
    margin-top: var(--space-4);
    gap: var(--space-4);
  }

  .header-badges {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .total-ink-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .ink-val {
    font-size: var(--text-3xl);
    font-weight: var(--weight-bold);
    color: var(--text-sumi);
    line-height: 1;
  }

  .ink-unit {
    font-size: var(--text-base);
    color: var(--text-bokashi);
    font-weight: var(--weight-medium);
  }

  h2 {
    margin-bottom: var(--space-4);
    color: var(--text-sumi);
    font-size: var(--text-xl);
  }

  .section-streak {
    padding: var(--space-6);
    overflow: visible;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: var(--space-6);
    flex-wrap: wrap;
    gap: var(--space-4);
  }

  .section-header h2 {
    margin: 0;
  }

  .streak-stats {
    font-size: var(--text-sm);
    color: var(--text-bokashi);
  }

  .streak-stats strong {
    color: var(--text-sumi);
    font-weight: var(--weight-bold);
  }

  .separator {
    margin: 0 var(--space-2);
    color: var(--border-mid);
  }

  .calendar-container {
    display: flex;
    gap: var(--space-4);
    overflow-x: auto;
    padding-bottom: var(--space-2);
  }

  .day-labels {
    display: grid;
    grid-template-rows: repeat(7, 12px);
    gap: 4px;
    padding-top: 1px;
    font-size: 10px;
    color: var(--text-usuzumi);
    height: calc(7 * 16px);
  }

  .day-labels span {
    line-height: 12px;
  }
  .day-labels span:nth-child(1) {
    grid-row: 1;
  }
  .day-labels span:nth-child(2) {
    grid-row: 3;
  }
  .day-labels span:nth-child(3) {
    grid-row: 5;
  }

  .calendar-grid {
    display: grid;
    grid-template-rows: repeat(7, 12px);
    grid-auto-flow: column;
    gap: 4px;
    padding-top: 4px;
  }

  .day-cell {
    width: 12px;
    height: 12px;
    background-color: var(--bg-kinu);
    border-radius: 2px;
    transition: all 0.2s ease;
  }

  .day-cell.active {
    background-color: var(--accent-matcha);
  }
  .day-cell.today {
    border: 1px solid var(--text-bokashi);
  }
  .day-cell.future {
    opacity: 0;
    pointer-events: none;
  }
  .day-cell:hover:not(.future) {
    transform: scale(1.2);
  }

  .milestone-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: var(--space-4);
  }

  .milestone-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    transition: transform 0.2s ease;
  }

  .milestone-card:hover {
    transform: translateY(-2px);
  }

  .milestone-card.locked {
    background-color: var(--bg-shoji);
    border-color: transparent;
    box-shadow: none;
    opacity: 0.7;
    filter: grayscale(1);
  }

  .milestone-icon {
    height: 3rem;
    display: flex;
    align-items: center;
    overflow: hidden;
  }

  .kanji-decorative {
    font-family: 'Noto Sans JP', serif;
    font-size: 2.5rem;
    color: var(--accent-shu-wash);
    font-weight: 700;
    line-height: 1;
    display: block;
  }

  .milestone-card:not(.locked) .kanji-decorative {
    color: var(--accent-shu);
  }
  .milestone-card.locked .kanji-decorative {
    color: var(--border-mid);
  }

  .milestone-content h3 {
    font-size: var(--text-sm);
    margin-bottom: var(--space-1);
    line-height: var(--leading-tight);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .milestone-ja {
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
    margin: 0 0 var(--space-1) 0;
    line-height: var(--leading-tight);
  }

  .milestone-content p {
    line-height: var(--leading-tight);
  }

  .achieved-date {
    font-size: var(--text-xs);
    color: var(--accent-matcha);
    font-weight: var(--weight-medium);
    margin: 0;
  }

  .locked-text {
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
    margin: 0;
  }

  .skills-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .skill-row {
    display: grid;
    grid-template-columns: 140px 1fr 48px;
    align-items: center;
    gap: var(--space-4);
  }

  .skill-info {
    display: flex;
    flex-direction: column;
  }

  .skill-name {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-sumi);
  }

  .skill-meta {
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
  }

  .skill-bar-container {
    height: 8px;
    background-color: var(--bg-kinu);
    border-radius: 4px;
    overflow: hidden;
  }

  .skill-bar {
    height: 100%;
    border-radius: 4px;
    transition: width 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .skill-pct {
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    text-align: right;
  }

  .history-table-container {
    padding: 0;
    overflow: hidden;
  }

  .history-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  .history-table th {
    background-color: var(--bg-kinu);
    color: var(--text-bokashi);
    font-weight: var(--weight-medium);
    text-align: left;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border-light);
  }

  .history-table td {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--bg-kinu);
    color: var(--text-sumi);
  }

  .history-table tr:last-child td {
    border-bottom: none;
  }

  .mode-badge {
    display: inline-block;
    padding: 2px 8px;
    background-color: var(--bg-shoji);
    border: 1px solid var(--border-light);
    border-radius: 12px;
    font-size: var(--text-xs);
    color: var(--text-bokashi);
    text-transform: capitalize;
  }

  .empty-state {
    padding: var(--space-6);
    text-align: center;
    color: var(--text-usuzumi);
    font-style: italic;
    margin: 0;
  }

  @media (max-width: 600px) {
    .header-section {
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .header-badges {
      width: 100%;
      justify-content: space-between;
    }
    .milestone-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    }
    .skill-row {
      grid-template-columns: 1fr;
      gap: var(--space-2);
    }
    .skill-info {
      flex-direction: row;
      justify-content: space-between;
      align-items: baseline;
    }
    .skill-pct {
      display: none;
    }
  }
</style>
