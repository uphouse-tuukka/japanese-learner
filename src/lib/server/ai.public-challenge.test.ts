import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockResponsesCreate } = vi.hoisted(() => {
  return {
    mockResponsesCreate: vi.fn(),
  };
});

vi.mock('openai', () => ({
  default: class MockOpenAI {
    responses = {
      create: mockResponsesCreate,
    };
  },
}));

vi.mock('$lib/config', () => ({
  config: {
    openai: {
      apiKey: 'test-api-key',
    },
  },
}));

import { generatePublicChallengePlan } from '$lib/server/ai';

function mockPublicChallengeModelOutput(payload: {
  lesson: {
    topic: string;
    category: string;
    explanation: string;
    culturalNote?: string;
    keyPhrases: Array<{
      japanese: string;
      romaji: string;
      english: string;
      usage?: string;
    }>;
  };
  exercises: unknown[];
  focus: string;
}) {
  mockResponsesCreate.mockResolvedValue({
    output_text: JSON.stringify(payload),
    usage: {
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
    },
  });
}

describe('generatePublicChallengePlan', () => {
  beforeEach(() => {
    mockResponsesCreate.mockReset();
    mockPublicChallengeModelOutput({
      lesson: {
        topic: 'Ordering food',
        category: 'food_dining',
        explanation: 'You can order politely at restaurants.',
        culturalNote: 'Be polite with staff.',
        keyPhrases: [
          {
            japanese: 'すみません (sumimasen)',
            romaji: 'sumimasen',
            english: 'Excuse me',
            usage: 'Use to get attention politely.',
          },
        ],
      },
      exercises: [
        {
          type: 'multiple_choice',
          japanese: 'お願いします (onegaishimasu)',
          romaji: 'onegaishimasu',
          englishContext: 'Polite request phrase',
          tags: ['restaurant'],
          difficulty: 1,
          question: 'What does お願いします (onegaishimasu) mean?',
          choices: ['Please', 'Thank you', 'Goodbye', 'Excuse me'],
          correctAnswer: 'Please',
        },
      ],
      focus: 'food_dining',
    });
  });

  it('sends a public challenge prompt contract with the two allowed multiple_choice patterns', async () => {
    await generatePublicChallengePlan({
      scenario: 'food_dining',
      scenarioLabel: 'Ordering at a restaurant',
      targetExerciseCount: 1,
    });

    const request = mockResponsesCreate.mock.calls[0]?.[0] as {
      input: Array<{ role: string; content: string }>;
    };
    const systemPrompt = request.input.find((message) => message.role === 'system')?.content ?? '';

    expect(systemPrompt).toContain(
      'Every exercise, regardless of type, MUST include these shared fields: type, japanese, romaji, englishContext, tags, difficulty.',
    );
    expect(systemPrompt).toContain('Exercise type-specific required fields:');
    expect(systemPrompt).toContain(
      'SCRIPT FORMATTING RULE: In fields named "japanese", output Japanese script only (no inline romaji and no parentheses). Put romanization only in fields named "romaji".',
    );
    expect(systemPrompt).toContain(
      'PUBLIC CHALLENGE MULTIPLE_CHOICE RULE: Only two patterns are allowed. Pattern 1: question is an English scenario asking what to say; all choices must be Japanese and include romaji in parentheses. Pattern 2: question includes a Japanese phrase and asks what it means; all choices must be English only.',
    );
    expect(systemPrompt).toContain(
      'NEVER generate English-scenario + English-only choices in public challenge.',
    );
  });

  it('normalizes inline romaji out of japanese fields in returned lesson and exercises', async () => {
    const plan = await generatePublicChallengePlan({
      scenario: 'food_dining',
      scenarioLabel: 'Ordering at a restaurant',
      targetExerciseCount: 1,
    });

    expect(plan.lesson.keyPhrases[0]?.japanese).toBe('すみません');
    expect(plan.lesson.keyPhrases[0]?.romaji).toBe('sumimasen');
    expect(plan.exercises[0]?.japanese).toBe('お願いします');
    expect(plan.exercises[0]?.romaji).toBe('onegaishimasu');
  });

  it('normalizes mixed-language meaning multiple_choice options to an English-only set', async () => {
    mockPublicChallengeModelOutput({
      lesson: {
        topic: 'Ordering food',
        category: 'food_dining',
        explanation: 'You can order politely at restaurants.',
        keyPhrases: [
          {
            japanese: 'すみません',
            romaji: 'sumimasen',
            english: 'Excuse me',
          },
        ],
      },
      exercises: [
        {
          type: 'multiple_choice',
          japanese: 'すみません',
          romaji: 'sumimasen',
          englishContext: 'Polite phrase',
          tags: ['restaurant'],
          difficulty: 1,
          question: 'What does すみません mean?',
          choices: ['Please', 'Thank you', 'すみません', 'Excuse me'],
          correctAnswer: 'Excuse me',
        },
      ],
      focus: 'food_dining',
    });

    const plan = await generatePublicChallengePlan({
      scenario: 'food_dining',
      scenarioLabel: 'Ordering at a restaurant',
      targetExerciseCount: 1,
    });

    const exercise = plan.exercises[0];
    expect(exercise?.type).toBe('multiple_choice');
    if (exercise?.type !== 'multiple_choice') return;

    expect(exercise.choices).not.toContain('すみません');
    expect(
      exercise.choices.every(
        (choice) => !/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]/u.test(choice),
      ),
    ).toBe(true);
    expect(exercise.correctAnswer).toBe('Excuse me');
  });

  it('drops an invalid scenario-style multiple_choice that has English-only choices', async () => {
    mockPublicChallengeModelOutput({
      lesson: {
        topic: 'Ordering food',
        category: 'food_dining',
        explanation: 'You can order politely at restaurants.',
        keyPhrases: [
          {
            japanese: 'すみません',
            romaji: 'sumimasen',
            english: 'Excuse me',
          },
        ],
      },
      exercises: [
        {
          type: 'multiple_choice',
          japanese: 'すみません',
          romaji: 'sumimasen',
          englishContext: 'Polite phrase',
          tags: ['restaurant'],
          difficulty: 1,
          question: "You want to get a server's attention. What should you say?",
          choices: ['Please', 'Thank you', 'Goodbye', 'Excuse me'],
          correctAnswer: 'Excuse me',
        },
        {
          type: 'translation',
          japanese: 'お願いします',
          romaji: 'onegaishimasu',
          englishContext: 'Polite request phrase',
          tags: ['restaurant'],
          difficulty: 1,
          direction: 'ja_to_en',
          prompt: 'Translate: お願いします (onegaishimasu)',
          expectedAnswer: 'Please',
          acceptedAnswers: ['Please', 'Please do', 'I request'],
        },
      ],
      focus: 'food_dining',
    });

    const plan = await generatePublicChallengePlan({
      scenario: 'food_dining',
      scenarioLabel: 'Ordering at a restaurant',
      targetExerciseCount: 1,
    });

    expect(
      plan.exercises.some(
        (exercise) =>
          exercise.type === 'multiple_choice' &&
          exercise.question === "You want to get a server's attention. What should you say?",
      ),
    ).toBe(false);
    expect(plan.exercises).toHaveLength(1);
    expect(plan.exercises[0]?.type).toBe('translation');
  });

  it('keeps a valid scenario-style multiple_choice with Japanese choices and romaji', async () => {
    mockPublicChallengeModelOutput({
      lesson: {
        topic: 'Ordering food',
        category: 'food_dining',
        explanation: 'You can order politely at restaurants.',
        keyPhrases: [
          {
            japanese: 'すみません',
            romaji: 'sumimasen',
            english: 'Excuse me',
          },
        ],
      },
      exercises: [
        {
          type: 'multiple_choice',
          japanese: 'すみません',
          romaji: 'sumimasen',
          englishContext: 'Polite phrase',
          tags: ['restaurant'],
          difficulty: 1,
          question: "You want to get a server's attention. What should you say?",
          choices: [
            'すみません (sumimasen)',
            'ありがとう (arigatou)',
            'さようなら (sayounara)',
            'はい (hai)',
          ],
          correctAnswer: 'すみません (sumimasen)',
        },
      ],
      focus: 'food_dining',
    });

    const plan = await generatePublicChallengePlan({
      scenario: 'food_dining',
      scenarioLabel: 'Ordering at a restaurant',
      targetExerciseCount: 1,
    });

    const exercise = plan.exercises[0];
    expect(exercise?.type).toBe('multiple_choice');
    if (exercise?.type !== 'multiple_choice') return;

    expect(exercise.question).toBe("You want to get a server's attention. What should you say?");
    expect(exercise.choices).toEqual(
      expect.arrayContaining([
        'すみません (sumimasen)',
        'ありがとう (arigatou)',
        'さようなら (sayounara)',
        'はい (hai)',
      ]),
    );
    expect(exercise.choices).toHaveLength(4);
    expect(exercise.choices.every((choice) => /\(.+\)/u.test(choice))).toBe(true);
    expect(exercise.correctAnswer).toBe('すみません (sumimasen)');
  });
});
