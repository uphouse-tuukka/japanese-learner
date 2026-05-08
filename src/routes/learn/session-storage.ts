import type { Lesson } from '$lib/types';

export type LearnUiState =
  | 'idle'
  | 'loading'
  | 'lesson'
  | 'active'
  | 'completing'
  | 'done'
  | 'budget_exhausted'
  | 'error';

export type ResumableLearnUiState = 'lesson' | 'active';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface LearnStorageKeys {
  session: string;
  lesson: string;
  uiState: string;
}

export function createLearnStorageKeys(selectedUserId: string): LearnStorageKeys {
  return {
    session: `learn:${selectedUserId}`,
    lesson: `jp-lesson:learn:${selectedUserId}`,
    uiState: `jp-uistate:learn:${selectedUserId}`,
  };
}

export function saveLearnLesson(
  lessonKey: string,
  lesson: Lesson | null,
  storage?: StorageLike,
): void {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return;

  try {
    if (lesson) {
      targetStorage.setItem(lessonKey, JSON.stringify(lesson));
    } else {
      targetStorage.removeItem(lessonKey);
    }
  } catch {
    /* ignore */
  }
}

export function restoreLearnLesson(lessonKey: string, storage?: StorageLike): Lesson | null {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return null;

  try {
    const raw = targetStorage.getItem(lessonKey);
    if (!raw) return null;
    return JSON.parse(raw) as Lesson;
  } catch {
    return null;
  }
}

export function saveLearnUiState(
  uiStateKey: string,
  state: LearnUiState,
  storage?: StorageLike,
): void {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return;

  try {
    targetStorage.setItem(uiStateKey, state);
  } catch {
    /* ignore */
  }
}

export function restoreResumableLearnUiState(
  uiStateKey: string,
  storage?: StorageLike,
): ResumableLearnUiState {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return 'active';

  try {
    const savedState = targetStorage.getItem(uiStateKey);
    if (savedState === 'lesson' || savedState === 'active') {
      return savedState;
    }
  } catch {
    /* ignore */
  }

  return 'active';
}

export function clearLearnPageStorage(
  keys: Pick<LearnStorageKeys, 'lesson' | 'uiState'>,
  storage?: StorageLike,
): void {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return;

  for (const key of [keys.lesson, keys.uiState]) {
    try {
      targetStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export function formatSavedAt(savedAt: string | null): string {
  if (!savedAt) return '';

  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;

  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}
