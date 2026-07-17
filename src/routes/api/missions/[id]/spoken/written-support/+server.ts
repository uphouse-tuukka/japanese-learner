import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jsonError } from '$lib/server/api';
import { loadSpokenMissionDisclosureRequest } from '$lib/server/spoken-mission-disclosure';
import { getSpokenMissionServerTurn } from '$lib/server/spoken-missions';
import {
  markSpokenMissionWrittenSupportRevealed,
  SpokenMissionProgressConflictError,
} from '$lib/server/spoken-missions-db';
import type { SpokenMissionWrittenSupportResponse } from '$lib/types';

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const missionId = String(params.id ?? '').trim();
  try {
    const disclosure = await loadSpokenMissionDisclosureRequest({
      missionId,
      request,
      cookies,
    });
    if (!disclosure.ok) return disclosure.response;
    const { attempt, definition, mission, turnNumber, userId } = disclosure;

    const turn = getSpokenMissionServerTurn(definition, attempt.wordingVariant, turnNumber);
    await markSpokenMissionWrittenSupportRevealed({
      attemptId: attempt.id,
      userId,
      missionId: mission.id,
      definitionVersion: definition.version,
      turnNumber,
    });

    return json({
      writtenText: turn.npcDialogue,
      writtenSupportRevealed: true,
    } satisfies SpokenMissionWrittenSupportResponse);
  } catch (error) {
    if (error instanceof SpokenMissionProgressConflictError) {
      return jsonError('Spoken Mission progress changed. Reload and try again.', 409);
    }
    console.error('[api/missions/[id]/spoken/written-support] failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      missionId,
    });
    return jsonError('Could not reveal written text. Your attempt is saved.', 500);
  }
};
