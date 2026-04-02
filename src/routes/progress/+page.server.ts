import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
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
  accuracy: number;
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

export type ProgressData = {
  user: { id: string; level: UserLevel } | null;
  history: Array<Awaited<ReturnType<typeof getSessionHistory>>[number] & { accuracy: number }>;
  gamification: GamificationStats;
  unlockedMilestones: UserMilestone[];
  milestones: Milestone[];
  activityDates: string[];
  exerciseTypeBreakdown: ExerciseTypeBreakdown[];
  dailyXpHistory: DailyXpEntry[];
};

export const load: PageServerLoad = async ({ cookies, url }) => {
  const selectedUserId = cookies.get('selected_user');
  if (!selectedUserId) {
    throw redirect(302, '/');
  }

  const localDate = url.searchParams.get('localDate')?.trim() ?? '';
  const fallbackDate = new Date().toLocaleDateString('sv-SE', { timeZone: HELSINKI_TIME_ZONE });
  const todayDateStr = /^\d{4}-\d{2}-\d{2}$/.test(localDate) ? localDate : fallbackDate;

  // Return the promise WITHOUT awaiting — SvelteKit streams it after instant navigation
  const lazy = Promise.all([
    getSessionHistory(selectedUserId),
    getGamificationStats(selectedUserId, todayDateStr),
    getUnlockedMilestones(selectedUserId),
    getActivityDates(selectedUserId),
    getExerciseTypeBreakdown(selectedUserId),
    getDailyXpHistory(selectedUserId),
    getUserById(selectedUserId),
  ]).then(
    ([
      rawHistory,
      gamification,
      unlockedMilestones,
      activityDates,
      rawExerciseTypeBreakdown,
      dailyXpHistory,
      user,
    ]): ProgressData => {
      const history = rawHistory.map((entry) => ({
        ...entry,
        accuracy: normalizePercentage(entry.accuracy),
      }));

      const exerciseTypeBreakdown = rawExerciseTypeBreakdown.map((entry) => ({
        ...entry,
        accuracy: normalizePercentage(entry.accuracy),
      }));

      return {
        user: user
          ? { id: user.id, level: user.level }
          : { id: selectedUserId, level: 'absolute_beginner' },
        history,
        gamification,
        unlockedMilestones,
        milestones: MILESTONES,
        activityDates,
        exerciseTypeBreakdown,
        dailyXpHistory,
      };
    },
  );

  return {
    selectedUserId,
    lazy,
  };
};
