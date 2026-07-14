import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jsonError, readJsonBody, requireStringField } from '$lib/server/api';
import { matchSelectedUser } from '$lib/server/selected-user';
import { loadSpokenMissionAttemptAccess } from '$lib/server/spoken-mission-access';
import { getSpokenMissionEnglishSupport } from '$lib/server/spoken-missions';
import {
  SpokenMissionProgressConflictError,
  markSpokenMissionSupportUsed,
} from '$lib/server/spoken-missions-db';
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
    const access = await loadSpokenMissionAttemptAccess({
      userId: selectedUser.userId,
      missionId,
      attemptId: attemptIdResult.value,
    });
    if (!access.ok) return jsonError(access.error, access.status);
    const { attempt, definition, mission } = access;
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
