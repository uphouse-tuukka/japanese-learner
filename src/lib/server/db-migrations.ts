import type { InStatement } from '@libsql/client';

export const USER_XP_MISSION_REASONS_MIGRATION_KEY = 'user_xp_mission_reasons';
export const PORTFOLIO_V2_SESSION_COLUMNS_MIGRATION_KEY = 'portfolio_v2_session_columns';

export type MigrationDatabase = {
  execute(statement: InStatement): Promise<{ rows: Array<unknown> }>;
  batch(statements: InStatement[]): Promise<unknown>;
};

export function hasUserXpMissionReasons(userXpCreateSql: unknown): boolean {
  return (
    typeof userXpCreateSql === 'string' &&
    userXpCreateSql.includes('mission_complete') &&
    userXpCreateSql.includes('mission_correct_response') &&
    userXpCreateSql.includes('mission_natural_phrasing')
  );
}

export function getUserXpMissionReasonsMigrationStatements(): InStatement[] {
  return [
    `ALTER TABLE user_xp RENAME TO user_xp_old;`,
    `CREATE TABLE user_xp (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL,
session_id TEXT,
amount INTEGER NOT NULL,
reason TEXT NOT NULL CHECK(reason IN ('exercise_correct','session_complete','perfect_score','streak_bonus','combo_bonus','mission_complete','mission_correct_response','mission_natural_phrasing')),
created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (user_id) REFERENCES users(id)
);`,
    `INSERT INTO user_xp (id, user_id, session_id, amount, reason, created_at)
SELECT id, user_id, session_id, amount, reason, created_at FROM user_xp_old;`,
    `DROP TABLE user_xp_old;`,
    `CREATE INDEX IF NOT EXISTS idx_user_xp_user_id ON user_xp(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_user_xp_session_id ON user_xp(session_id);`,
  ];
}

export function getPortfolioV2SessionColumnMigrationStatements(): InStatement[] {
  return [
    `ALTER TABLE portfolio_challenge_attempts ADD COLUMN scenario TEXT DEFAULT NULL;`,
    `ALTER TABLE portfolio_challenge_attempts ADD COLUMN lesson TEXT DEFAULT NULL;`,
    `ALTER TABLE portfolio_challenge_attempts ADD COLUMN exercises TEXT DEFAULT NULL;`,
    `ALTER TABLE portfolio_challenge_attempts ADD COLUMN answers TEXT DEFAULT NULL;`,
    `ALTER TABLE portfolio_challenge_attempts ADD COLUMN current_step INTEGER DEFAULT 0;`,
    `ALTER TABLE portfolio_challenge_attempts ADD COLUMN summary TEXT DEFAULT NULL;`,
    `ALTER TABLE portfolio_challenge_attempts ADD COLUMN supports_browser_voice INTEGER DEFAULT 0;`,
  ];
}

export async function runDatabaseMigrations(db: MigrationDatabase): Promise<void> {
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS _migrations (key TEXT PRIMARY KEY);`,
  });

  const userXpMigration = await db.execute({
    sql: `SELECT 1 FROM _migrations WHERE key = ? LIMIT 1;`,
    args: [USER_XP_MISSION_REASONS_MIGRATION_KEY],
  });

  if (userXpMigration.rows.length === 0) {
    const userXpTable = await db.execute({
      sql: `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'user_xp' LIMIT 1;`,
    });
    const userXpCreateSql = (userXpTable.rows[0] as Record<string, unknown> | undefined)?.sql;

    if (!hasUserXpMissionReasons(userXpCreateSql)) {
      await db.batch(getUserXpMissionReasonsMigrationStatements());
    }

    await db.execute({
      sql: `INSERT INTO _migrations (key) VALUES (?);`,
      args: [USER_XP_MISSION_REASONS_MIGRATION_KEY],
    });
  }

  const migrationResult = await db.execute({
    sql: `SELECT 1 FROM _migrations WHERE key = ? LIMIT 1;`,
    args: [PORTFOLIO_V2_SESSION_COLUMNS_MIGRATION_KEY],
  });

  if (migrationResult.rows.length === 0) {
    await db.batch(getPortfolioV2SessionColumnMigrationStatements());
    await db.execute({
      sql: `INSERT INTO _migrations (key) VALUES (?);`,
      args: [PORTFOLIO_V2_SESSION_COLUMNS_MIGRATION_KEY],
    });
  }
}
