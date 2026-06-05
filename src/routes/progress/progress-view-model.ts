import { LEVEL_LABELS, LEVEL_ORDER } from '$lib/types';

export function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 80) return 'var(--accent-matcha)';
  if (accuracy >= 50) return 'var(--state-warning)';
  return 'var(--accent-shu)';
}

export const typeLabels: Record<string, string> = {
  multiple_choice: 'Multiple Choice',
  translation: 'Translation',
  fill_blank: 'Fill in the Blank',
  reorder: 'Word Order',
  reading: 'Reading',
  listening: 'Listening',
};

function toLocalDateKey(value: Date): string {
  return value.toLocaleDateString('sv-SE');
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function safeNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function dateFromKey(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

export interface DailyXpHistoryEntry {
  date: string;
  totalXp: number;
}

export interface XpHistoryBucket {
  key: string;
  label: string;
  totalXp: number;
  dayCount: number;
}

export interface XpHistorySummary {
  totalXp: number;
  averageDailyXp: number;
  averageActiveDayXp: number;
  bestDaily: XpHistoryBucket | null;
  bestWeekly: XpHistoryBucket | null;
  bestMonthly: XpHistoryBucket | null;
  activeDayCount: number;
  bucketCount: number;
  hasData: boolean;
  isSparse: boolean;
}

export interface XpHistoryViewModel {
  daily: XpHistoryBucket[];
  weekly: XpHistoryBucket[];
  monthly: XpHistoryBucket[];
  summary: XpHistorySummary;
}

function normalizeDailyXpHistory(dailyXpHistory: DailyXpHistoryEntry[]): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const entry of dailyXpHistory) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) continue;
    byDate.set(entry.date, (byDate.get(entry.date) ?? 0) + safeNonNegative(entry.totalXp));
  }
  return byDate;
}

function buildDailyBuckets(
  dailyXpHistory: DailyXpHistoryEntry[],
  todayValue: Date,
  daysToShow: number,
): XpHistoryBucket[] {
  const safeDaysToShow = Math.max(1, Math.round(daysToShow));
  const byDate = normalizeDailyXpHistory(dailyXpHistory);
  const today = new Date(todayValue);
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - safeDaysToShow + 1);

  return Array.from({ length: safeDaysToShow }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const key = toLocalDateKey(date);
    return {
      key,
      label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date),
      totalXp: byDate.get(key) ?? 0,
      dayCount: 1,
    };
  });
}

function rollUpBuckets(daily: XpHistoryBucket[], bucketType: 'week' | 'month'): XpHistoryBucket[] {
  const buckets = new Map<string, { firstDate: Date; totalXp: number; dayCount: number }>();

  for (const day of daily) {
    const date = dateFromKey(day.key);
    let key: string;
    if (bucketType === 'week') {
      const weekStart = new Date(date);
      const currentDay = weekStart.getDay();
      const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
      weekStart.setDate(weekStart.getDate() - daysSinceMonday);
      key = toLocalDateKey(weekStart);
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    const existing = buckets.get(key);
    if (existing) {
      existing.totalXp += day.totalXp;
      existing.dayCount += day.dayCount;
    } else {
      buckets.set(key, { firstDate: date, totalXp: day.totalXp, dayCount: day.dayCount });
    }
  }

  return Array.from(buckets.entries()).map(([key, bucket]) => ({
    key,
    label: new Intl.DateTimeFormat(
      'en-US',
      bucketType === 'week'
        ? { month: 'short', day: 'numeric' }
        : { month: 'short', year: 'numeric' },
    ).format(bucket.firstDate),
    totalXp: bucket.totalXp,
    dayCount: bucket.dayCount,
  }));
}

function bestBucket(buckets: XpHistoryBucket[]): XpHistoryBucket | null {
  const [first] = buckets;
  if (!first) return null;
  return buckets.reduce((best, bucket) => (bucket.totalXp > best.totalXp ? bucket : best), first);
}

export function buildXpHistory(
  dailyXpHistory: DailyXpHistoryEntry[],
  todayValue: Date = new Date(),
  daysToShow = 30,
): XpHistoryViewModel {
  const daily = buildDailyBuckets(dailyXpHistory, todayValue, daysToShow);
  const weekly = rollUpBuckets(daily, 'week');
  const monthly = rollUpBuckets(daily, 'month');
  const totalXp = daily.reduce((sum, day) => sum + day.totalXp, 0);
  const activeDayCount = daily.filter((day) => day.totalXp > 0).length;
  const bucketCount = daily.length;

  return {
    daily,
    weekly,
    monthly,
    summary: {
      totalXp,
      averageDailyXp: bucketCount === 0 ? 0 : Math.round(totalXp / bucketCount),
      averageActiveDayXp: activeDayCount === 0 ? 0 : Math.round(totalXp / activeDayCount),
      bestDaily: bestBucket(daily),
      bestWeekly: bestBucket(weekly),
      bestMonthly: bestBucket(monthly),
      activeDayCount,
      bucketCount,
      hasData: totalXp > 0,
      isSparse: totalXp > 0 && activeDayCount < Math.ceil(bucketCount / 3),
    },
  };
}

export interface LearningLevelJourneyInput {
  currentLevel: string | number;
}

export interface LearningLevelJourneyStep {
  level: number;
  label: string;
  isCurrent: boolean;
  isReached: boolean;
  isNext: boolean;
}

export interface LearningLevelJourneyViewModel {
  currentLevel: number | null;
  currentLevelLabel: string;
  steps: LearningLevelJourneyStep[];
  nextLevel: LearningLevelJourneyStep | null;
  isMaxLevel: boolean;
}

const LEVEL_NAMES = LEVEL_ORDER.map((levelKey, index) => ({
  level: index + 1,
  label: LEVEL_LABELS[levelKey],
}));

function parseLevel(value: string | number): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(1, Math.round(value));
  const namedLevelIndex = LEVEL_ORDER.findIndex((levelKey) => levelKey === value);
  if (namedLevelIndex >= 0) return namedLevelIndex + 1;
  const matched = String(value).match(/\d+/);
  if (!matched) return null;
  return Math.max(1, Number.parseInt(matched[0], 10));
}

