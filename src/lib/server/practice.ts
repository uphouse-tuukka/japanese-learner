import { createHash, randomUUID } from 'node:crypto';
import { getDb, listSeedExercises, upsertExercise } from '$lib/server/db';
import seedExercisesData from '$lib/data/seed-exercises.json';
import type { Exercise, SessionPlan } from '$lib/types';

type ExerciseWithMeta = {
exercise: Exercise;
source: 'seed_json' | 'seed_db' | 'user_db';
lastSeenAt: string | null;
lastCorrect: boolean | null;
};

type PracticeOptions = {
exerciseCount?: number;
now?: Date;
};

function requireUserId(userId: string): string {
const normalized = userId.trim();
if (!normalized) {
throw new Error('[practice] userId is required');
}
return normalized;
}

function toExerciseCount(requested: number | undefined, rng: () => number): number {
if (requested !== undefined) {
const count = Math.round(requested);
if (count < 8 || count > 12) {
throw new Error('[practice] exerciseCount must be between 8 and 12');
}
return count;
}
return 8 + Math.floor(rng() * 5);
}

function dayKey(now: Date): string {
return now.toISOString().slice(0, 10);
}

function createDeterministicRng(seed: string): () => number {
let state = 0;
for (const char of seed) {
state = (state * 31 + char.charCodeAt(0)) >>> 0;
}
if (state === 0) state = 0x9e3779b9;

return () => {
state = (state + 0x6d2b79f5) >>> 0;
let temp = Math.imul(state ^ (state >>> 15), 1 | state);
temp ^= temp + Math.imul(temp ^ (temp >>> 7), 61 | temp);
return ((temp ^ (temp >>> 14)) >>> 0) / 4294967296;
};
}

function isExercise(value: unknown): value is Exercise {
if (!value || typeof value !== 'object') return false;
const row = value as Record<string, unknown>;
return typeof row.id === 'string' && typeof row.type === 'string' && typeof row.title === 'string';
}

function toDaysAgo(now: Date, iso: string | null): number {
if (!iso) return Number.POSITIVE_INFINITY;
const timestamp = new Date(iso).getTime();
if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
return Math.max(0, (now.getTime() - timestamp) / 86_400_000);
}

function exerciseWeight(item: ExerciseWithMeta, now: Date): number {
let weight = 1;
if (item.lastCorrect === false) weight += 4;
if (!item.lastSeenAt) weight += 3;

const daysAgo = toDaysAgo(now, item.lastSeenAt);
if (Number.isFinite(daysAgo)) {
weight += Math.min(4, Math.floor(daysAgo / 3));
}
if (item.source === 'user_db') weight += 1;

return Math.max(0.1, weight);
}

function pickWeightedWithoutReplacement(
items: ExerciseWithMeta[],
count: number,
rng: () => number,
now: Date
): ExerciseWithMeta[] {
const pool = items.slice();
const picked: ExerciseWithMeta[] = [];

while (pool.length > 0 && picked.length < count) {
const weights = pool.map((item) => exerciseWeight(item, now));
const totalWeight = weights.reduce((sum, value) => sum + value, 0);
if (totalWeight <= 0) {
picked.push(pool.shift() as ExerciseWithMeta);
continue;
}

let cursor = rng() * totalWeight;
let pickedIndex = 0;
for (let index = 0; index < weights.length; index += 1) {
cursor -= weights[index];
if (cursor <= 0) {
pickedIndex = index;
break;
}
}

const [selected] = pool.splice(pickedIndex, 1);
picked.push(selected);
}

return picked;
}

