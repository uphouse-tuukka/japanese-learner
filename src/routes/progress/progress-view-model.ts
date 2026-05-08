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

export interface ProgressCalendarDay {
  dateStr: string;
  isToday: boolean;
  isFuture: boolean;
  isActive: boolean;
  label: string;
}

export function buildCalendarData(
  activityDates: string[],
  todayValue: Date = new Date(),
): ProgressCalendarDay[] {
  const toLocalDateKey = (value: Date): string => value.toLocaleDateString('sv-SE');
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

export type MilestoneGalleryItem<T extends ProgressMilestone = ProgressMilestone> = T & {
  isUnlocked: boolean;
  achievedAt: string | null;
};

export function buildMilestoneGallery<T extends ProgressMilestone>(
  milestones: T[],
  unlockedMilestones: UnlockedMilestoneRecord[],
  totalXp: number,
): Array<MilestoneGalleryItem<T>> {
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

export interface SkillBreakdownItem {
  type: string;
  totalCount: number;
  correctCount: number;
  accuracy: number;
}

export type SkillBreakdownViewItem<T extends SkillBreakdownItem = SkillBreakdownItem> = T & {
  label: string;
  accuracyPct: number;
};

export function buildSkillBreakdown<T extends SkillBreakdownItem>(
  items: T[],
): Array<SkillBreakdownViewItem<T>> {
  return items
    .map((item) => ({
      ...item,
      label: typeLabels[item.type] || item.type,
      accuracyPct: item.accuracy,
    }))
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
};

export function buildHistoryList<T extends HistoryListItem>(
  history: T[],
): Array<HistoryListViewItem<T>> {
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
