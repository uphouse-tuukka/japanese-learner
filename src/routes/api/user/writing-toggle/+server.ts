import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jsonError, readJsonBody, requireStringField } from '$lib/server/api';
import { getUserById, updateJapaneseWritingSetting } from '$lib/server/db';
import { matchSelectedUser } from '$lib/server/selected-user';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const bodyResult = await readJsonBody(request);
    if (!bodyResult.ok) {
      return jsonError(bodyResult.error, 400);
    }

    const body = bodyResult.value;
    const userIdResult = requireStringField(body, 'userId');
    const enabled = isPlainObject(body) ? body.enabled : undefined;

    if (!userIdResult.ok || typeof enabled !== 'boolean') {
      return jsonError('Missing userId or enabled.', 400);
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

    await updateJapaneseWritingSetting(userId, enabled);

    return json({ ok: true, enabled });
  } catch (error) {
    console.error('[api/user/writing-toggle] failed', { error });
    return json({ ok: false, error: 'Failed to update writing setting.' }, { status: 500 });
  }
};
