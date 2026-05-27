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

    it('normalizes speaking exercises with aliases, fallback answers, and recording clamp', () => {
      const exercise = normalizeExercise(
        {
          id: 'speak-1',
          type: 'speaking',
          japanese: 'トイレはどこですか。',
          romaji: 'toire wa doko desu ka',
          englishContext: 'Asking for the restroom',
          difficulty: 2,
          tags: ['travel'],
          prompt: 'Speak Japanese to ask where the restroom is.',
          responseKind: 'translation_en_to_ja',
          expected_answer: 'トイレはどこですか。',
          expected_romaji: 'toire wa doko desu ka',
          alternatives: ['お手洗いはどこですか。'],
          rubric: 'Accept a natural question asking where the restroom is.',
          maxRecordingSeconds: 99,
        },
        2,
        'pre_intermediate',
      );

      expect(exercise).toMatchObject({
        id: 'speak-1',
        type: 'speaking',
        title: 'Speaking Practice',
        responseKind: 'translation_en_to_ja',
        expectedAnswer: 'トイレはどこですか。',
        expectedRomaji: 'toire wa doko desu ka',
        acceptedAnswers: ['お手洗いはどこですか。'],
        rubric: 'Accept a natural question asking where the restroom is.',
        maxRecordingSeconds: 20,
      });
    });

    it('defaults speaking response kind, accepted answers, and recording duration', () => {
      const exercise = normalizeExercise(
        {
          id: 'speak-2',
          type: 'speaking',
          japanese: '水をください。',
          romaji: 'mizu o kudasai',
          englishContext: 'Ordering water',
          difficulty: 2,
          prompt: 'Speak Japanese to ask for water.',
          responseKind: 'unexpected',
          expectedAnswer: '水をください。',
          expectedRomaji: 'mizu o kudasai',
          rubric: 'Accept a polite request for water.',
          maxRecordingSeconds: 1,
        },
        3,
        'elementary',
      );

      expect(exercise.type).toBe('speaking');
      if (exercise.type !== 'speaking') return;
      expect(exercise.responseKind).toBe('situational_response');
      expect(exercise.acceptedAnswers).toEqual(['水をください。', 'mizu o kudasai']);
      expect(exercise.maxRecordingSeconds).toBe(5);
    });

    it('rejects speaking by level and elementary translation-style speaking', () => {
      const situational = normalizeExercise(
        {
          id: 'speak-3',
          type: 'speaking',
          japanese: '水をください。',
          romaji: 'mizu o kudasai',
          englishContext: 'Ordering water',
          difficulty: 2,
          prompt: 'Speak Japanese to ask for water.',
          responseKind: 'situational_response',
          expectedAnswer: '水をください。',
          expectedRomaji: 'mizu o kudasai',
          rubric: 'Accept a polite request for water.',
        },
        4,
        'elementary',
      );
      const translationStyle = { ...situational, responseKind: 'translation_en_to_ja' as const };

      expect(() => validateExerciseSet([situational], 'beginner')).toThrow(
        '[ai] Invalid exercise type for beginner: speaking',
      );
      expect(() => validateExerciseSet([translationStyle], 'elementary')).toThrow(
        '[ai] elementary speaking exercises must use situational_response',
      );
      expect(validateExerciseSet([translationStyle], 'pre_intermediate')).toEqual([
        translationStyle,
      ]);
    });

    it('normalizes fill-blank prompts that still contain the answer into visible blanks', () => {
      const exercise = normalizeExercise(
        {
          id: 'fill-visible-blank',
          type: 'fill_blank',
          japanese: 'これは何ですか',
          romaji: 'kore wa nan desu ka',
          englishContext: 'Asking what something is',
          difficulty: 2,
          sentence: 'これは何ですか',
          sentenceRomaji: 'kore wa nan desu ka',
          sentenceEnglish: 'What is this?',
          blank: '何',
          answer: '何',
          answerRomaji: 'nan',
        },
        5,
        'elementary',
      );

      expect(exercise.type).toBe('fill_blank');
      if (exercise.type !== 'fill_blank') return;
      expect(exercise.sentence).toBe('これは____ですか');
      expect(exercise.sentenceRomaji).toBe('kore wa ____ desu ka');
      expect(exercise.blank).toBe('____');
    });

    it('normalizes fill-blank English context so only Japanese and romaji have blanks', () => {
      const exercise = normalizeExercise(
        {
          id: 'fill-english-context',
          type: 'fill_blank',
          japanese: '毎朝、コーヒーを飲みます。',
          romaji: 'Maiasa, koohii o nomimasu.',
          englishContext: 'Every morning, I drink coffee.',
          difficulty: 1,
          sentence: '毎朝、____を飲みます。',
          sentenceRomaji: 'Maiasa, ____ o nomimasu.',
          sentenceEnglish: 'Every morning, I drink ___.',
          blank: '____',
          answer: 'コーヒー',
          answerRomaji: 'koohii',
        },
        6,
        'elementary',
      );

      expect(exercise.type).toBe('fill_blank');
      if (exercise.type !== 'fill_blank') return;
      expect(exercise.sentence).toBe('毎朝、____を飲みます。');
      expect(exercise.sentenceRomaji).toBe('Maiasa, ____ o nomimasu.');
      expect(exercise.sentenceEnglish).toBe('Every morning, I drink coffee.');
    });

    it('normalizes meaning-style multiple-choice choices to English-only options', () => {
      const exercise = normalizeExercise(
        {
          id: 'mc-meaning-pairs',
          type: 'multiple_choice',
          japanese: 'それは何ですか',
          romaji: 'sore wa nan desu ka',
          englishContext: 'Asking what something is',
          difficulty: 2,
          question: 'What does それは何ですか (sore wa nan desu ka) mean?',
          choices: [
            'これは何ですか (kore wa nan desu ka) = What is this?',
            'それは何ですか (sore wa nan desu ka) = What is that?',
            'トイレはどこですか (toire wa doko desu ka) = Where is the restroom?',
            'いくらですか (ikura desu ka) = How much is it?',
          ],
          correctAnswer: 'それは何ですか (sore wa nan desu ka) = What is that?',
        },
        6,
        'elementary',
      );

      expect(exercise.type).toBe('multiple_choice');
      if (exercise.type !== 'multiple_choice') return;
      expect(exercise.choices).toEqual(
        expect.arrayContaining([
          'What is this?',
          'What is that?',
          'Where is the restroom?',
          'How much is it?',
        ]),
      );
      expect(
        exercise.choices.every(
          (choice) => !/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]/u.test(choice),
        ),
      ).toBe(true);
      expect(exercise.choices.every((choice) => !choice.includes('='))).toBe(true);
      expect(exercise.correctAnswer).toBe('What is that?');
    });

    it('normalizes English-choice multiple-choice questions to include the hidden Japanese phrase', () => {
      const exercise = normalizeExercise(
        {
          id: 'mc-hidden-source',
          type: 'multiple_choice',
          japanese: 'コーヒーを一つお願いします。',
          romaji: 'Koohii o hitotsu onegaishimasu.',
          englishContext: 'You are ordering one coffee at a cafe.',
          difficulty: 1,
          question: 'What does this sentence politely ask for?',
          choices: ['A table for one', 'One coffee', 'The bill', 'A glass of water'],
          correctAnswer: 'One coffee',
        },
        7,
        'elementary',
      );

      expect(exercise.type).toBe('multiple_choice');
      if (exercise.type !== 'multiple_choice') return;
      expect(exercise.question).toBe(
        'Phrase: コーヒーを一つお願いします。 (Koohii o hitotsu onegaishimasu.). What does this sentence politely ask for?',
      );
      expect(exercise.choices).toEqual(
        expect.arrayContaining(['A table for one', 'One coffee', 'The bill', 'A glass of water']),
      );
      expect(exercise.correctAnswer).toBe('One coffee');
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
