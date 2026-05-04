import { describe, expect, it } from 'vitest';
import type { Exercise } from '$lib/types';
import { orderExercisesForSession } from '$lib/utils/exercise-order';

function mockExercise(id: string, japanese: string): Exercise {
  return {
    id,
    type: 'multiple_choice',
    title: `Exercise ${id}`,
    japanese,
    romaji: 'test',
    englishContext: 'test',
    tags: [],
    difficulty: 1,
    question: 'Test?',
    choices: ['a', 'b'],
    correctAnswer: 'a',
  };
}

describe('orderExercisesForSession', () => {
  it('avoids back-to-back exercises for the same sentence when alternatives exist', () => {
    const exercises = [
      mockExercise('a-1', 'ありがとうございます'),
      mockExercise('a-2', 'ありがとうございます'),
      mockExercise('b-1', 'お願いします'),
      mockExercise('c-1', 'すみません'),
    ];

    const ordered = orderExercisesForSession(exercises, () => 0);

    expect(ordered).toHaveLength(exercises.length);
    expect(ordered.map((exercise) => exercise.id).sort()).toEqual(
      exercises.map((exercise) => exercise.id).sort(),
    );

    for (let index = 1; index < ordered.length; index += 1) {
      expect(ordered[index - 1]?.japanese).not.toBe(ordered[index]?.japanese);
    }
  });
});
