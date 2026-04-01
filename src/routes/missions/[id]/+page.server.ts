import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { config } from '$lib/server/config';
import { getCategorySessionCount, getMissionById } from '$lib/server/missions-db';

export const load: PageServerLoad = async ({ params, cookies }) => {
  const selectedUserId = cookies.get('selected_user');
  if (!selectedUserId) {
    throw redirect(302, '/');
  }

  const missionId = String(params.id ?? '').trim();
  const mission = await getMissionById(missionId);

  if (!mission) {
    throw error(404, 'Mission not found.');
  }

  const categorySessionCount = await getCategorySessionCount(selectedUserId, mission.category);
  const unlocked =
    config.missions.unlockAllOverride ||
    mission.startUnlocked ||
    categorySessionCount >= mission.unlockSessionsRequired;

  return {
    selectedUserId,
    mission,
    unlocked,
  };
};
