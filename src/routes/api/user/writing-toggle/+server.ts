import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserById, updateJapaneseWritingSetting } from '$lib/server/db';

type WritingToggleRequest = {
  userId?: string;
  enabled?: boolean;
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = (await request.json()) as WritingToggleRequest;
    const userId = String(body.userId ?? '').trim();
    const enabled = body.enabled;

    if (!userId || typeof enabled !== 'boolean') {
      return json({ ok: false, error: 'Missing userId or enabled.' }, { status: 400 });
    }

    const user = await getUserById(userId);
    if (!user) {
      return json({ ok: false, error: 'User not found.' }, { status: 404 });
    }

    await updateJapaneseWritingSetting(userId, enabled);

    return json({ ok: true, enabled });
  } catch (error) {
    console.error('[api/user/writing-toggle] failed', { error });
    return json({ ok: false, error: 'Failed to update writing setting.' }, { status: 500 });
  }
};
