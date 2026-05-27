import { describe, expect, it } from 'vitest';

import { getDebugExercises } from '$lib/server/debug-exercises';
import { containsJapaneseScript } from '$lib/utils/exercise-display';

describe('debug exercises', () => {
  it('keeps multiple-choice debug questions self-contained when choices are English-only', () => {
    const exercises = getDebugExercises('multiple_choice', 2);

    for (const exercise of exercises) {
      expect(exercise.type).toBe('multiple_choice');
      if (exercise.type !== 'multiple_choice') continue;

      const choicesAreEnglishOnly = exercise.choices.every(
        (choice) => !containsJapaneseScript(choice),
      );
      if (!choicesAreEnglishOnly) continue;

      expect(exercise.question).toContain(exercise.japanese);
      expect(exercise.question).toContain(exercise.romaji);
    }
  });
});
