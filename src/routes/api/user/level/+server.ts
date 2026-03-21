import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserById, updateUserLevel } from '$lib/server/db';
import { LEVEL_ORDER, type UserLevel } from '$lib/types';

type LevelUpdateRequest = {
  userId?: string;
  level?: string;
};

function isValidLevel(value: string): value is UserLevel {
  return LEVEL_ORDER.includes(value as UserLevel);
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = (await request.json()) as LevelUpdateRequest;
    const userId = String(body.userId ?? '').trim();
    const level = String(body.level ?? '').trim();

    if (!userId || !level) {
      return json({ ok: false, error: 'Missing userId or level.' }, { status: 400 });
    }

    if (!isValidLevel(level)) {
      return json({ ok: false, error: 'Invalid level.' }, { status: 400 });
    }

    const user = await getUserById(userId);
    if (!user) {
      return json({ ok: false, error: 'User not found.' }, { status: 404 });
    }

    await updateUserLevel(userId, level);

    return json({ ok: true, level });
  } catch (error) {
    console.error('[api/user/level] failed', { error });
    return json({ ok: false, error: 'Failed to update user level.' }, { status: 500 });
  }
};
