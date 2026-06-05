import { describe, expect, it } from 'vitest';
import {
  buildCalendarData,
  buildHistoryList,
  buildLearningLevelJourney,
  buildMilestoneGallery,
  buildSkillBreakdown,
  buildXpHistory,
  getAccuracyColor,
} from './progress-view-model';

function toLocalDateKey(value: Date): string {
  return value.toLocaleDateString('sv-SE');
}

describe('progress view model helpers', () => {
  it('returns the existing color tokens for accuracy thresholds', () => {
    expect(getAccuracyColor(80)).toBe('var(--accent-matcha)');
    expect(getAccuracyColor(79)).toBe('var(--state-warning)');
    expect(getAccuracyColor(50)).toBe('var(--state-warning)');
    expect(getAccuracyColor(49)).toBe('var(--accent-shu)');
  });

  it('builds XP history with daily buckets, sparse zero days, rollups, totals, averages, and best buckets', () => {
    const history = buildXpHistory(
      [
        { date: '2024-01-01', totalXp: 10 },
        { date: '2024-01-03', totalXp: 20 },
        { date: '2024-01-07', totalXp: 70 },
        { date: '2024-01-07', totalXp: 5 },
        { date: 'not-a-date', totalXp: 999 },
      ],
      new Date(2024, 0, 7, 12),
      7,
    );

    expect(history.daily).toHaveLength(7);
    expect(history.daily.map((day) => [day.key, day.totalXp])).toEqual([
      ['2024-01-01', 10],
      ['2024-01-02', 0],
      ['2024-01-03', 20],
      ['2024-01-04', 0],
      ['2024-01-05', 0],
      ['2024-01-06', 0],
      ['2024-01-07', 75],
    ]);
    expect(history.weekly).toEqual([
      expect.objectContaining({ key: '2024-01-01', totalXp: 105, dayCount: 7 }),
    ]);
    expect(history.monthly).toEqual([
      expect.objectContaining({ key: '2024-01', totalXp: 105, dayCount: 7 }),
    ]);
    expect(history.summary).toMatchObject({
      totalXp: 105,
      averageDailyXp: 15,
      averageActiveDayXp: 35,
      activeDayCount: 3,
      bucketCount: 7,
      hasData: true,
      isSparse: false,
    });
    expect(history.summary.bestDaily).toMatchObject({ key: '2024-01-07', totalXp: 75 });
    expect(history.summary.bestWeekly).toMatchObject({ key: '2024-01-01', totalXp: 105 });
    expect(history.summary.bestMonthly).toMatchObject({ key: '2024-01', totalXp: 105 });
  });

  it('builds XP history empty and sparse states without fabricating activity', () => {
    const empty = buildXpHistory([], new Date(2024, 0, 7, 12), 7);
    expect(empty.summary).toMatchObject({
      totalXp: 0,
      averageDailyXp: 0,
      averageActiveDayXp: 0,
      activeDayCount: 0,
      hasData: false,
      isSparse: false,
    });
    expect(empty.daily.every((day) => day.totalXp === 0)).toBe(true);

    const sparse = buildXpHistory(
      [{ date: '2024-01-07', totalXp: 14 }],
      new Date(2024, 0, 7, 12),
      14,
    );
    expect(sparse.summary).toMatchObject({
      totalXp: 14,
      averageDailyXp: 1,
      averageActiveDayXp: 14,
      activeDayCount: 1,
      hasData: true,
      isSparse: true,
    });
  });

  it('builds a learning level journey from the stored profile level only', () => {
    const journey = buildLearningLevelJourney({ currentLevel: 'elementary' });

    expect(journey.currentLevel).toBe(3);
    expect(journey.currentLevelLabel).toBe('Elementary');
    expect(journey.steps).toHaveLength(8);
    expect(journey.steps[2]).toMatchObject({
      level: 3,
      label: 'Elementary',
      isCurrent: true,
      isReached: true,
      isNext: false,
    });
    expect(journey.nextLevel).toMatchObject({
      level: 4,
      label: 'Pre-Intermediate',
      isNext: true,
    });
    expect(journey.isMaxLevel).toBe(false);
    expect(journey).not.toHaveProperty('xpToNext');
    expect(journey).not.toHaveProperty('progressToNextPct');
    expect(journey).not.toHaveProperty('estimatedDaysToNext');
  });

  it('does not expose ink or XP requirements for learning level progression', () => {
    const journey = buildLearningLevelJourney({ currentLevel: 'beginner' });

    expect(journey.currentLevel).toBe(2);
    expect(journey.currentLevelLabel).toBe('Beginner');
    expect(journey.nextLevel).toMatchObject({ level: 3, label: 'Elementary' });
    for (const step of journey.steps) {
      expect(step).not.toHaveProperty('thresholdXp');
    }
  });

  it('builds max learning level state explicitly', () => {
    const journey = buildLearningLevelJourney({ currentLevel: 'ready_for_japan' });

    expect(journey.currentLevel).toBe(8);
    expect(journey.currentLevelLabel).toBe('Ready for Japan 🇯🇵');
    expect(journey.nextLevel).toBeNull();
    expect(journey.isMaxLevel).toBe(true);
  });

  it('builds a 12-week Monday-start calendar and flags today, activity, future days, XP, and intensity', () => {
    const today = new Date(2024, 0, 1, 12);
    const activityDate = '2023-12-31';

    const calendar = buildCalendarData([activityDate], today, [
      { date: activityDate, totalXp: 10 },
      { date: '2024-01-01', totalXp: 30 },
      { date: '2024-01-02', totalXp: 99 },
    ]);

    expect(calendar).toHaveLength(84);
    expect(new Date(`${calendar[0]?.dateStr}T00:00:00`).getDay()).toBe(1);

    const todayCell = calendar.find((day) => day.isToday);
    expect(todayCell).toMatchObject({
      dateStr: toLocalDateKey(today),
      isToday: true,
      isFuture: false,
      xpTotal: 30,
      intensity: 3,
    });

    expect(calendar.find((day) => day.dateStr === activityDate)).toMatchObject({
      isActive: true,
      xpTotal: 10,
      intensity: 2,
    });
    expect(calendar.find((day) => day.isFuture)?.dateStr).toBe('2024-01-02');
    expect(calendar.find((day) => day.dateStr === '2024-01-02')).toMatchObject({
      isFuture: true,
      isActive: false,
      xpTotal: 0,
      intensity: 0,
    });
    expect(calendar.at(-1)).toMatchObject({ isFuture: true, isActive: false });
  });

  it('builds milestone cards with achieved dates and XP progress-to-target', () => {
    const achievedDate = '2024-01-03T12:00:00.000Z';
    const milestones = [
      {
        key: 'starter',
        name: 'Starter',
        nameJa: 'スターター',
        icon: '🌱',
        xpThreshold: 100,
      },
      {
        key: 'adept',
        name: 'Adept',
        nameJa: '上手',
        icon: '🏯',
        xpThreshold: 500,
      },
    ];

    const gallery = buildMilestoneGallery(
      milestones,
      [{ milestoneKey: 'starter', createdAt: achievedDate }],
      600,
    );

    expect(gallery).toEqual([
      {
        ...milestones[0],
        isUnlocked: true,
        achievedAt: new Date(achievedDate).toLocaleDateString(),
        progress: {
          currentXp: 100,
          targetXp: 100,
          remainingXp: 0,
          percent: 100,
          isComplete: true,
        },
      },
      {
        ...milestones[1],
        isUnlocked: false,
        achievedAt: null,
        progress: {
          currentXp: 500,
          targetXp: 500,
          remainingXp: 0,
          percent: 100,
          isComplete: true,
        },
      },
    ]);
  });

  it('builds sorted skill rows with labels, accuracy percentages, confidence, statuses, and recommendations', () => {
    const skills = buildSkillBreakdown([
      { type: 'custom_type', totalCount: 4, correctCount: 2, accuracy: 50 },
      { type: 'multiple_choice', totalCount: 30, correctCount: 27, accuracy: 90 },
      { type: 'translation', totalCount: 12, correctCount: 9, accuracy: 75 },
      { type: 'listening', totalCount: 10, correctCount: 6, accuracy: 60 },
    ]);

    expect(skills.map((skill) => skill.type)).toEqual([
      'multiple_choice',
      'translation',
      'listening',
      'custom_type',
    ]);
    expect(skills[0]).toMatchObject({
      label: 'Multiple Choice',
      accuracyPct: 90,
      confidence: 'high',
      status: 'strong',
      recommendation: 'Maintain with occasional review.',
    });
    expect(skills[1]).toMatchObject({
      label: 'Translation',
      accuracyPct: 75,
      confidence: 'medium',
      status: 'steady',
    });
    expect(skills[2]).toMatchObject({
      label: 'Listening',
      accuracyPct: 60,
      confidence: 'medium',
      status: 'focus-area',
    });
    expect(skills[3]).toMatchObject({
      label: 'custom_type',
      accuracyPct: 50,
      confidence: 'insufficient',
      status: 'insufficient-data',
      recommendation: 'Try a few more exercises before judging this skill.',
    });
  });

  it('builds history rows with existing fields and unavailable XP/duration when absent', () => {
    const createdAt = '2024-01-03T12:05:00.000Z';

    const history = buildHistoryList([
      {
        session: { createdAt, mode: 'practice' },
        accuracy: 75,
        exerciseCount: 8,
      },
    ]);

    expect(history).toEqual([
      {
        session: { createdAt, mode: 'practice' },
        accuracy: 75,
        exerciseCount: 8,
        dateLabel: new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }).format(new Date(createdAt)),
        modeLabel: 'practice',
        accuracyPct: 75,
        xpEarned: null,
        hasXp: false,
        durationMinutes: null,
        hasDuration: false,
      },
    ]);
    expect(history[0]?.dateLabel).not.toBe('');
  });

  it('passes through session XP and duration only when existing history fields provide them', () => {
    const createdAt = '2024-01-03T12:05:00.000Z';
    const history = buildHistoryList([
      {
        session: { createdAt, mode: 'learn', xpEarned: 24, durationSeconds: 540 },
        accuracy: 88,
        exerciseCount: 6,
      },
    ]);

    expect(history[0]).toMatchObject({
      modeLabel: 'learn',
      accuracyPct: 88,
      xpEarned: 24,
      hasXp: true,
      durationMinutes: 9,
      hasDuration: true,
    });
  });
});
