import { afterEach, describe, expect, it } from 'vitest';
import type { MissionTurn } from '$lib/types';
import {
  clearMissionStorage,
  createMissionStorageKey,
  hasSavedMissionState,
  restoreMissionState,
  saveMissionState,
  type MissionStorageState,
} from './mission-storage';

class FakeStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

class ThrowingStorage {
  getItem(): string | null {
    throw new Error('storage unavailable');
  }

  setItem(): void {
    throw new Error('storage unavailable');
  }

  removeItem(): void {
    throw new Error('storage unavailable');
  }
}

const missionTurn: MissionTurn = {
  turnNumber: 1,
  npcDialogue: {
    japanese: 'いらっしゃいませ',
    romaji: 'irasshaimase',
  },
  userResponse: null,
  feedback: null,
  choices: [
    {
      japanese: 'ラーメンをください',
      romaji: 'raamen o kudasai',
      english: 'Ramen, please.',
      isCorrect: true,
    },
  ],
};

const missionState: MissionStorageState = {
  mode: 'immersion',
  userMissionId: 'user-mission-123',
  turns: [missionTurn],
  currentTurnIndex: 0,
  sceneDescription: 'A busy ramen shop in Tokyo.',
  characterName: 'Shopkeeper',
  characterEmoji: '🍜',
  totalTurns: 5,
  correctCount: 2,
  naturalCount: 1,
  hintsEnabled: false,
  awaitingCompletion: true,
};

const originalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'sessionStorage',
);

function restoreDefaultSessionStorage(): void {
  if (originalSessionStorageDescriptor) {
    Object.defineProperty(globalThis, 'sessionStorage', originalSessionStorageDescriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, 'sessionStorage');
}

function removeDefaultSessionStorage(): void {
  Reflect.deleteProperty(globalThis, 'sessionStorage');
}

function blockDefaultSessionStorage(): void {
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get() {
      throw new Error('sessionStorage unavailable');
    },
  });
}

function expectHelpersToHandleUnavailableDefaultStorage(): void {
  const key = createMissionStorageKey('mission-123', 'user-456');

  expect(() => saveMissionState(key, missionState)).not.toThrow();
  expect(restoreMissionState(key)).toBeNull();
  expect(hasSavedMissionState(key)).toBe(false);
  expect(() => clearMissionStorage(key)).not.toThrow();
}

function missionStateWithoutFallbackFields(): Partial<MissionStorageState> {
  const saved: Partial<MissionStorageState> = { ...missionState };
  delete saved.hintsEnabled;
  delete saved.awaitingCompletion;
  return saved;
}

afterEach(() => {
  restoreDefaultSessionStorage();
});

describe('mission storage helpers', () => {
  it('creates the existing mission storage key for the mission and selected user', () => {
    expect(createMissionStorageKey('mission-123', 'user-456')).toBe(
      'jp-mission:mission-123:user-456',
    );
  });

  it('saves the mission state using the existing JSON shape', () => {
    const storage = new FakeStorage();
    const key = 'jp-mission:mission-123:user-456';

    saveMissionState(key, missionState, storage);

    expect(JSON.parse(storage.getItem(key) ?? '')).toEqual(missionState);
  });

  it('restores saved mission state and preserves fallback defaults', () => {
    const storage = new FakeStorage();
    const key = 'jp-mission:mission-123:user-456';
    storage.setItem(key, JSON.stringify(missionStateWithoutFallbackFields()));

    expect(restoreMissionState(key, storage)).toEqual({
      ...missionStateWithoutFallbackFields(),
      hintsEnabled: true,
      awaitingCompletion: false,
    });
  });

  it('returns null when no saved mission state exists', () => {
    expect(restoreMissionState('jp-mission:mission-123:user-456', new FakeStorage())).toBeNull();
  });

  it('returns null for invalid mission state JSON', () => {
    const storage = new FakeStorage();
    const key = 'jp-mission:mission-123:user-456';
    storage.setItem(key, '{not valid JSON');

    expect(restoreMissionState(key, storage)).toBeNull();
  });

  it.each([
    ['missing user mission id', { ...missionState, userMissionId: '' }],
    ['missing turns', { ...missionState, turns: undefined }],
    ['empty turns', { ...missionState, turns: [] }],
  ])('returns null for %s', (_name, saved) => {
    const storage = new FakeStorage();
    const key = 'jp-mission:mission-123:user-456';
    storage.setItem(key, JSON.stringify(saved));

    expect(restoreMissionState(key, storage)).toBeNull();
  });

  it('detects whether a valid saved mission exists', () => {
    const storage = new FakeStorage();
    const key = 'jp-mission:mission-123:user-456';

    expect(hasSavedMissionState(key, storage)).toBe(false);

    storage.setItem(key, '{not valid JSON');
    expect(hasSavedMissionState(key, storage)).toBe(false);

    storage.setItem(key, JSON.stringify({ ...missionState, userMissionId: '' }));
    expect(hasSavedMissionState(key, storage)).toBe(false);

    storage.setItem(key, JSON.stringify({ ...missionState, turns: undefined }));
    expect(hasSavedMissionState(key, storage)).toBe(false);

    storage.setItem(key, JSON.stringify({ ...missionState, turns: [] }));
    expect(hasSavedMissionState(key, storage)).toBe(false);

    storage.setItem(key, JSON.stringify(missionState));
    expect(hasSavedMissionState(key, storage)).toBe(true);
  });

  it('clears saved mission state', () => {
    const storage = new FakeStorage();
    const key = 'jp-mission:mission-123:user-456';
    storage.setItem(key, JSON.stringify(missionState));

    clearMissionStorage(key, storage);

    expect(storage.getItem(key)).toBeNull();
  });

  it('ignores throwing injected storage', () => {
    const storage = new ThrowingStorage();
    const key = 'jp-mission:mission-123:user-456';

    expect(() => saveMissionState(key, missionState, storage)).not.toThrow();
    expect(restoreMissionState(key, storage)).toBeNull();
    expect(hasSavedMissionState(key, storage)).toBe(false);
    expect(() => clearMissionStorage(key, storage)).not.toThrow();
  });

  it('uses safe defaults when default session storage is absent', () => {
    removeDefaultSessionStorage();

    expectHelpersToHandleUnavailableDefaultStorage();
  });

  it('uses safe defaults when default session storage accessor throws', () => {
    blockDefaultSessionStorage();

    expectHelpersToHandleUnavailableDefaultStorage();
  });
});
