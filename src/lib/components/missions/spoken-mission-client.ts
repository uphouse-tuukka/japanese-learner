import type { SpokenMissionStartResponse } from '$lib/types';

type RequestSpokenMissionStartInput = {
  missionId: string;
  userId: string;
  startOver: boolean;
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
