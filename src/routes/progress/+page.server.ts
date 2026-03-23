import type { PageServerLoad } from './$types';
import {
  getActivityDates,
  getDailyXpHistory,
  getExerciseTypeBreakdown,
  getSessionHistory,
  getUserById,
} from '$lib/server/db';
import { getGamificationStats, getUnlockedMilestones, MILESTONES } from '$lib/server/gamification';
import type { GamificationStats, Milestone, UserLevel, UserMilestone } from '$lib/types';

const HELSINKI_TIME_ZONE = 'Europe/Helsinki';

type ExerciseTypeBreakdown = {
  type: string;
  totalCount: number;
  correctCount: number;
  accuracy: number; // percentage in range 0-100
};

type DailyXpEntry = {
  date: string;
  totalXp: number;
};

function normalizePercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const scaled = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

type ProgressPageData = {
  selectedUserId: string | null;
  user: { id: string; level: UserLevel } | null;
  history: Awaited<ReturnType<typeof getSessionHistory>>;
  gamification: GamificationStats;
  unlockedMilestones: UserMilestone[];
  milestones: Milestone[];
  activityDates: string[];
  exerciseTypeBreakdown: ExerciseTypeBreakdown[];
  dailyXpHistory: DailyXpEntry[];
};

const EMPTY_GAMIFICATION_STATS: GamificationStats = {
  totalXp: 0,
  currentStreak: 0,
  longestStreak: 0,
  dailyGoalMet: false,
  nextMilestone: null,
  xpToNextMilestone: 0,
};

export const load: PageServerLoad = async ({ cookies, url }): Promise<ProgressPageData> => {
  const selectedUserId = cookies.get('selected_user');
  if (!selectedUserId) {
    return {
      selectedUserId: null,
      user: null,
      history: [],
      gamification: EMPTY_GAMIFICATION_STATS,
      unlockedMilestones: [],
      milestones: MILESTONES,
      activityDates: [],
      exerciseTypeBreakdown: [],
      dailyXpHistory: [],
    };
  }

  const localDate = url.searchParams.get('localDate')?.trim() ?? '';
  const fallbackDate = new Date().toLocaleDateString('sv-SE', { timeZone: HELSINKI_TIME_ZONE });
  const todayDateStr = /^\d{4}-\d{2}-\d{2}$/.test(localDate) ? localDate : fallbackDate;

  const [
    rawHistory,
    gamification,
    unlockedMilestones,
    activityDates,
    rawExerciseTypeBreakdown,
    dailyXpHistory,
    user,
  ] = await Promise.all([
    getSessionHistory(selectedUserId),
    getGamificationStats(selectedUserId, todayDateStr),
    getUnlockedMilestones(selectedUserId),
    getActivityDates(selectedUserId),
    getExerciseTypeBreakdown(selectedUserId),
    getDailyXpHistory(selectedUserId),
    getUserById(selectedUserId),
  ]);

  const history = rawHistory.map((entry) => ({
    ...entry,
    accuracy: normalizePercentage(entry.accuracy),
  }));

  const exerciseTypeBreakdown = rawExerciseTypeBreakdown.map((entry) => ({
    ...entry,
    accuracy: normalizePercentage(entry.accuracy),
  }));

  return {
    selectedUserId,
    user: user
      ? {
          id: user.id,
          level: user.level,
        }
      : {
          id: selectedUserId,
          level: 'absolute_beginner',
        },
    history,
    gamification,
    unlockedMilestones,
    milestones: MILESTONES,
    activityDates,
    exerciseTypeBreakdown,
    dailyXpHistory,
  };
};
