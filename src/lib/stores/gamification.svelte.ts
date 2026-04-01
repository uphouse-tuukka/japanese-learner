import { toStore } from 'svelte/store';
import type { SessionXpBreakdown } from '$lib/types';

type InkAnimation = {
  amount: number;
  id: string;
};

type GamificationState = {
  sessionXp: SessionXpBreakdown | null;
  comboCount: number;
  maxCombo: number;
  pendingInkAnimations: InkAnimation[];
};

const stateInternal = $state<GamificationState>({
  sessionXp: null,
  comboCount: 0,
  maxCombo: 0,
  pendingInkAnimations: [],
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

export const pendingInkAnimations = toStore(
  () => stateInternal.pendingInkAnimations,
  (value) => {
    stateInternal.pendingInkAnimations = value;
  },
);

function createInkAnimationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function resetGamification(): void {
  stateInternal.sessionXp = null;
  stateInternal.comboCount = 0;
  stateInternal.maxCombo = 0;
  stateInternal.pendingInkAnimations = [];
}

export function recordCorrectAnswer(xpAmount: number): void {
  const nextCombo = stateInternal.comboCount + 1;
  stateInternal.comboCount = nextCombo;
  stateInternal.maxCombo = Math.max(stateInternal.maxCombo, nextCombo);

  const animation: InkAnimation = {
    amount: xpAmount,
    id: createInkAnimationId(),
  };

  stateInternal.pendingInkAnimations = [...stateInternal.pendingInkAnimations, animation];
}

export function recordIncorrectAnswer(): void {
  stateInternal.comboCount = 0;
}

export function setSessionXp(breakdown: SessionXpBreakdown): void {
  stateInternal.sessionXp = breakdown;
}

export function consumeInkAnimation(id: string): void {
  stateInternal.pendingInkAnimations = stateInternal.pendingInkAnimations.filter(
    (animation) => animation.id !== id,
  );
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
    stateInternal.pendingInkAnimations = [];
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
