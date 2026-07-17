import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isMissionUnlocked } from '$lib/server/mission-access';
import {
  getCategorySessionCount,
  getMissionById,
  hasCompletedMissionInMode,
} from '$lib/server/missions-db';
import { getUserById } from '$lib/server/db';
import { getSpokenMissionDefinition, toSpokenMissionBriefing } from '$lib/server/spoken-missions';
import {
  getBestSpokenMissionEvidence,
  getResumableSpokenMissionAttempt,
} from '$lib/server/spoken-missions-db';

export const load: PageServerLoad = async ({ params, cookies }) => {
  const selectedUserId = cookies.get('selected_user');
  if (!selectedUserId) {
    throw redirect(302, '/');
  }

  const user = await getUserById(selectedUserId);
  if (!user) {
    cookies.delete('selected_user', { path: '/' });
    throw redirect(302, '/');
  }

  const missionId = String(params.id ?? '').trim();
  const mission = await getMissionById(missionId);

  if (!mission) {
    throw error(404, 'Mission not found.');
  }

  const definition = getSpokenMissionDefinition(mission.id);
  const [
    categorySessionCount,
    bestSpokenEvidence,
    resumableSpokenAttempt,
    completedPractice,
    completedImmersion,
  ] = await Promise.all([
    getCategorySessionCount(selectedUserId, mission.category),
    definition ? getBestSpokenMissionEvidence(selectedUserId, mission.id) : Promise.resolve(null),
    definition
      ? getResumableSpokenMissionAttempt(selectedUserId, mission.id)
      : Promise.resolve(null),
    hasCompletedMissionInMode(selectedUserId, mission.id, 'practice'),
    hasCompletedMissionInMode(selectedUserId, mission.id, 'immersion'),
  ]);
  const unlocked = isMissionUnlocked(mission, categorySessionCount);
  const definitionUpdated = Boolean(
    definition &&
    resumableSpokenAttempt &&
    resumableSpokenAttempt.definitionVersion !== definition.version,
  );

  return {
    selectedUserId,
    mission,
    unlocked,
    writtenProgress: {
      completedPractice,
      completedImmersion,
    },
    spokenMission:
      definition && unlocked
        ? {
            briefing: toSpokenMissionBriefing(definition),
            bestEvidence: bestSpokenEvidence ?? 'untried',
            resumable:
              resumableSpokenAttempt && !definitionUpdated
                ? {
                    currentTurn: resumableSpokenAttempt.currentTurn,
                    completedGoalCount: resumableSpokenAttempt.successfulTurnCount,
                  }
                : null,
            definitionUpdated,
          }
        : null,
  };
};
