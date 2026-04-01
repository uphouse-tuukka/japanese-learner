import { randomUUID } from 'node:crypto';
import type { InStatement } from '@libsql/client';
import { getDb } from '$lib/server/db';
import type {
  GamificationStats,
  Milestone,
  SessionXpBreakdown,
  UserMilestone,
  UserStreak,
  XpReason,
  XpTransaction,
} from '$lib/types';

export const XP_PER_CORRECT_ANSWER = 10;
export const XP_SESSION_COMPLETE = 50;
export const XP_PERFECT_SCORE = 25;
export const XP_STREAK_BONUS_PER_DAY = 5;
export const XP_COMBO_BONUS_THRESHOLD = 5;
export const XP_PER_COMBO_ANSWER = 2;
export const XP_MISSION_IMMERSION_COMPLETE = 100;
export const XP_MISSION_PRACTICE_COMPLETE = 25;
export const XP_MISSION_CORRECT_RESPONSE = 10;
export const XP_MISSION_NATURAL_PHRASING = 15;

export const MILESTONES: Milestone[] = [
  {
    key: 'first_stroke',
    name: 'First Stroke',
    nameJa: '初筆',
    icon: '初',
    description: 'You place your first intentional mark on the page.',
    xpThreshold: 50,
  },
  {
    key: 'ink_student',
    name: 'Ink Student',
    nameJa: '墨の学徒',
    icon: '学',
    description: 'Practice has become a habit, and your hand is steadier.',
    xpThreshold: 200,
  },
  {
    key: 'steady_brush',
    name: 'Steady Hand',
    nameJa: '安定の筆',
    icon: '筆',
    description: 'Your lines carry control and confidence.',
    xpThreshold: 500,
  },
  {
    key: 'flowing_script',
    name: 'Flowing Brush',
    nameJa: '流麗の筆',
    icon: '流',
    description: 'Your writing begins to flow like ink across washi.',
    xpThreshold: 1000,
  },
  {
    key: 'kanji_craft',
    name: 'Kanji Artisan',
    nameJa: '漢字工匠',
    icon: '匠',
    description: 'Precision and structure shape every character you write.',
    xpThreshold: 2000,
  },
  {
    key: 'dojo_disciple',
    name: 'Dōjō Disciple',
    nameJa: '道場の門人',
    icon: '道',
    description: 'Your discipline reflects daily commitment to the craft.',
    xpThreshold: 3500,
  },
  {
    key: 'seasoned_calligrapher',
    name: 'Seasoned Calligrapher',
    nameJa: '熟練書家',
    icon: '熟',
    description: 'Technique and calm are now part of your natural rhythm.',
    xpThreshold: 5000,
  },
  {
    key: 'ink_master',
    name: 'Ink Master',
    nameJa: '墨匠',
    icon: '墨',
    description: 'Your brushwork shows mature command and intent.',
    xpThreshold: 7500,
  },
  {
    key: 'school_mentor',
    name: 'School Mentor',
    nameJa: '一門の師',
    icon: '師',
    description: 'Your consistency sets the standard for dedicated learners.',
    xpThreshold: 10000,
  },
  {
    key: 'grandmaster_scroll',
    name: 'Grandmaster Scroll',
    nameJa: '大師範',
    icon: '範',
    description: 'Your long-term commitment has become true mastery.',
    xpThreshold: 15000,
  },
  {
    key: 'cultural_treasure',
    name: 'Cultural Treasure',
    nameJa: '文化の至宝',
    icon: '宝',
    description: 'Your journey reflects rare dedication to the written form.',
    xpThreshold: 25000,
  },
  {
    key: 'living_national_treasure',
    name: 'Living National Treasure',
    nameJa: '人間国宝',
    icon: '国',
    description: 'An extraordinary milestone achieved by very few.',
    xpThreshold: 50000,
  },
];

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asIso(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
}

function toYyyyMmDd(isoOrDateTime: string): string {
  if (isoOrDateTime.length >= 10) return isoOrDateTime.slice(0, 10);
  return isoOrDateTime;
}

function isConsecutiveDay(previousDate: string, nextDate: string): boolean {
  const previous = new Date(`${previousDate}T00:00:00.000Z`);
  const next = new Date(`${nextDate}T00:00:00.000Z`);
  if (Number.isNaN(previous.getTime()) || Number.isNaN(next.getTime())) return false;
  return next.getTime() - previous.getTime() === 24 * 60 * 60 * 1000;
}

