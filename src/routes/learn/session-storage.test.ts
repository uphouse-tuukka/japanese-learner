import { afterEach, describe, expect, it } from 'vitest';
import type { Lesson } from '$lib/types';
import {
  clearLearnPageStorage,
  createLearnStorageKeys,
  restoreLearnLesson,
  restoreResumableLearnUiState,
  saveLearnLesson,
  saveLearnUiState,
} from './session-storage';

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

const lesson: Lesson = {
  topic: 'Ordering ramen',
  category: 'food',
  explanation: 'Practice ordering a bowl of ramen politely.',
  culturalNote: 'Many ramen shops use ticket machines.',
  keyPhrases: [
    {
      japanese: 'ラーメンをください',
      romaji: 'raamen o kudasai',
      english: 'Ramen, please.',
      usage: 'Use this when ordering ramen.',
    },
  ],
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
  const lessonKey = 'jp-lesson:learn:user-123';
  const uiStateKey = 'jp-uistate:learn:user-123';

  expect(() => saveLearnLesson(lessonKey, lesson)).not.toThrow();
  expect(restoreLearnLesson(lessonKey)).toBeNull();
  expect(() => saveLearnUiState(uiStateKey, 'lesson')).not.toThrow();
  expect(restoreResumableLearnUiState(uiStateKey)).toBe('active');
  expect(() => clearLearnPageStorage({ lesson: lessonKey, uiState: uiStateKey })).not.toThrow();
}

afterEach(() => {
  restoreDefaultSessionStorage();
});

describe('learn session storage helpers', () => {
  it('creates the existing storage keys for the selected user', () => {
    expect(createLearnStorageKeys('user-123')).toEqual({
      session: 'learn:user-123',
      lesson: 'jp-lesson:learn:user-123',
      uiState: 'jp-uistate:learn:user-123',
    });
  });

  it('saves and restores lesson data and clears the key when lesson is null', () => {
    const storage = new FakeStorage();
    const key = 'jp-lesson:learn:user-123';

    saveLearnLesson(key, lesson, storage);

    expect(restoreLearnLesson(key, storage)).toEqual(lesson);

    saveLearnLesson(key, null, storage);

    expect(restoreLearnLesson(key, storage)).toBeNull();
  });

  it('returns null for invalid lesson JSON without throwing', () => {
    const storage = new FakeStorage();
    const key = 'jp-lesson:learn:user-123';
    storage.setItem(key, '{not valid JSON');

    expect(restoreLearnLesson(key, storage)).toBeNull();
  });

  it('ignores throwing storage while saving/restoring lessons', () => {
    const storage = new ThrowingStorage();

    expect(() => saveLearnLesson('jp-lesson:learn:user-123', lesson, storage)).not.toThrow();
    expect(restoreLearnLesson('jp-lesson:learn:user-123', storage)).toBeNull();
  });

  it('uses safe defaults when default session storage is absent', () => {
    removeDefaultSessionStorage();

    expectHelpersToHandleUnavailableDefaultStorage();
  });

  it('uses safe defaults when default session storage accessor throws', () => {
    blockDefaultSessionStorage();

    expectHelpersToHandleUnavailableDefaultStorage();
  });

  it('restores only resumable learn ui states and defaults to active otherwise', () => {
    const storage = new FakeStorage();
    const key = 'jp-uistate:learn:user-123';

    saveLearnUiState(key, 'lesson', storage);
    expect(restoreResumableLearnUiState(key, storage)).toBe('lesson');

    saveLearnUiState(key, 'active', storage);
    expect(restoreResumableLearnUiState(key, storage)).toBe('active');

    saveLearnUiState(key, 'loading', storage);
    expect(restoreResumableLearnUiState(key, storage)).toBe('active');

    storage.removeItem(key);
    expect(restoreResumableLearnUiState(key, storage)).toBe('active');
  });

  it('defaults to active when ui state storage throws', () => {
    expect(restoreResumableLearnUiState('jp-uistate:learn:user-123', new ThrowingStorage())).toBe(
      'active',
    );
  });

  it('clears lesson and ui state keys without touching the session key', () => {
    const storage = new FakeStorage();
    const keys = createLearnStorageKeys('user-123');
    storage.setItem(keys.session, 'session');
    storage.setItem(keys.lesson, 'lesson');
    storage.setItem(keys.uiState, 'active');

    clearLearnPageStorage(keys, storage);

    expect(storage.getItem(keys.lesson)).toBeNull();
    expect(storage.getItem(keys.uiState)).toBeNull();
    expect(storage.getItem(keys.session)).toBe('session');
  });

  it('ignores throwing storage while clearing learn page keys', () => {
    expect(() =>
      clearLearnPageStorage(
        { lesson: 'jp-lesson:learn:user-123', uiState: 'jp-uistate:learn:user-123' },
        new ThrowingStorage(),
      ),
    ).not.toThrow();
  });
});
