import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jsonError, readJsonBody, requireStringField } from '$lib/server/api';
import { getUserById, updateUserLevel } from '$lib/server/db';
import { matchSelectedUser } from '$lib/server/selected-user';
import { LEVEL_ORDER, type UserLevel } from '$lib/types';

function isValidLevel(value: string): value is UserLevel {
  return LEVEL_ORDER.includes(value as UserLevel);
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const bodyResult = await readJsonBody(request);
    if (!bodyResult.ok) {
      return jsonError(bodyResult.error, 400);
    }

    const body = bodyResult.value;
    const userIdResult = requireStringField(body, 'userId');
    const levelResult = requireStringField(body, 'level');

    if (!userIdResult.ok || !levelResult.ok) {
      return jsonError('Missing userId or level.', 400);
    }

    const level = levelResult.value;
    if (!isValidLevel(level)) {
      return jsonError('Invalid level.', 400);
    }

    const selectedUser = matchSelectedUser(cookies, userIdResult.value);
    if (!selectedUser.ok) {
      return jsonError(selectedUser.error, selectedUser.status);
    }

    const userId = selectedUser.userId;
    const user = await getUserById(userId);
    if (!user) {
      return jsonError('User not found.', 404);
    }

    await updateUserLevel(userId, level);

    return json({ ok: true, level });
  } catch (error) {
    console.error('[api/user/level] failed', { error });
    return jsonError('Failed to update user level.', 500);
  }
};
