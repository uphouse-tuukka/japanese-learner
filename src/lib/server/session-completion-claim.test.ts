import { createClient, type Client } from '@libsql/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Exercise } from '$lib/types';

const dbHarness = vi.hoisted(() => ({
  client: null as Client | null,
  runDatabaseMigrations: vi.fn(),
  seedMissions: vi.fn(),
}));

vi.mock('./db-client', () => ({
  getClient: () => {
    if (!dbHarness.client) {
      throw new Error('Test database client was not initialized.');
    }
    return dbHarness.client;
  },
}));

vi.mock('./db-migrations', () => ({
  runDatabaseMigrations: dbHarness.runDatabaseMigrations,
}));

vi.mock('./missions-seed', () => ({
  seedMissions: dbHarness.seedMissions,
}));

const exercise = {
  id: 'exercise-1',
  type: 'multiple_choice',
  title: 'Greeting choice',
  japanese: 'こんにちは',
  romaji: 'konnichiwa',
  englishContext: 'hello',
  tags: ['greetings'],
  difficulty: 1,
  question: 'Choose the greeting.',
  choices: ['こんにちは', 'さようなら'],
  correctAnswer: 'こんにちは',
  explanation: 'こんにちは is a common greeting.',
} satisfies Exercise;

async function loadDb() {
  vi.resetModules();
  dbHarness.client = createClient({ url: 'file::memory:' });
  dbHarness.runDatabaseMigrations.mockResolvedValue(undefined);
  dbHarness.seedMissions.mockResolvedValue(undefined);
  return import('./db');
}

