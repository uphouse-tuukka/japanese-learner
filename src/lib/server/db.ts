import { createClient, type Client, type InStatement } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { config } from '$lib/config';
import type {
Exercise,
Session,
SessionExercise,
SessionMode,
SessionStatus,
TokenUsage,
User,
UserLevel
} from '$lib/types';

let dbClient: Client | null = null;
let databaseInitPromise: Promise<void> | null = null;

function requiredValue(name: string, value: string): string {
const normalized = value.trim();
if (!normalized) {
throw new Error(`[db] Missing configuration value: ${name}`);
}
return normalized;
}

function nowIso(): string {
return new Date().toISOString();
}

function asString(value: unknown, fallback = ''): string {
return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
if (typeof value === 'number' && Number.isFinite(value)) return value;
if (typeof value === 'bigint') return Number(value);
if (typeof value === 'string') {
const parsed = Number(value);
return Number.isFinite(parsed) ? parsed : fallback;
}
return fallback;
}

function asIso(value: unknown): string {
if (typeof value === 'string' && value.trim()) {
const parsed = new Date(value);
if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
}
return nowIso();
}

function parseExercise(contentJson: unknown): Exercise {
if (typeof contentJson !== 'string' || !contentJson.trim()) {
throw new Error('[db] Missing exercise content_json');
}
return JSON.parse(contentJson) as Exercise;
}

function mapUserRow(row: Record<string, unknown>): User {
return {
id: asString(row.id),
name: asString(row.name),
level: asString(row.level) as UserLevel,
createdAt: asIso(row.created_at),
updatedAt: asIso(row.updated_at),
lastActiveAt: row.last_active_at ? asIso(row.last_active_at) : null
};
}

function mapSessionRow(row: Record<string, unknown>): Session {
return {
id: asString(row.id),
userId: asString(row.user_id),
mode: asString(row.mode) as SessionMode,
status: asString(row.status) as SessionStatus,
model: row.model ? asString(row.model) : null,
tokenInput: asNumber(row.token_input),
tokenOutput: asNumber(row.token_output),
summary: row.summary ? asString(row.summary) : null,
createdAt: asIso(row.created_at),
completedAt: row.completed_at ? asIso(row.completed_at) : null
};
}

function mapTokenUsageRow(row: Record<string, unknown>): TokenUsage {
return {
id: asString(row.id),
userId: asString(row.user_id),
sessionId: row.session_id ? asString(row.session_id) : null,
model: asString(row.model),
tokensIn: asNumber(row.tokens_in),
tokensOut: asNumber(row.tokens_out),
tokensTotal: asNumber(row.tokens_total),
createdAt: asIso(row.created_at)
};
}

function getClient(): Client {
if (!dbClient) {
dbClient = createClient({
url: requiredValue('config.turso.databaseUrl', config.turso.databaseUrl),
authToken: requiredValue('config.turso.authToken', config.turso.authToken)
});
}
return dbClient;
}

export async function initializeDatabase(): Promise<void> {
if (!databaseInitPromise) {
databaseInitPromise = (async () => {
const db = getClient();
const schemaStatements: InStatement[] = [
`PRAGMA foreign_keys = ON;`,
`CREATE TABLE IF NOT EXISTS users (
id TEXT PRIMARY KEY,
name TEXT NOT NULL,
level TEXT NOT NULL,
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
FOREIGN KEY (user_id) REFERENCES users(id),
FOREIGN KEY (session_id) REFERENCES sessions(id)
);`,
`CREATE INDEX IF NOT EXISTS idx_sessions_user_created_at ON sessions(user_id, created_at);`,
`CREATE INDEX IF NOT EXISTS idx_exercises_seed ON exercises(is_seed);`,
`CREATE INDEX IF NOT EXISTS idx_results_user_created_at ON user_exercise_results(user_id, created_at);`,
`CREATE INDEX IF NOT EXISTS idx_results_exercise_created_at ON user_exercise_results(exercise_id, created_at);`,
`CREATE INDEX IF NOT EXISTS idx_token_usage_user_created_at ON token_usage(user_id, created_at);`,
`CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at);`
];

await db.batch(schemaStatements);
console.info('[db] schema initialized');
})();
}

await databaseInitPromise;
}

export async function getDb(): Promise<Client> {
await initializeDatabase();
return getClient();
}