function isYesterday(referenceDate: string, todayDate: string): boolean {
  const reference = new Date(`${referenceDate}T00:00:00.000Z`);
  const today = new Date(`${todayDate}T00:00:00.000Z`);
  if (Number.isNaN(reference.getTime()) || Number.isNaN(today.getTime())) return false;
  return today.getTime() - reference.getTime() === 24 * 60 * 60 * 1000;
}

function mapXpRow(row: Record<string, unknown>): XpTransaction {
  return {
    id: asString(row.id),
    userId: asString(row.user_id),
    sessionId: row.session_id ? asString(row.session_id) : null,
    amount: asNumber(row.amount),
    reason: asString(row.reason) as XpReason,
    createdAt: asIso(row.created_at),
  };
}

function mapStreakRow(row: Record<string, unknown>): UserStreak {
  return {
    userId: asString(row.user_id),
    currentStreak: asNumber(row.current_streak),
    longestStreak: asNumber(row.longest_streak),
    lastActivityDate: row.last_activity_date ? asString(row.last_activity_date) : null,
    dailyGoalMet: asNumber(row.daily_goal_met) === 1,
    updatedAt: asIso(row.updated_at),
  };
}

function mapUserMilestoneRow(row: Record<string, unknown>): UserMilestone {
  return {
    id: asString(row.id),
    userId: asString(row.user_id),
    milestoneKey: asString(row.milestone_key),
    xpAtUnlock: asNumber(row.xp_at_unlock),
    createdAt: asIso(row.created_at),
  };
}

export async function getTotalXp(userId: string): Promise<number> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT COALESCE(SUM(amount), 0) AS total_xp
FROM user_xp
WHERE user_id = ?
`,
    args: [userId],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  return asNumber(row?.total_xp, 0);
}

export async function addXpTransactions(
  transactions: Array<{
    userId: string;
    sessionId?: string | null;
    amount: number;
    reason: XpReason;
    createdAt?: string;
  }>,
): Promise<XpTransaction[]> {
  if (transactions.length === 0) return [];

  const db = await getDb();
  const now = new Date().toISOString();
  const normalized: XpTransaction[] = transactions.map((transaction) => ({
    id: `xp-${randomUUID()}`,
    userId: transaction.userId,
    sessionId: transaction.sessionId ?? null,
    amount: Math.max(0, Math.floor(transaction.amount)),
    reason: transaction.reason,
    createdAt: transaction.createdAt ?? now,
  }));

  const statements: InStatement[] = normalized.map((transaction) => ({
    sql: `
INSERT INTO user_xp (id, user_id, session_id, amount, reason, created_at)
VALUES (?, ?, ?, ?, ?, ?)
`,
    args: [
      transaction.id,
      transaction.userId,
      transaction.sessionId,
      transaction.amount,
      transaction.reason,
      transaction.createdAt,
    ],
  }));

  await db.batch(statements);
  return normalized;
}

export async function getXpTransactionsForUser(userId: string): Promise<XpTransaction[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT id, user_id, session_id, amount, reason, created_at
FROM user_xp
WHERE user_id = ?
ORDER BY datetime(created_at) ASC
`,
    args: [userId],
  });

  return (result.rows as Array<Record<string, unknown>>).map((row) => mapXpRow(row));
}

export async function getUserStreak(userId: string): Promise<UserStreak | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT user_id, current_streak, longest_streak, last_activity_date, daily_goal_met, updated_at
FROM user_streaks
WHERE user_id = ?
LIMIT 1
`,
    args: [userId],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapStreakRow(row) : null;
}

export async function upsertUserStreak(
  userId: string,
  data: {
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: string | null;
    dailyGoalMet: boolean;
    updatedAt?: string;
  },
): Promise<UserStreak> {
  const db = await getDb();
  const updatedAt = data.updatedAt ?? new Date().toISOString();

  await db.execute({
    sql: `
