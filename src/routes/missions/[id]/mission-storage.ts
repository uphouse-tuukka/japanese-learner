import type { MissionMode, MissionTurn } from '$lib/types';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type MissionStorageState = {
  mode: MissionMode;
  userMissionId: string;
  turns: MissionTurn[];
  currentTurnIndex: number;
  sceneDescription: string;
  characterName: string;
  characterEmoji: string;
  totalTurns: number;
  correctCount: number;
  naturalCount: number;
  hintsEnabled: boolean;
  awaitingCompletion: boolean;
};

export function createMissionStorageKey(missionId: string, selectedUserId: string): string {
  return `jp-mission:${missionId}:${selectedUserId}`;
}

export function saveMissionState(
  storageKey: string,
  stateData: MissionStorageState,
  storage?: StorageLike,
): void {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return;

  try {
    targetStorage.setItem(storageKey, JSON.stringify(stateData));
  } catch {
    /* ignore */
  }
}

export function restoreMissionState(
  storageKey: string,
  storage?: StorageLike,
): MissionStorageState | null {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return null;

  try {
    const raw = targetStorage.getItem(storageKey);
    if (!raw) return null;

    const saved = JSON.parse(raw) as MissionStorageState;
    if (!saved.userMissionId || !saved.turns || saved.turns.length === 0) return null;

    return {
      ...saved,
      hintsEnabled: saved.hintsEnabled ?? true,
      awaitingCompletion: saved.awaitingCompletion ?? false,
    };
  } catch {
    return null;
  }
}

export function hasSavedMissionState(storageKey: string, storage?: StorageLike): boolean {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return false;

  try {
    const raw = targetStorage.getItem(storageKey);
    if (!raw) return false;

    const data = JSON.parse(raw);
    return !!(data?.userMissionId && data?.turns?.length > 0);
  } catch {
    return false;
  }
}

export function clearMissionStorage(storageKey: string, storage?: StorageLike): void {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return;

  try {
    targetStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
}

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;

  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}
