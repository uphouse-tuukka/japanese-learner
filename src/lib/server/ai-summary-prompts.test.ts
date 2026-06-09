import { describe, expect, it } from 'vitest';

import {
  buildSessionSummaryPrompt,
  buildUpdatedJournalPrompt,
  type SessionSummaryPromptInput,
  type UpdatedJournalPromptInput,
} from '$lib/server/ai-summary-prompts';
import type { Exercise, SessionSummary } from '$lib/types';

function translationExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'exercise-translation-1',
    type: 'translation',
    title: 'Translate a polite request',
    japanese: 'お願いします',
    romaji: 'onegaishimasu',
    englishContext: 'Please',
    tags: ['food_dining'],
    difficulty: 1,
    direction: 'ja_to_en',
    prompt: 'お願いします (onegaishimasu)',
    expectedAnswer: 'Please',
    acceptedAnswers: ['Please', 'Please do', 'I request it'],
    ...overrides,
  } as Exercise;
}

function multipleChoiceExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'exercise-choice-1',
    type: 'multiple_choice',
    title: 'Choose a polite attention getter',
    japanese: 'すみません',
    romaji: 'sumimasen',
    englishContext: 'Excuse me',
    tags: ['greetings_basics'],
    difficulty: 1,
    question: 'What does すみません (sumimasen) mean?',
    choices: ['Excuse me', 'Thank you', 'Hello', 'Goodbye'],
    correctAnswer: 'Excuse me',
    ...overrides,
  } as Exercise;
}

function baseSessionSummaryPromptInput(
  overrides: Partial<SessionSummaryPromptInput> = {},
): SessionSummaryPromptInput {
  const exercise = translationExercise();
  return {
    sessionId: 'session-123',
    userId: 'user-abc',
    userLevel: 'beginner',
    japaneseWritingEnabled: true,
    lessonTopic: 'Ordering food',
    exercises: [exercise],
    results: [{ exerciseId: exercise.id, answerText: 'Please', isCorrect: true }],
    ...overrides,
  };
}

function messageContent(
  messages: Array<{ role: string; content: string }>,
  role: 'system' | 'user',
): string {
  return messages.find((message) => message.role === role)?.content ?? '';
}

function parseCurrentSessionData(userContent: string): {
  accuracy: number;
  lessonTopic: string;
  japaneseWritingEnabled: boolean;
  exercises: Array<Record<string, unknown>>;
  results: Array<Record<string, unknown>>;
} {
  const marker = 'CURRENT SESSION DATA:\n';
  const markerIndex = userContent.indexOf(marker);
  expect(markerIndex).toBeGreaterThanOrEqual(0);
  return JSON.parse(userContent.slice(markerIndex + marker.length));
}

