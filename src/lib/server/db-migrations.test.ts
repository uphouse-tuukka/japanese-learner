import { createClient, type InStatement } from '@libsql/client';
import { describe, expect, it } from 'vitest';
import {
  PORTFOLIO_V2_SESSION_COLUMNS_MIGRATION_KEY,
  SPOKEN_MISSION_SINGLE_IN_PROGRESS_MIGRATION_KEY,
  SPOKEN_MISSION_WRITTEN_SUPPORT_MIGRATION_KEY,
  USER_XP_MISSION_REASONS_MIGRATION_KEY,
  hasUserXpMissionReasons,
  runDatabaseMigrations,
} from './db-migrations';

type StatementInput = InStatement;

const PORTFOLIO_V2_COLUMN_NAMES = [
  'scenario',
  'lesson',
  'exercises',
  'answers',
  'current_step',
  'summary',
  'supports_browser_voice',
] as const;

function sqlText(statement: StatementInput): string {
  return typeof statement === 'string' ? statement : statement.sql;
}

function firstArg(statement: StatementInput): unknown {
  if (typeof statement === 'string' || !Array.isArray(statement.args)) return undefined;
  return statement.args[0];
}

class FakeMigrationDb {
  readonly executeCalls: StatementInput[] = [];
  readonly batchCalls: StatementInput[][] = [];
  readonly insertedMigrationKeys: string[] = [];
  private readonly existingMigrationKeys: Set<string>;
  private readonly portfolioColumns: Set<string>;
  private readonly portfolioTableExists: boolean;
  private readonly spokenMissionColumns: Set<string>;
  private readonly spokenMissionTableExists: boolean;
  private readonly userXpCreateSql: string;

  constructor(
    input: {
      existingMigrationKeys?: string[];
      portfolioColumns?: string[];
      portfolioTableExists?: boolean;
      spokenMissionColumns?: string[];
      spokenMissionTableExists?: boolean;
      userXpCreateSql?: string;
    } = {},
  ) {
    this.existingMigrationKeys = new Set(input.existingMigrationKeys ?? []);
    this.portfolioColumns = new Set(input.portfolioColumns ?? []);
    this.portfolioTableExists = input.portfolioTableExists ?? true;
    this.spokenMissionColumns = new Set(input.spokenMissionColumns ?? []);
    this.spokenMissionTableExists = input.spokenMissionTableExists ?? false;
    this.userXpCreateSql = input.userXpCreateSql ?? '';
  }

  async execute(statement: StatementInput): Promise<{ rows: Array<Record<string, unknown>> }> {
    this.executeCalls.push(statement);
    const sql = sqlText(statement);

    if (sql.includes('CREATE TABLE IF NOT EXISTS _migrations')) {
      return { rows: [] };
    }

    if (sql.includes('SELECT 1 FROM _migrations')) {
      const key = firstArg(statement);
      return { rows: this.existingMigrationKeys.has(String(key)) ? [{ found: 1 }] : [] };
    }

    if (sql.includes("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'user_xp'")) {
      return { rows: [{ sql: this.userXpCreateSql }] };
    }

    if (sql.includes('sqlite_master') && firstArg(statement) === 'portfolio_challenge_attempts') {
      return { rows: this.portfolioTableExists ? [{ found: 1 }] : [] };
    }

    if (sql.includes('sqlite_master') && firstArg(statement) === 'user_spoken_missions') {
      return { rows: this.spokenMissionTableExists ? [{ found: 1 }] : [] };
    }

    if (sql.includes('PRAGMA table_info(portfolio_challenge_attempts)')) {
      return { rows: Array.from(this.portfolioColumns, (name) => ({ name })) };
    }

    if (sql.includes('PRAGMA table_info(user_spoken_missions)')) {
      return { rows: Array.from(this.spokenMissionColumns, (name) => ({ name })) };
    }

    if (sql.includes('ALTER TABLE portfolio_challenge_attempts ADD COLUMN')) {
      this.addPortfolioColumn(sql);
      return { rows: [] };
    }

    if (sql.includes('ALTER TABLE user_spoken_missions ADD COLUMN')) {
      const columnName = sql.match(/ADD COLUMN\s+([a-z_]+)/i)?.[1];
      if (!columnName)
        throw new Error(`Could not parse Spoken Mission ADD COLUMN statement: ${sql}`);
      if (this.spokenMissionColumns.has(columnName)) {
        throw new Error(`duplicate column name: ${columnName}`);
      }
      this.spokenMissionColumns.add(columnName);
      return { rows: [] };
    }

    if (sql.includes('INSERT INTO _migrations')) {
      const key = firstArg(statement);
      this.insertedMigrationKeys.push(String(key));
      this.existingMigrationKeys.add(String(key));
      return { rows: [] };
    }

    throw new Error(`Unexpected SQL in fake migration DB: ${sql}`);
  }

