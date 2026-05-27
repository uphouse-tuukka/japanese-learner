import { describe, expect, it } from 'vitest';

import {
  formatFillBlankContextText,
  formatFillBlankPromptText,
  formatMultipleChoiceQuestionText,
  getMultipleChoiceOptionDisplay,
  getMultipleChoiceSourcePrompt,
} from '$lib/utils/exercise-display';

describe('exercise display helpers', () => {
  it('inserts a visible blank when a fill-blank prompt still contains the answer', () => {
    expect(
      formatFillBlankPromptText({
        text: 'これは何ですか',
        answer: '何',
        blank: '何',
      }),
    ).toBe('これは____ですか');

    expect(
      formatFillBlankPromptText({
        text: 'kore wa nan desu ka',
        answer: 'nan',
        blank: 'nan',
      }),
    ).toBe('kore wa ____ desu ka');
  });

  it('keeps an existing fill-blank placeholder intact', () => {
    expect(
      formatFillBlankPromptText({
        text: '水を____',
        answer: 'ください',
        blank: '____',
      }),
    ).toBe('水を____');
  });

  it('keeps fill-blank English context complete when Japanese and romaji have blanks', () => {
    expect(
      formatFillBlankContextText({
        text: 'Every morning, I drink ___.',
        fallbackText: 'Every morning, I drink coffee.',
      }),
    ).toBe('Every morning, I drink coffee.');

    expect(
      formatFillBlankContextText({
        text: 'I go to Shinjuku.',
        fallbackText: 'You are saying where you are going.',
      }),
    ).toBe('I go to Shinjuku.');
  });

  it('falls back to explicit fill-blank instruction instead of showing an English blank', () => {
    expect(
      formatFillBlankContextText({
        text: 'Every morning, I drink ___.',
        fallbackText: 'You describe your daily morning habit ___.',
      }),
    ).toBe('Fill the missing Japanese word or romaji.');
  });

  it('hides counterpart language from multiple-choice option labels', () => {
    const pairedChoice = 'これは何ですか (kore wa nan desu ka) = What is this?';

    expect(
      getMultipleChoiceOptionDisplay({
        question: 'What does それは何ですか (sore wa nan desu ka) mean?',
        choice: pairedChoice,
      }),
    ).toBe('What is this?');

    expect(
      getMultipleChoiceOptionDisplay({
        question: 'You want to ask what this is. What would you say?',
        choice: pairedChoice,
      }),
    ).toBe('これは何ですか (kore wa nan desu ka)');
  });

  it('keeps Japanese options for questions that ask for a Japanese phrase', () => {
    const pairedChoice = 'トイレはどこですか (toire wa doko desu ka) = Where is the restroom?';

    expect(
      getMultipleChoiceOptionDisplay({
        question: 'Translate "Where is the restroom?" into Japanese (日本語).',
        choice: pairedChoice,
      }),
    ).toBe('トイレはどこですか (toire wa doko desu ka)');
  });

  it('surfaces the source Japanese phrase when English choices depend on hidden metadata', () => {
    expect(
      getMultipleChoiceSourcePrompt({
        question: 'What does this sentence politely ask for?',
        japanese: 'コーヒーを一つお願いします。',
        romaji: 'Koohii o hitotsu onegaishimasu.',
        choices: ['A table for one', 'One coffee', 'The bill', 'A glass of water'],
      }),
    ).toEqual({
      japanese: 'コーヒーを一つお願いします。',
      romaji: 'Koohii o hitotsu onegaishimasu.',
    });
  });

  it('normalizes metadata-dependent English-choice questions into self-contained prompts', () => {
    expect(
      formatMultipleChoiceQuestionText({
        question: 'What does this sentence politely ask for?',
        japanese: 'コーヒーを一つお願いします。',
        romaji: 'Koohii o hitotsu onegaishimasu.',
        choices: ['A table for one', 'One coffee', 'The bill', 'A glass of water'],
      }),
    ).toBe(
      'Phrase: コーヒーを一つお願いします。 (Koohii o hitotsu onegaishimasu.). What does this sentence politely ask for?',
    );
  });
});
