import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jsonError, readJsonBody, requireStringField } from '$lib/server/api';
import { matchSelectedUser } from '$lib/server/selected-user';
import { loadSpokenMissionAttemptAccess } from '$lib/server/spoken-mission-access';
import {
  getSpokenMissionServerTurn,
  toSpokenMissionHistory,
  toSpokenMissionResult,
} from '$lib/server/spoken-missions';
import {
  skipSpokenMissionGoal,
  SpokenMissionProgressConflictError,
} from '$lib/server/spoken-missions-db';
import type { SpokenMissionSkipResponse } from '$lib/types';

type SkipSpokenMissionRequest = {
  userId?: string;
  attemptId?: string;
  turnNumber?: number;
  clientSkipId?: string;
};

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const missionId = String(params.id ?? '').trim();
  try {
    const bodyResult = await readJsonBody(request);
    if (!bodyResult.ok) return jsonError(bodyResult.error, 400);
    const body = bodyResult.value as SkipSpokenMissionRequest;
    const userIdResult = requireStringField(body, 'userId');
    const attemptIdResult = requireStringField(body, 'attemptId');
    const clientSkipIdResult = requireStringField(body, 'clientSkipId');
    if (!missionId) return jsonError('Missing mission id.', 400);
    if (!userIdResult.ok) return jsonError(userIdResult.error, 400);
    if (!attemptIdResult.ok) return jsonError(attemptIdResult.error, 400);
    if (!clientSkipIdResult.ok || clientSkipIdResult.value.length > 120) {
      return jsonError(
        clientSkipIdResult.ok ? 'Invalid clientSkipId.' : clientSkipIdResult.error,
        400,
      );
    }
    if (!Number.isInteger(body.turnNumber) || body.turnNumber! < 1 || body.turnNumber! > 3) {
      return jsonError('Invalid turnNumber value.', 400);
    }

    const selectedUser = matchSelectedUser(cookies, userIdResult.value);
    if (!selectedUser.ok) return jsonError(selectedUser.error, selectedUser.status);
    const access = await loadSpokenMissionAttemptAccess({
      userId: selectedUser.userId,
      missionId,
      attemptId: attemptIdResult.value,
    });
    if (!access.ok) return jsonError(access.error, access.status);

    const turn = getSpokenMissionServerTurn(
      access.definition,
      access.attempt.wordingVariant,
      body.turnNumber!,
    );
    const skipped = await skipSpokenMissionGoal({
      attemptId: access.attempt.id,
      userId: selectedUser.userId,
      missionId: access.mission.id,
      definitionVersion: access.definition.version,
      turnNumber: body.turnNumber!,
      goalKey: turn.goalKey,
      npcJapanese: turn.npcDialogue.japanese,
      npcRomaji: turn.npcDialogue.romaji,
      clientSkipId: clientSkipIdResult.value,
    });
    const terminal =
      skipped.attempt.status === 'completed' || skipped.attempt.status === 'incomplete';
    return json({
      duplicate: skipped.status === 'duplicate',
      nextTurn:
        skipped.attempt.status === 'in_progress'
          ? getSpokenMissionServerTurn(
              access.definition,
              skipped.attempt.wordingVariant,
              skipped.attempt.currentTurn,
            )
          : null,
      history: toSpokenMissionHistory(access.definition, skipped.attempt),
      isComplete: terminal,
      result: toSpokenMissionResult(access.definition, skipped.attempt),
    } satisfies SpokenMissionSkipResponse);
  } catch (error) {
    if (error instanceof SpokenMissionProgressConflictError) {
      return jsonError('This goal can only be skipped after an incorrect assessment.', 409);
    }
    console.error('[api/missions/[id]/spoken/skip] failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      missionId,
    });
    return jsonError('Could not skip this goal. Your attempt is saved.', 500);
  }
};