function getLevelLabel(level: number): string {
  return LEVEL_NAMES[level - 1]?.label ?? `Level ${level}`;
}

export function buildLearningLevelJourney(
  input: LearningLevelJourneyInput,
): LearningLevelJourneyViewModel {
  const levelFromUser = parseLevel(input.currentLevel);
  const clampedCurrentLevel = Math.max(1, Math.min(LEVEL_NAMES.length, levelFromUser ?? 1));
  const nextLevelNumber = clampedCurrentLevel < LEVEL_NAMES.length ? clampedCurrentLevel + 1 : null;

  const steps = LEVEL_NAMES.map(({ level, label }) => ({
    level,
    label,
    isCurrent: level === clampedCurrentLevel,
    isReached: level <= clampedCurrentLevel,
    isNext: level === nextLevelNumber,
  }));

  const nextLevel = nextLevelNumber ? (steps[nextLevelNumber - 1] ?? null) : null;

  return {
    currentLevel: clampedCurrentLevel,
    currentLevelLabel: getLevelLabel(clampedCurrentLevel),
    steps,
    nextLevel,
    isMaxLevel: nextLevel === null,
  };
}

export interface ProgressCalendarDay {
  dateStr: string;
  isToday: boolean;
  isFuture: boolean;
  isActive: boolean;
  label: string;
  xpTotal: number;
  intensity: 0 | 1 | 2 | 3;
}

export function buildCalendarData(
  activityDates: string[],
  todayValue: Date = new Date(),
  dailyXpHistory: DailyXpHistoryEntry[] = [],
): ProgressCalendarDay[] {
  const today = new Date(todayValue);
  today.setHours(0, 0, 0, 0);
  const todayKey = toLocalDateKey(today);
  const currentDay = today.getDay();
  const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
  const weeksToShow = 12;
  const daysTotal = weeksToShow * 7;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - daysSinceMonday - (weeksToShow - 1) * 7);
  const days: ProgressCalendarDay[] = [];
  const activeSet = new Set(activityDates);
  const xpByDate = normalizeDailyXpHistory(dailyXpHistory);
  const bestXp = Math.max(
    0,
    ...Array.from(xpByDate.entries())
      .filter(([dateStr]) => dateFromKey(dateStr).getTime() <= today.getTime())
      .map(([, xp]) => xp),
  );

  for (let i = 0; i < daysTotal; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dateStr = toLocalDateKey(d);
    const isFuture = d.getTime() > today.getTime();
    const xpTotal = isFuture ? 0 : (xpByDate.get(dateStr) ?? 0);
    let intensity: 0 | 1 | 2 | 3 = 0;
    if (!isFuture && xpTotal > 0 && bestXp > 0) {
      intensity = xpTotal >= bestXp * 0.66 ? 3 : xpTotal >= bestXp * 0.33 ? 2 : 1;
    }

    days.push({
      dateStr,
      isToday: dateStr === todayKey,
      isFuture,
      isActive: activeSet.has(dateStr),
      label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d),
      xpTotal,
      intensity,
    });
  }
  return days;
}

export interface ProgressMilestone {
  key: string;
  name: string;
  nameJa: string;
  icon: string;
  xpThreshold: number;
}

export interface UnlockedMilestoneRecord {
  milestoneKey: string;
  createdAt: string;
}

export interface MilestoneProgress {
  currentXp: number;
  targetXp: number;
  remainingXp: number;
  percent: number;
  isComplete: boolean;
}

export type MilestoneGalleryItem<T extends ProgressMilestone = ProgressMilestone> = T & {
  isUnlocked: boolean;
  achievedAt: string | null;
  progress: MilestoneProgress;
};

