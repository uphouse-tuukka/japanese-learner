import { describe, expect, it } from 'vitest';
import { getSchemaStatements } from './db-schema';

function sqlText(statement: unknown): string {
  if (typeof statement === 'string') return statement;
  if (statement && typeof statement === 'object' && 'sql' in statement) {
    return String((statement as { sql: unknown }).sql);
  }
  return '';
}

describe('getSchemaStatements', () => {
  it('includes the core user/session/exercise table DDL used by database initialization', () => {
    const schemaSql = getSchemaStatements().map(sqlText).join('\n');

    expect(schemaSql).toContain('PRAGMA foreign_keys = ON;');
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS sessions');
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS exercises');
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS user_exercise_results');
  });

  it('includes mission and portfolio tables required by current app flows', () => {
    const schemaSql = getSchemaStatements().map(sqlText).join('\n');

    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS missions');
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS user_missions');
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS user_spoken_missions');
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS user_badges');
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS portfolio_challenge_attempts');
  });

  it('defines constrained, indexed Spoken Mission attempts separately from Written Missions', () => {
    const schemaSql = getSchemaStatements().map(sqlText).join('\n');

    expect(schemaSql).toContain("CHECK(status IN ('in_progress', 'completed', 'abandoned'))");
    expect(schemaSql).toContain("CHECK(evidence_state IN ('supported', 'independent'))");
    expect(schemaSql).toContain('CHECK(current_turn BETWEEN 1 AND 3)');
    expect(schemaSql).toContain(
      'current_turn_support_used INTEGER NOT NULL DEFAULT 0 CHECK(current_turn_support_used IN (0, 1))',
    );
    expect(schemaSql).toContain('CHECK(successful_turn_count BETWEEN 0 AND 3)');
    expect(schemaSql).toContain(
      "status = 'completed' AND evidence_state IS NOT NULL AND completed_at IS NOT NULL AND successful_turn_count = 3",
    );
    expect(schemaSql).toContain(
      'CREATE INDEX IF NOT EXISTS idx_user_spoken_missions_user_mission ON user_spoken_missions(user_id, mission_id);',
    );
    expect(schemaSql).toContain(
      'CREATE INDEX IF NOT EXISTS idx_user_spoken_missions_resumable ON user_spoken_missions(user_id, mission_id, status, updated_at);',
    );
  });

  it('keeps the current token, mission, and portfolio indexes represented', () => {
    const schemaSql = getSchemaStatements().map(sqlText).join('\n');

    expect(schemaSql).toContain(
      'CREATE INDEX IF NOT EXISTS idx_token_usage_user_created_at ON token_usage(user_id, created_at);',
    );
    expect(schemaSql).toContain(
      'CREATE INDEX IF NOT EXISTS idx_user_missions_user ON user_missions(user_id);',
    );
    expect(schemaSql).toContain(
      'CREATE INDEX IF NOT EXISTS idx_portfolio_attempts_cookie ON portfolio_challenge_attempts(cookie_id, started_at);',
    );
  });
});
