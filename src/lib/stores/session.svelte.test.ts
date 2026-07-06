import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercise, Session } from '$lib/types';
import {
  hasSavedSession,
  markSessionCompleteInStorage,
  resetSession,
  restoreSessionFromStorage,
  state,
} from './session.svelte';

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

function buildSession(id: string): Session {
  return {
    id,
    userId: 'user-1',
    mode: 'ai',
    status: 'planned',
    model: 'gpt-5.4',
    tokenInput: 10,
    tokenOutput: 20,
    summary: null,
    createdAt: '2026-07-01T08:00:00.000Z',
    completedAt: null,
  };
}

function buildExercise(index: number): Exercise {
  return {
    id: `exercise-${index}`,
    type: 'multiple_choice',
    title: `Exercise ${index}`,
    japanese: 'こんにちは',
    romaji: 'konnichiwa',
    englishContext: 'Hello.',
    tags: ['greetings_basics'],
    difficulty: 1,
    question: 'What does こんにちは (konnichiwa) mean?',
    choices: ['Hello', 'Goodbye'],
    correctAnswer: 'Hello',
  };
}

function buildExercises(count: number): Exercise[] {
  return Array.from({ length: count }, (_, index) => buildExercise(index + 1));
}

function buildAnswers(targetExercises: Exercise[]) {
  return targetExercises.map((exercise) => ({
    exerciseId: exercise.id,
    answerText: 'Hello',
    isCorrect: true,
    createdAt: '2026-07-01T08:05:00.000Z',
  }));
}

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

describe('session store persistence', () => {
  function useFakeStorage(): FakeStorage {
    const storage = new FakeStorage();
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: storage,
    });
    return storage;
  }

  beforeEach(() => {
    resetSession();
  });

  afterEach(() => {
    resetSession();
    vi.restoreAllMocks();
    restoreDefaultSessionStorage();
  });

  it('does not restore an explicitly completed Learn session at 8 of 8 as resumable progress', () => {
    const storage = useFakeStorage();
    const key = 'learn:user-1';
    const staleExercises = buildExercises(8);

    storage.setItem(
      `jp-session:${key}`,
      JSON.stringify({
        session: buildSession('stale-session'),
        exercises: staleExercises,
        answers: buildAnswers(staleExercises),
        currentIndex: 7,
        completionConfirmed: true,
        savedAt: '2026-07-01T08:05:00.000Z',
      }),
    );

    expect(hasSavedSession(key)).toBe(false);
    expect(restoreSessionFromStorage(key)).toBe(false);
    expect(state.session).toBeNull();
    expect(state.exercises).toEqual([]);
    expect(state.currentIndex).toBe(0);
  });

  it('does not restore a legacy fully answered Learn session without a completion marker', () => {
    const storage = useFakeStorage();
    const key = 'learn:user-1';
    const staleExercises = buildExercises(8);

    storage.setItem(
      `jp-session:${key}`,
      JSON.stringify({
        session: buildSession('legacy-stale-session'),
        exercises: staleExercises,
        answers: buildAnswers(staleExercises),
        currentIndex: 7,
        savedAt: '2026-07-01T08:05:00.000Z',
      }),
    );

    expect(hasSavedSession(key)).toBe(false);
    expect(restoreSessionFromStorage(key)).toBe(false);
    expect(state.session).toBeNull();
    expect(state.exercises).toEqual([]);
    expect(state.currentIndex).toBe(0);
  });

  it('restores a fully answered session when server completion has not been confirmed', () => {
    const storage = useFakeStorage();
    const key = 'learn:user-1';
    const recoverableExercises = buildExercises(8);
    const recoverableAnswers = buildAnswers(recoverableExercises);

    storage.setItem(
      `jp-session:${key}`,
      JSON.stringify({
        session: buildSession('recoverable-session'),
        exercises: recoverableExercises,
        answers: recoverableAnswers,
        currentIndex: 7,
        completionConfirmed: false,
        savedAt: '2026-07-01T08:05:00.000Z',
      }),
    );

    expect(hasSavedSession(key)).toBe(true);
    expect(restoreSessionFromStorage(key)).toBe(true);
    expect(state.session?.id).toBe('recoverable-session');
    expect(state.exercises).toHaveLength(8);
    expect(state.answers).toEqual(recoverableAnswers);
    expect(state.currentIndex).toBe(7);
  });

  it('marks a saved session as complete only after server completion is confirmed', () => {
    const storage = useFakeStorage();
    const key = 'practice:user-1';
    const savedExercises = buildExercises(2);

    storage.setItem(
      `jp-session:${key}`,
      JSON.stringify({
        session: buildSession('practice-session'),
        exercises: savedExercises,
        answers: buildAnswers(savedExercises),
        currentIndex: 1,
        completionConfirmed: false,
        savedAt: '2026-07-01T08:05:00.000Z',
      }),
    );

    expect(hasSavedSession(key)).toBe(true);

    markSessionCompleteInStorage(key);

    expect(hasSavedSession(key)).toBe(false);
    expect(restoreSessionFromStorage(key)).toBe(false);
  });
});