  async batch(statements: StatementInput[]): Promise<unknown[]> {
    this.batchCalls.push(statements);
    for (const statement of statements) {
      const sql = sqlText(statement);
      if (sql.includes('ALTER TABLE portfolio_challenge_attempts ADD COLUMN')) {
        this.addPortfolioColumn(sql);
      }
      if (sql.includes('INSERT INTO _migrations')) {
        const key = firstArg(statement);
        this.insertedMigrationKeys.push(String(key));
        this.existingMigrationKeys.add(String(key));
      }
    }
    return [];
  }

  executeSql(): string[] {
    return this.executeCalls.map(sqlText);
  }

  private addPortfolioColumn(sql: string): void {
    if (!this.portfolioTableExists) {
      throw new Error('no such table: portfolio_challenge_attempts');
    }

    const columnName = sql.match(/ADD COLUMN\s+([a-z_]+)/i)?.[1];
    if (!columnName) {
      throw new Error(`Could not parse portfolio ADD COLUMN statement: ${sql}`);
    }

    if (this.portfolioColumns.has(columnName)) {
      throw new Error(`duplicate column name: ${columnName}`);
    }

    this.portfolioColumns.add(columnName);
  }
}

function portfolioAlterSql(db: FakeMigrationDb): string[] {
  return [...db.executeCalls, ...db.batchCalls.flat()]
    .map(sqlText)
    .filter((sql) => sql.includes('ALTER TABLE portfolio_challenge_attempts ADD COLUMN'));
}

describe('hasUserXpMissionReasons', () => {
  it('detects the existing user_xp reason constraint after mission reasons are present', () => {
    expect(
      hasUserXpMissionReasons(
        "CREATE TABLE user_xp (reason TEXT CHECK(reason IN ('exercise_correct','mission_complete','mission_correct_response','mission_natural_phrasing')))",
      ),
    ).toBe(true);
  });

  it('requires every current mission XP reason to be present', () => {
    expect(
      hasUserXpMissionReasons(
        "CREATE TABLE user_xp (reason TEXT CHECK(reason IN ('exercise_correct','mission_complete','mission_correct_response')))",
      ),
    ).toBe(false);
    expect(hasUserXpMissionReasons(null)).toBe(false);
  });
});