INSERT OR REPLACE INTO user_streaks
(user_id, current_streak, longest_streak, last_activity_date, daily_goal_met, updated_at)
VALUES (?, ?, ?, ?, ?, ?)
`,
    args: [
      userId,
      Math.max(0, Math.floor(data.currentStreak)),
      Math.max(0, Math.floor(data.longestStreak)),
      data.lastActivityDate,
      data.dailyGoalMet ? 1 : 0,
      updatedAt,
    ],
  });

  return {
    userId,
    currentStreak: Math.max(0, Math.floor(data.currentStreak)),
    longestStreak: Math.max(0, Math.floor(data.longestStreak)),
    lastActivityDate: data.lastActivityDate,
    dailyGoalMet: data.dailyGoalMet,
    updatedAt,
  };
}

export async function getUnlockedMilestones(userId: string): Promise<UserMilestone[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT id, user_id, milestone_key, xp_at_unlock, created_at
FROM user_milestones
WHERE user_id = ?
ORDER BY datetime(created_at) ASC
`,
    args: [userId],
  });

  return (result.rows as Array<Record<string, unknown>>).map((row) => mapUserMilestoneRow(row));
}

export async function unlockMilestones(
  milestones: Array<{
    userId: string;
    milestoneKey: string;
    xpAtUnlock: number;
    createdAt?: string;
  }>,
): Promise<void> {
  if (milestones.length === 0) return;

  const db = await getDb();
  const now = new Date().toISOString();
  const statements: InStatement[] = milestones.map((milestone) => ({
    sql: `
INSERT OR IGNORE INTO user_milestones (id, user_id, milestone_key, xp_at_unlock, created_at)
VALUES (?, ?, ?, ?, ?)
`,
    args: [
      `milestone-${randomUUID()}`,
      milestone.userId,
      milestone.milestoneKey,
      Math.max(0, Math.floor(milestone.xpAtUnlock)),
      milestone.createdAt ?? now,
    ],
  }));

  await db.batch(statements);
}

export function calculateSessionXp(
  results: Array<{ isCorrect: boolean }>,
  maxCombo: number,
): Omit<SessionXpBreakdown, 'streakBonusXp' | 'newMilestones'> {
  const correctCount = results.filter((result) => result.isCorrect).length;
  const exerciseXp = correctCount * XP_PER_CORRECT_ANSWER;
  const sessionBonusXp = XP_SESSION_COMPLETE;
  const hasResults = results.length > 0;
  const perfectBonusXp = hasResults && correctCount === results.length ? XP_PERFECT_SCORE : 0;
  const comboBonusXp =
    Math.max(0, Math.floor(maxCombo) - XP_COMBO_BONUS_THRESHOLD) * XP_PER_COMBO_ANSWER;

  const totalXp = exerciseXp + sessionBonusXp + perfectBonusXp + comboBonusXp;

  return {
    exerciseXp,
    sessionBonusXp,
    perfectBonusXp,
    comboBonusXp,
    totalXp,
  };
}

export function calculateMissionXp(input: {
  mode: 'practice' | 'immersion';
  correctResponses: number;
  totalExchanges: number;
  naturalPhrasings: number;
}): {
  missionCompletion: number;
  correctResponses: number;
  naturalPhrasing: number;
  total: number;
} {
  const mode = input.mode;
  const normalizedCorrectResponses = Math.max(0, Math.floor(input.correctResponses));
  const normalizedNaturalPhrasings = Math.max(0, Math.floor(input.naturalPhrasings));
  const _normalizedTotalExchanges = Math.max(0, Math.floor(input.totalExchanges));

  const missionCompletion =
    mode === 'immersion' ? XP_MISSION_IMMERSION_COMPLETE : XP_MISSION_PRACTICE_COMPLETE;
  const correctResponses = normalizedCorrectResponses * XP_MISSION_CORRECT_RESPONSE;
  const naturalPhrasing =
    mode === 'immersion' ? normalizedNaturalPhrasings * XP_MISSION_NATURAL_PHRASING : 0;
  const total = missionCompletion + correctResponses + naturalPhrasing;

  return {
    missionCompletion,
    correctResponses,
    naturalPhrasing,
    total,
  };
}

