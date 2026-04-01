import { toStore } from 'svelte/store';
import type { SessionXpBreakdown } from '$lib/types';

type GamificationState = {
  sessionXp: SessionXpBreakdown | null;
  comboCount: number;
  maxCombo: number;
};

const stateInternal = $state<GamificationState>({
  sessionXp: null,
  comboCount: 0,
  maxCombo: 0,
});

export const state = stateInternal;

export const combo = toStore(
  () => stateInternal.comboCount,
  (value) => {
    stateInternal.comboCount = value;
  },
);

export const maxCombo = toStore(
  () => stateInternal.maxCombo,
  (value) => {
    stateInternal.maxCombo = value;
  },
);

export const sessionXp = toStore(
  () => stateInternal.sessionXp,
  (value) => {
    stateInternal.sessionXp = value;
  },
);

export function resetGamification(): void {
  stateInternal.sessionXp = null;
  stateInternal.comboCount = 0;
  stateInternal.maxCombo = 0;
}

export function recordCorrectAnswer(_xpAmount: number): void {
  const nextCombo = stateInternal.comboCount + 1;
  stateInternal.comboCount = nextCombo;
  stateInternal.maxCombo = Math.max(stateInternal.maxCombo, nextCombo);
}

export function recordIncorrectAnswer(): void {
  stateInternal.comboCount = 0;
}

export function setSessionXp(breakdown: SessionXpBreakdown): void {
  stateInternal.sessionXp = breakdown;
}

const STORAGE_PREFIX = 'jp-gamification:';

export function saveGamificationToStorage(key: string): void {
  try {
    const data = {
      comboCount: stateInternal.comboCount,
      maxCombo: stateInternal.maxCombo,
    };
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function restoreGamificationFromStorage(key: string): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return false;
    const data = JSON.parse(raw);
    stateInternal.comboCount = data.comboCount ?? 0;
    stateInternal.maxCombo = data.maxCombo ?? 0;
    stateInternal.sessionXp = null;
    return true;
  } catch {
    return false;
  }
}

export function clearGamificationStorage(key: string): void {
  try {
    sessionStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // ignore
  }
}