describe('runDatabaseMigrations', () => {
  it('runs current user_xp migration and adds all portfolio v2 columns when migration markers are absent', async () => {
    const db = new FakeMigrationDb({
      userXpCreateSql:
        "CREATE TABLE user_xp (reason TEXT CHECK(reason IN ('exercise_correct','session_complete','perfect_score','streak_bonus','combo_bonus')))",
    });

    await runDatabaseMigrations(db);

    expect(db.executeSql()[0]).toContain('CREATE TABLE IF NOT EXISTS _migrations');
    expect(db.batchCalls[0].map(sqlText).join('\n')).toContain(
      'ALTER TABLE user_xp RENAME TO user_xp_old;',
    );
    expect(db.batchCalls[0].map(sqlText).join('\n')).toContain('mission_natural_phrasing');
    expect(portfolioAlterSql(db)).toEqual([
      'ALTER TABLE portfolio_challenge_attempts ADD COLUMN scenario TEXT DEFAULT NULL;',
      'ALTER TABLE portfolio_challenge_attempts ADD COLUMN lesson TEXT DEFAULT NULL;',
      'ALTER TABLE portfolio_challenge_attempts ADD COLUMN exercises TEXT DEFAULT NULL;',
      'ALTER TABLE portfolio_challenge_attempts ADD COLUMN answers TEXT DEFAULT NULL;',
      'ALTER TABLE portfolio_challenge_attempts ADD COLUMN current_step INTEGER DEFAULT 0;',
      'ALTER TABLE portfolio_challenge_attempts ADD COLUMN summary TEXT DEFAULT NULL;',
      'ALTER TABLE portfolio_challenge_attempts ADD COLUMN supports_browser_voice INTEGER DEFAULT 0;',
    ]);
    expect(db.insertedMigrationKeys).toEqual([
      USER_XP_MISSION_REASONS_MIGRATION_KEY,
      PORTFOLIO_V2_SESSION_COLUMNS_MIGRATION_KEY,
    ]);
  });

  it('skips migration batches and schema inspection when migration markers are already present', async () => {
    const db = new FakeMigrationDb({
      existingMigrationKeys: [
        USER_XP_MISSION_REASONS_MIGRATION_KEY,
        PORTFOLIO_V2_SESSION_COLUMNS_MIGRATION_KEY,
        SPOKEN_MISSION_WRITTEN_SUPPORT_MIGRATION_KEY,
        SPOKEN_MISSION_SINGLE_IN_PROGRESS_MIGRATION_KEY,
      ],
    });

    await runDatabaseMigrations(db);

    expect(db.batchCalls).toEqual([]);
    expect(db.insertedMigrationKeys).toEqual([]);
    expect(db.executeSql().some((sql) => sql.includes('sqlite_master'))).toBe(false);
  });

  it('adds only missing portfolio v2 columns and records the marker when some columns already exist', async () => {
    const db = new FakeMigrationDb({
      existingMigrationKeys: [USER_XP_MISSION_REASONS_MIGRATION_KEY],
      portfolioColumns: ['scenario', 'lesson', 'answers', 'summary'],
    });

    await runDatabaseMigrations(db);

    expect(portfolioAlterSql(db)).toEqual([
      'ALTER TABLE portfolio_challenge_attempts ADD COLUMN exercises TEXT DEFAULT NULL;',
      'ALTER TABLE portfolio_challenge_attempts ADD COLUMN current_step INTEGER DEFAULT 0;',
      'ALTER TABLE portfolio_challenge_attempts ADD COLUMN supports_browser_voice INTEGER DEFAULT 0;',
    ]);
    expect(db.insertedMigrationKeys).toEqual([PORTFOLIO_V2_SESSION_COLUMNS_MIGRATION_KEY]);
  });

  it('records the portfolio marker without ALTERs when all v2 columns already exist', async () => {
    const db = new FakeMigrationDb({
      existingMigrationKeys: [USER_XP_MISSION_REASONS_MIGRATION_KEY],
      portfolioColumns: [...PORTFOLIO_V2_COLUMN_NAMES],
    });

    await runDatabaseMigrations(db);

    expect(portfolioAlterSql(db)).toEqual([]);
    expect(db.insertedMigrationKeys).toEqual([PORTFOLIO_V2_SESSION_COLUMNS_MIGRATION_KEY]);
  });

  it('skips portfolio v2 ALTERs and does not record the marker when the table is absent', async () => {
    const db = new FakeMigrationDb({
      existingMigrationKeys: [USER_XP_MISSION_REASONS_MIGRATION_KEY],
      portfolioTableExists: false,
    });

    await runDatabaseMigrations(db);

    expect(portfolioAlterSql(db)).toEqual([]);
    expect(db.insertedMigrationKeys).toEqual([]);
  });

  it('adds durable written-support state to existing Spoken Mission attempts', async () => {
    const db = new FakeMigrationDb({
      existingMigrationKeys: [
        USER_XP_MISSION_REASONS_MIGRATION_KEY,
        PORTFOLIO_V2_SESSION_COLUMNS_MIGRATION_KEY,
      ],
      spokenMissionColumns: ['id', 'current_turn_support_used'],
      spokenMissionTableExists: true,
    });

    await runDatabaseMigrations(db);

    expect(db.executeSql()).toContain(
      'ALTER TABLE user_spoken_missions ADD COLUMN current_turn_written_support_revealed INTEGER NOT NULL DEFAULT 0 CHECK(current_turn_written_support_revealed IN (0, 1));',
    );
    expect(db.insertedMigrationKeys).toEqual(['spoken_mission_written_support']);
  });
});