export async function updateStreakAndGoal(
  userId: string,
  todayDateStr: string,
): Promise<{ currentStreak: number; streakBonusXp: number }> {
  const current = await getUserStreak(userId);

  let nextCurrentStreak = 1;
  let nextLongestStreak = 1;
  let nextDailyGoalMet = true;
  let streakBonusXp: number;

  if (current) {
    nextLongestStreak = current.longestStreak;

    if (current.lastActivityDate === todayDateStr) {
      nextCurrentStreak = current.currentStreak;
      if (current.dailyGoalMet) {
        nextDailyGoalMet = true;
        streakBonusXp = 0;
      } else {
        nextDailyGoalMet = true;
        streakBonusXp = Math.min(50, XP_STREAK_BONUS_PER_DAY * nextCurrentStreak);
      }
    } else {
      if (current.lastActivityDate && isYesterday(current.lastActivityDate, todayDateStr)) {
        nextCurrentStreak = current.currentStreak + 1;
      } else {
        nextCurrentStreak = 1;
      }
      nextDailyGoalMet = true;
      streakBonusXp = Math.min(50, XP_STREAK_BONUS_PER_DAY * nextCurrentStreak);
    }
  } else {
    streakBonusXp = Math.min(50, XP_STREAK_BONUS_PER_DAY * nextCurrentStreak);
  }

  nextLongestStreak = Math.max(nextLongestStreak, nextCurrentStreak);

  await upsertUserStreak(userId, {
    currentStreak: nextCurrentStreak,
    longestStreak: nextLongestStreak,
    lastActivityDate: todayDateStr,
    dailyGoalMet: nextDailyGoalMet,
  });

  return {
    currentStreak: nextCurrentStreak,
    streakBonusXp,
  };
}

export async function checkAndUnlockMilestones(
  userId: string,
  newTotalXp: number,
): Promise<Milestone[]> {
  const unlocked = await getUnlockedMilestones(userId);
  const unlockedKeys = new Set(unlocked.map((milestone) => milestone.milestoneKey));

  const toUnlock = MILESTONES.filter(
    (milestone) => milestone.xpThreshold <= newTotalXp && !unlockedKeys.has(milestone.key),
  );

  if (toUnlock.length > 0) {
    await unlockMilestones(
      toUnlock.map((milestone) => ({
        userId,
        milestoneKey: milestone.key,
        xpAtUnlock: newTotalXp,
      })),
    );
  }

  return toUnlock;
}

