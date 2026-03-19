import { config } from '$lib/config';
import {
insertUser,
getUserById,
listUsers,
updateUserLevel as updateUserLevelInDb
} from '$lib/server/db';
import type { User, UserLevel } from '$lib/types';

const ALLOWED_LEVELS: UserLevel[] = ['absolute_beginner', 'beginner', 'lower_intermediate'];

function requireUserId(userId: string): string {
const normalized = userId.trim();
if (!normalized) {
throw new Error('[users] userId is required');
}
return normalized;
}

function validateName(name: string): string {
const normalized = name.trim();
if (!normalized) {
throw new Error('[users] name is required');
}
if (normalized.length > 80) {
throw new Error('[users] name must be 80 characters or less');
}
return normalized;
}

function validateLevel(level: string): UserLevel {
if (!ALLOWED_LEVELS.includes(level as UserLevel)) {
throw new Error(`[users] invalid level: ${level}`);
}
return level as UserLevel;
}

export async function getUsers(): Promise<User[]> {
const users = await listUsers();
console.info('[users] fetched users', { count: users.length });
return users;
}

export async function getUser(userId: string): Promise<User | null> {
const id = requireUserId(userId);
const user = await getUserById(id);
console.info('[users] fetched user', { userId: id, found: Boolean(user) });
return user;
}

export async function createUser(input: { name: string; level?: UserLevel }): Promise<User> {
const name = validateName(input.name);
const level = validateLevel(input.level ?? 'absolute_beginner');
const maxUsers = Math.max(1, config.limits.maxUsers);

const users = await listUsers();
if (users.length >= maxUsers) {
throw new Error(`[users] Cannot create user. MAX_USERS (${maxUsers}) reached.`);
}

const created = await insertUser({ name, level });
console.info('[users] created user', {
id: created.id,
level: created.level,
totalUsers: users.length + 1
});
return created;
}

export async function updateUserLevel(userId: string, level: UserLevel): Promise<User> {
const id = requireUserId(userId);
const validatedLevel = validateLevel(level);
const existing = await getUserById(id);
if (!existing) {
throw new Error(`[users] user not found: ${id}`);
}

await updateUserLevelInDb(id, validatedLevel);
const updated = await getUserById(id);
if (!updated) {
throw new Error(`[users] failed to reload user after level update: ${id}`);
}

console.info('[users] updated level', { userId: id, level: validatedLevel });
return updated;
}
