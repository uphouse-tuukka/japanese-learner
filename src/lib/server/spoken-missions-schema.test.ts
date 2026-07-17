import { createClient } from '@libsql/client';
import { describe, expect, it } from 'vitest';
import { runDatabaseMigrations } from './db-migrations';
import { getSchemaStatements } from './db-schema';

describe('Spoken Mission database schema', () => {
  it('creates the dedicated attempt table and enforces its evidence constraints on a fresh database', async () => {
    const db = createClient({ url: 'file::memory:' });
    await db.batch(getSchemaStatements());
    await runDatabaseMigrations(db);

    const table = await db.execute({
      sql: `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'user_spoken_missions'`,
    });
    expect(String((table.rows[0] as Record<string, unknown>).sql)).toContain(
      "evidence_state TEXT CHECK(evidence_state IN ('supported', 'independent'))",
    );
    const columns = await db.execute('PRAGMA table_info(user_spoken_missions)');
    expect(columns.rows.map((row) => row.name)).not.toEqual(
      expect.arrayContaining(['audio', 'audio_blob', 'raw_audio']),
    );

    await expect(
      db.execute({
        sql: `INSERT INTO user_spoken_missions (
          id, user_id, mission_id, definition_version, evidence_state
        ) VALUES (?, ?, ?, ?, ?)`,
        args: ['spoken-1', 'user-1', 'mission-1', 'v1', 'incorrect'],
      }),
    ).rejects.toThrow();

    await db.execute({
      sql: `INSERT INTO user_spoken_missions (
        id, user_id, mission_id, definition_version
      ) VALUES (?, ?, ?, ?)`,
      args: ['spoken-active-1', 'user-1', 'mission-1', 'v1'],
    });
    await expect(
      db.execute({
        sql: `INSERT INTO user_spoken_missions (
          id, user_id, mission_id, definition_version
        ) VALUES (?, ?, ?, ?)`,
        args: ['spoken-active-2', 'user-1', 'mission-1', 'v1'],
      }),
    ).rejects.toThrow();
  });

  it('adds Spoken Mission storage to an existing mission database without changing Written Mission rows', async () => {
    const db = createClient({ url: 'file::memory:' });
    await db.batch([
      `CREATE TABLE missions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        difficulty TEXT NOT NULL CHECK(difficulty IN ('easy', 'medium', 'hard')),
        sequence INTEGER NOT NULL,
        scenario_prompt TEXT NOT NULL,
        badge_emoji TEXT NOT NULL,
        badge_name TEXT NOT NULL,
        badge_statement TEXT NOT NULL,
        unlock_sessions_required INTEGER NOT NULL DEFAULT 0,
        start_unlocked INTEGER NOT NULL DEFAULT 0
      );`,
      `CREATE TABLE user_missions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        mission_id TEXT NOT NULL,
        mode TEXT NOT NULL CHECK(mode IN ('practice', 'immersion')),
        status TEXT NOT NULL CHECK(status IN ('in_progress', 'completed')) DEFAULT 'in_progress',
        exchanges INTEGER NOT NULL DEFAULT 0,
        correct_responses INTEGER NOT NULL DEFAULT 0,
        score REAL NOT NULL DEFAULT 0,
        xp_earned INTEGER NOT NULL DEFAULT 0,
        badge_earned INTEGER NOT NULL DEFAULT 0,
        conversation_log TEXT NOT NULL DEFAULT '[]',
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`,
      {
        sql: `INSERT INTO user_missions (
          id, user_id, mission_id, mode, status, exchanges, correct_responses, score,
          xp_earned, badge_earned, conversation_log
        ) VALUES (?, ?, ?, 'practice', 'completed', 5, 4, 0.8, 65, 0, '[]')`,
        args: ['written-1', 'user-1', 'mission-order-restaurant'],
      },
    ]);

    await db.batch(getSchemaStatements());
    await runDatabaseMigrations(db);

    const written = await db.execute({
      sql: `SELECT * FROM user_missions WHERE id = 'written-1'`,
    });
    expect(written.rows[0]).toMatchObject({
      id: 'written-1',
      mode: 'practice',
      status: 'completed',
      exchanges: 5,
      correct_responses: 4,
      xp_earned: 65,
    });

    const spokenTable = await db.execute({
      sql: `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_spoken_missions'`,
    });
    expect(spokenTable.rows).toHaveLength(1);

    const indexes = await db.execute({
      sql: `SELECT name FROM sqlite_master
        WHERE type = 'index' AND tbl_name = 'user_spoken_missions'
        ORDER BY name`,
    });
    expect(indexes.rows.map((row) => row.name)).toEqual([
      'idx_user_spoken_missions_resumable',
      'idx_user_spoken_missions_single_in_progress',
      'idx_user_spoken_missions_user_mission',
      'sqlite_autoindex_user_spoken_missions_1',
    ]);

    await expect(
      db.execute({
        sql: `INSERT INTO user_spoken_missions (
          id, user_id, mission_id, definition_version, status, successful_turn_count,
          evidence_state, completed_at
        ) VALUES (?, ?, ?, ?, 'completed', 2, 'independent', datetime('now'))`,
        args: ['invalid-completion', 'user-1', 'mission-order-restaurant', 'v1'],
      }),
    ).rejects.toThrow();
  });

  it('keeps only the newest active attempt when adding the invariant to existing storage', async () => {
    const db = createClient({ url: 'file::memory:' });
    await db.batch(getSchemaStatements());
    await db.batch([
      {
        sql: `INSERT INTO user_spoken_missions (
          id, user_id, mission_id, definition_version, updated_at
        ) VALUES (?, ?, ?, ?, ?)`,
        args: [
          'spoken-old',
          'user-1',
          'mission-order-restaurant',
          'restaurant-order-v1',
          '2026-07-16T09:00:00.000Z',
        ],
      },
      {
        sql: `INSERT INTO user_spoken_missions (
          id, user_id, mission_id, definition_version, updated_at
        ) VALUES (?, ?, ?, ?, ?)`,
        args: [
          'spoken-new',
          'user-1',
          'mission-order-restaurant',
          'restaurant-order-v2',
          '2026-07-17T09:00:00.000Z',
        ],
      },
    ]);

    await runDatabaseMigrations(db);

    const attempts = await db.execute({
      sql: `SELECT id, status FROM user_spoken_missions ORDER BY id`,
    });
    expect(attempts.rows).toEqual([
      expect.objectContaining({ id: 'spoken-new', status: 'in_progress' }),
      expect.objectContaining({ id: 'spoken-old', status: 'abandoned' }),
    ]);
  });
});
