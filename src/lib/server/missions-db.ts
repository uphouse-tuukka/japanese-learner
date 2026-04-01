import { randomUUID } from 'crypto';
import { getDb } from './db';
import { config } from './config';
import type {
  Mission,
  MissionMode,
  MissionStatus,
  MissionTurn,
  MissionWithProgress,
  UserBadge,
  UserMission,
} from '$lib/types';

function nowIso(): string {
  return new Date().toISOString();
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function asIso(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return nowIso();
}

function parseConversationLog(value: unknown): MissionTurn[] {
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as MissionTurn[]) : [];
  } catch {
    return [];
  }
}

function mapMissionRow(row: Record<string, unknown>): Mission {
  return {
    id: asString(row.id),
    title: asString(row.title),
    category: asString(row.category),
    difficulty: asString(row.difficulty) as Mission['difficulty'],
    sequence: asNumber(row.sequence),
    scenarioPrompt: asString(row.scenario_prompt),
    badgeEmoji: asString(row.badge_emoji),
    badgeName: asString(row.badge_name),
    badgeStatement: asString(row.badge_statement),
    unlockSessionsRequired: asNumber(row.unlock_sessions_required),
    startUnlocked: asNumber(row.start_unlocked) === 1,
  };
}

function mapUserMissionRow(row: Record<string, unknown>): UserMission {
  return {
    id: asString(row.id),
    userId: asString(row.user_id),
    missionId: asString(row.mission_id),
    mode: asString(row.mode) as MissionMode,
    status: asString(row.status) as MissionStatus,
    exchanges: asNumber(row.exchanges),
    correctResponses: asNumber(row.correct_responses),
    score: asNumber(row.score),
    xpEarned: asNumber(row.xp_earned),
    badgeEarned: asNumber(row.badge_earned) === 1,
    conversationLog: parseConversationLog(row.conversation_log),
    completedAt: row.completed_at ? asIso(row.completed_at) : null,
    createdAt: asIso(row.created_at),
  };
}

function mapUserBadgeRow(row: Record<string, unknown>): UserBadge {
  return {
    id: asString(row.id),
    userId: asString(row.user_id),
    missionId: asString(row.mission_id),
    badgeEmoji: asString(row.badge_emoji),
    badgeName: asString(row.badge_name),
    badgeStatement: asString(row.badge_statement),
    earnedAt: asIso(row.earned_at),
  };
}

async function getSessionsCategoryJsonColumn(): Promise<'meta' | 'summary'> {
  const db = await getDb();
  const info = await db.execute({
    sql: `PRAGMA table_info(sessions)`,
  });

  for (const row of info.rows as Array<Record<string, unknown>>) {
    if (asString(row.name) === 'meta') {
      return 'meta';
    }
  }

  return 'summary';
}

export async function getAllMissions(): Promise<Mission[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT
  id,
  title,
  category,
  difficulty,
  sequence,
  scenario_prompt,
  badge_emoji,
  badge_name,
  badge_statement,
  unlock_sessions_required,
  start_unlocked
FROM missions
ORDER BY category ASC, sequence ASC
`,
  });

  return (result.rows as Array<Record<string, unknown>>).map((row) => mapMissionRow(row));
}

export async function getMissionById(id: string): Promise<Mission | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT
  id,
  title,
  category,
  difficulty,
  sequence,
  scenario_prompt,
  badge_emoji,
  badge_name,
  badge_statement,
  unlock_sessions_required,
  start_unlocked
FROM missions
WHERE id = ?
LIMIT 1
`,
    args: [id],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  return mapMissionRow(row);
}