describe('buildSessionSummaryPrompt', () => {
  it('computes accuracy and includes current session data with expected answer details', () => {
    const translation = translationExercise();
    const multipleChoice = multipleChoiceExercise();

    const prompt = buildSessionSummaryPrompt(
      baseSessionSummaryPromptInput({
        lessonTopic: 'Restaurant requests',
        exercises: [translation, multipleChoice],
        results: [
          { exerciseId: translation.id, answerText: 'Please do', isCorrect: true },
          { exerciseId: multipleChoice.id, answerText: 'Thank you', isCorrect: false },
          { exerciseId: 'missing-exercise', answerText: 'Unknown response', isCorrect: true },
        ],
      }),
    );

    expect(prompt.accuracy).toBe(67);

    const currentSessionData = parseCurrentSessionData(messageContent(prompt.messages, 'user'));
    expect(currentSessionData).toMatchObject({
      sessionId: 'session-123',
      userId: 'user-abc',
      userLevel: 'beginner',
      japaneseWritingEnabled: true,
      lessonTopic: 'Restaurant requests',
      accuracy: 67,
    });
    expect(currentSessionData.exercises).toEqual([
      {
        id: translation.id,
        type: 'translation',
        title: 'Translate a polite request',
        japanese: 'お願いします',
        romaji: 'onegaishimasu',
        englishContext: 'Please',
        difficulty: 1,
      },
      {
        id: multipleChoice.id,
        type: 'multiple_choice',
        title: 'Choose a polite attention getter',
        japanese: 'すみません',
        romaji: 'sumimasen',
        englishContext: 'Excuse me',
        difficulty: 1,
      },
    ]);
    expect(currentSessionData.results).toEqual([
      {
        exerciseId: translation.id,
        type: 'translation',
        title: 'Translate a polite request',
        prompt: 'Please',
        answerText: 'Please do',
        expectedAnswer: 'Please',
        acceptedAnswers: ['Please', 'Please do', 'I request it'],
        isCorrect: true,
      },
      {
        exerciseId: multipleChoice.id,
        type: 'multiple_choice',
        title: 'Choose a polite attention getter',
        prompt: 'Excuse me',
        answerText: 'Thank you',
        expectedAnswer: 'Excuse me',
        acceptedAnswers: ['Excuse me'],
        isCorrect: false,
      },
      {
        exerciseId: 'missing-exercise',
        type: 'unknown',
        title: 'Unknown exercise',
        prompt: '',
        answerText: 'Unknown response',
        expectedAnswer: '',
        acceptedAnswers: [],
        isCorrect: true,
      },
    ]);
  });

  it('includes learner progress journal and compact recent sessions with key phrases capped to five', () => {
    const prompt = buildSessionSummaryPrompt(
      baseSessionSummaryPromptInput({
        progressJournal: '  **Progress snapshot** — prior cumulative notes.  ',
        recentSessions: [
          {
            topic: 'Ordering noodles',
            accuracy: 82,
            keyPhrases: ['phrase-1', 'phrase-2', 'phrase-3', 'phrase-4', 'phrase-5', 'phrase-6'],
            exerciseTypes: ['multiple_choice', 'translation'],
          },
          {
            topic: 'Buying tickets',
            accuracy: 60,
            keyPhrases: ['ticket phrase'],
            exerciseTypes: [],
          },
        ],
      }),
    );

    const userContent = messageContent(prompt.messages, 'user');
    expect(userContent).toContain(
      'LEARNER PROGRESS JOURNAL (cumulative history):\n**Progress snapshot** — prior cumulative notes.\n',
    );
    expect(userContent).toContain('RECENT SESSIONS (last 2):\n');

    const recentSessionsJson = userContent.match(
      /RECENT SESSIONS \(last 2\):\n(.+)\nCURRENT SESSION DATA:/u,
    )?.[1];
    expect(recentSessionsJson).toBeDefined();
    expect(JSON.parse(recentSessionsJson ?? '[]')).toEqual([
      {
        topic: 'Ordering noodles',
        accuracy: 82,
        keyPhrases: ['phrase-1', 'phrase-2', 'phrase-3', 'phrase-4', 'phrase-5'],
        exerciseTypes: ['multiple_choice', 'translation'],
      },
      {
        topic: 'Buying tickets',
        accuracy: 60,
        keyPhrases: ['ticket phrase'],
        exerciseTypes: [],
      },
    ]);
  });

  it('switches the level-up recommendation instruction when promotion is suppressed', () => {
    const normalPrompt = buildSessionSummaryPrompt(baseSessionSummaryPromptInput());
    const suppressedPrompt = buildSessionSummaryPrompt(
      baseSessionSummaryPromptInput({ suppressPromotion: true }),
    );

    const normalSystemPrompt = messageContent(normalPrompt.messages, 'system');
    const suppressedSystemPrompt = messageContent(suppressedPrompt.messages, 'system');

    expect(normalSystemPrompt).toContain(
      '7) levelUpRecommendation: null or {recommendedLevel, reason}. Recommend promotion only with consistent mastery (>=80% recent accuracy + strong evidence across multiple sessions). Never promote ready_for_japan. Do NOT recommend promotion in consecutive sessions.',
    );
    expect(suppressedSystemPrompt).toContain(
      '7) levelUpRecommendation: MUST be null. A promotion was recently recommended — do NOT suggest another promotion this session.',
    );
    expect(suppressedSystemPrompt).not.toContain(
      'Recommend promotion only with consistent mastery',
    );
  });

  it('instructs the model that summary is a concise top recap with a concrete cap', () => {
    const prompt = buildSessionSummaryPrompt(baseSessionSummaryPromptInput());
    const systemPrompt = messageContent(prompt.messages, 'system');

    expect(systemPrompt).toContain(
      'summary: This is the short top recap shown under the score. Write 1-3 concise sentences, 35-60 words maximum.',
    );
    expect(systemPrompt).toContain(
      'Do NOT make summary exercise-by-exercise feedback, an essay, or a duplicate of patterns_strong, patterns_weak, or mini_lesson.',
    );
  });
});

function completedSessionSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    sessionId: 'session-123',
    userId: 'user-abc',
    summary: 'You handled station direction phrases with good confidence.',
    strengths: ['Polite station vocabulary'],
    weaknesses: ['Particles に and へ need contrast practice'],
    nextSteps: ['Contrast に and へ in destination phrases'],
    accuracy: 80,
    generatedAt: '2026-01-01T00:00:00.000Z',
    miniLesson: null,
    levelUpRecommendation: null,
    ...overrides,
  };
}

function baseUpdatedJournalPromptInput(
  overrides: Partial<UpdatedJournalPromptInput> = {},
): UpdatedJournalPromptInput {
  return {
    currentJournal: null,
    sessionSummary: completedSessionSummary(),
    sessionMeta: {
      topic: 'Asking directions at a station',
      exerciseTypes: ['multiple_choice', 'translation'],
      keyPhrases: ['駅はどこですか', '右に曲がってください'],
    },
    userLevel: 'beginner',
    ...overrides,
  };
}

describe('buildUpdatedJournalPrompt', () => {
  it('uses the first-session fallback and includes ordered journal headings, no-romaji instruction, and session payload', () => {
    const prompt = buildUpdatedJournalPrompt(baseUpdatedJournalPromptInput());
    const systemPrompt = messageContent(prompt.messages, 'system');
    const userPrompt = messageContent(prompt.messages, 'user');

    const orderedHeadings = [
      '**Categories & topics covered** — list each category with its topics (e.g., food_dining: ordering, menu items)',
      '**Vocabulary bank** — key phrases learned, capped at ~30 most recent/important. Drop older mastered items to stay under cap.',
      '**Persistent weak spots** — only patterns that keep recurring across multiple sessions. Remove items the learner has since mastered.',
      '**Progress snapshot** — session count, current level, any streak info',
      '**Learning trajectory** — 1-2 sentences on overall direction and readiness',
    ];
    let previousHeadingIndex = -1;
    for (const heading of orderedHeadings) {
      const headingIndex = systemPrompt.indexOf(heading);
      expect(headingIndex).toBeGreaterThan(previousHeadingIndex);
      previousHeadingIndex = headingIndex;
    }
    expect(systemPrompt).toContain('Do NOT include romaji — this data is for AI consumption only.');

    const expectedSessionPayload = {
      level: 'beginner',
      category: 'unknown',
      topic: 'Asking directions at a station',
      exerciseTypes: ['multiple_choice', 'translation'],
      keyPhrases: ['駅はどこですか', '右に曲がってください'],
      summary: 'You handled station direction phrases with good confidence.',
      accuracy: 80,
      strengths: ['Polite station vocabulary'],
      weaknesses: ['Particles に and へ need contrast practice'],
      nextSteps: ['Contrast に and へ in destination phrases'],
    };
    expect(userPrompt).toBe(
      [
        "EXISTING_JOURNAL:\nThis is the user's first session.",
        'SESSION:',
        JSON.stringify(expectedSessionPayload),
      ].join('\n'),
    );
  });
});