async function getSessionActivityDate(userId: string, sessionId: string): Promise<string> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT COALESCE(completed_at, created_at) AS activity_at
FROM sessions
WHERE id = ? AND user_id = ?
LIMIT 1
`,
    args: [sessionId, userId],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  const activityAt = row?.activity_at;
  if (typeof activityAt !== 'string' || activityAt.length < 10) {
    throw new Error('[gamification] Missing session activity date for streak update');
  }

  return toYyyyMmDd(activityAt);
}

export async function processSessionCompletion(
  userId: string,
  sessionId: string,
  results: Array<{ isCorrect: boolean }>,
  maxCombo: number,
): Promise<SessionXpBreakdown> {
  const baseXp = calculateSessionXp(results, maxCombo);
  const activityDate = await getSessionActivityDate(userId, sessionId);
  const streak = await updateStreakAndGoal(userId, activityDate);

  const transactions: Array<{
    userId: string;
    sessionId?: string | null;
    amount: number;
    reason: XpReason;
  }> = [];

  if (baseXp.exerciseXp > 0) {
    transactions.push({
      userId,
      sessionId,
      amount: baseXp.exerciseXp,
      reason: 'exercise_correct',
    });
  }

  transactions.push({
    userId,
    sessionId,
    amount: baseXp.sessionBonusXp,
    reason: 'session_complete',
  });

  if (baseXp.perfectBonusXp > 0) {
    transactions.push({
      userId,
      sessionId,
      amount: baseXp.perfectBonusXp,
      reason: 'perfect_score',
    });
  }

  if (streak.streakBonusXp > 0) {
    transactions.push({
      userId,
      sessionId: null,
      amount: streak.streakBonusXp,
      reason: 'streak_bonus',
    });
  }

  if (baseXp.comboBonusXp > 0) {
    transactions.push({
      userId,
      sessionId,
      amount: baseXp.comboBonusXp,
      reason: 'combo_bonus',
    });
  }

  await addXpTransactions(transactions);

  const newTotalXp = await getTotalXp(userId);
  const newMilestones = await checkAndUnlockMilestones(userId, newTotalXp);
  const totalXp = baseXp.totalXp + streak.streakBonusXp;

  return {
    exerciseXp: baseXp.exerciseXp,
    sessionBonusXp: baseXp.sessionBonusXp,
    perfectBonusXp: baseXp.perfectBonusXp,
    streakBonusXp: streak.streakBonusXp,
    comboBonusXp: baseXp.comboBonusXp,
    totalXp,
    newMilestones,
  };
}

export async function processMissionCompletion(
  userId: string,
  missionId: string,
  input: {
    mode: 'practice' | 'immersion';
    correctResponses: number;
    totalExchanges: number;
    naturalPhrasings: number;
  },
): Promise<{
  xpBreakdown: {
    missionCompletion: number;
    correctResponses: number;
    naturalPhrasing: number;
    total: number;
  };
  newMilestones: Milestone[];
}> {
  const xpBreakdown = calculateMissionXp(input);
  const todayDateStr = toYyyyMmDd(new Date().toISOString());
  const streak = await updateStreakAndGoal(userId, todayDateStr);

  const transactions: Array<{
    userId: string;
    sessionId?: string | null;
    amount: number;
    reason: XpReason;
  }> = [];

  if (xpBreakdown.missionCompletion > 0) {
    transactions.push({
      userId,
      sessionId: null,
      amount: xpBreakdown.missionCompletion,
      reason: 'mission_complete',
    });
  }

  if (xpBreakdown.correctResponses > 0) {
    transactions.push({
      userId,
      sessionId: null,
      amount: xpBreakdown.correctResponses,
      reason: 'mission_correct_response',
    });
  }

  if (xpBreakdown.naturalPhrasing > 0) {
    transactions.push({
      userId,
      sessionId: null,
      amount: xpBreakdown.naturalPhrasing,
      reason: 'mission_natural_phrasing',
    });
  }

  if (streak.streakBonusXp > 0) {
    transactions.push({
      userId,
      sessionId: null,
      amount: streak.streakBonusXp,
      reason: 'streak_bonus',
    });
  }

  await addXpTransactions(transactions);

  const newTotalXp = await getTotalXp(userId);
  const newMilestones = await checkAndUnlockMilestones(userId, newTotalXp);

  return {
    xpBreakdown,
    newMilestones,
  };
}

export async function getGamificationStats(
  userId: string,
  todayDateStr: string,
): Promise<GamificationStats> {
  const { backfillGamificationForUser } = await import('$lib/server/gamification-backfill');
  await backfillGamificationForUser(userId);

  const [totalXp, streak] = await Promise.all([getTotalXp(userId), getUserStreak(userId)]);

  let currentStreak = streak?.currentStreak ?? 0;
  const longestStreak = streak?.longestStreak ?? 0;
  if (currentStreak > 0 && streak?.lastActivityDate) {
    const isCurrentDate = streak.lastActivityDate === todayDateStr;
    const isPreviousDate = isYesterday(streak.lastActivityDate, todayDateStr);
    if (!isCurrentDate && !isPreviousDate) {
      currentStreak = 0;
    }
  }
  const dailyGoalMet =
    streak?.lastActivityDate === todayDateStr ? (streak?.dailyGoalMet ?? false) : false;

  const nextMilestone = MILESTONES.find((milestone) => milestone.xpThreshold > totalXp) ?? null;
  const xpToNextMilestone = nextMilestone ? Math.max(0, nextMilestone.xpThreshold - totalXp) : 0;

  return {
    totalXp,
    currentStreak,
    longestStreak,
    dailyGoalMet,
    nextMilestone,
    xpToNextMilestone,
  };
}

export function calculateStreakFromDateStrings(dateStrings: string[]): {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
} {
  if (dateStrings.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
    };
  }

  const uniqueSorted = Array.from(new Set(dateStrings)).sort((a, b) => a.localeCompare(b));

  let longestStreak = 1;
  let runningStreak = 1;

  for (let index = 1; index < uniqueSorted.length; index += 1) {
    const previous = uniqueSorted[index - 1];
    const current = uniqueSorted[index];
    if (isConsecutiveDay(previous, current)) {
      runningStreak += 1;
    } else {
      runningStreak = 1;
    }
    longestStreak = Math.max(longestStreak, runningStreak);
  }

  let currentStreak = 1;
  for (let index = uniqueSorted.length - 1; index > 0; index -= 1) {
    const current = uniqueSorted[index];
    const previous = uniqueSorted[index - 1];
    if (isConsecutiveDay(previous, current)) {
      currentStreak += 1;
      continue;
    }
    break;
  }

  return {
    currentStreak,
    longestStreak,
    lastActivityDate: uniqueSorted[uniqueSorted.length - 1],
  };
}
