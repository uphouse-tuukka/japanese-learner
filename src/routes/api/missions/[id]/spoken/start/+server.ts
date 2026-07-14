import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jsonError, readJsonBody, requireStringField } from '$lib/server/api';
import { isMissionUnlocked } from '$lib/server/mission-access';
import { getCategorySessionCount, getMissionById } from '$lib/server/missions-db';
import { matchSelectedUser } from '$lib/server/selected-user';
import {
  getSpokenMissionDefinition,
  getSpokenMissionEnglishSupport,
  getSpokenMissionServerTurn,
  selectSpokenMissionVariant,
  toSpokenMissionBriefing,
  toSpokenMissionHistory,
} from '$lib/server/spoken-missions';
import {
  createSpokenMissionAttempt,
  getMostRecentSpokenMissionVariant,
  getResumableSpokenMissionAttempt,
  restartSpokenMissionAttempt,
  SpokenMissionProgressConflictError,
} from '$lib/server/spoken-missions-db';
import { getUser } from '$lib/server/users';
import type { SpokenMissionAttempt, SpokenMissionStartResponse } from '$lib/types';

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
    const unlocked = isMissionUnlocked(mission, categorySessionCount);
    if (!unlocked) return jsonError('Mission is locked.', 403);

    const resumable = await getResumableSpokenMissionAttempt(userId, mission.id);
    if (resumable && !body.startOver) {
      if (resumable.definitionVersion !== definition.version) {
        return jsonError('This saved attempt needs to be started over.', 409);
      }
      return json(serializeStartResponse(definition, resumable, true));
    }

    const previousVariant = await getMostRecentSpokenMissionVariant(userId, mission.id);
    const wordingVariant = selectSpokenMissionVariant(definition, previousVariant);
    const attempt =
      body.startOver && resumable
        ? await restartSpokenMissionAttempt({
            attemptId: resumable.id,
            userId,
            missionId: mission.id,
            definitionVersion: definition.version,
            wordingVariant,
          })
        : await createSpokenMissionAttempt({
            userId,
            missionId: mission.id,
            definitionVersion: definition.version,
            wordingVariant,
          });

    return json(serializeStartResponse(definition, attempt, false));
  } catch (error) {
    if (error instanceof SpokenMissionProgressConflictError) {
      return jsonError('Spoken Mission progress changed. Reload and try again.', 409);
    }
    console.error('[api/missions/[id]/spoken/start] failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
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
    briefing: toSpokenMissionBriefing(definition),
    turn: getSpokenMissionServerTurn(definition, attempt.wordingVariant, attempt.currentTurn),
    history: toSpokenMissionHistory(definition, attempt),
    totalTurns: 3,
    resumed,
    supportUsed: attempt.supportUsed,
    currentTurnSupportRevealed: attempt.currentTurnSupportUsed,
    currentTurnEnglishSupport: attempt.currentTurnSupportUsed
      ? getSpokenMissionEnglishSupport(definition, attempt.wordingVariant, attempt.currentTurn)
      : null,
  };
}