export function buildMilestoneGallery<T extends ProgressMilestone>(
  milestones: T[],
  unlockedMilestones: UnlockedMilestoneRecord[],
  totalXp: number,
): Array<MilestoneGalleryItem<T>> {
  const currentXp = safeNonNegative(totalXp);
  const unlockedMap = new Map(unlockedMilestones.map((m) => [m.milestoneKey, m]));
  return milestones.map((m) => {
    const unlocked = unlockedMap.get(m.key);
    const targetXp = safeNonNegative(m.xpThreshold);
    const isComplete = targetXp === 0 || currentXp >= targetXp;
    return {
      ...m,
      isUnlocked: Boolean(unlocked),
      achievedAt: unlocked ? new Date(unlocked.createdAt).toLocaleDateString() : null,
      progress: {
        currentXp: Math.min(currentXp, targetXp),
        targetXp,
        remainingXp: Math.max(0, targetXp - currentXp),
        percent: targetXp === 0 ? 100 : clampPercentage((currentXp / targetXp) * 100),
        isComplete,
      },
    };
  });
}

export interface SkillBreakdownItem {
  type: string;
  totalCount: number;
  correctCount: number;
  accuracy: number;
}

export type SkillConfidence = 'insufficient' | 'low' | 'medium' | 'high';
export type SkillStatus = 'insufficient-data' | 'strong' | 'steady' | 'focus-area';

export type SkillBreakdownViewItem<T extends SkillBreakdownItem = SkillBreakdownItem> = T & {
  label: string;
  accuracyPct: number;
  confidence: SkillConfidence;
  status: SkillStatus;
  recommendation: string;
};

function getSkillConfidence(totalCount: number): SkillConfidence {
  if (totalCount < 5) return 'insufficient';
  if (totalCount < 10) return 'low';
  if (totalCount < 25) return 'medium';
  return 'high';
}

function getSkillStatus(accuracyPct: number, confidence: SkillConfidence): SkillStatus {
  if (confidence === 'insufficient') return 'insufficient-data';
  if (accuracyPct >= 85) return 'strong';
  if (accuracyPct >= 70) return 'steady';
  return 'focus-area';
}

function getSkillRecommendation(status: SkillStatus, confidence: SkillConfidence): string {
  if (status === 'insufficient-data') return 'Try a few more exercises before judging this skill.';
  if (confidence === 'low') return 'Keep sampling this skill to confirm the trend.';
  if (status === 'strong') return 'Maintain with occasional review.';
  if (status === 'steady') return 'Continue steady practice to build fluency.';
  return 'Prioritize this skill in the next practice session.';
}

export function buildSkillBreakdown<T extends SkillBreakdownItem>(
  items: T[],
): Array<SkillBreakdownViewItem<T>> {
  return items
    .map((item) => {
      const accuracyPct = item.accuracy;
      const confidence = getSkillConfidence(item.totalCount);
      const status = getSkillStatus(accuracyPct, confidence);
      return {
        ...item,
        label: typeLabels[item.type] || item.type,
        accuracyPct,
        confidence,
        status,
        recommendation: getSkillRecommendation(status, confidence),
      };
    })
    .sort((a, b) => b.totalCount - a.totalCount);
}

export interface HistoryListItem {
  session: { createdAt: string; mode: string };
  accuracy: number;
  exerciseCount: number;
}

export type HistoryListViewItem<T extends HistoryListItem = HistoryListItem> = T & {
  dateLabel: string;
  modeLabel: string;
  accuracyPct: number;
  xpEarned: number | null;
  hasXp: boolean;
  durationMinutes: number | null;
  hasDuration: boolean;
};

function readOptionalNumber(source: unknown, keys: string[]): number | null {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

export function buildHistoryList<T extends HistoryListItem>(
  history: T[],
): Array<HistoryListViewItem<T>> {
  return history.map((h) => {
    const sessionXp = readOptionalNumber(h.session, ['xpEarned', 'totalXp', 'xp']);
    const itemXp = readOptionalNumber(h, ['xpEarned', 'totalXp', 'xp']);
    const xpEarned = sessionXp ?? itemXp;
    const durationMs = readOptionalNumber(h.session, ['durationMs', 'durationMillis']);
    const durationSeconds = readOptionalNumber(h.session, ['durationSeconds']);
    const durationMinutes = readOptionalNumber(h.session, ['durationMinutes']);
    const resolvedDurationMinutes =
      durationMinutes ??
      (durationSeconds === null ? null : Math.round(durationSeconds / 60)) ??
      (durationMs === null ? null : Math.round(durationMs / 60_000));

    return {
      ...h,
      dateLabel: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(h.session.createdAt)),
      modeLabel: h.session.mode,
      accuracyPct: h.accuracy,
      xpEarned,
      hasXp: xpEarned !== null,
      durationMinutes: resolvedDurationMinutes,
      hasDuration: resolvedDurationMinutes !== null,
    };
  });
}
