<script lang="ts">
  import LevelBadge from '$lib/components/LevelBadge.svelte';
  import type { PageData } from './$types';
  import {
    buildCalendarData,
    buildHistoryList,
    buildLevelJourney,
    buildMilestoneGallery,
    buildSkillBreakdown,
    buildXpHistory,
    getAccuracyColor,
  } from './progress-view-model';

  let { data } = $props<{ data: PageData }>();
</script>

<div class="progress-page page-transition">
  {#if !data.lazy}
    <header class="header-section">
      <h1>Progress</h1>
    </header>
    <p class="empty-state">Select a user to view progress.</p>
  {:else}
    {#await data.lazy}
      <header class="header-section">
        <div>
          <h1>Progress</h1>
          <p class="header-note">A calm view of your long-term learning momentum.</p>
        </div>
        <div class="header-badges">
          <div class="total-ink-badge">
            <span class="shimmer-block" style="width: 4rem; height: 38px;"></span>
            <span class="shimmer-block" style="width: 6rem; height: 26px;"></span>
          </div>
          <span
            class="shimmer-block"
            style="width: 5rem; height: 69px; border-radius: var(--radius-md);"
          ></span>
        </div>
      </header>

      <section class="card section-xp-history">
        <div class="section-header">
          <h2>XP History</h2>
          <span class="shimmer-block" style="width: 10rem; height: 1rem;"></span>
        </div>
        <div class="xp-chart skeleton-chart">
          {#each Array(30) as _}
            <span class="xp-bar shimmer-cell"></span>
          {/each}
        </div>
      </section>

      <section class="card section-levels">
        <div class="section-header">
          <h2>Level Journey</h2>
          <span class="shimmer-block" style="width: 12rem; height: 1rem;"></span>
        </div>
        <div class="level-track">
          {#each Array(8) as _}
            <span class="level-step skeleton-step shimmer-cell"></span>
          {/each}
        </div>
      </section>

      <section class="section-milestones">
        <h2>Milestone Gallery</h2>
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

      <section class="card section-streak">
        <div class="section-header">
          <h2>Streak Calendar</h2>
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

      <section class="section-history">
        <h2>Session History Enhanced</h2>
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
                  <td>
                    <span
                      class="shimmer-block"
                      style="width: 4rem; height: 1.25rem; border-radius: 12px;"
                    ></span>
                  </td>
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
    {:then resolved}
      {@const gamification = resolved.gamification || {
        totalXp: 0,
        currentStreak: 0,
        longestStreak: 0,
        dailyGoalMet: false,
        nextMilestone: null,
        xpToNextMilestone: 0,
      }}
      {@const userLevel = resolved.user?.level ?? 'absolute_beginner'}
      {@const xpHistory = buildXpHistory(resolved.dailyXpHistory)}
      {@const levelJourney = buildLevelJourney({
        totalXp: gamification.totalXp,
        currentLevel: userLevel,
        dailyXpHistory: resolved.dailyXpHistory,
      })}
      {@const calendar = buildCalendarData(
        resolved.activityDates,
        new Date(),
        resolved.dailyXpHistory,
      )}
      {@const milestones = buildMilestoneGallery(
        resolved.milestones,
        resolved.unlockedMilestones,
        gamification.totalXp,
      )}
      {@const skills = buildSkillBreakdown(resolved.exerciseTypeBreakdown)}
      {@const history = buildHistoryList(resolved.history)}
      {@const maxDailyXp = Math.max(1, ...xpHistory.daily.map((day) => day.totalXp))}
      {@const nextMilestoneName = gamification.nextMilestone?.name ?? null}

      <header class="header-section">
        <div>
          <h1>Progress</h1>
          <p class="header-note">A calm view of your long-term learning momentum.</p>
        </div>
        <div class="header-badges">
          <div class="total-ink-badge">
            <span class="ink-val">{gamification.totalXp}</span>
            <span class="ink-unit">墨 ink earned</span>
          </div>
          <LevelBadge level={userLevel} />
        </div>
      </header>

      <section class="card header-summary" aria-labelledby="summary-heading">
        <div class="section-header">
          <h2 id="summary-heading">Header Summary</h2>
          <p class="section-copy">Uses your current profile, streak, and milestone summary.</p>
        </div>
        <div class="summary-grid">
          <div class="summary-stat">
            <span class="stat-label">Current level</span>
            <strong>{levelJourney.currentLevelLabel}</strong>
          </div>
          <div class="summary-stat">
            <span class="stat-label">Total ink</span>
            <strong>{gamification.totalXp} 墨</strong>
          </div>
          <div class="summary-stat">
            <span class="stat-label">Current streak</span>
            <strong>{gamification.currentStreak} days</strong>
          </div>
          <div class="summary-stat">
            <span class="stat-label">Next milestone</span>
            {#if nextMilestoneName}
              <strong>{nextMilestoneName}</strong>
              <span>{gamification.xpToNextMilestone} 墨 to go</span>
            {:else}
              <strong>All visible milestones reached</strong>
              <span>New goals will appear as milestones are added.</span>
            {/if}
          </div>
        </div>
      </section>

      <section class="card section-xp-history" aria-labelledby="xp-history-heading">
        <div class="section-header">
          <div>
            <h2 id="xp-history-heading">XP History</h2>
            <p class="section-copy">Daily totals from current XP rollups, not an event ledger.</p>
          </div>
          {#if xpHistory.summary.hasData}
            <div class="streak-stats">
              <span>Total this view: <strong>{xpHistory.summary.totalXp} 墨</strong></span>
              <span class="separator">·</span>
              <span>Avg/day: <strong>{xpHistory.summary.averageDailyXp} 墨</strong></span>
            </div>
          {/if}
        </div>
        {#if xpHistory.summary.hasData}
          <div class="xp-chart" aria-label="Daily XP totals for the last 30 days">
            {#each xpHistory.daily as day}
              <div class="xp-bar-wrap">
                <span
                  class="xp-bar"
                  class:empty-bar={day.totalXp === 0}
                  style:height={`${Math.max(4, (day.totalXp / maxDailyXp) * 100)}%`}
                  title={`${day.label}: ${day.totalXp} 墨`}
                ></span>
              </div>
            {/each}
          </div>
          <div class="xp-stats">
            <span
              >Active days: {xpHistory.summary.activeDayCount} / {xpHistory.summary
                .bucketCount}</span
            >
            {#if xpHistory.summary.bestDaily}
              <span
                >Best day: {xpHistory.summary.bestDaily.label} ({xpHistory.summary.bestDaily
                  .totalXp} 墨)</span
              >
            {/if}
            {#if xpHistory.summary.bestWeekly}
              <span
                >Best week: {xpHistory.summary.bestWeekly.label} ({xpHistory.summary.bestWeekly
                  .totalXp} 墨)</span
              >
            {/if}
            {#if xpHistory.summary.isSparse}
              <span>Momentum is sparse; even small daily practice will make this chart denser.</span
              >
            {/if}
          </div>
        {:else}
          <p class="empty-state">
            No daily XP totals yet. Complete a session to start building history.
          </p>
        {/if}
      </section>

      <section class="card section-levels" aria-labelledby="level-heading">
        <div class="section-header">
          <div>
            <h2 id="level-heading">Level Journey</h2>
            <p class="section-copy">
              Conservative local thresholds; this is not persisted level-up history.
            </p>
          </div>
          <div class="streak-stats">
            <span>Current: <strong>{levelJourney.currentLevelLabel}</strong></span>
            <span class="separator">·</span>
            <span>{levelJourney.totalXp} 墨</span>
          </div>
        </div>
        <div class="level-track" aria-label="Eight-level progress journey">
          {#each levelJourney.steps as step}
            <div
              class="level-step"
              class:reached={step.isReached}
              class:current={step.isCurrent}
              title={`${step.label}: ${step.thresholdXp} 墨 threshold`}
            >
              <span>{step.level}</span>
              <small>{step.thresholdXp}</small>
            </div>
          {/each}
        </div>
        <div class="level-details">
          {#if levelJourney.isMaxLevel}
            <strong>Max visible level reached.</strong>
            <span>Keep practicing to deepen mastery.</span>
          {:else if levelJourney.nextLevel}
            <strong
              >Next: {levelJourney.nextLevel.label} at {levelJourney.nextLevel.thresholdXp} 墨</strong
            >
            <span>{levelJourney.xpToNext} 墨 to go</span>
            {#if levelJourney.progressToNextPct !== null}
              <div
                class="progress-meter"
                aria-label={`Progress to next level: ${levelJourney.progressToNextPct}%`}
              >
                <span style:width={`${levelJourney.progressToNextPct}%`}></span>
              </div>
            {/if}
            {#if levelJourney.hasPaceData}
              <span>
                Recent pace: ~{levelJourney.recentWeeklyPaceXp} 墨/week{levelJourney.estimatedDaysToNext
                  ? `, about ${levelJourney.estimatedDaysToNext} days to next level`
                  : ''}
              </span>
            {:else}
              <span>Recent pace appears after daily XP totals are available.</span>
            {/if}
          {/if}
        </div>
      </section>

      <section class="section-milestones" aria-labelledby="milestones-heading">
        <div class="section-header">
          <div>
            <h2 id="milestones-heading">Milestone Gallery</h2>
            <p class="section-copy">
              Unlocked milestones plus XP progress toward upcoming milestone targets.
            </p>
          </div>
        </div>
        {#if milestones.length > 0}
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
                    <p class="achieved-date">Achieved {m.achievedAt}</p>
                  {:else if m.progress.isComplete}
                    <p class="locked-text">XP target complete; unlock record not present yet.</p>
                  {:else}
                    <p class="locked-text">
                      Progress: {m.progress.currentXp} / {m.progress.targetXp} 墨
                    </p>
                  {/if}
                  <div class="progress-meter milestone-meter" aria-hidden="true">
                    <span style:width={`${m.progress.percent}%`}></span>
                  </div>
                </div>
              </article>
            {/each}
          </div>
        {:else}
          <p class="empty-state">No milestones are configured yet.</p>
        {/if}
      </section>

      <section class="card section-streak" aria-labelledby="calendar-heading">
        <div class="section-header">
          <div>
            <h2 id="calendar-heading">Streak Calendar</h2>
            <p class="section-copy">
              Active days come from activity dates; ink intensity uses daily XP totals when present.
            </p>
          </div>
          <div class="streak-stats">
            <span>Current streak: <strong>{gamification.currentStreak} days</strong></span>
            <span class="separator">·</span>
            <span>Longest: <strong>{gamification.longestStreak} days</strong></span>
          </div>
        </div>
        <div class="calendar-container">
          <div class="day-labels" aria-hidden="true">
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
          </div>
          <div class="calendar-grid" aria-label="Twelve-week streak calendar">
            {#each calendar as day}
              <div
                class="day-cell"
                class:active={day.isActive}
                class:intensity-low={day.intensity === 1}
                class:intensity-mid={day.intensity === 2}
                class:intensity-high={day.intensity === 3}
                class:today={day.isToday}
                class:future={day.isFuture}
                title={`${day.label}${day.isActive ? ' - Active' : ''}${day.xpTotal ? ` - ${day.xpTotal} 墨` : ''}`}
              ></div>
            {/each}
          </div>
        </div>
        {#if resolved.activityDates.length === 0}
          <p class="empty-state compact-empty">
            No activity days yet. Your streak calendar will fill in as you practice.
          </p>
        {/if}
      </section>

      <section class="section-history" aria-labelledby="history-heading">
        <div class="section-header">
          <div>
            <h2 id="history-heading">Session History Enhanced</h2>
            <p class="section-copy">
              Shows session XP and duration only when those fields already exist.
            </p>
          </div>
        </div>
        <div class="card history-table-container">
          {#if history.length > 0}
            <table class="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mode</th>
                  <th>XP</th>
                  <th>Accuracy</th>
                  <th>Duration</th>
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
                    <td class="col-xp">{session.hasXp ? `+${session.xpEarned} 墨` : '—'}</td>
                    <td class="col-acc" style:color={getAccuracyColor(session.accuracy)}>
                      {session.accuracyPct}%
                    </td>
                    <td class="col-duration"
                      >{session.hasDuration ? `${session.durationMinutes} min` : '—'}</td
                    >
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

      <section class="card section-skills" aria-labelledby="skills-heading">
        <div class="section-header">
          <div>
            <h2 id="skills-heading">Skill Breakdown</h2>
            <p class="section-copy">
              Sample-size-aware confidence and recommendations from exercise results.
            </p>
          </div>
        </div>
        <div class="skills-list">
          {#each skills as skill}
            <div class="skill-row enhanced-skill-row">
              <div class="skill-info">
                <span class="skill-name">{skill.label}</span>
                <span class="skill-meta">
                  {skill.totalCount} attempts · {skill.confidence} confidence · {skill.status.replace(
                    '-',
                    ' ',
                  )}
                </span>
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
              <p class="skill-recommendation">{skill.recommendation}</p>
            </div>
          {/each}
          {#if skills.length === 0}
            <p class="empty-state">Complete exercises to see your skill breakdown.</p>
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
    padding-left: 2.3rem;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid var(--border-light);
    padding-bottom: var(--space-4);
    margin-top: var(--space-4);
    gap: var(--space-4);
  }

  .header-section h1 {
    margin-bottom: var(--space-1);
  }

  .header-note,
  .section-copy {
    margin: 0;
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
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

  .card {
    padding: var(--space-6);
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
    margin: 0 0 var(--space-1) 0;
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

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-4);
  }

  .summary-stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-4);
    background-color: var(--bg-shoji);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
  }

  .summary-stat strong {
    color: var(--text-sumi);
    font-size: var(--text-lg);
  }

  .summary-stat span {
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }

  .stat-label {
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .xp-chart {
    display: flex;
    align-items: end;
    gap: 3px;
    height: 160px;
    padding: var(--space-4);
    background-color: var(--bg-shoji);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
  }

  .skeleton-chart {
    align-items: stretch;
  }

  .xp-bar-wrap {
    display: flex;
    align-items: end;
    flex: 1;
    height: 100%;
  }

  .xp-bar {
    display: block;
    width: 100%;
    min-height: 4px;
    background-color: var(--accent-matcha);
    border-radius: 4px 4px 0 0;
    transition: height 0.3s ease;
  }

  .xp-bar.empty-bar {
    background-color: var(--bg-kinu);
  }

  .xp-stats,
  .level-details {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3) var(--space-6);
    margin-top: var(--space-4);
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }

  .level-track {
    display: grid;
    grid-template-columns: repeat(8, minmax(42px, 1fr));
    gap: var(--space-2);
    align-items: stretch;
  }

  .level-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 62px;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    background-color: var(--bg-shoji);
    color: var(--text-usuzumi);
  }

  .level-step.reached {
    border-color: color-mix(in srgb, var(--accent-matcha) 40%, var(--border-light));
    color: var(--text-sumi);
  }

  .level-step.current {
    background-color: color-mix(in srgb, var(--accent-matcha) 14%, var(--bg-shoji));
    border-color: var(--accent-matcha);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-matcha) 30%, transparent);
  }

  .level-step span {
    font-weight: var(--weight-bold);
  }

  .level-step small {
    font-size: 10px;
    color: var(--text-usuzumi);
  }

  .skeleton-step {
    min-height: 62px;
  }

  .progress-meter {
    width: min(220px, 100%);
    height: 8px;
    background-color: var(--bg-kinu);
    border-radius: 999px;
    overflow: hidden;
  }

  .progress-meter span {
    display: block;
    height: 100%;
    background-color: var(--accent-matcha);
    border-radius: inherit;
  }

  .milestone-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
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
    opacity: 0.85;
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

  .milestone-meter {
    width: 100%;
    margin-top: var(--space-2);
  }

  .section-streak {
    overflow: visible;
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
  .day-cell.intensity-low {
    background-color: color-mix(in srgb, var(--accent-matcha) 36%, var(--bg-kinu));
  }
  .day-cell.intensity-mid {
    background-color: color-mix(in srgb, var(--accent-matcha) 68%, var(--bg-kinu));
  }
  .day-cell.intensity-high {
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

  .compact-empty {
    padding-bottom: 0;
  }

  .skills-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .skill-row {
    display: grid;
    grid-template-columns: 160px 1fr 48px;
    align-items: center;
    gap: var(--space-4);
  }

  .enhanced-skill-row {
    grid-template-columns: 180px 1fr 48px;
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
    text-transform: capitalize;
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

  .skill-recommendation {
    grid-column: 1 / -1;
    margin: calc(var(--space-3) * -1) 0 0 0;
    color: var(--text-bokashi);
    font-size: var(--text-xs);
  }

  .history-table-container {
    padding: 0;
    overflow-x: auto;
  }

  .history-table {
    width: 100%;
    min-width: 620px;
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

  .col-xp,
  .col-duration {
    color: var(--text-bokashi);
  }

  .empty-state {
    padding: var(--space-6);
    text-align: center;
    color: var(--text-usuzumi);
    font-style: italic;
    margin: 0;
  }

  @media (max-width: 37.5rem) /* --bp-sm */ {
    .header-section {
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .header-badges {
      width: 100%;
      justify-content: space-between;
    }
    .summary-grid {
      grid-template-columns: 1fr;
    }
    .xp-chart {
      height: 120px;
      padding: var(--space-3);
    }
    .level-track {
      grid-template-columns: repeat(4, minmax(42px, 1fr));
    }
    .milestone-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    }
    .skill-row,
    .enhanced-skill-row {
      grid-template-columns: 1fr;
      gap: var(--space-2);
    }
    .skill-info {
      flex-direction: column;
      justify-content: space-between;
      align-items: flex-start;
    }
    .skill-pct {
      display: none;
    }
    .skill-recommendation {
      margin-top: 0;
    }
  }
</style>