export async function getMissionsWithProgress(userId: string): Promise<MissionWithProgress[]> {
  const [db, sessionCategoryColumn] = await Promise.all([getDb(), getSessionsCategoryJsonColumn()]);
  const missionsResult = await db.execute({
    sql: `
SELECT
  m.id,
  m.title,
  m.category,
  m.difficulty,
  m.sequence,
  m.scenario_prompt,
  m.badge_emoji,
  m.badge_name,
  m.badge_statement,
  m.unlock_sessions_required,
  m.start_unlocked,
  MAX(CASE WHEN um.mode = 'practice' AND um.status = 'completed' THEN 1 ELSE 0 END) AS completed_practice,
  MAX(CASE WHEN um.mode = 'immersion' AND um.status = 'completed' THEN 1 ELSE 0 END) AS completed_immersion,
  MAX(CASE WHEN ub.id IS NOT NULL THEN 1 ELSE 0 END) AS badge_earned
FROM missions m
LEFT JOIN user_missions um ON um.mission_id = m.id AND um.user_id = ?
LEFT JOIN user_badges ub ON ub.mission_id = m.id AND ub.user_id = ?
GROUP BY
  m.id,
  m.title,
  m.category,
  m.difficulty,
  m.sequence,
  m.scenario_prompt,
  m.badge_emoji,
  m.badge_name,
  m.badge_statement,
  m.unlock_sessions_required,
  m.start_unlocked
ORDER BY m.category ASC, m.sequence ASC
`,
    args: [userId, userId],
  });

  const categoryCountsResult = await db.execute({
    sql: `
SELECT JSON_EXTRACT(${sessionCategoryColumn}, '$.category') AS category, COUNT(*) AS count
FROM sessions
WHERE user_id = ?
  AND status = 'completed'
  AND ${sessionCategoryColumn} IS NOT NULL
  AND JSON_VALID(${sessionCategoryColumn})
GROUP BY JSON_EXTRACT(${sessionCategoryColumn}, '$.category')
`,
    args: [userId],
  });

  const categorySessionCounts = new Map<string, number>();
  for (const row of categoryCountsResult.rows as Array<Record<string, unknown>>) {
    const category = asString(row.category);
    if (!category) continue;
    categorySessionCounts.set(category, asNumber(row.count));
  }

  return (missionsResult.rows as Array<Record<string, unknown>>).map((row) => {
    const mission = mapMissionRow(row);
    const sessionsCompletedInCategory = categorySessionCounts.get(mission.category) ?? 0;
    const unlockedByCategory = sessionsCompletedInCategory >= mission.unlockSessionsRequired;
    const unlocked =
      config.missions.unlockAllOverride || mission.startUnlocked || unlockedByCategory;

    return {
      ...mission,
      unlocked,
      completedPractice: asNumber(row.completed_practice) === 1,
      completedImmersion: asNumber(row.completed_immersion) === 1,
      badgeEarned: asNumber(row.badge_earned) === 1,
    } satisfies MissionWithProgress;
  });
}

export async function createUserMission(input: {
  userId: string;
  missionId: string;
  mode: MissionMode;
}): Promise<string> {
  const db = await getDb();
  const id = `usermission-${randomUUID()}`;
  await db.execute({
    sql: `
INSERT INTO user_missions (
  id,
  user_id,
  mission_id,
  mode,
  status,
  exchanges,
  correct_responses,
  score,
  xp_earned,
  badge_earned,
  conversation_log,
  completed_at,
  created_at
)
VALUES (?, ?, ?, ?, 'in_progress', 0, 0, 0, 0, 0, '[]', NULL, ?)
`,
    args: [id, input.userId, input.missionId, input.mode, nowIso()],
  });
  return id;
}

export async function getUserMission(id: string): Promise<UserMission | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT
  id,
  user_id,
  mission_id,
  mode,
  status,
  exchanges,
  correct_responses,
  score,
  xp_earned,
  badge_earned,
  conversation_log,
  completed_at,
  created_at
