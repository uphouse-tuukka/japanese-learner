import type {
  SpokenMissionStartResponse,
  SpokenMissionTurnRecovery,
  SpokenMissionTurnResponse,
} from '$lib/types';

type RequestSpokenMissionStartInput = {
  missionId: string;
  userId: string;
  startOver: boolean;
  fetcher?: typeof fetch;
};

export class SpokenMissionTurnRequestError extends Error {
  constructor(
    message: string,
    public readonly recovery: SpokenMissionTurnRecovery,
  ) {
    super(message);
    this.name = 'SpokenMissionTurnRequestError';
  }
}

type RequestSpokenMissionTurnInput = {
  missionId: string;
  form: FormData;
  fetcher?: typeof fetch;
};

export async function requestSpokenMissionStart({
  missionId,
  userId,
  startOver,
  fetcher = fetch,
}: RequestSpokenMissionStartInput): Promise<SpokenMissionStartResponse> {
  const response = await fetcher(`/api/missions/${missionId}/spoken/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId, startOver }),
  });
  const payload = (await response.json()) as SpokenMissionStartResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Could not start Spoken Mission.');
  return payload;
}

function isTurnRecovery(value: unknown): value is SpokenMissionTurnRecovery {
  return value === 'retry_upload' || value === 'record_again' || value === 'none';
}

function recoveryForTurnFailure(status: number, recovery: unknown): SpokenMissionTurnRecovery {
  if (isTurnRecovery(recovery)) return recovery;
  if (status === 429 || status >= 500) return 'retry_upload';
  return 'none';
}

export async function requestSpokenMissionTurn({
  missionId,
  form,
  fetcher = fetch,
}: RequestSpokenMissionTurnInput): Promise<SpokenMissionTurnResponse> {
  let response: Response;
  try {
    response = await fetcher(`/api/missions/${missionId}/spoken/turn`, {
      method: 'POST',
      body: form,
    });
  } catch {
    throw new SpokenMissionTurnRequestError(
      'Could not reach the assessment service. Your attempt is saved.',
      'retry_upload',
    );
  }

  let payload:
    | (SpokenMissionTurnResponse & { error?: string; recovery?: SpokenMissionTurnRecovery })
    | null = null;
  try {
    payload = (await response.json()) as SpokenMissionTurnResponse & {
      error?: string;
      recovery?: SpokenMissionTurnRecovery;
    };
  } catch {
    // A malformed upstream response is recoverable in the same way as a service failure.
  }

  if (!response.ok) {
    const message = payload?.error ?? 'Could not assess this response. Your attempt is saved.';
    throw new SpokenMissionTurnRequestError(
      message,
      recoveryForTurnFailure(response.status, payload?.recovery),
    );
  }
  if (!payload) {
    throw new SpokenMissionTurnRequestError(
      'Could not read the assessment response. Your attempt is saved.',
      'retry_upload',
    );
  }
  return payload;
}
