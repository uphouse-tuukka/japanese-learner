import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getUser } from '$lib/server/users';

type TopicCount = {
topic: string;
count: number;
};

type PracticeHistoryItem = {
id: string;
createdAt: string;
completedAt: string | null;
status: 'planned' | 'completed' | 'error';
exerciseCount: number;
score: number | null;
};

function readSelectedUserId(cookies: { get(name: string): string | undefined }): string | null {
return cookies.get('selected_user') ?? cookies.get('selected_user_id') ?? cookies.get('user_id') ?? null;
}

function parseTopicFromExercise(contentJson: string): string {
try {
const parsed = JSON.parse(contentJson) as { tags?: unknown };
if (Array.isArray(parsed.tags)) {
const firstTag = parsed.tags.find((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0);
if (firstTag) return firstTag;
}
} catch {
// keep fallback
}

return 'mixed_review';
}

export const load: PageServerLoad = async ({ cookies }) => {
const selectedUserId = readSelectedUserId(cookies);
if (!selectedUserId) {
throw redirect(303, '/');
}

const user = await getUser(selectedUserId);
if (!user) {
cookies.delete('selected_user', { path: '/' });
cookies.delete('selected_user_id', { path: '/' });
throw redirect(303, '/');
}

const db = await getDb();

const exerciseRows = await db.execute({
sql: `
SELECT id, content_json
FROM exercises
WHERE is_seed = 1 OR created_by_user_id = ?
`,
args: [user.id]
});

const topicCounter = new Map<string, number>();
for (const row of exerciseRows.rows as Array<Record<string, unknown>>) {
const topic = parseTopicFromExercise(String(row.content_json ?? '{}'));
topicCounter.set(topic, (topicCounter.get(topic) ?? 0) + 1);
}

const byTopic: TopicCount[] = Array.from(topicCounter.entries())
.map(([topic, count]) => ({ topic, count }))
.sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));

const historyRows = await db.execute({
sql: `
SELECT s.id, s.status, s.created_at, s.completed_at, COUNT(se.exercise_id) AS exercise_count
FROM sessions s
LEFT JOIN session_exercises se ON se.session_id = s.id
WHERE s.user_id = ? AND s.mode = 'practice'
GROUP BY s.id
ORDER BY datetime(s.created_at) DESC
LIMIT 20
`,
args: [user.id]
});

const history: PracticeHistoryItem[] = [];
for (const row of historyRows.rows as Array<Record<string, unknown>>) {
const sessionId = String(row.id);
const scoreRows = await db.execute({
sql: `
SELECT COUNT(*) AS total, SUM(is_correct) AS correct
FROM user_exercise_results
WHERE user_id = ? AND session_id = ? AND mode = 'practice'
`,
args: [user.id, sessionId]
});

const scoreRow = scoreRows.rows[0] as Record<string, unknown> | undefined;
const total = Number(scoreRow?.total ?? 0);
const correct = Number(scoreRow?.correct ?? 0);
const score = total > 0 ? Math.round((correct / total) * 100) : null;

history.push({
id: sessionId,
createdAt: String(row.created_at),
completedAt: row.completed_at ? String(row.completed_at) : null,
status: (String(row.status) as PracticeHistoryItem['status']) ?? 'planned',
exerciseCount: Number(row.exercise_count ?? 0),
score
});
}

const reviewedRows = await db.execute({
sql: `
SELECT session_id, COUNT(*) AS total, SUM(is_correct) AS correct
FROM user_exercise_results
WHERE user_id = ? AND mode = 'practice'
GROUP BY session_id
`,
args: [user.id]
});

let exercisesReviewed = 0;
let completedSessions = 0;
let summedAccuracy = 0;

for (const row of reviewedRows.rows as Array<Record<string, unknown>>) {
const total = Number(row.total ?? 0);
const correct = Number(row.correct ?? 0);
exercisesReviewed += total;
if (total > 0) {
completedSessions += 1;
summedAccuracy += correct / total;
}
}

const practiceStats = {
sessionCount: completedSessions,
exercisesReviewed,
averageScore: completedSessions > 0 ? Math.round((summedAccuracy / completedSessions) * 100) : null
};

const exerciseCount = {
total: exerciseRows.rows.length,
byTopic
};

return {
user,
exerciseCount,
practiceStats,
history,
can_practice: exerciseCount.total >= 8
};
};
