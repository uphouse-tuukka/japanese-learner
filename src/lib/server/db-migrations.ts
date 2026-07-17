import type { InStatement } from '@libsql/client';

export const USER_XP_MISSION_REASONS_MIGRATION_KEY = 'user_xp_mission_reasons';
export const PORTFOLIO_V2_SESSION_COLUMNS_MIGRATION_KEY = 'portfolio_v2_session_columns';
export const SPOKEN_MISSION_WRITTEN_SUPPORT_MIGRATION_KEY = 'spoken_mission_written_support';
export const SPOKEN_MISSION_SINGLE_IN_PROGRESS_MIGRATION_KEY = 'spoken_mission_single_in_progress';

export type MigrationDatabase = {
  execute(statement: InStatement): Promise<{ rows: Array<unknown> }>;
  batch(statements: InStatement[]): Promise<unknown>;
};

type ColumnDefinition = {
  name: string;
  definition: string;
};

const PORTFOLIO_CHALLENGE_ATTEMPTS_TABLE = 'portfolio_challenge_attempts';
const SPOKEN_MISSION_ATTEMPTS_TABLE = 'user_spoken_missions';
const SAFE_SQL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PORTFOLIO_V2_SESSION_COLUMN_DEFINITIONS: ColumnDefinition[] = [
  { name: 'scenario', definition: 'scenario TEXT DEFAULT NULL' },
  { name: 'lesson', definition: 'lesson TEXT DEFAULT NULL' },
  { name: 'exercises', definition: 'exercises TEXT DEFAULT NULL' },
  { name: 'answers', definition: 'answers TEXT DEFAULT NULL' },
  { name: 'current_step', definition: 'current_step INTEGER DEFAULT 0' },
  { name: 'summary', definition: 'summary TEXT DEFAULT NULL' },
  { name: 'supports_browser_voice', definition: 'supports_browser_voice INTEGER DEFAULT 0' },
];
const SPOKEN_MISSION_WRITTEN_SUPPORT_COLUMN: ColumnDefinition = {
  name: 'current_turn_written_support_revealed',
  definition:
    'current_turn_written_support_revealed INTEGER NOT NULL DEFAULT 0 CHECK(current_turn_written_support_revealed IN (0, 1))',
};
const SPOKEN_MISSION_SINGLE_IN_PROGRESS_REQUIRED_COLUMNS = [
  'user_id',
  'mission_id',
  'status',
  'updated_at',
] as const;

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
  return PORTFOLIO_V2_SESSION_COLUMN_DEFINITIONS.map((column) =>
    getAddColumnStatement(PORTFOLIO_CHALLENGE_ATTEMPTS_TABLE, column),
  );
}

