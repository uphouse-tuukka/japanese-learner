import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { MissionCatalogResponse } from '$lib/types';
import { getMissionsWithProgress, getUserBadges } from '$lib/server/missions-db';

type MissionsRequest = {
  userId?: string;
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = (await request.json()) as MissionsRequest;
    const userId = String(body.userId ?? '').trim();

    if (!userId) {
      return json({ ok: false, error: 'Missing userId.' }, { status: 400 });
    }

    const [missions, badges] = await Promise.all([
      getMissionsWithProgress(userId),
      getUserBadges(userId),
    ]);

    const response: MissionCatalogResponse = {
      missions,
      badges,
    };

    return json(response);
  } catch (error) {
    console.error('[api/missions] failed', { error });
    return json({ ok: false, error: 'Failed to load missions.' }, { status: 500 });
  }
};
