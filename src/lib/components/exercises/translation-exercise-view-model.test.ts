import { describe, expect, it } from 'vitest';
import {
  buildAcceptedAnswers,
  buildDirectionDisplay,
  buildHintText,
  buildPromptDisplay,
} from './translation-exercise-view-model';
import type { TranslationExercise } from '$lib/types';

function translationExercise(overrides: Partial<TranslationExercise> = {}): TranslationExercise {
  return {
    id: 'translation-1',
    type: 'translation',
    title: 'Translate a polite request',
    japanese: 'お会計お願いします',
    romaji: 'okaikei onegaishimasu',
    englishContext: 'Restaurant checkout',
    tags: ['restaurant'],
    difficulty: 2,
    direction: 'ja_to_en',
    prompt: 'Please ask for the bill.',
    expectedAnswer: 'Check, please.',
    expectedRomaji: 'chekku puriizu',
    acceptedAnswers: ['Bill, please.', 'Check, please.'],
    ...overrides,
  };
}

describe('translation exercise view-model helpers', () => {
  it('builds direction labels for the existing badge copy', () => {
    expect(buildDirectionDisplay('ja_to_en')).toEqual({
      sourceLabel: '日本語',
      targetLabel: 'English',
    });

    expect(buildDirectionDisplay('en_to_ja')).toEqual({
      sourceLabel: 'English',
      targetLabel: '日本語',
    });
  });

  it('keeps the existing hint text thresholds', () => {
    expect(buildHintText('お会計お願いします', 0)).toBe('');
    expect(buildHintText('お会計お願いします', 1)).toBe('お...');
    expect(buildHintText('お会計お願いします', 2)).toBe('お会計...');
    expect(buildHintText('お会計お願いします', 3)).toBe('お会計...');
  });

  it('deduplicates accepted answers while preserving the expected answer first', () => {
    expect(
      buildAcceptedAnswers(
        translationExercise({
          expectedAnswer: 'お願いします',
          acceptedAnswers: ['ください', 'お願いします', 'お願い', 'ください'],
        }),
      ),
    ).toEqual(['お願いします', 'ください', 'お願い']);
  });

  it('builds the Japanese prompt display for ja_to_en exercises', () => {
    expect(buildPromptDisplay(translationExercise({ direction: 'ja_to_en' }))).toEqual({
      kind: 'japanese',
      japanese: 'お会計お願いします',
      romaji: 'okaikei onegaishimasu',
    });
  });

  it('builds the English prompt display for en_to_ja exercises', () => {
    expect(buildPromptDisplay(translationExercise({ direction: 'en_to_ja' }))).toEqual({
      kind: 'english',
      prompt: 'Please ask for the bill.',
    });
  });
});