export async function listUsers(): Promise<User[]> {
const db = await getDb();
const result = await db.execute({
sql: `
SELECT
u.id,
u.name,
u.level,
u.created_at,
u.updated_at,
(SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_active_at
FROM users u
ORDER BY datetime(u.created_at) ASC
`
});
return result.rows.map((row) => mapUserRow(row as Record<string, unknown>));
}

export async function getUserById(userId: string): Promise<User | null> {
const db = await getDb();
const result = await db.execute({
sql: `
SELECT
u.id,
u.name,
u.level,
u.created_at,
u.updated_at,
(SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_active_at
FROM users u
WHERE u.id = ?
LIMIT 1
`,
args: [userId]
});
if (!result.rows[0]) return null;
return mapUserRow(result.rows[0] as Record<string, unknown>);
}

export async function insertUser(input: { id?: string; name: string; level: UserLevel }): Promise<User> {
const db = await getDb();
const id = input.id ?? `user-${randomUUID()}`;
const timestamp = nowIso();
await db.execute({
sql: `INSERT INTO users (id, name, level, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
args: [id, input.name, input.level, timestamp, timestamp]
});
return {
id,
name: input.name,
level: input.level,
createdAt: timestamp,
updatedAt: timestamp,
lastActiveAt: null
};
}

export async function createUser(name: string, level: UserLevel): Promise<User> {
	return insertUser({ name, level });
}

export async function updateUserLevel(userId: string, level: UserLevel): Promise<void> {
const db = await getDb();
await db.execute({
sql: `UPDATE users SET level = ?, updated_at = ? WHERE id = ?`,
args: [level, nowIso(), userId]
});
}

export async function countSeedExercises(): Promise<number> {
const db = await getDb();
const result = await db.execute({ sql: `SELECT COUNT(*) AS total FROM exercises WHERE is_seed = 1` });
return asNumber((result.rows[0] as Record<string, unknown> | undefined)?.total, 0);
}

export async function upsertExercise(exercise: Exercise, isSeed = false, createdByUserId: string | null = null): Promise<void> {
const db = await getDb();
await db.execute({
sql: `
INSERT INTO exercises (id, type, title, content_json, is_seed, created_by_user_id)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
type = excluded.type,
title = excluded.title,
content_json = excluded.content_json,
is_seed = excluded.is_seed,
created_by_user_id = COALESCE(excluded.created_by_user_id, exercises.created_by_user_id)
`,
args: [exercise.id, exercise.type, exercise.title, JSON.stringify(exercise), isSeed ? 1 : 0, createdByUserId]
});
}

export async function listSeedExercises(): Promise<Exercise[]> {
const db = await getDb();
const result = await db.execute({
sql: `SELECT content_json FROM exercises WHERE is_seed = 1 ORDER BY id ASC`
});
return result.rows.map((row) => parseExercise((row as Record<string, unknown>).content_json));
}

export async function createSession(input: {
id?: string;
userId: string;
mode: SessionMode;
status?: SessionStatus;
model?: string | null;
tokenInput?: number;
tokenOutput?: number;
summary?: string | null;
createdAt?: string;
}): Promise<Session> {
const db = await getDb();
const session: Session = {
id: input.id ?? `session-${randomUUID()}`,
userId: input.userId,
mode: input.mode,
status: input.status ?? 'planned',
model: input.model ?? null,
tokenInput: Math.max(0, Math.floor(input.tokenInput ?? 0)),
tokenOutput: Math.max(0, Math.floor(input.tokenOutput ?? 0)),
summary: input.summary ?? null,
createdAt: input.createdAt ?? nowIso(),
completedAt: null
};

await db.execute({
sql: `
INSERT INTO sessions (id, user_id, mode, status, model, token_input, token_output, summary, created_at, completed_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
args: [
session.id,
session.userId,
session.mode,
session.status,
session.model,
session.tokenInput,
session.tokenOutput,
session.summary,
session.createdAt,
session.completedAt
]
});

return session;
}

export const insertSession = createSession;
export const saveSession = createSession;

export async function createSessionExercises(sessionId: string, exercises: SessionExercise[] | Exercise[]): Promise<void> {
const db = await getDb();
const normalized = exercises.map((row, index) => {
if ('exercise' in row) {
return row;
}
return {
sessionId,
exerciseId: row.id,
orderIndex: index,
exercise: row
} satisfies SessionExercise;
});

for (const row of normalized) {
await upsertExercise(row.exercise, false);
await db.execute({
sql: `
INSERT INTO session_exercises (session_id, exercise_id, order_index)
VALUES (?, ?, ?)
ON CONFLICT(session_id, order_index) DO UPDATE SET exercise_id = excluded.exercise_id
`,
args: [sessionId, row.exerciseId, row.orderIndex]
});
}
}

export const insertSessionExercises = createSessionExercises;
export const saveSessionExercises = createSessionExercises;

export async function getSession(sessionId: string): Promise<Session | null> {
const db = await getDb();
const result = await db.execute({
sql: `
SELECT id, user_id, mode, status, model, token_input, token_output, summary, created_at, completed_at
FROM sessions WHERE id = ? LIMIT 1
`,
args: [sessionId]
});
if (!result.rows[0]) return null;
return mapSessionRow(result.rows[0] as Record<string, unknown>);
}

export async function getSessionExercises(sessionId: string): Promise<SessionExercise[]> {
const db = await getDb();
const result = await db.execute({
sql: `
SELECT se.session_id, se.exercise_id, se.order_index, e.content_json
FROM session_exercises se
JOIN exercises e ON e.id = se.exercise_id
WHERE se.session_id = ?
ORDER BY se.order_index ASC
`,
args: [sessionId]
});

return result.rows.map((row) => {
const record = row as Record<string, unknown>;
const exercise = parseExercise(record.content_json);
return {
sessionId: asString(record.session_id),
exerciseId: asString(record.exercise_id),
orderIndex: asNumber(record.order_index),
exercise
};
});
}

export async function getTodaySessionForUser(userId: string): Promise<{ session: Session; exercises: SessionExercise[] } | null> {
const db = await getDb();
const todayStart = new Date();
todayStart.setUTCHours(0, 0, 0, 0);
const tomorrowStart = new Date(todayStart);
tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

const result = await db.execute({
sql: `
SELECT id, user_id, mode, status, model, token_input, token_output, summary, created_at, completed_at
FROM sessions
WHERE user_id = ? AND created_at >= ? AND created_at < ?
ORDER BY datetime(created_at) DESC
LIMIT 1
`,
args: [userId, todayStart.toISOString(), tomorrowStart.toISOString()]
});

if (!result.rows[0]) return null;
const session = mapSessionRow(result.rows[0] as Record<string, unknown>);
const exercises = await getSessionExercises(session.id);
return { session, exercises };
}

export async function createExerciseResults(input: {
userId: string;
sessionId: string;
results: Array<{ exerciseId: string; answerText: string; isCorrect: boolean; mode?: SessionMode; createdAt?: string }>;
mode?: SessionMode;
}): Promise<void> {
const db = await getDb();
for (const result of input.results) {
await db.execute({
sql: `
INSERT INTO user_exercise_results (id, user_id, session_id, exercise_id, mode, is_correct, answer_text, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`,
args: [
`result-${randomUUID()}`,
input.userId,
input.sessionId,
result.exerciseId,
result.mode ?? input.mode ?? 'ai',
result.isCorrect ? 1 : 0,
result.answerText,
result.createdAt ?? nowIso()
]
});
}
}

export const insertExerciseResults = createExerciseResults;
export const saveExerciseResults = createExerciseResults;

export async function completeSession(
sessionId: string,
input: { status?: SessionStatus; completedAt?: string; summary?: string | null; tokenInput?: number; tokenOutput?: number }
): Promise<void> {
const db = await getDb();
await db.execute({
sql: `
UPDATE sessions
SET status = ?, completed_at = ?, summary = COALESCE(?, summary), token_input = token_input + ?, token_output = token_output + ?
WHERE id = ?
`,
args: [
input.status ?? 'completed',
input.completedAt ?? nowIso(),
input.summary ?? null,
Math.max(0, Math.floor(input.tokenInput ?? 0)),
Math.max(0, Math.floor(input.tokenOutput ?? 0)),
sessionId
]
});
}

export const markSessionCompleted = completeSession;
export const updateSessionStatus = completeSession;
export const completeSessionRecord = completeSession;
export const createSessionRecord = createSession;
export const attachExercisesToSession = createSessionExercises;

export async function getRandomExercises(limit: number): Promise<Exercise[]> {
	const safeLimit = Math.max(1, Math.floor(limit));
	const db = await getDb();
	const result = await db.execute({
		sql: `SELECT content_json FROM exercises ORDER BY RANDOM() LIMIT ?`,
		args: [safeLimit]
	});
	return result.rows.map((row) => parseExercise((row as Record<string, unknown>).content_json));
}

export async function getHistoryByUser(userId: string): Promise<
	Array<{
		session: Session;
		exerciseCount: number;
		correctCount: number;
		accuracy: number;
	}>
> {
	const db = await getDb();
	const sessions = await db.execute({
		sql: `
		SELECT id, user_id, mode, status, model, token_input, token_output, summary, created_at, completed_at
		FROM sessions
		WHERE user_id = ?
		ORDER BY datetime(created_at) DESC
		`,
		args: [userId]
	});

	const history: Array<{
		session: Session;
		exerciseCount: number;
		correctCount: number;
		accuracy: number;
	}> = [];

	for (const row of sessions.rows as Array<Record<string, unknown>>) {
		const sessionId = asString(row.id);
		const [exerciseCountRow, scoreRow] = await Promise.all([
			db.execute({
				sql: `SELECT COUNT(*) AS total FROM session_exercises WHERE session_id = ?`,
				args: [sessionId]
			}),
			db.execute({
				sql: `SELECT COUNT(*) AS total, COALESCE(SUM(is_correct), 0) AS correct FROM user_exercise_results WHERE session_id = ?`,
				args: [sessionId]
			})
		]);

		const exerciseCount = asNumber((exerciseCountRow.rows[0] as Record<string, unknown> | undefined)?.total, 0);
		const answeredCount = asNumber((scoreRow.rows[0] as Record<string, unknown> | undefined)?.total, 0);
		const correctCount = asNumber((scoreRow.rows[0] as Record<string, unknown> | undefined)?.correct, 0);
		const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

		history.push({
			session: mapSessionRow(row),
			exerciseCount,
			correctCount,
			accuracy
		});
	}

	return history;
}

export async function createSessionSummary(input: {
sessionId: string;
summary: { summary?: string; [key: string]: unknown } | string;
}): Promise<void> {
const summaryText =
typeof input.summary === 'string'
? input.summary
: JSON.stringify(input.summary);
await completeSession(input.sessionId, { summary: summaryText });
}

export const insertSessionSummary = createSessionSummary;
export const saveSessionSummary = createSessionSummary;

export async function recordTokenUsage(input: {
id?: string;
userId: string;
sessionId?: string | null;
model: string;
tokensIn: number;
tokensOut: number;
createdAt?: string;
}): Promise<TokenUsage> {
const db = await getDb();
const usage: TokenUsage = {
id: input.id ?? `tok-${randomUUID()}`,
userId: input.userId,
sessionId: input.sessionId ?? null,
model: input.model,
tokensIn: Math.max(0, Math.floor(input.tokensIn)),
tokensOut: Math.max(0, Math.floor(input.tokensOut)),
tokensTotal: Math.max(0, Math.floor(input.tokensIn)) + Math.max(0, Math.floor(input.tokensOut)),
createdAt: input.createdAt ?? nowIso()
};

await db.execute({
sql: `
INSERT INTO token_usage (id, user_id, session_id, model, tokens_in, tokens_out, tokens_total, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`,
args: [
usage.id,
usage.userId,
usage.sessionId,
usage.model,
usage.tokensIn,
usage.tokensOut,
usage.tokensTotal,
usage.createdAt
]
});

return usage;
}

export const insertTokenUsage = recordTokenUsage;
export const createTokenUsage = recordTokenUsage;

export async function listTokenUsageForRange(startIso: string, endIso: string, userId?: string): Promise<TokenUsage[]> {
const db = await getDb();
const result = await db.execute({
sql: userId
? `
SELECT id, user_id, session_id, model, tokens_in, tokens_out, tokens_total, created_at
FROM token_usage
WHERE user_id = ? AND created_at >= ? AND created_at < ?
ORDER BY datetime(created_at) DESC
`
: `
SELECT id, user_id, session_id, model, tokens_in, tokens_out, tokens_total, created_at
FROM token_usage
WHERE created_at >= ? AND created_at < ?
ORDER BY datetime(created_at) DESC
`,
args: userId ? [userId, startIso, endIso] : [startIso, endIso]
});
return result.rows.map((row) => mapTokenUsageRow(row as Record<string, unknown>));
}
