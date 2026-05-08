import { describe, expect, it } from 'vitest';
import {
  buildCalendarData,
  buildHistoryList,
  buildMilestoneGallery,
  buildSkillBreakdown,
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

  it('builds a 12-week Monday-start calendar and flags today, activity, and future days', () => {
    const today = new Date(2024, 0, 1, 12);
    const activityDate = '2023-12-31';

    const calendar = buildCalendarData([activityDate], today);

    expect(calendar).toHaveLength(84);
    expect(new Date(`${calendar[0].dateStr}T00:00:00`).getDay()).toBe(1);

    const todayCell = calendar.find((day) => day.isToday);
    expect(todayCell).toMatchObject({
      dateStr: toLocalDateKey(today),
      isToday: true,
      isFuture: false,
    });

    expect(calendar.find((day) => day.dateStr === activityDate)).toMatchObject({
      isActive: true,
    });
    expect(calendar.find((day) => day.isFuture)?.dateStr).toBe('2024-01-02');
    expect(calendar.at(-1)).toMatchObject({ isFuture: true, isActive: false });
  });

  it('builds milestone cards with preserved fields, XP unlock state, and achieved dates from records', () => {
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
      250,
    );

    expect(gallery).toEqual([
      {
        ...milestones[0],
        isUnlocked: true,
        achievedAt: new Date(achievedDate).toLocaleDateString(),
      },
      {
        ...milestones[1],
        isUnlocked: false,
        achievedAt: null,
      },
    ]);
  });

  it('builds sorted skill rows with labels and accuracy percentages', () => {
    const skills = buildSkillBreakdown([
      { type: 'custom_type', totalCount: 4, correctCount: 2, accuracy: 50 },
      { type: 'multiple_choice', totalCount: 9, correctCount: 8, accuracy: 89 },
      { type: 'translation', totalCount: 6, correctCount: 3, accuracy: 50 },
    ]);

    expect(skills.map((skill) => skill.type)).toEqual([
      'multiple_choice',
      'translation',
      'custom_type',
    ]);
    expect(skills[0]).toMatchObject({ label: 'Multiple Choice', accuracyPct: 89 });
    expect(skills[1]).toMatchObject({ label: 'Translation', accuracyPct: 50 });
    expect(skills[2]).toMatchObject({ label: 'custom_type', accuracyPct: 50 });
  });

  it('builds history rows with mode labels, accuracy percentages, and formatted dates', () => {
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
      },
    ]);
    expect(history[0].dateLabel).not.toBe('');
  });
});
