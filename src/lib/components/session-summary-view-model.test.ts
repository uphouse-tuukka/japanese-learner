import { describe, expect, it } from 'vitest';
import {
  buildLevelTransition,
  buildMilestoneDisplay,
  buildUsefulUnlock,
  buildXpRows,
  getSessionSummaryFrameLabels,
  shouldCelebrateScore,
} from './session-summary-view-model';
import type { Milestone, SessionMiniLesson, SessionXpBreakdown } from '$lib/types';

function milestone(key: string): Milestone {
  return {
    key,
    name: `Milestone ${key}`,
    nameJa: `マイルストーン ${key}`,
    description: `Description ${key}`,
    xpThreshold: 100,
  };
}

function xpBreakdown(overrides: Partial<SessionXpBreakdown>): SessionXpBreakdown {
  return {
    exerciseXp: 0,
    sessionBonusXp: 0,
    perfectBonusXp: 0,
    streakBonusXp: 0,
    comboBonusXp: 0,
    totalXp: 0,
    newMilestones: [],
    ...overrides,
  };
}

function miniLesson(overrides: Partial<SessionMiniLesson> = {}): SessionMiniLesson {
  return {
    kind: 'nuance_upgrade',
    japanese: 'すみません、駅はどこですか。',
    romaji: 'sumimasen, eki wa doko desu ka',
    english: 'Excuse me, where is the station?',
    note: 'Use this shape for stations, gates, and counters.',
    ...overrides,
  };
}

describe('session summary view-model helpers', () => {
  it('keeps the existing celebration threshold at 80 percent', () => {
    expect(shouldCelebrateScore(80)).toBe(true);
    expect(shouldCelebrateScore(79)).toBe(false);
  });

  it('builds the existing visible XP rows and highlight classes', () => {
    const rows = buildXpRows(
      xpBreakdown({
        exerciseXp: 12,
        sessionBonusXp: 5,
        perfectBonusXp: 10,
        streakBonusXp: 8,
        comboBonusXp: 3,
      }),
    );

    expect(rows).toEqual([
      { label: 'Correct answers', value: '12墨', highlight: false },
      { label: 'Session complete', value: '+5墨', highlight: false },
      { label: 'Perfect score', value: '+10墨', highlight: true },
      { label: 'Streak bonus', value: '+8墨', highlight: true },
      { label: 'Combo bonus', value: '+3墨', highlight: true },
    ]);
  });

  it('omits zero and negative XP rows like the previous conditional markup', () => {
    const rows = buildXpRows(
      xpBreakdown({
        exerciseXp: 0,
        sessionBonusXp: -1,
        perfectBonusXp: 7,
      }),
    );

    expect(rows).toEqual([{ label: 'Perfect score', value: '+7墨', highlight: true }]);
    expect(buildXpRows(null)).toEqual([]);
  });

  it('keeps all displayed milestones when there are at most two', () => {
    const milestones = [milestone('first'), milestone('second')];

    expect(buildMilestoneDisplay(milestones)).toEqual({
      displayedMilestones: milestones,
      hiddenMilestoneCount: 0,
    });
  });

  it('shows only the latest milestone and preserves the old hidden count when there are more than two', () => {
    const milestones = [milestone('first'), milestone('second'), milestone('third')];

    expect(buildMilestoneDisplay(milestones)).toEqual({
      displayedMilestones: [milestones[2]],
      hiddenMilestoneCount: 2,
    });
  });

  it('maps promotion recommendations to the previous and next level labels', () => {
    expect(buildLevelTransition({ recommendedLevel: 'intermediate', reason: 'Ready' })).toEqual({
      currentLevelLabel: 'Pre-Intermediate',
      nextLevelLabel: 'Intermediate',
      isReadyForJapan: false,
    });

    expect(buildLevelTransition({ recommendedLevel: 'ready_for_japan', reason: 'Ready' })).toEqual({
      currentLevelLabel: 'Advanced',
      nextLevelLabel: 'Ready for Japan 🇯🇵',
      isReadyForJapan: true,
    });

    expect(buildLevelTransition(null)).toEqual({
      currentLevelLabel: '',
      nextLevelLabel: '',
      isReadyForJapan: false,
    });
  });

  it('uses the session mini lesson as the carry-forward unlock with romaji parentheses', () => {
    const unlock = buildUsefulUnlock(miniLesson());

    expect(unlock).toEqual({
      eyebrow: 'Today’s unlock',
      heading: 'Carry this pattern forward',
      deck: 'Use this shape for stations, gates, and counters.',
      phrase: {
        japanese: 'すみません、駅はどこですか。',
        romaji: 'sumimasen, eki wa doko desu ka',
        english: 'Excuse me, where is the station?',
      },
      phraseLine: 'すみません、駅はどこですか。 (sumimasen, eki wa doko desu ka)',
    });
    expect(unlock.phraseLine).toBe('すみません、駅はどこですか。 (sumimasen, eki wa doko desu ka)');
  });

  it('keeps a reusable fallback unlock instead of falling back to the old audit grid', () => {
    const unlock = buildUsefulUnlock(null);

    expect(unlock.heading).toBe('Keep one reusable travel move');
    expect(unlock.phraseLine).toContain('すみません (sumimasen)');
    expect(unlock.deck).not.toMatch(/mastering|work on/i);
  });

  it('names the locked B4 frame and not the removed strengths or weaknesses audit labels', () => {
    expect(getSessionSummaryFrameLabels()).toEqual({
      leftHeading: 'Session complete',
      unlockEyebrow: 'Today’s unlock',
      homeCta: 'Return Home',
      practiceCta: 'Try Practice Mode',
    });
  });
});
