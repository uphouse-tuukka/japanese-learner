import { describe, expect, it } from 'vitest';
import {
  MILESTONES,
  calculateMissionXp,
  calculateNewMilestones,
  calculateSessionXp,
  calculateStreakFromDateStrings,
} from './gamification';

function exerciseResults(...results: boolean[]): Array<{ isCorrect: boolean }> {
  return results.map((isCorrect) => ({ isCorrect }));
}

function milestoneKeysFor(totalXp: number, unlockedKeys: string[] = []): string[] {
  return calculateNewMilestones(totalXp, unlockedKeys).map((milestone) => milestone.key);
}

describe('calculateSessionXp', () => {
  it('awards exercise XP only for correct answers and includes session completion XP', () => {
    expect(calculateSessionXp(exerciseResults(true, false, true, false), 0)).toEqual({
      exerciseXp: 20,
      sessionBonusXp: 50,
      perfectBonusXp: 0,
      comboBonusXp: 0,
      totalXp: 70,
    });
  });

  it('awards a perfect score bonus for non-empty all-correct sessions', () => {
    expect(calculateSessionXp(exerciseResults(true, true, true), 0)).toEqual({
      exerciseXp: 30,
      sessionBonusXp: 50,
      perfectBonusXp: 25,
      comboBonusXp: 0,
      totalXp: 105,
    });
  });

  it('does not award a perfect score bonus for an empty session result set', () => {
    expect(calculateSessionXp([], 0)).toEqual({
      exerciseXp: 0,
      sessionBonusXp: 50,
      perfectBonusXp: 0,
      comboBonusXp: 0,
      totalXp: 50,
    });
  });

  it('integrates combo bonus XP into the session total', () => {
    expect(
      calculateSessionXp(exerciseResults(true, true, false, true, true, true, true, true), 8),
    ).toEqual({
      exerciseXp: 70,
      sessionBonusXp: 50,
      perfectBonusXp: 0,
      comboBonusXp: 6,
      totalXp: 126,
    });
  });
});

describe('calculateMissionXp', () => {
  it('calculates practice mission XP without a natural phrasing bonus', () => {
    expect(
      calculateMissionXp({
        mode: 'practice',
        correctResponses: 3,
        totalExchanges: 5,
        naturalPhrasings: 2,
      }),
    ).toEqual({
      missionCompletion: 25,
      correctResponses: 30,
      naturalPhrasing: 0,
      total: 55,
    });
  });

  it('calculates immersion mission XP with correct response and natural phrasing bonuses', () => {
    expect(
      calculateMissionXp({
        mode: 'immersion',
        correctResponses: 2,
        totalExchanges: 5,
        naturalPhrasings: 3,
      }),
    ).toEqual({
      missionCompletion: 100,
      correctResponses: 20,
      naturalPhrasing: 45,
      total: 165,
    });
  });
});

describe('calculateStreakFromDateStrings', () => {
  it('returns empty streak state for no activity dates', () => {
    expect(calculateStreakFromDateStrings([])).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
    });
  });

  it('deduplicates multiple activities on the same local date across a day boundary', () => {
    expect(calculateStreakFromDateStrings(['2025-05-07', '2025-05-06', '2025-05-06'])).toEqual({
      currentStreak: 2,
      longestStreak: 2,
      lastActivityDate: '2025-05-07',
    });
  });

  it('resets the current streak after a skipped local date while preserving the longest streak', () => {
    expect(
      calculateStreakFromDateStrings(['2025-05-01', '2025-05-02', '2025-05-03', '2025-05-05']),
    ).toEqual({
      currentStreak: 1,
      longestStreak: 3,
      lastActivityDate: '2025-05-05',
    });
  });
});

describe('calculateNewMilestones', () => {
  it('detects milestones only at or above their XP threshold', () => {
    expect(milestoneKeysFor(49)).toEqual([]);
    expect(milestoneKeysFor(50)).toEqual(['first_stroke']);
  });

  it('returns all newly eligible milestones and skips already unlocked keys', () => {
    expect(milestoneKeysFor(500, ['first_stroke'])).toEqual(['ink_student', 'steady_brush']);
  });

  it('keeps milestone thresholds in ascending order for progress detection', () => {
    expect(MILESTONES.map((milestone) => milestone.xpThreshold)).toEqual([
      50, 200, 500, 1000, 2000, 3500, 5000, 7500, 10000, 15000, 25000, 50000,
    ]);
  });
});
