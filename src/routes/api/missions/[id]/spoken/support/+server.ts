import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jsonError, readJsonBody, requireStringField } from '$lib/server/api';
import { isMissionUnlocked } from '$lib/server/mission-access';
import { getCategorySessionCount, getMissionById } from '$lib/server/missions-db';
import { matchSelectedUser } from '$lib/server/selected-user';
import {
  getSpokenMissionDefinition,
  getSpokenMissionEnglishSupport,
} from '$lib/server/spoken-missions';
import {
  SpokenMissionProgressConflictError,
  getSpokenMissionAttempt,
  markSpokenMissionSupportUsed,
} from '$lib/server/spoken-missions-db';
import { getUser } from '$lib/server/users';
import type { SpokenMissionSupportResponse } from '$lib/types';

type RevealSpokenMissionSupportRequest = {
  userId?: string;
  attemptId?: string;
  turnNumber?: number;
};

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return jsonError(bodyResult.error, 400);

  const body = bodyResult.value as RevealSpokenMissionSupportRequest;
  const userIdResult = requireStringField(body, 'userId');
  const attemptIdResult = requireStringField(body, 'attemptId');
  const missionId = String(params.id ?? '').trim();
  if (!missionId) return jsonError('Missing mission id.', 400);
  if (!userIdResult.ok) return jsonError(userIdResult.error, 400);
  if (!attemptIdResult.ok) return jsonError(attemptIdResult.error, 400);
  if (!Number.isInteger(body.turnNumber)) return jsonError('Invalid turnNumber value.', 400);

  const selectedUser = matchSelectedUser(cookies, userIdResult.value);
  if (!selectedUser.ok) return jsonError(selectedUser.error, selectedUser.status);

  try {
    const user = await getUser(selectedUser.userId);
    if (!user) return jsonError('User not found.', 404);

    const mission = await getMissionById(missionId);
    if (!mission) return jsonError('Mission not found.', 404);

    const categorySessionCount = await getCategorySessionCount(
      selectedUser.userId,
      mission.category,
    );
    if (!isMissionUnlocked(mission, categorySessionCount)) {
      return jsonError('Mission is locked.', 403);
    }

    const definition = getSpokenMissionDefinition(mission.id);
    if (!definition) {
      return jsonError('Spoken Mission is not available for this scenario.', 404);
    }

    const attempt = await getSpokenMissionAttempt(attemptIdResult.value);
    if (!attempt) return jsonError('Spoken Mission attempt not found.', 404);
    if (attempt.userId !== selectedUser.userId) return jsonError('Forbidden.', 403);
    if (attempt.missionId !== mission.id) return jsonError('Mission mismatch for attempt.', 400);
    if (attempt.definitionVersion !== definition.version) {
      return jsonError('Spoken Mission definition changed. Start over to continue.', 409);
    }
    if (attempt.status !== 'in_progress') {
      return jsonError('Spoken Mission attempt is not in progress.', 400);
    }
    if (body.turnNumber! < 1 || body.turnNumber! > 3 || attempt.currentTurn !== body.turnNumber) {
      return jsonError('Turn does not match current attempt progress.', 409);
    }

    const englishSupport = getSpokenMissionEnglishSupport(
      definition,
      attempt.wordingVariant,
      body.turnNumber!,
    );
    await markSpokenMissionSupportUsed({
      attemptId: attempt.id,
      userId: selectedUser.userId,
      missionId: mission.id,
      definitionVersion: definition.version,
      turnNumber: body.turnNumber!,
    });

    return json({
      englishSupport,
      supportUsed: true,
    } satisfies SpokenMissionSupportResponse);
  } catch (error) {
    if (error instanceof SpokenMissionProgressConflictError) {
      return jsonError('Spoken Mission progress changed. Reload and try again.', 409);
    }
    console.error('[api/missions/[id]/spoken/support] failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      missionId,
      attemptId: attemptIdResult.value,
      turnNumber: body.turnNumber,
    });
    return jsonError('Could not reveal English support. Your attempt is saved.', 500);
  }
};
