<script lang="ts">
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();
  type MilestoneDef = PageData['milestones'][number];
  type UserMilestone = PageData['unlockedMilestones'][number];
  type ExerciseBreakdownItem = PageData['exerciseTypeBreakdown'][number];
  type HistoryItem = PageData['history'][number];

  // --- Derived Data ---

  // 1. Gamification & Header
  const gamification = $derived(
    data.gamification || {
      totalXp: 0,
      currentStreak: 0,
      longestStreak: 0,
      dailyGoalMet: false,
      nextMilestone: null,
      xpToNextMilestone: 0,
    },
  );

  // 2. Streak Calendar
  // specific logic to ensure the grid aligns with Mon-Sun rows
  const calendarData = $derived.by(() => {
    const today = new Date();
    // Normalize today to start of day to avoid time discrepancies
    today.setHours(0, 0, 0, 0);

    const currentDay = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    // We want Monday to be index 0.
    // Mon(1)->0, Tue(2)->1 ... Sat(6)->5, Sun(0)->6
    const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;

    // We want 12 weeks total. Start date is 11 weeks ago's Monday.
    const weeksToShow = 12;
    const daysTotal = weeksToShow * 7;

    // Start date = Today - daysSinceMonday - (weeksToShow - 1)*7
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysSinceMonday - (weeksToShow - 1) * 7);

    const days = [];
    const activeSet = new Set(data.activityDates);

    for (let i = 0; i < daysTotal; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);

      const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
      const isToday = d.getTime() === today.getTime();
      const isFuture = d.getTime() > today.getTime();
      const isActive = activeSet.has(dateStr);

      days.push({
        date: d,
        dateStr,
        isToday,
        isFuture,
        isActive,
        // formatted date for tooltip
        label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d),
      });
    }
    return days;
  });

  // 3. Milestones
  // Merge static definition with unlocked status
  const milestoneGallery = $derived.by(() => {
    // Create a map of unlocked milestones for quick lookup of achieved date
    const unlockedMap = new Map<string, UserMilestone>(
      data.unlockedMilestones.map((m: UserMilestone) => [m.milestoneKey, m]),
    );

    return data.milestones.map((m: MilestoneDef) => {
      const unlocked = unlockedMap.get(m.key);
      const isUnlocked = data.gamification.totalXp >= m.xpThreshold;

      return {
        ...m,
        isUnlocked,
        achievedAt: unlocked ? new Date(unlocked.createdAt).toLocaleDateString() : null,
      };
    });
  });

  // 4. Skill Breakdown
  const skillBreakdown = $derived.by(() => {
    const typeLabels: Record<string, string> = {
      multiple_choice: 'Multiple Choice',
      translation: 'Translation',
      fill_blank: 'Fill in the Blank',
      reorder: 'Word Order',
      reading: 'Reading',
      listening: 'Listening',
    };

    return data.exerciseTypeBreakdown
      .map((item: ExerciseBreakdownItem) => ({
        ...item,
        label: typeLabels[item.type] || item.type,
        accuracyPct: item.accuracy,
      }))
      .sort((a: ExerciseBreakdownItem, b: ExerciseBreakdownItem) => b.totalCount - a.totalCount); // Sort by most practiced
  });

  // Helper for accuracy colors
  function getAccuracyColor(accuracy: number) {
    if (accuracy >= 80) return 'var(--accent-matcha)';
    if (accuracy >= 50) return 'var(--state-warning)'; // Gold/Neutral
    return 'var(--accent-shu)';
  }

  // 5. Session History
  // Just formatting dates
  const historyList = $derived.by(() =>
    data.history.map((h: HistoryItem) => ({
      ...h,
      dateLabel: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(h.session.createdAt)),
      modeLabel: h.session.mode,
      accuracyPct: h.accuracy,
    })),
  );
</script>

