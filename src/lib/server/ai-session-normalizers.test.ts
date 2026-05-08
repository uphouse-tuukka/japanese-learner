import { describe, expect, it } from 'vitest';

import {
  normalizeExercise,
  normalizeLesson,
  normalizeMiniLesson,
  normalizePublicChallengeExercise,
  validateExerciseSet,
} from '$lib/server/ai-session-normalizers';
import type { Exercise } from '$lib/types';

function keyPhrase(index: number) {
  return {
    japanese: `日本語${index}`,
    romaji: `nihongo ${index}`,
    english: `Japanese ${index}`,
  };
}

function baseMultipleChoiceExercise(
  overrides: Partial<Extract<Exercise, { type: 'multiple_choice' }>> = {},
) {
  return {
    id: 'mc-1',
    type: 'multiple_choice' as const,
    title: 'Multiple Choice',
    japanese: 'すみません',
    romaji: 'sumimasen',
    englishContext: 'Polite attention phrase',
    tags: ['restaurant'],
    difficulty: 1 as const,
    question: 'What does すみません mean?',
    choices: ['Excuse me', 'Thank you', 'Goodbye', 'Please'],
    correctAnswer: 'Excuse me',
    ...overrides,
  } satisfies Extract<Exercise, { type: 'multiple_choice' }>;
}

