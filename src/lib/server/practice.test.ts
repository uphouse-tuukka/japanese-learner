import { describe, expect, it } from 'vitest';
import type { Exercise } from '$lib/types';
import { pickTopExercises, scoreCandidate, toExerciseCount } from '$lib/server/practice';

function mockExercise(id: string): Exercise {
  return {
    id,
    type: 'multiple_choice',
    title: `Test ${id}`,
    japanese: 'テスト',
    romaji: 'tesuto',
    englishContext: 'test',
    tags: [],
    difficulty: 1,
    question: 'Test?',
    choices: ['a', 'b'],
    correctAnswer: 'a',
  } as Exercise;
}

type CandidateInput = {
  id: string;
  wrongCount: number;
  correctCount: number;
  lastSeenAt: string | null;
};

function candidate(input: CandidateInput) {
  return {
    exercise: mockExercise(input.id),
    wrongCount: input.wrongCount,
    correctCount: input.correctCount,
    lastSeenAt: input.lastSeenAt,
  };
}

describe('scoreCandidate', () => {
  it('returns 7 for never-seen exercise with no history', () => {
    const score = scoreCandidate(
      candidate({
        id: 'a',
        wrongCount: 0,
        correctCount: 0,
        lastSeenAt: null,
      }),
    );

    expect(score).toBe(7);
  });

  it('returns 22 for never-seen exercise with 3 wrong and 0 correct', () => {
    const score = scoreCandidate(
      candidate({
        id: 'a',
        wrongCount: 3,
        correctCount: 0,
        lastSeenAt: null,
      }),
    );

    expect(score).toBe(22);
  });

  it('returns 1 for seen exercise with 0 wrong and 5 correct', () => {
    const score = scoreCandidate(
      candidate({
        id: 'a',
        wrongCount: 0,
        correctCount: 5,
        lastSeenAt: '2025-01-01T00:00:00.000Z',
      }),
    );

    expect(score).toBe(1);
  });

  it('returns 13 for seen exercise with 2 wrong and 1 correct', () => {
    const score = scoreCandidate(
      candidate({
        id: 'a',
        wrongCount: 2,
        correctCount: 1,
        lastSeenAt: '2025-01-01T00:00:00.000Z',
      }),
    );

    expect(score).toBe(13);
  });

  it('returns 6 for seen exercise with 1 wrong and 3 correct', () => {
    const score = scoreCandidate(
      candidate({
        id: 'a',
        wrongCount: 1,
        correctCount: 3,
        lastSeenAt: '2025-01-01T00:00:00.000Z',
      }),
    );

    expect(score).toBe(6);
  });
});

describe('toExerciseCount', () => {
  it('uses fallback 6 for undefined', () => {
    expect(toExerciseCount(undefined)).toBe(6);
  });

  it('uses fallback 6 for NaN', () => {
    expect(toExerciseCount(Number.NaN)).toBe(6);
  });

  it('clamps to minimum 4', () => {
    expect(toExerciseCount(3)).toBe(4);
  });

  it('clamps to maximum 12', () => {
    expect(toExerciseCount(15)).toBe(12);
  });

  it('rounds to nearest integer', () => {
    expect(toExerciseCount(7.6)).toBe(8);
  });

  it('passes through valid in-range integer', () => {
    expect(toExerciseCount(10)).toBe(10);
  });
});

describe('pickTopExercises', () => {
  it('returns highest-scored candidates first', () => {
    const result = pickTopExercises(
      [
        candidate({
          id: 'low',
          wrongCount: 0,
          correctCount: 5,
          lastSeenAt: '2025-01-03T00:00:00.000Z',
        }),
        candidate({
          id: 'top',
          wrongCount: 3,
          correctCount: 0,
          lastSeenAt: null,
        }),
        candidate({
          id: 'mid',
          wrongCount: 1,
          correctCount: 3,
          lastSeenAt: '2025-01-02T00:00:00.000Z',
        }),
      ],
      3,
    );

    expect(result.map((exercise) => exercise.id)).toEqual(['top', 'mid', 'low']);
  });

  it('breaks score ties by oldest lastSeenAt first', () => {
    const result = pickTopExercises(
      [
        candidate({
          id: 'newer',
          wrongCount: 1,
          correctCount: 3,
          lastSeenAt: '2025-01-03T00:00:00.000Z',
        }),
        candidate({
          id: 'older',
          wrongCount: 1,
          correctCount: 3,
          lastSeenAt: '2025-01-01T00:00:00.000Z',
        }),
      ],
      2,
    );

    expect(result.map((exercise) => exercise.id)).toEqual(['older', 'newer']);
  });

  it('respects target count and returns only N items', () => {
    const result = pickTopExercises(
      [
        candidate({
          id: 'a',
          wrongCount: 3,
          correctCount: 0,
          lastSeenAt: null,
        }),
        candidate({
          id: 'b',
          wrongCount: 2,
          correctCount: 1,
          lastSeenAt: '2025-01-01T00:00:00.000Z',
        }),
        candidate({
          id: 'c',
          wrongCount: 1,
          correctCount: 3,
          lastSeenAt: '2025-01-01T00:00:00.000Z',
        }),
      ],
      2,
    );

    expect(result).toHaveLength(2);
    expect(result.map((exercise) => exercise.id)).toEqual(['a', 'b']);
  });

  it('returns fewer than target when candidates are fewer than target', () => {
    const result = pickTopExercises(
      [
        candidate({
          id: 'only',
          wrongCount: 0,
          correctCount: 0,
          lastSeenAt: null,
        }),
      ],
      5,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('only');
  });

  it('returns an empty array for empty candidates', () => {
    expect(pickTopExercises([], 3)).toEqual([]);
  });
});
