import { describe, expect, it } from 'vitest';

import {
  formatFillBlankPromptText,
  getMultipleChoiceOptionDisplay,
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
});