async function seedPlannedSession(db: Awaited<ReturnType<typeof loadDb>>): Promise<void> {
  await db.insertUser({ id: 'user-1', name: 'Test User', level: 'beginner' });
  await db.createSession({
    id: 'session-1',
    userId: 'user-1',
    mode: 'ai',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  await db.upsertExercise(exercise, false);
}

async function insertPartialResult(
  db: Awaited<ReturnType<typeof loadDb>>,
  completionClaimedAt?: string,
): Promise<void> {
  await db.createExerciseResults({
    userId: 'user-1',
    sessionId: 'session-1',
    completionClaimedAt,
    mode: 'ai',
    results: [
      {
        exerciseId: 'exercise-1',
        isCorrect: true,
        answerText: 'こんにちは',
      },
    ],
  });
}

async function countExerciseResults(): Promise<number> {
  const result = await dbHarness.client!.execute({
    sql: `SELECT COUNT(*) AS total FROM user_exercise_results WHERE session_id = ?`,
    args: ['session-1'],
  });
  return Number((result.rows[0] as Record<string, unknown> | undefined)?.total ?? 0);
}

describe('session completion claims', () => {
  afterEach(() => {
    dbHarness.client = null;
    dbHarness.runDatabaseMigrations.mockReset();
    dbHarness.seedMissions.mockReset();
  });

  it('claims a planned session with a recoverable completing state', async () => {
    const db = await loadDb();
    await seedPlannedSession(db);

    const claim = await db.claimSessionCompletion('user-1', 'session-1');
    expect(claim).toEqual({
      status: 'claimed',
      claimedAt: expect.any(String),
    });

    const session = await db.getSession('session-1');
    expect(session).toMatchObject({
      id: 'session-1',
      userId: 'user-1',
      status: 'completing',
      completedAt: claim.status === 'claimed' ? claim.claimedAt : '',
    });
  });

  it('keeps a fresh completing claim busy for concurrent completion requests', async () => {
    const db = await loadDb();
    await seedPlannedSession(db);

    await expect(db.claimSessionCompletion('user-1', 'session-1')).resolves.toMatchObject({
      status: 'claimed',
      claimedAt: expect.any(String),
    });

    await expect(db.claimSessionCompletion('user-1', 'session-1')).resolves.toEqual({
      status: 'busy',
    });
  });

  it('reclaims a stale completing session and clears partial exercise results', async () => {
    const db = await loadDb();
    await seedPlannedSession(db);
    await dbHarness.client!.execute({
      sql: `UPDATE sessions SET status = 'completing', completed_at = ? WHERE id = ?`,
      args: ['2000-01-01T00:00:00.000Z', 'session-1'],
    });
    await insertPartialResult(db);

    expect(await countExerciseResults()).toBe(1);

    const claim = await db.claimSessionCompletion('user-1', 'session-1');
    expect(claim).toEqual({
      status: 'claimed',
      claimedAt: expect.any(String),
    });

    const session = await db.getSession('session-1');
    expect(session?.status).toBe('completing');
    expect(session?.completedAt).not.toBe('2000-01-01T00:00:00.000Z');
    expect(session?.completedAt).toBe(claim.status === 'claimed' ? claim.claimedAt : '');
    expect(await countExerciseResults()).toBe(0);
  });

  it('resets a failed completing claim to a planned retryable session', async () => {
    const db = await loadDb();
    await seedPlannedSession(db);
    const claim = await db.claimSessionCompletion('user-1', 'session-1');
    if (claim.status !== 'claimed') throw new Error('Expected session claim.');
    await insertPartialResult(db);

    await expect(
      db.resetSessionCompletionClaim('user-1', 'session-1', claim.claimedAt),
    ).resolves.toBe(true);

    const session = await db.getSession('session-1');
    expect(session).toMatchObject({
      status: 'planned',
      completedAt: null,
    });
    expect(await countExerciseResults()).toBe(0);
  });

  it('does not let an old stale worker reset a newer reclaimed session', async () => {
    const db = await loadDb();
    const oldClaimedAt = '2000-01-01T00:00:00.000Z';
    await seedPlannedSession(db);
    await dbHarness.client!.execute({
      sql: `UPDATE sessions SET status = 'completing', completed_at = ? WHERE id = ?`,
      args: [oldClaimedAt, 'session-1'],
    });

    const newClaim = await db.claimSessionCompletion('user-1', 'session-1');
    if (newClaim.status !== 'claimed') throw new Error('Expected stale claim to be reclaimed.');
    await insertPartialResult(db, newClaim.claimedAt);

    await expect(db.resetSessionCompletionClaim('user-1', 'session-1', oldClaimedAt)).resolves.toBe(
      false,
    );

    const session = await db.getSession('session-1');
    expect(session).toMatchObject({
      status: 'completing',
      completedAt: newClaim.claimedAt,
    });
    expect(await countExerciseResults()).toBe(1);
  });

  it('does not let an old stale worker insert results or complete a newer reclaimed session', async () => {
    const db = await loadDb();
    const oldClaimedAt = '2000-01-01T00:00:00.000Z';
    await seedPlannedSession(db);
    await dbHarness.client!.execute({
      sql: `UPDATE sessions SET status = 'completing', completed_at = ? WHERE id = ?`,
      args: [oldClaimedAt, 'session-1'],
    });

    const newClaim = await db.claimSessionCompletion('user-1', 'session-1');
    if (newClaim.status !== 'claimed') throw new Error('Expected stale claim to be reclaimed.');

    await insertPartialResult(db, oldClaimedAt);
    expect(await countExerciseResults()).toBe(0);

    await insertPartialResult(db, newClaim.claimedAt);
    expect(await countExerciseResults()).toBe(1);

    await expect(
      db.completeSessionRecord('session-1', {
        summary: 'old worker summary',
        completionClaimedAt: oldClaimedAt,
      }),
    ).resolves.toBe(false);

    const session = await db.getSession('session-1');
    expect(session).toMatchObject({
      status: 'completing',
      completedAt: newClaim.claimedAt,
      summary: null,
    });
    expect(await countExerciseResults()).toBe(1);
  });

  it('deletes stale completing sessions and their partial results during ghost cleanup', async () => {
    const db = await loadDb();
    await seedPlannedSession(db);
    await dbHarness.client!.execute({
      sql: `UPDATE sessions SET status = 'completing', completed_at = ? WHERE id = ?`,
      args: ['2000-01-01T00:00:00.000Z', 'session-1'],
    });
    await insertPartialResult(db);

    await db.deleteStaleGhostSessions('user-1');

    await expect(db.getSession('session-1')).resolves.toBeNull();
    expect(await countExerciseResults()).toBe(0);
  });

  it('keeps fresh completing sessions during ghost cleanup', async () => {
    const db = await loadDb();
    await seedPlannedSession(db);
    const claim = await db.claimSessionCompletion('user-1', 'session-1');
    if (claim.status !== 'claimed') throw new Error('Expected session claim.');
    await insertPartialResult(db, claim.claimedAt);

    await db.deleteStaleGhostSessions('user-1');

    const session = await db.getSession('session-1');
    expect(session).toMatchObject({
      status: 'completing',
      completedAt: claim.claimedAt,
    });
    expect(await countExerciseResults()).toBe(1);
  });

  it('does not expose another user completed session as an idempotent retry', async () => {
    const db = await loadDb();
    await db.insertUser({ id: 'user-1', name: 'Test User', level: 'beginner' });
    await db.insertUser({ id: 'user-2', name: 'Other User', level: 'beginner' });
    await db.createSession({
      id: 'session-1',
      userId: 'user-2',
      mode: 'ai',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await db.completeSessionRecord('session-1', { summary: 'secret summary' });

    await expect(db.claimSessionCompletion('user-1', 'session-1')).resolves.toEqual({
      status: 'not_found',
    });
  });
});
