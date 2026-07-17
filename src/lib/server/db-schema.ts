import type { InStatement } from '@libsql/client';

export function getSchemaStatements(): InStatement[] {
  return [
    `PRAGMA foreign_keys = ON;`,
    `CREATE TABLE IF NOT EXISTS users (
id TEXT PRIMARY KEY,
name TEXT NOT NULL,
level TEXT NOT NULL,
progress_journal TEXT DEFAULT NULL,
japanese_writing_enabled INTEGER NOT NULL DEFAULT 0,
created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`,
    `CREATE TABLE IF NOT EXISTS sessions (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL,
mode TEXT NOT NULL,
status TEXT NOT NULL,
model TEXT,
token_input INTEGER NOT NULL DEFAULT 0,
token_output INTEGER NOT NULL DEFAULT 0,
summary TEXT,
created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
completed_at TEXT,
FOREIGN KEY (user_id) REFERENCES users(id)
);`,
    `CREATE TABLE IF NOT EXISTS exercises (
id TEXT PRIMARY KEY,
type TEXT NOT NULL,
title TEXT NOT NULL,
content_json TEXT NOT NULL,
is_seed INTEGER NOT NULL DEFAULT 0,
created_by_user_id TEXT,
created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);`,
    `CREATE TABLE IF NOT EXISTS session_exercises (
session_id TEXT NOT NULL,
exercise_id TEXT NOT NULL,
order_index INTEGER NOT NULL,
PRIMARY KEY (session_id, order_index),
FOREIGN KEY (session_id) REFERENCES sessions(id),
FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);`,
    `CREATE TABLE IF NOT EXISTS user_exercise_results (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL,
session_id TEXT,
exercise_id TEXT NOT NULL,
mode TEXT NOT NULL,
is_correct INTEGER NOT NULL,
answer_text TEXT,
created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (user_id) REFERENCES users(id),
FOREIGN KEY (session_id) REFERENCES sessions(id),
FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);`,
    `CREATE TABLE IF NOT EXISTS token_usage (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL,
session_id TEXT,
model TEXT NOT NULL,
tokens_in INTEGER NOT NULL,
tokens_out INTEGER NOT NULL,
tokens_total INTEGER NOT NULL,
created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (user_id) REFERENCES users(id)
);`,
    `CREATE TABLE IF NOT EXISTS user_xp (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL,
session_id TEXT,
amount INTEGER NOT NULL,
reason TEXT NOT NULL CHECK(reason IN ('exercise_correct','session_complete','perfect_score','streak_bonus','combo_bonus','mission_complete','mission_correct_response','mission_natural_phrasing')),
created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (user_id) REFERENCES users(id)
);`,
    `CREATE TABLE IF NOT EXISTS user_streaks (
user_id TEXT PRIMARY KEY,
current_streak INTEGER NOT NULL DEFAULT 0,
longest_streak INTEGER NOT NULL DEFAULT 0,
last_activity_date TEXT,
daily_goal_met INTEGER NOT NULL DEFAULT 0,
updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (user_id) REFERENCES users(id)
);`,
    `CREATE TABLE IF NOT EXISTS user_milestones (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL,
milestone_key TEXT NOT NULL,
xp_at_unlock INTEGER NOT NULL,
created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
UNIQUE(user_id, milestone_key),
FOREIGN KEY (user_id) REFERENCES users(id)
);`,
    `CREATE TABLE IF NOT EXISTS missions (
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
    `CREATE TABLE IF NOT EXISTS user_missions (
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
    `CREATE TABLE IF NOT EXISTS user_spoken_missions (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL,
mission_id TEXT NOT NULL,
definition_version TEXT NOT NULL,
status TEXT NOT NULL CHECK(status IN ('in_progress', 'completed', 'incomplete', 'abandoned')) DEFAULT 'in_progress',
current_turn INTEGER NOT NULL DEFAULT 1 CHECK(current_turn BETWEEN 1 AND 3),
support_used INTEGER NOT NULL DEFAULT 0 CHECK(support_used IN (0, 1)),
current_turn_support_used INTEGER NOT NULL DEFAULT 0 CHECK(current_turn_support_used IN (0, 1)),
current_turn_written_support_revealed INTEGER NOT NULL DEFAULT 0 CHECK(current_turn_written_support_revealed IN (0, 1)),
successful_turn_count INTEGER NOT NULL DEFAULT 0 CHECK(successful_turn_count BETWEEN 0 AND 3),
wording_variant INTEGER NOT NULL DEFAULT 0 CHECK(wording_variant >= 0),
conversation_log TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(conversation_log)),
evidence_state TEXT CHECK(evidence_state IN ('supported', 'independent')),
completed_at TEXT,
created_at TEXT NOT NULL DEFAULT (datetime('now')),
updated_at TEXT NOT NULL DEFAULT (datetime('now')),
CHECK(
  (status = 'completed' AND evidence_state IS NOT NULL AND completed_at IS NOT NULL AND successful_turn_count = 3)
  OR
  (status = 'incomplete' AND evidence_state IS NULL AND completed_at IS NOT NULL)
  OR
  (status IN ('in_progress', 'abandoned') AND evidence_state IS NULL AND completed_at IS NULL)
)
);`,
    `CREATE TABLE IF NOT EXISTS user_badges (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL,
mission_id TEXT NOT NULL,
badge_emoji TEXT NOT NULL,
badge_name TEXT NOT NULL,
badge_statement TEXT NOT NULL,
earned_at TEXT NOT NULL DEFAULT (datetime('now')),
UNIQUE(user_id, mission_id)
);`,
    `CREATE TABLE IF NOT EXISTS user_mission_limits (
user_id TEXT NOT NULL,
date TEXT NOT NULL,
missions_used INTEGER NOT NULL DEFAULT 0,
PRIMARY KEY (user_id, date)
);`,
    `CREATE TABLE IF NOT EXISTS portfolio_challenge_attempts (
id TEXT PRIMARY KEY,
cookie_id TEXT NOT NULL,
ip_hash TEXT NOT NULL,
status TEXT NOT NULL CHECK(status IN ('started', 'completed', 'blocked', 'expired')),
started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
completed_at TEXT,
expires_at TEXT NOT NULL
);`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user_created_at ON sessions(user_id, created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_exercises_seed ON exercises(is_seed);`,
    `CREATE INDEX IF NOT EXISTS idx_results_user_created_at ON user_exercise_results(user_id, created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_results_exercise_created_at ON user_exercise_results(exercise_id, created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_token_usage_user_created_at ON token_usage(user_id, created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_user_xp_user_id ON user_xp(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_user_xp_session_id ON user_xp(session_id);`,
    `CREATE INDEX IF NOT EXISTS idx_user_milestones_user_id ON user_milestones(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_user_missions_user ON user_missions(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_user_missions_mission ON user_missions(mission_id);`,
    `CREATE INDEX IF NOT EXISTS idx_user_spoken_missions_user_mission ON user_spoken_missions(user_id, mission_id);`,
    `CREATE INDEX IF NOT EXISTS idx_user_spoken_missions_resumable ON user_spoken_missions(user_id, mission_id, status, updated_at);`,
    `CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_missions_category ON missions(category);`,
    `CREATE INDEX IF NOT EXISTS idx_portfolio_attempts_cookie ON portfolio_challenge_attempts(cookie_id, started_at);`,
    `CREATE INDEX IF NOT EXISTS idx_portfolio_attempts_ip ON portfolio_challenge_attempts(ip_hash, started_at);`,
    `CREATE INDEX IF NOT EXISTS idx_portfolio_attempts_expires ON portfolio_challenge_attempts(expires_at);`,
  ];
}
