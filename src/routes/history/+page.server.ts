import { redirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import type { SessionStatus, User } from '$lib/types';

type SessionMode = 'ai' | 'practice';

type HistorySession = {
	id: string;
	userId: string;
	date: string;
	mode: SessionMode;
	status: SessionStatus;
	score: number | null;
	topics: string[];
	strengths: string[];
	weaknesses: string[];
	focusAreas: string[];
	summaryText: string | null;
};

type HistoryStats = {
	totalSessionsCompleted: number;
	averageScore: number;
	currentStreak: number;
	bestStreak: number;
	sessionsThisWeek: number;
	sessionsThisMonth: number;
	breakdown: {
		ai: number;
		practice: number;
	};
};

type SummaryDetails = {
	summaryText: string | null;
	strengths: string[];
	weaknesses: string[];
	focusAreas: string[];
};

function parseSelectedUserId(cookies: Cookies): string | null {
	const explicit = cookies.get('selected_user_id') ?? cookies.get('user_id');
	if (explicit && explicit.trim()) return explicit.trim();

	const encoded = cookies.get('selected_user');
	if (!encoded) return null;

	try {
		const parsed = JSON.parse(encoded) as { id?: unknown };
		if (typeof parsed.id === 'string' && parsed.id.trim()) {
			return parsed.id.trim();
		}
	} catch {
		// Ignore malformed cookie.
	}

	return null;
}

function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => (typeof item === 'string' ? item.trim() : ''))
		.filter((item) => item.length > 0);
}

function parseSummary(summary: string | null): SummaryDetails {
	if (!summary || summary.trim().length === 0) {
		return {
			summaryText: null,
			strengths: [],
			weaknesses: [],
			focusAreas: []
		};
	}

	try {
		const parsed = JSON.parse(summary) as {
			summary?: unknown;
			strengths?: unknown;
			weaknesses?: unknown;
			nextSteps?: unknown;
			focusAreas?: unknown;
		};

		return {
			summaryText:
				typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
					? parsed.summary.trim()
					: summary,
			strengths: toStringArray(parsed.strengths),
			weaknesses: toStringArray(parsed.weaknesses),
			focusAreas: [...toStringArray(parsed.focusAreas), ...toStringArray(parsed.nextSteps)]
		};
	} catch {
		return {
			summaryText: summary,
			strengths: [],
			weaknesses: [],
			focusAreas: []
		};
	}
}

function dayKey(isoDate: string): string {
	return isoDate.slice(0, 10);
}

function utcMidnightTimestamp(day: string): number {
	return Date.parse(`${day}T00:00:00.000Z`);
}

function getWeekStartUtc(now: Date): Date {
	const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	const currentDay = start.getUTCDay();
	const daysFromMonday = (currentDay + 6) % 7;
	start.setUTCDate(start.getUTCDate() - daysFromMonday);
	return start;
}

function calculateStats(sessions: HistorySession[]): HistoryStats {
	const completedSessions = sessions.filter((session) => session.status === 'completed');
	const scoredSessions = completedSessions.filter((session) => session.score !== null);

	const averageScore =
		scoredSessions.length === 0
			? 0
			: Math.round(
					(scoredSessions.reduce((total, session) => total + (session.score ?? 0), 0) /
						scoredSessions.length) *
						10
				) / 10;

	const now = new Date();
	const weekStart = getWeekStartUtc(now).getTime();
	const nowMonth = now.getUTCMonth();
	const nowYear = now.getUTCFullYear();

	let sessionsThisWeek = 0;
	let sessionsThisMonth = 0;

	for (const session of completedSessions) {
		const sessionDate = new Date(session.date);
		const sessionTime = sessionDate.getTime();
		if (sessionTime >= weekStart) sessionsThisWeek += 1;
		if (sessionDate.getUTCMonth() === nowMonth && sessionDate.getUTCFullYear() === nowYear) {
			sessionsThisMonth += 1;
		}
	}

	const completedDaySet = new Set(completedSessions.map((session) => dayKey(session.date)));
	const orderedDays = [...completedDaySet].sort();

	let bestStreak = 0;
	let running = 0;
	let previousDayTimestamp = -1;

	for (const day of orderedDays) {
		const ts = utcMidnightTimestamp(day);
		if (previousDayTimestamp === -1 || ts - previousDayTimestamp !== 86_400_000) {
			running = 1;
		} else {
			running += 1;
		}
		bestStreak = Math.max(bestStreak, running);
		previousDayTimestamp = ts;
	}

	const today = dayKey(now.toISOString());
	const yesterdayTs = utcMidnightTimestamp(today) - 86_400_000;
	const yesterday = new Date(yesterdayTs).toISOString().slice(0, 10);
	const streakAnchor = completedDaySet.has(today) ? today : completedDaySet.has(yesterday) ? yesterday : null;

	let currentStreak = 0;
	if (streakAnchor) {
		let cursor = utcMidnightTimestamp(streakAnchor);
		while (completedDaySet.has(new Date(cursor).toISOString().slice(0, 10))) {
			currentStreak += 1;
			cursor -= 86_400_000;
		}
	}

	let ai = 0;
	let practice = 0;
	for (const session of sessions) {
		if (session.mode === 'ai') ai += 1;
		if (session.mode === 'practice') practice += 1;
	}

	return {
		totalSessionsCompleted: completedSessions.length,
		averageScore,
		currentStreak,
		bestStreak,
		sessionsThisWeek,
		sessionsThisMonth,
		breakdown: {
			ai,
			practice
		}
	};
}

