import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { config } from '$lib/config';
import { getDb } from '$lib/server/db';
import { loadSeedExercises } from '$lib/server/seed';
import { createUser, getUser, getUsers } from '$lib/server/users';
import type { User, UserLevel } from '$lib/types';

const SELECTED_USER_COOKIE = 'selected_user';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function isUserLevel(value: string): value is UserLevel {
return value === 'total-beginner' || value === 'knows-something' || value === 'intermediate';
}

function dayKey(date: Date): string {
return date.toISOString().slice(0, 10);
}

function calculateStreak(days: string[]): number {
if (days.length === 0) return 0;

const uniqueDays = [...new Set(days)].sort((a, b) => (a > b ? -1 : 1));
const daySet = new Set(uniqueDays);
const now = new Date();
const today = dayKey(now);
const yesterdayDate = new Date(now);
yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
const yesterday = dayKey(yesterdayDate);

let cursor = daySet.has(today) ? today : daySet.has(yesterday) ? yesterday : null;
if (!cursor) return 0;

let streak = 0;
while (cursor && daySet.has(cursor)) {
streak += 1;
const previous = new Date(`${cursor}T00:00:00.000Z`);
previous.setUTCDate(previous.getUTCDate() - 1);
cursor = dayKey(previous);
}

return streak;
}

async function loadStatsForUser(userId: string): Promise<{ sessions: number; streak: number }> {
const db = await getDb();
const result = await db.execute({
sql: `
SELECT date
FROM sessions
WHERE user_id = ?
ORDER BY date DESC, created_at DESC
`,
args: [userId]
});

const days = result.rows
.map((row) => {
const value = row.date;
return typeof value === 'string' ? value.slice(0, 10) : null;
})
.filter((value): value is string => Boolean(value));

return {
sessions: result.rows.length,
streak: calculateStreak(days)
};
}

function setSelectedUserCookie(cookies: Parameters<Actions['selectUser']>[0]['cookies'], userId: string): void {
cookies.set(SELECTED_USER_COOKIE, userId, {
path: '/',
maxAge: COOKIE_MAX_AGE,
httpOnly: true,
sameSite: 'lax'
});
}

export const load: PageServerLoad = async ({ cookies }) => {
await loadSeedExercises();

const users = await getUsers();
const selectedUserId = cookies.get(SELECTED_USER_COOKIE);

let selectedUser: User | null = null;
if (selectedUserId) {
selectedUser = await getUser(selectedUserId);
if (!selectedUser) {
cookies.delete(SELECTED_USER_COOKIE, { path: '/' });
}
}

const stats = selectedUser ? await loadStatsForUser(selectedUser.id) : { sessions: 0, streak: 0 };

return {
users,
selectedUser,
stats,
maxUsers: config.limits.maxUsers
};
};

export const actions: Actions = {
createUser: async ({ request, cookies }) => {
const formData = await request.formData();
const name = String(formData.get('name') ?? '').trim();
const level = String(formData.get('level') ?? '').trim();

if (name.length < 1 || name.length > 64) {
return fail(400, { error: 'Name must be between 1 and 64 characters.' });
}

if (!isUserLevel(level)) {
return fail(400, { error: 'Please select a valid level.' });
}

const users = await getUsers();
if (users.length >= config.limits.maxUsers) {
return fail(400, { error: `Maximum users reached (${config.limits.maxUsers}).` });
}

const user = await createUser({ name, level });
setSelectedUserCookie(cookies, user.id);

return {
success: true,
selectedUserId: user.id
};
},
selectUser: async ({ request, cookies }) => {
const formData = await request.formData();
const userId = String(formData.get('user_id') ?? '').trim();

if (!userId) {
return fail(400, { error: 'Please select a user.' });
}

const user = await getUser(userId);
if (!user) {
return fail(404, { error: 'Selected user not found.' });
}

setSelectedUserCookie(cookies, user.id);

return {
success: true,
selectedUserId: user.id
};
}
};
