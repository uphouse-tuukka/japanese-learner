import { randomUUID } from 'node:crypto';
import type { InStatement } from '@libsql/client';
import { getDb } from './db';
import type {
  SpokenMissionAttempt,
  SpokenMissionAttemptStatus,
  SpokenMissionEvidenceState,
  SpokenMissionTurnEvidence,
} from '$lib/types';

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

function asTimestamp(value: unknown): string {
  const text = asString(value);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function parseConversationLog(value: unknown): SpokenMissionTurnEvidence[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as SpokenMissionTurnEvidence[]) : [];
  } catch {
    return [];
  }
}

function mapSpokenMissionAttempt(row: Record<string, unknown>): SpokenMissionAttempt {
  return {
    id: asString(row.id),
    userId: asString(row.user_id),
    missionId: asString(row.mission_id),
    definitionVersion: asString(row.definition_version),
    status: asString(row.status) as SpokenMissionAttemptStatus,
    currentTurn: asNumber(row.current_turn, 1),
    supportUsed: asNumber(row.support_used) === 1,
    currentTurnSupportUsed: asNumber(row.current_turn_support_used) === 1,
    currentTurnWrittenSupportRevealed: asNumber(row.current_turn_written_support_revealed) === 1,
    successfulTurnCount: asNumber(row.successful_turn_count),
    wordingVariant: asNumber(row.wording_variant),
    conversationLog: parseConversationLog(row.conversation_log),
    evidenceState: row.evidence_state
      ? (asString(row.evidence_state) as SpokenMissionEvidenceState)
      : null,
    completedAt: row.completed_at ? asTimestamp(row.completed_at) : null,
    createdAt: asTimestamp(row.created_at),
    updatedAt: asTimestamp(row.updated_at),
  };
}

const SPOKEN_ATTEMPT_COLUMNS = `
  id,
  user_id,
  mission_id,
  definition_version,
  status,
  current_turn,
  support_used,
  current_turn_support_used,
  current_turn_written_support_revealed,
  successful_turn_count,
  wording_variant,
  conversation_log,
  evidence_state,
  completed_at,
  created_at,
  updated_at
`;

type SpokenMissionAttemptCreationInput = {
  userId: string;
  missionId: string;
  definitionVersion: string;
  wordingVariant: number;
};

function buildSpokenMissionAttemptInsert(
  input: SpokenMissionAttemptCreationInput,
  id: string,
  timestamp: string,
  restartGuard?: { attemptId: string; abandonedAt: string },
): InStatement {
  return {
    sql: `
INSERT INTO user_spoken_missions (
  id, user_id, mission_id, definition_version, status, current_turn, support_used,
  successful_turn_count, wording_variant, conversation_log, evidence_state,
  completed_at, created_at, updated_at
)
SELECT ?, ?, ?, ?, 'in_progress', 1, 0, 0, ?, '[]', NULL, NULL, ?, ?
${
  restartGuard
    ? `WHERE changes() = 1
AND EXISTS (
  SELECT 1 FROM user_spoken_missions
  WHERE id = ? AND status = 'abandoned' AND updated_at = ?
)`
    : ''
}
`,
    args: [
      id,
      input.userId,
      input.missionId,
      input.definitionVersion,
      Math.max(0, Math.floor(input.wordingVariant)),
      timestamp,
      timestamp,
      ...(restartGuard ? [restartGuard.attemptId, restartGuard.abandonedAt] : []),
    ],
  };
}

export async function getSpokenMissionAttempt(id: string): Promise<SpokenMissionAttempt | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT ${SPOKEN_ATTEMPT_COLUMNS} FROM user_spoken_missions WHERE id = ? LIMIT 1`,
    args: [id],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapSpokenMissionAttempt(row) : null;
}

export async function getResumableSpokenMissionAttempt(
  userId: string,
  missionId: string,
): Promise<SpokenMissionAttempt | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT ${SPOKEN_ATTEMPT_COLUMNS}
FROM user_spoken_missions
WHERE user_id = ? AND mission_id = ? AND status = 'in_progress'
ORDER BY datetime(updated_at) DESC, rowid DESC
LIMIT 1
`,
    args: [userId, missionId],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapSpokenMissionAttempt(row) : null;
}

export async function createSpokenMissionAttempt(
  input: SpokenMissionAttemptCreationInput,
): Promise<SpokenMissionAttempt> {
  const db = await getDb();
  const id = `spokenmission-${randomUUID()}`;
  const timestamp = new Date().toISOString();
  await db.execute(buildSpokenMissionAttemptInsert(input, id, timestamp));

  const created = await getSpokenMissionAttempt(id);
  if (!created) throw new Error('[spoken-missions-db] failed to load created attempt');
  return created;
}

