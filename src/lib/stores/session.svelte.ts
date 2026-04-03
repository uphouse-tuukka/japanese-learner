import { toStore } from 'svelte/store';
import type { Exercise, Session, SessionSummary } from '$lib/types';

export type ExerciseAnswer = {
  exerciseId: string;
  answerText: string;
  isCorrect: boolean;
  createdAt: string;
};

type SessionState = {
  session: Session | null;
  exercises: Exercise[];
  answers: ExerciseAnswer[];
  currentIndex: number;
  summary: SessionSummary | null;
};

const stateInternal = $state<SessionState>({
  session: null,
  exercises: [],
  answers: [],
  currentIndex: 0,
  summary: null,
});

export const state = stateInternal;

export const session = toStore(
  () => stateInternal.session,
  (value) => {
    stateInternal.session = value;
  },
);

export const exercises = toStore(
  () => stateInternal.exercises,
  (value) => {
    stateInternal.exercises = value;
  },
);

export const answers = toStore(
  () => stateInternal.answers,
  (value) => {
    stateInternal.answers = value;
  },
);

export const currentIndex = toStore(
  () => stateInternal.currentIndex,
  (value) => {
    stateInternal.currentIndex = value;
  },
);

export const summary = toStore(
  () => stateInternal.summary,
  (value) => {
    stateInternal.summary = value;
  },
);

export function resetSession(): void {
  stateInternal.session = null;
  stateInternal.exercises = [];
  stateInternal.answers = [];
  stateInternal.currentIndex = 0;
  stateInternal.summary = null;
}

export function startSession(nextSession: Session, nextExercises: Exercise[]): void {
  stateInternal.session = nextSession;
  stateInternal.exercises = nextExercises;
  stateInternal.answers = [];
  stateInternal.currentIndex = 0;
  stateInternal.summary = null;
}

export function answerExercise(
  index: number,
  payload: Omit<ExerciseAnswer, 'createdAt'> & { createdAt?: string },
): void {
  const next = [...stateInternal.answers];
  next[index] = {
    exerciseId: payload.exerciseId,
    answerText: payload.answerText,
    isCorrect: payload.isCorrect,
    createdAt: payload.createdAt ?? new Date().toISOString(),
  };
  stateInternal.answers = next;
}

export function nextExercise(): void {
  stateInternal.currentIndex += 1;
}

export function completeSession(nextSummary: SessionSummary): void {
  stateInternal.summary = nextSummary;
}

const STORAGE_PREFIX = 'jp-session:';

export function saveSessionToStorage(key: string): void {
  try {
    const data = {
      session: stateInternal.session,
      exercises: stateInternal.exercises,
      answers: stateInternal.answers,
      currentIndex: stateInternal.currentIndex,
      savedAt: new Date().toISOString(),
      // Don't save summary — completed sessions don't need resuming
    };
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch (err) {
    console.warn('[session-store] sessionStorage write failed:', err);
  }
}

export function restoreSessionFromStorage(key: string): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return false;
    const data = JSON.parse(raw) as Partial<SessionState>;
    if (!data.session || !data.exercises || data.exercises.length === 0) return false;
    stateInternal.session = data.session;
    stateInternal.exercises = data.exercises;
    stateInternal.answers = data.answers ?? [];
    stateInternal.currentIndex = data.currentIndex ?? 0;
    stateInternal.summary = null;
    return true;
  } catch (err) {
    console.warn('[session-store] Failed to restore session:', err);
    return false;
  }
}

export function hasSavedSession(key: string): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return !!(data?.session && data?.exercises?.length > 0);
  } catch (err) {
    console.warn('[session-store] sessionStorage read failed:', err);
    return false;
  }
}

export function getSavedSessionAt(key: string): string | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return typeof data?.savedAt === 'string' ? data.savedAt : null;
  } catch (err) {
    console.warn('[session-store] Failed to read saved session timestamp:', err);
    return null;
  }
}
export function clearSessionStorage(key: string): void {
  try {
    sessionStorage.removeItem(STORAGE_PREFIX + key);
  } catch (err) {
    console.warn('[session-store] sessionStorage remove failed:', err);
  }
}
