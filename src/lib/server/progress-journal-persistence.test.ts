import { createClient, type Client } from '@libsql/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

describe('progress journal persistence', () => {
  afterEach(() => {
    dbHarness.client = null;
    dbHarness.runDatabaseMigrations.mockReset();
    dbHarness.seedMissions.mockReset();
  });

  it('stores a generated journal only while its source journal is still current', async () => {
    const db = await loadDb();
    await db.insertUser({ id: 'user-1', name: 'Test User', level: 'beginner' });

    const firstWrite = await db.updateProgressJournalIfCurrent('user-1', null, 'Newer journal');
    const staleWrite = await db.updateProgressJournalIfCurrent('user-1', null, 'Stale journal');

    expect(firstWrite).toBe(true);
    expect(staleWrite).toBe(false);
    await expect(db.getProgressJournal('user-1')).resolves.toBe('Newer journal');
  });

  it('advances a non-empty journal when the expected source still matches', async () => {
    const db = await loadDb();
    await db.insertUser({ id: 'user-1', name: 'Test User', level: 'beginner' });
    await dbHarness.client!.execute({
      sql: `UPDATE users SET progress_journal = ? WHERE id = ?`,
      args: ['Existing journal', 'user-1'],
    });

    const updated = await db.updateProgressJournalIfCurrent(
      'user-1',
      'Existing journal',
      'Updated journal',
    );

    expect(updated).toBe(true);
    await expect(db.getProgressJournal('user-1')).resolves.toBe('Updated journal');
  });
});
