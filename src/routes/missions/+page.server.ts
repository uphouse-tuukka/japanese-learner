import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getMissionsWithProgress, getUserBadges } from '$lib/server/missions-db';
import { config } from '$lib/server/config';
import { getUserById } from '$lib/server/db';

export const load: PageServerLoad = async ({ cookies }) => {
  const selectedUserId = cookies.get('selected_user');
  if (!selectedUserId) {
    throw redirect(302, '/');
  }

  const user = await getUserById(selectedUserId);
  if (!user) {
    cookies.delete('selected_user', { path: '/' });
    throw redirect(302, '/');
  }

  const [missions, badges] = await Promise.all([
    getMissionsWithProgress(selectedUserId),
    getUserBadges(selectedUserId),
  ]);

  return {
    selectedUserId,
    missions,
    badges,
    unlockAllOverride: config.missions.unlockAllOverride,
  };
};