<div class="progress-page page-transition">
  <!-- 1. Header -->
  <header class="header-section">
    <h1>Progress</h1>
    <div class="total-ink-badge">
      <span class="ink-val">{gamification.totalXp}</span>
      <span class="ink-unit">墨 ink earned</span>
    </div>
  </header>

  <!-- 2. Streak Calendar -->
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
        {#each calendarData as day}
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

  <!-- 3. Milestone Gallery -->
  <section class="section-milestones">
    <h2>Milestones</h2>
    <div class="milestone-grid">
      {#each milestoneGallery as m}
        <article class="card milestone-card" class:locked={!m.isUnlocked}>
          <div class="milestone-icon">
            <span class="kanji-decorative">{m.nameJa}</span>
          </div>
          <div class="milestone-content">
            <h3>{m.name}</h3>
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

  <!-- 4. Skill Breakdown -->
  <section class="card section-skills">
    <h2>Skill Breakdown</h2>
    <div class="skills-list">
      {#each skillBreakdown as skill}
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
      {#if skillBreakdown.length === 0}
        <p class="empty-state">Complete exercises to see your skill breakdown.</p>
      {/if}
    </div>
  </section>

  <!-- 5. Session History -->
  <section class="section-history">
    <h2>Recent Sessions</h2>
    <div class="card history-table-container">
      {#if historyList.length > 0}
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
            {#each historyList as session}
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

  /* --- Header --- */
  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid var(--border-light);
    padding-bottom: var(--space-4);
    margin-top: var(--space-4);
  }

  .total-ink-badge {
    display: flex;
    align-items: baseline;
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

  /* --- Section Headers --- */
  h2 {
    margin-bottom: var(--space-4);
    color: var(--text-sumi);
    font-size: var(--text-xl);
  }

  /* --- Streak Calendar --- */
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
    overflow-x: auto; /* Allow scroll on very small screens */
    padding-bottom: var(--space-2);
  }

  .day-labels {
    display: grid;
    grid-template-rows: repeat(7, 12px); /* Match cell size + gap */
    gap: 4px; /* match grid gap */
    padding-top: 1px; /* Visual alignment */
    font-size: 10px;
    color: var(--text-usuzumi);
    height: calc(7 * 16px);
  }

  .day-labels span {
    line-height: 12px;
  }
  /* Position labels to match rows: Mon(1)=Row0, Wed(3)=Row2, Fri(5)=Row4 */
  /* Our grid is Mon-index-0 based. Mon=Row1, Wed=Row3, Fri=Row5 in CSS Grid (1-based). */
  .day-labels span:nth-child(1) {
    grid-row: 1;
  } /* Mon */
  .day-labels span:nth-child(2) {
    grid-row: 3;
  } /* Wed */
  .day-labels span:nth-child(3) {
    grid-row: 5;
  } /* Fri */

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

  /* Make highly active days darker? For now just boolean active */
  /* .day-cell.active.high { background-color: var(--accent-matcha-deep); } */

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

  /* --- Milestone Gallery --- */
  .milestone-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
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
  }

  .kanji-decorative {
    font-family: 'Noto Sans JP', serif;
    font-size: 2.5rem;
    color: var(--accent-shu-wash); /* Very subtle normally */
    /* If achieved, make it pop */
    font-weight: 700;
  }

  .milestone-card:not(.locked) .kanji-decorative {
    color: var(--accent-shu);
  }

  .milestone-card.locked .kanji-decorative {
    color: var(--border-mid);
  }

  .milestone-content h3 {
    font-size: var(--text-base);
    margin-bottom: var(--space-1);
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

  /* --- Skill Breakdown --- */
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

  /* --- Session History --- */
  .history-table-container {
    padding: 0; /* Let table fill card */
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

  /* Responsive Adjustments */
  @media (max-width: 600px) {
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
      display: none; /* Show in header? or hide to save space */
    }

    /* Show pct in label instead for mobile */
    .skill-name::after {
      content: ' - ' attr(data-pct);
    }
  }
</style>
