import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jsonError, readJsonBody, requireStringField } from '$lib/server/api';
import { config } from '$lib/server/config';
import { getCategorySessionCount, getMissionById } from '$lib/server/missions-db';
import { matchSelectedUser } from '$lib/server/selected-user';
import {
  getSpokenMissionDefinition,
  getSpokenMissionServerTurn,
  selectSpokenMissionVariant,
  toSpokenMissionBriefing,
} from '$lib/server/spoken-missions';
import {
  abandonResumableSpokenMissionAttempts,
  createSpokenMissionAttempt,
  getMostRecentSpokenMissionVariant,
  getResumableSpokenMissionAttempt,
} from '$lib/server/spoken-missions-db';
import { getUser } from '$lib/server/users';
import type { SpokenMissionAttempt, SpokenMissionStartResponse } from '$lib/types';

const SUPPORT_POLICY =
  'Replaying Japanese audio and reading romaji do not change your evidence. Revealing English support makes a completed result Supported.';

type StartSpokenMissionRequest = {
  userId?: string;
  startOver?: boolean;
};

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const bodyResult = await readJsonBody(request);
    if (!bodyResult.ok) return jsonError(bodyResult.error, 400);

    const body = bodyResult.value as StartSpokenMissionRequest;
    const userIdResult = requireStringField(body, 'userId');
    const missionId = String(params.id ?? '').trim();
    if (!missionId) return jsonError('Missing mission id.', 400);
    if (!userIdResult.ok) return jsonError(userIdResult.error, 400);
    if (body.startOver !== undefined && typeof body.startOver !== 'boolean') {
      return jsonError('Invalid startOver value.', 400);
    }

    const selectedUser = matchSelectedUser(cookies, userIdResult.value);
    if (!selectedUser.ok) return jsonError(selectedUser.error, selectedUser.status);
    const userId = selectedUser.userId;

    const mission = await getMissionById(missionId);
    if (!mission) return jsonError('Mission not found.', 404);

    const definition = getSpokenMissionDefinition(mission.id);
    if (!definition) {
      return jsonError('Spoken Mission is not available for this scenario.', 404);
    }

    const user = await getUser(userId);
    if (!user) return jsonError('User not found.', 404);

    const categorySessionCount = await getCategorySessionCount(userId, mission.category);
    const unlocked =
      config.missions.unlockAllOverride ||
      mission.startUnlocked ||
      categorySessionCount >= mission.unlockSessionsRequired;
    if (!unlocked) return jsonError('Mission is locked.', 403);

    const resumable = await getResumableSpokenMissionAttempt(userId, mission.id);
    if (resumable && !body.startOver) {
      if (resumable.definitionVersion !== definition.version) {
        return jsonError('This saved attempt needs to be started over.', 409);
      }
      return json(serializeStartResponse(definition, resumable, true));
    }

    const previousVariant = await getMostRecentSpokenMissionVariant(userId, mission.id);
    if (body.startOver) {
      await abandonResumableSpokenMissionAttempts(userId, mission.id);
    }
    const wordingVariant = selectSpokenMissionVariant(definition, previousVariant);
    const attempt = await createSpokenMissionAttempt({
      userId,
      missionId: mission.id,
      definitionVersion: definition.version,
      wordingVariant,
    });

    return json(serializeStartResponse(definition, attempt, false));
  } catch (error) {
    console.error('[api/missions/[id]/spoken/start] failed', {
      error,
      missionId: params.id,
    });
    return jsonError('Failed to start Spoken Mission.', 500);
  }
};

function serializeStartResponse(
  definition: NonNullable<ReturnType<typeof getSpokenMissionDefinition>>,
  attempt: SpokenMissionAttempt,
  resumed: boolean,
): SpokenMissionStartResponse {
  return {
    attemptId: attempt.id,
    definitionVersion: definition.version,
    briefing: toSpokenMissionBriefing(definition),
    turn: getSpokenMissionServerTurn(definition, attempt.wordingVariant, attempt.currentTurn),
    totalTurns: 3,
    resumed,
    supportUsed: attempt.supportUsed,
    supportPolicy: SUPPORT_POLICY,
  };
}