export class SpokenMissionProgressConflictError extends Error {
  constructor() {
    super('Spoken Mission progress changed before the response could be saved.');
    this.name = 'SpokenMissionProgressConflictError';
  }
}

export async function markSpokenMissionEnglishSupportUsed(input: {
  attemptId: string;
  userId: string;
  missionId: string;
  definitionVersion: string;
  turnNumber: number;
}): Promise<SpokenMissionAttempt> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
UPDATE user_spoken_missions
SET support_used = 1, current_turn_support_used = 1, updated_at = ?
WHERE id = ?
  AND user_id = ?
  AND mission_id = ?
  AND definition_version = ?
  AND status = 'in_progress'
  AND current_turn = ?
`,
    args: [
      new Date().toISOString(),
      input.attemptId,
      input.userId,
      input.missionId,
      input.definitionVersion,
      input.turnNumber,
    ],
  });

  if (result.rowsAffected === 0) throw new SpokenMissionProgressConflictError();
  const updated = await getSpokenMissionAttempt(input.attemptId);
  if (!updated) throw new SpokenMissionProgressConflictError();
  return updated;
}

export async function markSpokenMissionWrittenSupportRevealed(input: {
  attemptId: string;
  userId: string;
  missionId: string;
  definitionVersion: string;
  turnNumber: number;
}): Promise<SpokenMissionAttempt> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
UPDATE user_spoken_missions
SET current_turn_written_support_revealed = 1, updated_at = ?
WHERE id = ?
  AND user_id = ?
  AND mission_id = ?
  AND definition_version = ?
  AND status = 'in_progress'
  AND current_turn = ?
`,
    args: [
      new Date().toISOString(),
      input.attemptId,
      input.userId,
      input.missionId,
      input.definitionVersion,
      input.turnNumber,
    ],
  });

  if (result.rowsAffected === 0) throw new SpokenMissionProgressConflictError();
  const updated = await getSpokenMissionAttempt(input.attemptId);
  if (!updated) throw new SpokenMissionProgressConflictError();
  return updated;
}

export type RecordSpokenMissionAssessmentResult = {
  status: 'recorded' | 'duplicate';
  attempt: SpokenMissionAttempt;
  evidence: SpokenMissionTurnEvidence;
};

export async function recordSpokenMissionAssessment(input: {
  attemptId: string;
  userId: string;
  missionId: string;
  definitionVersion: string;
  turnNumber: number;
  evidence: SpokenMissionTurnEvidence;
}): Promise<RecordSpokenMissionAssessmentResult> {
  const existing = await getSpokenMissionAttempt(input.attemptId);
  if (!existing) throw new SpokenMissionProgressConflictError();

  const duplicate = existing.conversationLog.find(
    (entry) => entry.clientResponseId === input.evidence.clientResponseId,
  );
  if (duplicate) {
    return { status: 'duplicate', attempt: existing, evidence: duplicate };
  }

  if (
    existing.userId !== input.userId ||
    existing.missionId !== input.missionId ||
    existing.definitionVersion !== input.definitionVersion ||
    existing.status !== 'in_progress' ||
    existing.currentTurn !== input.turnNumber
  ) {
    throw new SpokenMissionProgressConflictError();
  }

  const accepted = input.evidence.outcome === 'accepted';
  const storedEvidence = {
    ...input.evidence,
    supportUsed: existing.currentTurnSupportUsed || input.evidence.supportUsed,
    writtenSupportRevealed:
      existing.currentTurnWrittenSupportRevealed || input.evidence.writtenSupportRevealed === true,
  };
  const successfulTurnCount = existing.successfulTurnCount + (accepted ? 1 : 0);
  const completed = accepted && successfulTurnCount === 3;
  const timestamp = new Date().toISOString();
  const conversationLog = [...existing.conversationLog, storedEvidence];
  const currentTurn = completed
    ? 3
    : accepted
      ? Math.min(3, existing.currentTurn + 1)
      : existing.currentTurn;

  const db = await getDb();
  const result = await db.execute({
    sql: `
UPDATE user_spoken_missions
SET
  status = ?,
  current_turn = ?,
  support_used = CASE WHEN support_used = 1 OR ? = 1 THEN 1 ELSE 0 END,
  current_turn_support_used = CASE
    WHEN ? = 1 THEN 0
    WHEN current_turn_support_used = 1 OR ? = 1 THEN 1
    ELSE 0
  END,
  current_turn_written_support_revealed = CASE
    WHEN ? = 1 THEN 0
    ELSE current_turn_written_support_revealed
  END,
  successful_turn_count = ?,
  conversation_log = ?,
  evidence_state = CASE
    WHEN ? = 1 THEN
      CASE WHEN support_used = 1 OR ? = 1 THEN 'supported' ELSE 'independent' END
    ELSE NULL
  END,
  completed_at = ?,
  updated_at = ?
WHERE id = ?
  AND user_id = ?
  AND mission_id = ?
  AND definition_version = ?
  AND status = 'in_progress'
  AND current_turn = ?
  AND NOT EXISTS (
    SELECT 1
    FROM json_each(user_spoken_missions.conversation_log)
    WHERE json_extract(value, '$.clientResponseId') = ?
  )
`,
    args: [
      completed ? 'completed' : 'in_progress',
      currentTurn,
      storedEvidence.supportUsed ? 1 : 0,
      accepted ? 1 : 0,
      storedEvidence.supportUsed ? 1 : 0,
      accepted ? 1 : 0,
      successfulTurnCount,
      JSON.stringify(conversationLog),
      completed ? 1 : 0,
      storedEvidence.supportUsed ? 1 : 0,
      completed ? timestamp : null,
      timestamp,
      input.attemptId,
      input.userId,
      input.missionId,
      input.definitionVersion,
      input.turnNumber,
      input.evidence.clientResponseId,
    ],
  });

  if (result.rowsAffected === 0) {
    const latest = await getSpokenMissionAttempt(input.attemptId);
    const concurrentDuplicate = latest?.conversationLog.find(
      (entry) => entry.clientResponseId === input.evidence.clientResponseId,
    );
    if (latest && concurrentDuplicate) {
      return { status: 'duplicate', attempt: latest, evidence: concurrentDuplicate };
    }
    throw new SpokenMissionProgressConflictError();
  }

  const updated = await getSpokenMissionAttempt(input.attemptId);
  if (!updated) throw new SpokenMissionProgressConflictError();
  return { status: 'recorded', attempt: updated, evidence: storedEvidence };
}

