import {
  LEVEL_LABELS,
  LEVEL_ORDER,
  type LevelUpRecommendation,
  type Milestone,
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