describe('Spoken Mission single in-progress attempt migration', () => {
  const previousMigrationKeys = [
    USER_XP_MISSION_REASONS_MIGRATION_KEY,
    PORTFOLIO_V2_SESSION_COLUMNS_MIGRATION_KEY,
    SPOKEN_MISSION_WRITTEN_SUPPORT_MIGRATION_KEY,
  ];

  async function createMigrationDatabase() {
    const db = createClient({ url: 'file::memory:' });
    await db.execute(`CREATE TABLE _migrations (key TEXT PRIMARY KEY);`);
    for (const key of previousMigrationKeys) {
      await db.execute({ sql: `INSERT INTO _migrations (key) VALUES (?);`, args: [key] });
    }
    return db;
  }

  it('allows concurrent cold-start runners to complete both Spoken Mission migrations', async () => {
    const db = createClient({ url: 'file::memory:' });
    await db.batch([
      `CREATE TABLE _migrations (key TEXT PRIMARY KEY);`,
      {
        sql: `INSERT INTO _migrations (key) VALUES (?);`,
        args: [USER_XP_MISSION_REASONS_MIGRATION_KEY],
      },
      {
        sql: `INSERT INTO _migrations (key) VALUES (?);`,
        args: [PORTFOLIO_V2_SESSION_COLUMNS_MIGRATION_KEY],
      },
      `CREATE TABLE user_spoken_missions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        mission_id TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
    ]);

    await Promise.all([runDatabaseMigrations(db), runDatabaseMigrations(db)]);

    const columns = await db.execute(`PRAGMA table_info(user_spoken_missions);`);
    expect(
      columns.rows.filter((row) => row.name === 'current_turn_written_support_revealed'),
    ).toHaveLength(1);
    const indexes = await db.execute({
      sql: `SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?;`,
      args: ['idx_user_spoken_missions_single_in_progress'],
    });
    expect(indexes.rows).toHaveLength(1);
    const markers = await db.execute({
      sql: `SELECT key FROM _migrations
        WHERE key IN (?, ?)
        ORDER BY key;`,
      args: [
        SPOKEN_MISSION_SINGLE_IN_PROGRESS_MIGRATION_KEY,
        SPOKEN_MISSION_WRITTEN_SUPPORT_MIGRATION_KEY,
      ],
    });
    expect(markers.rows).toEqual([
      expect.objectContaining({ key: SPOKEN_MISSION_SINGLE_IN_PROGRESS_MIGRATION_KEY }),
      expect.objectContaining({ key: SPOKEN_MISSION_WRITTEN_SUPPORT_MIGRATION_KEY }),
    ]);
  });

  it('repairs duplicate active attempts before installing and recording the invariant', async () => {
    const db = await createMigrationDatabase();
    await db.batch([
      `CREATE TABLE user_spoken_missions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        mission_id TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      {
        sql: `INSERT INTO user_spoken_missions VALUES (?, ?, ?, 'in_progress', ?);`,
        args: ['older', 'user-1', 'mission-1', '2026-07-16T09:00:00.000Z'],
      },
      {
        sql: `INSERT INTO user_spoken_missions VALUES (?, ?, ?, 'in_progress', ?);`,
        args: ['newer', 'user-1', 'mission-1', '2026-07-17T09:00:00.000Z'],
      },
      {
        sql: `INSERT INTO user_spoken_missions VALUES (?, ?, ?, 'in_progress', ?);`,
        args: ['other-mission', 'user-1', 'mission-2', '2026-07-15T09:00:00.000Z'],
      },
    ]);

    await runDatabaseMigrations(db);
    await runDatabaseMigrations(db);

    const attempts = await db.execute(`SELECT id, status FROM user_spoken_missions ORDER BY id;`);
    expect(attempts.rows).toEqual([
      expect.objectContaining({ id: 'newer', status: 'in_progress' }),
      expect.objectContaining({ id: 'older', status: 'abandoned' }),
      expect.objectContaining({ id: 'other-mission', status: 'in_progress' }),
    ]);
    const indexes = await db.execute({
      sql: `SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?;`,
      args: ['idx_user_spoken_missions_single_in_progress'],
    });
    expect(indexes.rows).toHaveLength(1);
    const markers = await db.execute({
      sql: `SELECT key FROM _migrations WHERE key = ?;`,
      args: [SPOKEN_MISSION_SINGLE_IN_PROGRESS_MIGRATION_KEY],
    });
    expect(markers.rows).toHaveLength(1);
    await expect(
      db.execute({
        sql: `INSERT INTO user_spoken_missions VALUES (?, ?, ?, 'in_progress', ?);`,
        args: ['duplicate', 'user-1', 'mission-1', '2026-07-18T09:00:00.000Z'],
      }),
    ).rejects.toThrow();
  });

  it('defers safely until the attempt table has every required column', async () => {
    const db = await createMigrationDatabase();

    await runDatabaseMigrations(db);
    await db.execute(`CREATE TABLE user_spoken_missions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mission_id TEXT NOT NULL,
      status TEXT NOT NULL
    );`);
    await runDatabaseMigrations(db);

    const markers = await db.execute({
      sql: `SELECT key FROM _migrations WHERE key = ?;`,
      args: [SPOKEN_MISSION_SINGLE_IN_PROGRESS_MIGRATION_KEY],
    });
    expect(markers.rows).toHaveLength(0);
    const indexes = await db.execute({
      sql: `SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?;`,
      args: ['idx_user_spoken_missions_single_in_progress'],
    });
    expect(indexes.rows).toHaveLength(0);

    await db.execute(
      `ALTER TABLE user_spoken_missions ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';`,
    );
    await runDatabaseMigrations(db);

    const completedMarkers = await db.execute({
      sql: `SELECT key FROM _migrations WHERE key = ?;`,
      args: [SPOKEN_MISSION_SINGLE_IN_PROGRESS_MIGRATION_KEY],
    });
    expect(completedMarkers.rows).toHaveLength(1);
  });
});
