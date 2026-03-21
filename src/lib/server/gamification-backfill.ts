import { getDb } from '$lib/server/db';
import {
  XP_PER_CORRECT_ANSWER,
  XP_SESSION_COMPLETE,
  addXpTransactions,
  calculateStreakFromDateStrings,
  checkAndUnlockMilestones,
  getTotalXp,
  upsertUserStreak,
} from '$lib/server/gamification';

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

function toYyyyMmDd(isoOrDateTime: string): string {
  return isoOrDateTime.length >= 10 ? isoOrDateTime.slice(0, 10) : isoOrDateTime;
}

async function hasExistingXpRows(userId: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT COUNT(*) AS total
FROM user_xp
WHERE user_id = ?
`,
    args: [userId],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  return asNumber(row?.total, 0) > 0;
}

async function getCorrectResultsGroupedBySession(userId: string): Promise<
  Array<{
    sessionId: string | null;
    correctCount: number;
  }>
> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT session_id, COUNT(*) AS correct_count
FROM user_exercise_results
WHERE user_id = ? AND is_correct = 1
GROUP BY session_id
`,
    args: [userId],
  });

  return (result.rows as Array<Record<string, unknown>>).map((row) => ({
    sessionId: row.session_id ? asString(row.session_id) : null,
    correctCount: asNumber(row.correct_count),
  }));
}

async function getCompletedSessions(
  userId: string,
): Promise<Array<{ sessionId: string; activityDate: string }>> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT id, COALESCE(completed_at, created_at) AS activity_at
FROM sessions
WHERE user_id = ? AND status = 'completed'
ORDER BY datetime(COALESCE(completed_at, created_at)) ASC
`,
    args: [userId],
  });

  return (result.rows as Array<Record<string, unknown>>)
    .map((row) => {
      const activityAt = asString(row.activity_at);
      if (!activityAt) return null;
      return {
        sessionId: asString(row.id),
        activityDate: toYyyyMmDd(activityAt),
      };
    })
    .filter((row): row is { sessionId: string; activityDate: string } => row !== null);
}

export async function backfillGamificationForUser(userId: string): Promise<{
  skipped: boolean;
  totalXp: number;
}> {
  if (await hasExistingXpRows(userId)) {
    const totalXp = await getTotalXp(userId);
    return { skipped: true, totalXp };
  }

  const [correctGroups, completedSessions] = await Promise.all([
    getCorrectResultsGroupedBySession(userId),
    getCompletedSessions(userId),
  ]);

  const xpTransactions: Array<{
    userId: string;
    sessionId?: string | null;
    amount: number;
    reason: 'exercise_correct' | 'session_complete';
  }> = [];

  for (const group of correctGroups) {
    if (group.correctCount <= 0) continue;
    xpTransactions.push({
      userId,
      sessionId: group.sessionId,
      amount: group.correctCount * XP_PER_CORRECT_ANSWER,
      reason: 'exercise_correct',
    });
  }

  for (const session of completedSessions) {
    xpTransactions.push({
      userId,
      sessionId: session.sessionId,
      amount: XP_SESSION_COMPLETE,
      reason: 'session_complete',
    });
  }

  await addXpTransactions(xpTransactions);

  const streak = calculateStreakFromDateStrings(
    completedSessions.map((session) => session.activityDate),
  );
  await upsertUserStreak(userId, {
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    lastActivityDate: streak.lastActivityDate,
    dailyGoalMet: false,
  });

  const totalXp = await getTotalXp(userId);
  await checkAndUnlockMilestones(userId, totalXp);

  return {
    skipped: false,
    totalXp,
  };
}

export async function backfillGamificationForAllUsers(): Promise<void> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT id FROM users ORDER BY datetime(created_at) ASC`,
  });

  const users = (result.rows as Array<Record<string, unknown>>)
    .map((row) => asString(row.id))
    .filter(Boolean);

  for (const userId of users) {
    await backfillGamificationForUser(userId);
  }
}