export const load: PageServerLoad = async ({ cookies }) => {
	const selectedUserId = parseSelectedUserId(cookies);
	if (!selectedUserId) {
		throw redirect(303, '/');
	}

	const db = await getDb();

	const userResult = await db.execute({
		sql: `
			SELECT id, name, level, created_at, updated_at
			FROM users
			WHERE id = ?
			LIMIT 1
		`,
		args: [selectedUserId]
	});

	if (userResult.rows.length === 0) {
		throw redirect(303, '/');
	}

	const userRow = userResult.rows[0] as Record<string, unknown>;
	const user: User = {
		id: String(userRow.id),
		name: String(userRow.name),
		level: String(userRow.level) as User['level'],
		createdAt: String(userRow.created_at),
		updatedAt: String(userRow.updated_at)
	};

	const [sessionsResult, topicResult] = await Promise.all([
		db.execute({
			sql: `
				SELECT
					s.id,
					s.user_id,
					s.mode,
					s.status,
					s.summary,
					COALESCE(s.completed_at, s.created_at) AS session_date,
					COALESCE(results.correct_count, 0) AS correct_count,
					COALESCE(results.total_count, 0) AS total_count
				FROM sessions s
				LEFT JOIN (
					SELECT
						session_id,
						SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
						COUNT(*) AS total_count
					FROM user_exercise_results
					WHERE user_id = ?
					GROUP BY session_id
				) results
				ON results.session_id = s.id
				WHERE s.user_id = ?
				ORDER BY datetime(COALESCE(s.completed_at, s.created_at)) DESC
			`,
			args: [selectedUserId, selectedUserId]
		}),
		db.execute({
			sql: `
				SELECT
					se.session_id,
					GROUP_CONCAT(DISTINCT e.type) AS topics
				FROM session_exercises se
				INNER JOIN exercises e ON e.id = se.exercise_id
				INNER JOIN sessions s ON s.id = se.session_id
				WHERE s.user_id = ?
				GROUP BY se.session_id
			`,
			args: [selectedUserId]
		})
	]);

	const topicsBySession = new Map<string, string[]>();
	for (const row of topicResult.rows as Array<Record<string, unknown>>) {
		const sessionId = String(row.session_id);
		const rawTopics = typeof row.topics === 'string' ? row.topics : '';
		const topics = rawTopics
			.split(',')
			.map((topic) => topic.trim())
			.filter((topic) => topic.length > 0);
		topicsBySession.set(sessionId, topics);
	}

	const sessions: HistorySession[] = (sessionsResult.rows as Array<Record<string, unknown>>).map((row) => {
		const sessionId = String(row.id);
		const totalCount = Number(row.total_count ?? 0);
		const correctCount = Number(row.correct_count ?? 0);
		const summaryData = parseSummary(typeof row.summary === 'string' ? row.summary : null);

		return {
			id: sessionId,
			userId: String(row.user_id),
			date: String(row.session_date),
			mode: String(row.mode) === 'practice' ? 'practice' : 'ai',
			status: (String(row.status) || 'planned') as SessionStatus,
			score:
				totalCount > 0 ? Math.round((Math.max(0, correctCount) / Math.max(1, totalCount)) * 1000) / 10 : null,
			topics: topicsBySession.get(sessionId) ?? [],
			strengths: summaryData.strengths,
			weaknesses: summaryData.weaknesses,
			focusAreas: summaryData.focusAreas,
			summaryText: summaryData.summaryText
		};
	});

	const stats = calculateStats(sessions);

	return {
		user,
		sessions,
		stats
	};
};