FROM user_missions
WHERE id = ?
LIMIT 1
`,
    args: [id],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  return mapUserMissionRow(row);
}

export async function updateUserMission(
  id: string,
  updates: {
    exchanges?: number;
    correctResponses?: number;
    score?: number;
    xpEarned?: number;
    badgeEarned?: boolean;
    conversationLog?: MissionTurn[];
    status?: MissionStatus;
    completedAt?: string;
  },
): Promise<void> {
  const setClauses: string[] = [];
  const args: Array<string | number | null> = [];

  if (updates.exchanges !== undefined) {
    setClauses.push('exchanges = ?');
    args.push(Math.max(0, Math.floor(updates.exchanges)));
  }

  if (updates.correctResponses !== undefined) {
    setClauses.push('correct_responses = ?');
    args.push(Math.max(0, Math.floor(updates.correctResponses)));
  }

  if (updates.score !== undefined) {
    setClauses.push('score = ?');
    args.push(Math.max(0, updates.score));
  }

  if (updates.xpEarned !== undefined) {
    setClauses.push('xp_earned = ?');
    args.push(Math.max(0, Math.floor(updates.xpEarned)));
  }

  if (updates.badgeEarned !== undefined) {
    setClauses.push('badge_earned = ?');
    args.push(updates.badgeEarned ? 1 : 0);
  }

  if (updates.conversationLog !== undefined) {
    setClauses.push('conversation_log = ?');
    args.push(JSON.stringify(updates.conversationLog));
  }

  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    args.push(updates.status);
  }

  if (updates.completedAt !== undefined) {
    setClauses.push('completed_at = ?');
    args.push(updates.completedAt);
  }

  if (setClauses.length === 0) {
    return;
  }

  const db = await getDb();
  await db.execute({
    sql: `UPDATE user_missions SET ${setClauses.join(', ')} WHERE id = ?`,
    args: [...args, id],
  });
}

export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT
  id,
  user_id,
  mission_id,
  badge_emoji,
  badge_name,
  badge_statement,
  earned_at
FROM user_badges
WHERE user_id = ?
ORDER BY datetime(earned_at) DESC
`,
    args: [userId],
  });

  return (result.rows as Array<Record<string, unknown>>).map((row) => mapUserBadgeRow(row));
}

export async function awardBadge(input: {
  userId: string;
  missionId: string;
  badgeEmoji: string;
  badgeName: string;
  badgeStatement: string;
}): Promise<UserBadge> {
  const db = await getDb();
  const id = `badge-${randomUUID()}`;
  const earnedAt = nowIso();

  await db.execute({
    sql: `
INSERT OR IGNORE INTO user_badges (
  id,
  user_id,
  mission_id,
  badge_emoji,
  badge_name,
  badge_statement,
  earned_at
)
VALUES (?, ?, ?, ?, ?, ?, ?)
`,
    args: [
      id,
      input.userId,
      input.missionId,
      input.badgeEmoji,
      input.badgeName,
      input.badgeStatement,
      earnedAt,
    ],
  });

  const result = await db.execute({
    sql: `
SELECT
  id,
  user_id,
  mission_id,
  badge_emoji,
  badge_name,
  badge_statement,
  earned_at
FROM user_badges
WHERE user_id = ? AND mission_id = ?
LIMIT 1
`,
    args: [input.userId, input.missionId],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error('[missions-db] failed to load badge after insert');
  }

  return mapUserBadgeRow(row);
}

export async function getDailyMissionCount(userId: string, date: string): Promise<number> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT missions_used
FROM user_mission_limits
WHERE user_id = ? AND date = ?
LIMIT 1
`,
    args: [userId, date],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  return asNumber(row?.missions_used, 0);
}

export async function incrementDailyMissionCount(userId: string, date: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `
INSERT INTO user_mission_limits (user_id, date, missions_used)
VALUES (?, ?, 1)
ON CONFLICT(user_id, date) DO UPDATE SET
missions_used = missions_used + 1
`,
    args: [userId, date],
  });
}

export async function getCategorySessionCount(userId: string, category: string): Promise<number> {
  const db = await getDb();
  const sessionCategoryColumn = await getSessionsCategoryJsonColumn();
  const result = await db.execute({
    sql: `
SELECT COUNT(*) AS count
FROM sessions
WHERE user_id = ?
  AND status = 'completed'
  AND ${sessionCategoryColumn} IS NOT NULL
  AND JSON_VALID(${sessionCategoryColumn})
  AND JSON_EXTRACT(${sessionCategoryColumn}, '$.category') = ?
`,
    args: [userId, category],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  return asNumber(row?.count, 0);
}

export async function hasCompletedMissionInMode(
  userId: string,
  missionId: string,
  mode: MissionMode,
): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT COUNT(*) AS count
FROM user_missions
WHERE user_id = ?
  AND mission_id = ?
  AND mode = ?
  AND status = 'completed'
`,
    args: [userId, missionId, mode],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  return asNumber(row?.count, 0) > 0;
}
