import type { InStatement } from '@libsql/client';
import { describe, expect, it } from 'vitest';
import {
  PORTFOLIO_V2_SESSION_COLUMNS_MIGRATION_KEY,
  USER_XP_MISSION_REASONS_MIGRATION_KEY,
  hasUserXpMissionReasons,
  runDatabaseMigrations,
} from './db-migrations';

type StatementInput = InStatement;

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
  private readonly userXpCreateSql: string;

  constructor(input: { existingMigrationKeys?: string[]; userXpCreateSql?: string } = {}) {
    this.existingMigrationKeys = new Set(input.existingMigrationKeys ?? []);
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
    return [];
  }

  executeSql(): string[] {
    return this.executeCalls.map(sqlText);
  }
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
  it('keeps the current migration order and statements when migration markers are absent', async () => {
    const db = new FakeMigrationDb({
      userXpCreateSql:
        "CREATE TABLE user_xp (reason TEXT CHECK(reason IN ('exercise_correct','session_complete','perfect_score','streak_bonus','combo_bonus')))",
    });

    await runDatabaseMigrations(db);

    expect(db.executeSql()[0]).toContain('CREATE TABLE IF NOT EXISTS _migrations');
    expect(db.batchCalls).toHaveLength(2);
    expect(db.batchCalls[0].map(sqlText).join('\n')).toContain(
      'ALTER TABLE user_xp RENAME TO user_xp_old;',
    );
    expect(db.batchCalls[0].map(sqlText).join('\n')).toContain('mission_natural_phrasing');
    expect(db.batchCalls[1].map(sqlText).join('\n')).toContain(
      'ALTER TABLE portfolio_challenge_attempts ADD COLUMN supports_browser_voice INTEGER DEFAULT 0;',
    );
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
      ],
    });

    await runDatabaseMigrations(db);

    expect(db.batchCalls).toEqual([]);
    expect(db.insertedMigrationKeys).toEqual([]);
    expect(db.executeSql().some((sql) => sql.includes('sqlite_master'))).toBe(false);
  });
});
