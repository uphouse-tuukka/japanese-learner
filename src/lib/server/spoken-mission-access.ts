import { isMissionUnlocked } from './mission-access';
import { getCategorySessionCount, getMissionById } from './missions-db';
import { getSpokenMissionDefinition, type SpokenMissionDefinition } from './spoken-missions';
import { getSpokenMissionAttempt } from './spoken-missions-db';
import { getUser } from './users';
import type { Mission, SpokenMissionAttempt } from '$lib/types';

type SpokenMissionAccessFailure = {
  ok: false;
  error: string;
  status: number;
};

type SpokenMissionAccessSuccess = {
  ok: true;
  mission: Mission;
  definition: SpokenMissionDefinition;
  attempt: SpokenMissionAttempt;
};

export type SpokenMissionAccessResult = SpokenMissionAccessFailure | SpokenMissionAccessSuccess;

export async function loadSpokenMissionAttemptAccess(input: {
  userId: string;
  missionId: string;
  attemptId: string;
}): Promise<SpokenMissionAccessResult> {
  const user = await getUser(input.userId);
  if (!user) return { ok: false, error: 'User not found.', status: 404 };

  const mission = await getMissionById(input.missionId);
  if (!mission) return { ok: false, error: 'Mission not found.', status: 404 };

  const categorySessionCount = await getCategorySessionCount(input.userId, mission.category);
  if (!isMissionUnlocked(mission, categorySessionCount)) {
    return { ok: false, error: 'Mission is locked.', status: 403 };
  }

  const definition = getSpokenMissionDefinition(mission.id);
  if (!definition) {
    return {
      ok: false,
      error: 'Spoken Mission is not available for this scenario.',
      status: 404,
    };
  }

  const attempt = await getSpokenMissionAttempt(input.attemptId);
  if (!attempt) {
    return { ok: false, error: 'Spoken Mission attempt not found.', status: 404 };
  }
  if (attempt.userId !== input.userId) {
    return { ok: false, error: 'Forbidden.', status: 403 };
  }
  if (attempt.missionId !== mission.id) {
    return { ok: false, error: 'Mission mismatch for attempt.', status: 400 };
  }
  if (attempt.definitionVersion !== definition.version) {
    return {
      ok: false,
      error: 'Spoken Mission definition changed. Start over to continue.',
      status: 409,
    };
  }

  return { ok: true, mission, definition, attempt };
}
