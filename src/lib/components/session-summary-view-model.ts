import {
  LEVEL_LABELS,
  LEVEL_ORDER,
  type LevelUpRecommendation,
  type Milestone,
  type SessionMiniLesson,
  type SessionXpBreakdown,
} from '$lib/types';

export interface XpRow {
  label: string;
  value: string;
  highlight: boolean;
}

type XpBreakdownKey =
  | 'exerciseXp'
  | 'sessionBonusXp'
  | 'perfectBonusXp'
  | 'streakBonusXp'
  | 'comboBonusXp';

interface XpRowConfig {
  key: XpBreakdownKey;
  label: string;
  prefix: '' | '+';
  highlight: boolean;
}

const XP_ROW_CONFIGS: readonly XpRowConfig[] = [
  { key: 'exerciseXp', label: 'Correct answers', prefix: '', highlight: false },
  { key: 'sessionBonusXp', label: 'Session complete', prefix: '+', highlight: false },
  { key: 'perfectBonusXp', label: 'Perfect score', prefix: '+', highlight: true },
  { key: 'streakBonusXp', label: 'Streak bonus', prefix: '+', highlight: true },
  { key: 'comboBonusXp', label: 'Combo bonus', prefix: '+', highlight: true },
];

export interface MilestoneDisplay {
  displayedMilestones: readonly Milestone[];
  hiddenMilestoneCount: number;
}

export interface LevelTransition {
  currentLevelLabel: string;
  nextLevelLabel: string;
  isReadyForJapan: boolean;
}

export interface UsefulUnlock {
  eyebrow: 'Today’s unlock';
  heading: string;
  deck: string;
  phrase: {
    japanese: string;
    romaji: string;
    english: string;
  };
  phraseLine: string;
}

export interface SessionSummaryFrameLabels {
  leftHeading: 'Session complete';
  unlockEyebrow: 'Today’s unlock';
  homeCta: 'Return Home';
  practiceCta: 'Try Practice Mode';
}

const FALLBACK_USEFUL_UNLOCK: UsefulUnlock = {
  eyebrow: 'Today’s unlock',
  heading: 'Keep one reusable travel move',
  deck: 'When you need help, open politely first, then name the thing you need.',
  phrase: {
    japanese: 'すみません',
    romaji: 'sumimasen',
    english: 'Excuse me / sorry to bother you',
  },
  phraseLine: 'すみません (sumimasen)',
};

export function shouldCelebrateScore(score: number): boolean {
  return score >= 80;
}

export function buildXpRows(xpBreakdown: SessionXpBreakdown | null | undefined): XpRow[] {
  if (!xpBreakdown) return [];

  const rows: XpRow[] = [];
  for (const { key, label, prefix, highlight } of XP_ROW_CONFIGS) {
    const xp = xpBreakdown[key];
    if (xp > 0) {
      rows.push({ label, value: `${prefix}${xp}墨`, highlight });
    }
  }

  return rows;
}

export function buildMilestoneDisplay(
  milestones: Milestone[] | readonly Milestone[] | null | undefined,
): MilestoneDisplay {
  const milestoneList: readonly Milestone[] = milestones ?? [];

  if (milestoneList.length <= 2) {
    return { displayedMilestones: milestoneList, hiddenMilestoneCount: 0 };
  }

  const latestMilestone = milestoneList[milestoneList.length - 1];
  return {
    displayedMilestones: latestMilestone ? [latestMilestone] : [],
    hiddenMilestoneCount: latestMilestone ? milestoneList.length - 1 : 0,
  };
}

export function buildLevelTransition(
  recommendation: LevelUpRecommendation | null | undefined,
): LevelTransition {
  if (!recommendation) {
    return { currentLevelLabel: '', nextLevelLabel: '', isReadyForJapan: false };
  }

  const nextIdx = LEVEL_ORDER.indexOf(recommendation.recommendedLevel);
  const currentLevelKey = nextIdx > 0 ? LEVEL_ORDER[nextIdx - 1] : null;

  return {
    currentLevelLabel: currentLevelKey ? LEVEL_LABELS[currentLevelKey] : '',
    nextLevelLabel: LEVEL_LABELS[recommendation.recommendedLevel],
    isReadyForJapan: recommendation.recommendedLevel === 'ready_for_japan',
  };
}

export function buildUsefulUnlock(miniLesson: SessionMiniLesson | null | undefined): UsefulUnlock {
  if (!miniLesson) return FALLBACK_USEFUL_UNLOCK;

  return {
    eyebrow: 'Today’s unlock',
    heading: 'Carry this pattern forward',
    deck: miniLesson.note,
    phrase: {
      japanese: miniLesson.japanese,
      romaji: miniLesson.romaji,
      english: miniLesson.english,
    },
    phraseLine: `${miniLesson.japanese} (${miniLesson.romaji})`,
  };
}

export function getSessionSummaryFrameLabels(): SessionSummaryFrameLabels {
  return {
    leftHeading: 'Session complete',
    unlockEyebrow: 'Today’s unlock',
    homeCta: 'Return Home',
    practiceCta: 'Try Practice Mode',
  };
}