describe('ai session normalizers', () => {
  describe('normalizeLesson', () => {
    it('accepts model-output aliases and normalizes key phrase fields', () => {
      const lesson = normalizeLesson({
        title: 'Restaurant basics',
        category: ' food_dining ',
        description: ' Ask politely for help. ',
        cultural_note: ' Cash trays are common. ',
        keyPhrases: [
          {
            jp: ' すみません ',
            romanji: ' sumimasen ',
            translation: ' Excuse me ',
            note: ' Getting attention politely ',
          },
        ],
      });

      expect(lesson).toEqual({
        topic: 'Restaurant basics',
        category: 'food_dining',
        explanation: 'Ask politely for help.',
        culturalNote: 'Cash trays are common.',
        keyPhrases: [
          {
            japanese: 'すみません',
            romaji: 'sumimasen',
            english: 'Excuse me',
            usage: 'Getting attention politely',
          },
        ],
      });
    });

    it('rejects missing and too-large key phrase sets', () => {
      const lessonBase = {
        topic: 'Restaurant basics',
        explanation: 'Ask politely for help.',
      };

      expect(() => normalizeLesson({ ...lessonBase, keyPhrases: [] })).toThrow(
        '[ai] lesson.keyPhrases must contain at least 1 entry',
      );
      expect(() =>
        normalizeLesson({
          ...lessonBase,
          keyPhrases: Array.from({ length: 9 }, (_, index) => keyPhrase(index)),
        }),
      ).toThrow('[ai] lesson.keyPhrases must contain 1-8 entries');
    });
  });

  describe('normalizeExercise and validateExerciseSet', () => {
    it('normalizes a representative exercise and clamps difficulty by level', () => {
      const exercise = normalizeExercise(
        {
          id: ' translate-1 ',
          type: 'translation',
          jp: ' すみません ',
          romanji: ' sumimasen ',
          context: ' Polite attention phrase ',
          difficulty: 99,
          tags: [{ label: 'restaurant' }, ' travel '],
          direction: 'ja_to_en',
          text: 'Translate: すみません',
          expected_answer: 'Excuse me',
          expected_romaji: 'sumimasen',
          alternatives: ['Excuse me', { value: 'Pardon me' }],
        },
        0,
        'beginner',
      );

      expect(exercise).toMatchObject({
        id: 'translate-1',
        type: 'translation',
        title: 'Translation',
        japanese: 'すみません',
        romaji: 'sumimasen',
        englishContext: 'Polite attention phrase',
        tags: ['restaurant', 'travel'],
        difficulty: 3,
        direction: 'ja_to_en',
        prompt: 'Translate: すみません',
        expectedAnswer: 'Excuse me',
        expectedRomaji: 'sumimasen',
        acceptedAnswers: ['Excuse me', 'Pardon me'],
      });
    });

    it('rejects disallowed exercise types and translation directions for a level', () => {
      const fillBlank = normalizeExercise(
        {
          id: 'fill-1',
          type: 'fill_blank',
          japanese: '水をください',
          romaji: 'mizu o kudasai',
          englishContext: 'Asking for water',
          difficulty: 2,
          sentence: '水を____',
          sentenceRomaji: 'mizu o ____',
          sentenceEnglish: 'Please give me water.',
          blank: 'ください',
          answer: 'ください',
          answerRomaji: 'kudasai',
        },
        0,
        'beginner',
      );
      const enToJa = normalizeExercise(
        {
          id: 'translation-1',
          type: 'translation',
          japanese: '水をください',
          romaji: 'mizu o kudasai',
          englishContext: 'Asking for water',
          difficulty: 2,
          direction: 'en_to_ja',
          prompt: 'Translate: Please give me water.',
          expectedAnswer: '水をください',
          acceptedAnswers: ['水をください'],
        },
        1,
        'beginner',
      );

      expect(() => validateExerciseSet([fillBlank], 'beginner')).toThrow(
        '[ai] Invalid exercise type for beginner: fill_blank',
      );
      expect(() => validateExerciseSet([enToJa], 'beginner')).toThrow(
        '[ai] beginner translation direction must be one of ja_to_en',
      );
    });
  });

  describe('normalizePublicChallengeExercise', () => {
    it('strips inline romaji and enforces the public multiple-choice answer patterns', () => {
      const meaningStyle = normalizePublicChallengeExercise(
        baseMultipleChoiceExercise({
          japanese: 'お願いします (onegaishimasu)',
          romaji: '',
          question: 'What does お願いします mean?',
          choices: ['Please', 'お願いします', 'Excuse me', '水 (mizu)'],
          correctAnswer: 'Please',
        }),
      );

      expect(meaningStyle.japanese).toBe('お願いします');
      expect(meaningStyle.romaji).toBe('onegaishimasu');
      expect(meaningStyle.type).toBe('multiple_choice');
      if (meaningStyle.type !== 'multiple_choice') {
        throw new Error('Expected meaningStyle to remain multiple_choice');
      }
      expect(meaningStyle.choices).toEqual(['Please', 'Excuse me']);
      expect(meaningStyle.correctAnswer).toBe('Please');

      const scenarioStyle = normalizePublicChallengeExercise(
        baseMultipleChoiceExercise({
          question: "You want a server's attention. What should you say?",
          choices: ['Please', 'すみません (sumimasen)', 'ありがとう (arigatou)', 'Goodbye'],
          correctAnswer: 'すみません (sumimasen)',
        }),
      );

      expect(scenarioStyle.type).toBe('multiple_choice');
      if (scenarioStyle.type !== 'multiple_choice') {
        throw new Error('Expected scenarioStyle to remain multiple_choice');
      }
      expect(scenarioStyle.choices).toEqual(['すみません (sumimasen)', 'ありがとう (arigatou)']);
      expect(scenarioStyle.correctAnswer).toBe('すみません (sumimasen)');
      expect(() =>
        normalizePublicChallengeExercise(
          baseMultipleChoiceExercise({
            question: "You want a server's attention. What should you say?",
            choices: ['Please', 'Excuse me', 'Thank you', 'Goodbye'],
            correctAnswer: 'Excuse me',
          }),
        ),
      ).toThrow(
        '[ai] Public challenge multiple_choice scenario question must use Japanese choices with romaji',
      );
    });
  });

  describe('normalizeMiniLesson', () => {
    it('handles aliases, array payloads, inline romaji, and kind normalization', () => {
      const miniLesson = normalizeMiniLesson([
        null,
        {
          type: 'likely response',
          phrase: 'おすすめは何ですか (osusume wa nan desu ka)',
          meaning: 'What do you recommend?',
          usage: 'Use this to ask staff for a recommendation.',
        },
      ]);

      expect(miniLesson).toEqual({
        kind: 'likely_reply',
        japanese: 'おすすめは何ですか',
        romaji: 'osusume wa nan desu ka',
        english: 'What do you recommend?',
        note: 'Use this to ask staff for a recommendation.',
      });
    });

    it('falls back to related_phrase kind and returns null when required fields are missing', () => {
      expect(
        normalizeMiniLesson({
          kind: 'unexpected kind',
          japanese: '大丈夫です',
          romaji: 'daijoubu desu',
          english: 'It is okay.',
          note: 'Useful for declining help politely.',
        }),
      ).toMatchObject({ kind: 'related_phrase' });

      expect(
        normalizeMiniLesson({
          japanese: '大丈夫です',
          romaji: 'daijoubu desu',
          english: 'It is okay.',
        }),
      ).toBeNull();
    });
  });
});
