import { createClient, type Client } from '@libsql/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionMeta, SessionMode } from '$lib/types';

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

async function loadDb() {
  vi.resetModules();
  dbHarness.client = createClient({ url: 'file::memory:' });
  dbHarness.runDatabaseMigrations.mockResolvedValue(undefined);
  dbHarness.seedMissions.mockResolvedValue(undefined);
  return import('./db');
}

function buildSessionMeta(hadLevelUpRecommendation: boolean): SessionMeta {
  return {
    summaryText: 'Completed learning session',
    topic: 'Travel phrases',
    accuracy: 90,
    strengths: ['Strong recall'],
    weaknesses: [],
    exerciseTypes: ['translation'],
    keyPhrases: [],
    hadLevelUpRecommendation,
  };
}

async function insertCompletedSession(input: {
  id: string;
  mode: SessionMode;
  completedAt: string;
  summary: string | null;
}): Promise<void> {
  await dbHarness.client!.execute({
    sql: `
INSERT INTO sessions (id, user_id, mode, status, summary, created_at, completed_at)
VALUES (?, 'user-1', ?, 'completed', ?, ?, ?)
`,
    args: [input.id, input.mode, input.summary, input.completedAt, input.completedAt],
  });
}

describe('completed Learning Session summary history', () => {
  afterEach(() => {
    dbHarness.client = null;
    dbHarness.runDatabaseMigrations.mockReset();
    dbHarness.seedMissions.mockReset();
  });

  it.each([
    { name: 'malformed', summary: 'legacy summary text' },
    { name: 'null', summary: null },
  ])(
    'does not skip a $name latest Learning Session summary to suppress from an older one',
    async ({ summary }) => {
      const db = await loadDb();
      await db.insertUser({ id: 'user-1', name: 'Test User', level: 'beginner' });
      await insertCompletedSession({
        id: 'older-learning',
        mode: 'ai',
        completedAt: '2026-01-01T10:00:00.000Z',
        summary: JSON.stringify(buildSessionMeta(true)),
      });
      await insertCompletedSession({
        id: 'latest-learning',
        mode: 'ai',
        completedAt: '2026-01-01T12:00:00.000Z',
        summary,
      });

      await expect(db.getLatestCompletedLearningSessionSummary('user-1')).resolves.toBeNull();
    },
  );

  it('ignores a newer practice session when finding the previous Learning Session', async () => {
    const db = await loadDb();
    await db.insertUser({ id: 'user-1', name: 'Test User', level: 'beginner' });
    const previousLearningSummary = buildSessionMeta(true);
    await insertCompletedSession({
      id: 'previous-learning',
      mode: 'ai',
      completedAt: '2026-01-01T10:00:00.000Z',
      summary: JSON.stringify(previousLearningSummary),
    });
    await insertCompletedSession({
      id: 'newer-practice',
      mode: 'practice',
      completedAt: '2026-01-01T12:00:00.000Z',
      summary: 'Practice summary',
    });

    await expect(db.getLatestCompletedLearningSessionSummary('user-1')).resolves.toEqual(
      previousLearningSummary,
    );
  });
});