function safeSqlIdentifier(identifier: string): string {
  if (!SAFE_SQL_IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  return identifier;
}

async function tableExists(db: MigrationDatabase, tableName: string): Promise<boolean> {
  safeSqlIdentifier(tableName);
  const result = await db.execute({
    sql: `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1;`,
    args: [tableName],
  });

  return result.rows.length > 0;
}

async function getTableColumnNames(db: MigrationDatabase, tableName: string): Promise<Set<string>> {
  const safeTableName = safeSqlIdentifier(tableName);
  const result = await db.execute({
    sql: `PRAGMA table_info(${safeTableName});`,
  });

  const columnNames = new Set<string>();
  for (const row of result.rows as Array<Record<string, unknown>>) {
    if (typeof row.name === 'string') {
      columnNames.add(row.name);
    }
  }

  return columnNames;
}

function hasTableColumn(columnNames: ReadonlySet<string>, columnName: string): boolean {
  return columnNames.has(columnName);
}

function getAddColumnStatement(tableName: string, column: ColumnDefinition): InStatement {
  const safeTableName = safeSqlIdentifier(tableName);
  safeSqlIdentifier(column.name);

  return `ALTER TABLE ${safeTableName} ADD COLUMN ${column.definition};`;
}

async function addColumnIfMissing(
  db: MigrationDatabase,
  tableName: string,
  columnNames: Set<string>,
  column: ColumnDefinition,
): Promise<void> {
  if (hasTableColumn(columnNames, column.name)) {
    return;
  }

  try {
    await db.execute(getAddColumnStatement(tableName, column));
  } catch (error) {
    const refreshedColumnNames = await getTableColumnNames(db, tableName);
    if (!hasTableColumn(refreshedColumnNames, column.name)) {
      throw error;
    }
  }
  columnNames.add(column.name);
}

function hasAllColumns(
  columnNames: ReadonlySet<string>,
  columns: readonly ColumnDefinition[],
): boolean {
  return columns.every((column) => hasTableColumn(columnNames, column.name));
}

async function recordMigrationKey(db: MigrationDatabase, key: string): Promise<void> {
  await db.execute({
    sql: `INSERT INTO _migrations (key) VALUES (?) ON CONFLICT(key) DO NOTHING;`,
    args: [key],
  });
}

async function runPortfolioV2SessionColumnsMigration(db: MigrationDatabase): Promise<void> {
  if (!(await tableExists(db, PORTFOLIO_CHALLENGE_ATTEMPTS_TABLE))) {
    return;
  }

  const columnNames = await getTableColumnNames(db, PORTFOLIO_CHALLENGE_ATTEMPTS_TABLE);
  for (const column of PORTFOLIO_V2_SESSION_COLUMN_DEFINITIONS) {
    await addColumnIfMissing(db, PORTFOLIO_CHALLENGE_ATTEMPTS_TABLE, columnNames, column);
  }

  if (hasAllColumns(columnNames, PORTFOLIO_V2_SESSION_COLUMN_DEFINITIONS)) {
    await recordMigrationKey(db, PORTFOLIO_V2_SESSION_COLUMNS_MIGRATION_KEY);
  }
}

async function runSpokenMissionWrittenSupportMigration(db: MigrationDatabase): Promise<void> {
  if (!(await tableExists(db, SPOKEN_MISSION_ATTEMPTS_TABLE))) {
    return;
  }

  const columnNames = await getTableColumnNames(db, SPOKEN_MISSION_ATTEMPTS_TABLE);
  await addColumnIfMissing(
    db,
    SPOKEN_MISSION_ATTEMPTS_TABLE,
    columnNames,
    SPOKEN_MISSION_WRITTEN_SUPPORT_COLUMN,
  );
  await recordMigrationKey(db, SPOKEN_MISSION_WRITTEN_SUPPORT_MIGRATION_KEY);
}

async function runSpokenMissionSingleInProgressMigration(db: MigrationDatabase): Promise<void> {
  if (!(await tableExists(db, SPOKEN_MISSION_ATTEMPTS_TABLE))) {
    return;
  }

  const columnNames = await getTableColumnNames(db, SPOKEN_MISSION_ATTEMPTS_TABLE);
  if (
    !SPOKEN_MISSION_SINGLE_IN_PROGRESS_REQUIRED_COLUMNS.every((columnName) =>
      columnNames.has(columnName),
    )
  ) {
    return;
  }

  await db.batch([
    `UPDATE user_spoken_missions
SET status = 'abandoned', updated_at = datetime('now')
WHERE rowid IN (
  SELECT rowid
  FROM (
    SELECT
      rowid,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, mission_id
        ORDER BY datetime(updated_at) DESC, rowid DESC
      ) AS active_position
    FROM user_spoken_missions
    WHERE status = 'in_progress'
  )
  WHERE active_position > 1
);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_spoken_missions_single_in_progress
ON user_spoken_missions(user_id, mission_id)
WHERE status = 'in_progress';`,
    {
      sql: `INSERT INTO _migrations (key) VALUES (?) ON CONFLICT(key) DO NOTHING;`,
      args: [SPOKEN_MISSION_SINGLE_IN_PROGRESS_MIGRATION_KEY],
    },
  ]);
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

    await recordMigrationKey(db, USER_XP_MISSION_REASONS_MIGRATION_KEY);
  }

  const migrationResult = await db.execute({
    sql: `SELECT 1 FROM _migrations WHERE key = ? LIMIT 1;`,
    args: [PORTFOLIO_V2_SESSION_COLUMNS_MIGRATION_KEY],
  });

  if (migrationResult.rows.length === 0) {
    await runPortfolioV2SessionColumnsMigration(db);
  }

  const spokenMissionWrittenSupportMigration = await db.execute({
    sql: `SELECT 1 FROM _migrations WHERE key = ? LIMIT 1;`,
    args: [SPOKEN_MISSION_WRITTEN_SUPPORT_MIGRATION_KEY],
  });

  if (spokenMissionWrittenSupportMigration.rows.length === 0) {
    await runSpokenMissionWrittenSupportMigration(db);
  }

  const spokenMissionSingleInProgressMigration = await db.execute({
    sql: `SELECT 1 FROM _migrations WHERE key = ? LIMIT 1;`,
    args: [SPOKEN_MISSION_SINGLE_IN_PROGRESS_MIGRATION_KEY],
  });

  if (spokenMissionSingleInProgressMigration.rows.length === 0) {
    await runSpokenMissionSingleInProgressMigration(db);
  }
}
