import { describe, expect, it } from 'vitest';

import { getDebugExercises } from '$lib/server/debug-exercises';
import {
  containsJapaneseScript,
  VISIBLE_FILL_BLANK_PLACEHOLDER,
} from '$lib/utils/exercise-display';

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

  it('keeps fill-blank debug English context complete while Japanese and romaji carry the blank', () => {
    const exercises = getDebugExercises('fill_blank', 2);

    for (const exercise of exercises) {
      expect(exercise.type).toBe('fill_blank');
      if (exercise.type !== 'fill_blank') continue;

      expect(exercise.sentence).toContain(VISIBLE_FILL_BLANK_PLACEHOLDER);
      expect(exercise.sentenceRomaji).toContain(VISIBLE_FILL_BLANK_PLACEHOLDER);
      expect(exercise.sentenceEnglish).not.toContain(VISIBLE_FILL_BLANK_PLACEHOLDER);
      expect(exercise.sentenceEnglish).not.toContain('___');
    }
  });
});