async function getLatestUserExerciseResults(userId: string): Promise<Map<string, { lastSeenAt: string; lastCorrect: boolean }>> {
const db = await getDb();
const result = await db.execute({
sql: `
SELECT r.exercise_id, r.created_at, r.is_correct
FROM user_exercise_results r
INNER JOIN (
SELECT exercise_id, MAX(created_at) AS max_created_at
FROM user_exercise_results
WHERE user_id = ?
GROUP BY exercise_id
) latest
ON latest.exercise_id = r.exercise_id AND latest.max_created_at = r.created_at
WHERE r.user_id = ?
`,
args: [userId, userId]
});

const map = new Map<string, { lastSeenAt: string; lastCorrect: boolean }>();
for (const row of result.rows as Array<Record<string, unknown>>) {
map.set(String(row.exercise_id), {
lastSeenAt: String(row.created_at),
lastCorrect: Number(row.is_correct) === 1
});
}
return map;
}

async function getUserExercises(userId: string): Promise<ExerciseWithMeta[]> {
const db = await getDb();
const result = await db.execute({
sql: `
SELECT id, content_json
FROM exercises
WHERE created_by_user_id = ?
ORDER BY datetime(created_at) ASC
`,
args: [userId]
});

const rows = result.rows as Array<Record<string, unknown>>;
return rows
.map((row): ExerciseWithMeta | null => {
try {
const parsed = JSON.parse(String(row.content_json)) as Exercise;
if (!parsed.id) parsed.id = String(row.id);
return {
exercise: parsed,
source: 'user_db' as const,
lastSeenAt: null,
lastCorrect: null
};
} catch {
return null;
}
})
.filter((item): item is ExerciseWithMeta => item !== null);
}

export async function getSeedExercises(): Promise<Exercise[]> {
const dbSeedExercises = await listSeedExercises();
if (dbSeedExercises.length > 0) {
return dbSeedExercises;
}

const fallbackExercises = (seedExercisesData as unknown[]).filter(isExercise);
for (const exercise of fallbackExercises) {
await upsertExercise(exercise, true, null);
}
return fallbackExercises;
}

export async function buildPracticeSession(userId: string, options: PracticeOptions = {}): Promise<SessionPlan> {
const validatedUserId = requireUserId(userId);
const now = options.now ?? new Date();
const seed = createHash('sha256')
.update(`${validatedUserId}:${dayKey(now)}:practice`)
.digest('hex');
const rng = createDeterministicRng(seed);
const targetCount = toExerciseCount(options.exerciseCount, rng);

const [seedExercises, userExercises, latestResults] = await Promise.all([
getSeedExercises(),
getUserExercises(validatedUserId),
getLatestUserExerciseResults(validatedUserId)
]);

const uniquePool = new Map<string, ExerciseWithMeta>();
for (const exercise of seedExercises) {
uniquePool.set(exercise.id, {
exercise,
source: 'seed_db',
lastSeenAt: null,
lastCorrect: null
});
}
for (const row of userExercises) {
uniquePool.set(row.exercise.id, row);
}

for (const [exerciseId, latest] of latestResults.entries()) {
const existing = uniquePool.get(exerciseId);
if (existing) {
existing.lastSeenAt = latest.lastSeenAt;
existing.lastCorrect = latest.lastCorrect;
}
}

const pool = Array.from(uniquePool.values());
if (pool.length < 8) {
throw new Error(`[practice] Not enough exercises in pool (${pool.length}) to build session`);
}

const selected = pickWeightedWithoutReplacement(pool, Math.min(targetCount, pool.length), rng, now);
const exercises = selected.map((row) => row.exercise);

const plan: SessionPlan = {
id: `practice-${randomUUID()}`,
userId: validatedUserId,
mode: 'practice',
createdAt: now.toISOString(),
model: null,
exercises,
tokenUsage: null,
metadata: {
focus: 'travel_japanese_review',
exerciseCount: exercises.length,
selectionStrategy: 'weighted_wrong_before_and_not_seen_recently',
poolSize: pool.length,
seedExerciseCount: seedExercises.length,
userExerciseCount: userExercises.length,
rngSeedKey: dayKey(now)
}
};

console.info('[practice] built practice session', {
userId: validatedUserId,
sessionId: plan.id,
exerciseCount: exercises.length
});

return plan;
}
