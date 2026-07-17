import type { Mission, SpokenMissionAttempt } from '$lib/types';
import { jsonError, readJsonBody, requireStringField } from './api';
import { matchSelectedUser } from './selected-user';
import {
  loadSpokenMissionAttemptAccess,
  type SpokenMissionAccessResult,
} from './spoken-mission-access';

type SpokenMissionDisclosureRequest = {
  userId?: string;
  attemptId?: string;
  turnNumber?: number;
};

type DisclosureRequestFailure = {
  ok: false;
  response: Response;
};

type DisclosureRequestSuccess = {
  ok: true;
  userId: string;
  mission: Mission;
  definition: Extract<SpokenMissionAccessResult, { ok: true }>['definition'];
  attempt: SpokenMissionAttempt;
  turnNumber: number;
};

export type SpokenMissionDisclosureRequestResult =
  | DisclosureRequestFailure
  | DisclosureRequestSuccess;

export async function loadSpokenMissionDisclosureRequest(input: {
  missionId: string;
  request: Request;
  cookies: { get(name: string): string | undefined };
}): Promise<SpokenMissionDisclosureRequestResult> {
  const bodyResult = await readJsonBody(input.request);
  if (!bodyResult.ok) return { ok: false, response: jsonError(bodyResult.error, 400) };

  const body = bodyResult.value as SpokenMissionDisclosureRequest;
  const userIdResult = requireStringField(body, 'userId');
  const attemptIdResult = requireStringField(body, 'attemptId');
  if (!input.missionId) {
    return { ok: false, response: jsonError('Missing mission id.', 400) };
  }
  if (!userIdResult.ok) return { ok: false, response: jsonError(userIdResult.error, 400) };
  if (!attemptIdResult.ok) {
    return { ok: false, response: jsonError(attemptIdResult.error, 400) };
  }
  if (!Number.isInteger(body.turnNumber)) {
    return { ok: false, response: jsonError('Invalid turnNumber value.', 400) };
  }

  const selectedUser = matchSelectedUser(input.cookies, userIdResult.value);
  if (!selectedUser.ok) {
    return {
      ok: false,
      response: jsonError(selectedUser.error, selectedUser.status),
    };
  }

  const access = await loadSpokenMissionAttemptAccess({
    userId: selectedUser.userId,
    missionId: input.missionId,
    attemptId: attemptIdResult.value,
  });
  if (!access.ok) return { ok: false, response: jsonError(access.error, access.status) };
  if (access.attempt.status !== 'in_progress') {
    return {
      ok: false,
      response: jsonError('Spoken Mission attempt is not in progress.', 400),
    };
  }
  if (
    body.turnNumber! < 1 ||
    body.turnNumber! > 3 ||
    access.attempt.currentTurn !== body.turnNumber
  ) {
    return {
      ok: false,
      response: jsonError('Turn does not match current attempt progress.', 409),
    };
  }

  return {
    ok: true,
    userId: selectedUser.userId,
    mission: access.mission,
    definition: access.definition,
    attempt: access.attempt,
    turnNumber: body.turnNumber!,
  };
}