export async function getBestSpokenMissionEvidence(
  userId: string,
  missionId: string,
): Promise<SpokenMissionEvidenceState | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT CASE
  WHEN MAX(CASE WHEN evidence_state = 'independent' THEN 1 ELSE 0 END) = 1 THEN 'independent'
  WHEN MAX(CASE WHEN evidence_state = 'supported' THEN 1 ELSE 0 END) = 1 THEN 'supported'
  ELSE NULL
END AS best_evidence
FROM user_spoken_missions
WHERE user_id = ? AND mission_id = ? AND status = 'completed'
`,
    args: [userId, missionId],
  });
  const value = (result.rows[0] as Record<string, unknown> | undefined)?.best_evidence;
  return value === 'independent' || value === 'supported' ? value : null;
}

export async function getMostRecentSpokenMissionVariant(
  userId: string,
  missionId: string,
): Promise<number | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
SELECT wording_variant
FROM user_spoken_missions
WHERE user_id = ? AND mission_id = ?
ORDER BY datetime(created_at) DESC, rowid DESC
LIMIT 1
`,
    args: [userId, missionId],
  });
  const value = (result.rows[0] as Record<string, unknown> | undefined)?.wording_variant;
  return value === undefined ? null : asNumber(value);
}

export async function restartSpokenMissionAttempt(
  input: SpokenMissionAttemptCreationInput & {
    attemptId: string;
  },
): Promise<SpokenMissionAttempt> {
  const db = await getDb();
  const replacementId = `spokenmission-${randomUUID()}`;
  const timestamp = new Date().toISOString();
  const [abandoned, inserted] = await db.batch(
    [
      {
        sql: `
UPDATE user_spoken_missions
SET status = 'abandoned', updated_at = ?
WHERE id = ? AND user_id = ? AND mission_id = ? AND status = 'in_progress'
`,
        args: [timestamp, input.attemptId, input.userId, input.missionId],
      },
      buildSpokenMissionAttemptInsert(input, replacementId, timestamp, {
        attemptId: input.attemptId,
        abandonedAt: timestamp,
      }),
    ],
    'write',
  );

  if (abandoned.rowsAffected === 0 || inserted.rowsAffected === 0) {
    throw new SpokenMissionProgressConflictError();
  }

  const replacement = await getSpokenMissionAttempt(replacementId);
  if (!replacement) throw new Error('[spoken-missions-db] failed to load replacement attempt');
  return replacement;
}
