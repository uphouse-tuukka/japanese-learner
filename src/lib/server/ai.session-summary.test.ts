/**
 * Regression tests for the session-summary mini-lesson and cultural-note variance feature.
 *
 * Coverage:
 * - generateSessionSummary: mini-lesson present, missing, and malformed
 * - generateSessionSummary: handoffNotes returned separately from the learner summary
 * - generateSessionSummary: legacy next_focus field falls back to handoffNotes
 * - generateSessionSummary: no nextSteps in the returned SessionSummary for normal sessions
 * - generateSessionPlan: anti-repeat cultural note context limited to the last 4 sessions
 * - generateSessionPlan: prior handoff uses handoffNotes; falls back to nextSteps for legacy entries
 * - generateSessionPlan: recentCulturalNotesBlock is absent when no culturalNote in history
 */
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

import { generateSessionPlan, generateSessionSummary } from '$lib/server/ai';
import type { Exercise } from '$lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockModelOutput(payload: Record<string, unknown>) {
  mockResponsesCreate.mockResolvedValue({
    output_text: JSON.stringify(payload),
    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
  });
}

function minimalMultipleChoiceExercise(id: string): Exercise {
  return {
    id,
    type: 'multiple_choice',
    title: 'Test exercise',
    japanese: 'すみません',
    romaji: 'sumimasen',
    englishContext: 'Excuse me',
    tags: ['greetings'],
    difficulty: 1,
    question: 'What does すみません (sumimasen) mean?',
    choices: ['Excuse me', 'Thank you', 'Hello', 'Goodbye'],
    correctAnswer: 'Excuse me',
  };
}

function minimalSessionResults(exerciseId: string) {
  return [{ exerciseId, answerText: 'Excuse me', isCorrect: true }];
}

function validSummaryModelPayload(overrides: Record<string, unknown> = {}) {
  return {
    summary: 'You did well this session.',
    patterns_strong: ['Polite requests'],
    patterns_weak: ['Particle usage'],
    mini_lesson: {
      kind: 'related_phrase',
      japanese: 'おすすめは何ですか',
      romaji: 'osusume wa nan desu ka',
      english: 'What do you recommend?',
      note: 'Useful when you want the staff to suggest a dish.',
    },
    handoff_notes: ['Extend polite service interaction patterns.'],
    levelUpRecommendation: null,
    ...overrides,
  };
}

function minimalSessionPlanPayload() {
  // generateSessionPlan requires at least ceil(targetExerciseCount / 2) valid exercises.
  // The exerciseCount clamps to a minimum of 4, so minExercises = ceil(4/2) = 2.
  // Provide 3 to exceed the minimum comfortably.
  const sharedExerciseBase = {
    type: 'multiple_choice' as const,
    englishContext: 'Polite attention',
    tags: ['restaurant'],
    difficulty: 1,
    choices: ['Excuse me', 'Thank you', 'Hello', 'Goodbye'],
    correctAnswer: 'Excuse me',
  };
  return {
    lesson: {
      topic: 'Ordering food',
      category: 'food_dining',
      explanation: 'Polite ordering.',
      culturalNote: 'No tipping in Japan.',
      keyPhrases: [
        { japanese: 'すみません', romaji: 'sumimasen', english: 'Excuse me', usage: 'Attention' },
      ],
    },
    exercises: [
      {
        ...sharedExerciseBase,
        title: 'Excuse me',
        japanese: 'すみません',
        romaji: 'sumimasen',
        question: 'What does すみません (sumimasen) mean?',
      },
      {
        ...sharedExerciseBase,
        title: 'Please',
        japanese: 'お願いします',
        romaji: 'onegaishimasu',
        question: 'What does お願いします (onegaishimasu) mean?',
        choices: ['Please', 'Thank you', 'Hello', 'Goodbye'],
        correctAnswer: 'Please',
      },
      {
        ...sharedExerciseBase,
        title: 'Thank you very much',
        japanese: 'ありがとうございます',
        romaji: 'arigatou gozaimasu',
        question: 'What does ありがとうございます (arigatou gozaimasu) mean?',
        choices: ['Thank you very much', 'Excuse me', 'Hello', 'Goodbye'],
        correctAnswer: 'Thank you very much',
      },
    ],
    focus: 'restaurant_ordering',
  };
}

function baseSessionInput() {
  const ex = minimalMultipleChoiceExercise('ex-1');
  return {
    sessionId: 'session-abc',
    userId: 'user-1',
    userLevel: 'beginner' as const,
    lessonTopic: 'Ordering food',
    exercises: [ex],
    results: minimalSessionResults('ex-1'),
  };
}

// ---------------------------------------------------------------------------
// generateSessionSummary
// ---------------------------------------------------------------------------

describe('generateSessionSummary', () => {
  beforeEach(() => {
    mockResponsesCreate.mockReset();
  });

  it('returns a well-formed mini-lesson when the model provides one', async () => {
    mockModelOutput(validSummaryModelPayload());

    const { summary } = await generateSessionSummary(baseSessionInput());

    expect(summary.miniLesson).not.toBeNull();
    expect(summary.miniLesson).toMatchObject({
      kind: 'related_phrase',
      japanese: 'おすすめは何ですか',
      romaji: 'osusume wa nan desu ka',
      english: 'What do you recommend?',
      note: expect.any(String),
    });
  });

  it('returns null miniLesson when the model omits mini_lesson', async () => {
    mockModelOutput(validSummaryModelPayload({ mini_lesson: undefined }));

    const { summary } = await generateSessionSummary(baseSessionInput());

    expect(summary.miniLesson).toBeNull();
  });

  it('returns null miniLesson when the model provides an empty object', async () => {
    mockModelOutput(validSummaryModelPayload({ mini_lesson: {} }));

    const { summary } = await generateSessionSummary(baseSessionInput());

    expect(summary.miniLesson).toBeNull();
  });

  it('returns null miniLesson when mini_lesson is missing required fields', async () => {
    // Missing `note` — should not pass normalization
    mockModelOutput(
      validSummaryModelPayload({
        mini_lesson: {
          kind: 'related_phrase',
          japanese: 'おすすめは何ですか',
          romaji: 'osusume wa nan desu ka',
          english: 'What do you recommend?',
          // note is absent
        },
      }),
    );

    const { summary } = await generateSessionSummary(baseSessionInput());

    expect(summary.miniLesson).toBeNull();
  });

  it('returns null miniLesson when mini_lesson is a non-object value', async () => {
    mockModelOutput(validSummaryModelPayload({ mini_lesson: 'just a string' }));

    const { summary } = await generateSessionSummary(baseSessionInput());

    expect(summary.miniLesson).toBeNull();
  });

  it('accepts mini_lesson wrapped in an array and uses the first valid item', async () => {
    mockModelOutput(
      validSummaryModelPayload({
        mini_lesson: [
          {
            kind: 'likely_reply',
            japanese: 'はい',
            romaji: 'hai',
            english: 'Yes',
            note: 'Simple affirmative.',
          },
        ],
      }),
    );

    const { summary } = await generateSessionSummary(baseSessionInput());

    expect(summary.miniLesson).toMatchObject({ kind: 'likely_reply', english: 'Yes' });
  });

  it('returns handoffNotes from the model separately and not included in SessionSummary', async () => {
    mockModelOutput(
      validSummaryModelPayload({
        handoff_notes: ['Focus on particle が vs を next session.'],
      }),
    );

    const result = await generateSessionSummary(baseSessionInput());

    expect(result.handoffNotes).toEqual(['Focus on particle が vs を next session.']);
    // handoffNotes should NOT appear on the SessionSummary object itself
    expect(result.summary).not.toHaveProperty('handoffNotes');
  });

  it('falls back to legacy next_focus values as handoffNotes when handoff_notes absent', async () => {
    mockModelOutput(
      validSummaryModelPayload({
        handoff_notes: undefined,
        next_focus: ['Review polite endings.'],
      }),
    );

    const result = await generateSessionSummary(baseSessionInput());

    expect(result.handoffNotes).toEqual(['Review polite endings.']);
  });

  it('does not expose nextSteps on the returned SessionSummary when the model only returns handoff_notes', async () => {
    mockModelOutput(
      validSummaryModelPayload({
        handoff_notes: ['Internal note.'],
        next_focus: undefined,
        nextSteps: undefined,
      }),
    );

    const { summary } = await generateSessionSummary(baseSessionInput());

    // The learner-facing summary must not carry forward nextSteps as a populated list
    // (legacy field may still exist but only if the model explicitly returned it)
    const hasPopulatedNextSteps = Array.isArray(summary.nextSteps) && summary.nextSteps.length > 0;
    expect(hasPopulatedNextSteps).toBe(false);
  });

  it('preserves a valid mini_lesson kind of nuance_upgrade', async () => {
    mockModelOutput(
      validSummaryModelPayload({
        mini_lesson: {
          kind: 'nuance_upgrade',
          japanese: 'いただきます',
          romaji: 'itadakimasu',
          english: 'I humbly receive',
          note: 'Said before eating as a ritual expression of gratitude.',
        },
      }),
    );

    const { summary } = await generateSessionSummary(baseSessionInput());

    expect(summary.miniLesson?.kind).toBe('nuance_upgrade');
  });

  it('normalises an unknown kind to related_phrase', async () => {
    mockModelOutput(
      validSummaryModelPayload({
        mini_lesson: {
          kind: 'bonus_phrase', // unknown kind
          japanese: 'ちょっと待って',
          romaji: 'chotto matte',
          english: 'Wait a moment',
          note: 'Casual way to ask someone to wait.',
        },
      }),
    );

    const { summary } = await generateSessionSummary(baseSessionInput());

    expect(summary.miniLesson?.kind).toBe('related_phrase');
  });

  it('computes accuracy from results regardless of mini_lesson presence', async () => {
    mockModelOutput(validSummaryModelPayload({ mini_lesson: null }));

    // 1 correct out of 1 = 100%
    const { summary } = await generateSessionSummary(baseSessionInput());

    expect(summary.accuracy).toBe(100);
  });

  it('computes zero accuracy when all results are incorrect', async () => {
    mockModelOutput(validSummaryModelPayload({ mini_lesson: null }));
    const ex = minimalMultipleChoiceExercise('ex-2');

    const { summary } = await generateSessionSummary({
      ...baseSessionInput(),
      exercises: [ex],
      results: [{ exerciseId: 'ex-2', answerText: 'Wrong answer', isCorrect: false }],
    });

    expect(summary.accuracy).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateSessionPlan — cultural note anti-repeat context
// ---------------------------------------------------------------------------

describe('generateSessionPlan — anti-repeat cultural note context', () => {
  beforeEach(() => {
    mockResponsesCreate.mockReset();
    mockModelOutput(minimalSessionPlanPayload());
  });

  it('includes a RECENT CULTURAL NOTES block when session history has cultural notes', async () => {
    await generateSessionPlan({
      userId: 'user-1',
      userName: 'Tester',
      userLevel: 'beginner',
      sessionHistory: [
        {
          date: '2025-01-01',
          category: 'food_dining',
          topic: 'Ordering politely',
          accuracy: 80,
          strengths: [],
          weaknesses: [],
          keyPhrases: [],
          culturalNote: 'In Japan, you do not tip.',
        },
      ],
    });

    const call = mockResponsesCreate.mock.calls[0]?.[0] as {
      input: Array<{ role: string; content: string }>;
    };
    const systemPrompt = call.input.find((m) => m.role === 'system')?.content ?? '';

    expect(systemPrompt).toContain('RECENT CULTURAL NOTES');
    expect(systemPrompt).toContain('In Japan, you do not tip.');
  });

  it('limits the cultural notes block to at most 4 entries even when history has more', async () => {
    // Provide 6 sessions each with a distinct cultural note
    const sessionHistory = Array.from({ length: 6 }, (_, i) => ({
      date: `2025-01-0${i + 1}`,
      category: 'greetings_basics',
      topic: `Topic ${i + 1}`,
      accuracy: 75,
      strengths: [],
      weaknesses: [],
      keyPhrases: [],
      culturalNote: `Cultural note number ${i + 1}`,
    }));

    await generateSessionPlan({
      userId: 'user-1',
      userName: 'Tester',
      userLevel: 'beginner',
      sessionHistory,
    });

    const call = mockResponsesCreate.mock.calls[0]?.[0] as {
      input: Array<{ role: string; content: string }>;
    };
    const systemPrompt = call.input.find((m) => m.role === 'system')?.content ?? '';

    // Only the first 4 (most recent) notes should appear — notes 5 and 6 from the oldest
    // sessions are beyond the limit
    const countMatches = (str: string, sub: string) => str.split(sub).length - 1;
    const notesInPrompt = countMatches(systemPrompt, 'Cultural note number');
    expect(notesInPrompt).toBe(4);

    // Notes 5 and 6 (index 4 and 5) should not appear because only first 4 are used
    expect(systemPrompt).not.toContain('Cultural note number 5');
    expect(systemPrompt).not.toContain('Cultural note number 6');
  });

  it('omits the RECENT CULTURAL NOTES block entirely when no session has a culturalNote', async () => {
    await generateSessionPlan({
      userId: 'user-1',
      userName: 'Tester',
      userLevel: 'beginner',
      sessionHistory: [
        {
          date: '2025-01-01',
          topic: 'Greetings',
          accuracy: 70,
          strengths: [],
          weaknesses: [],
          keyPhrases: [],
          // no culturalNote
        },
      ],
    });

    const call = mockResponsesCreate.mock.calls[0]?.[0] as {
      input: Array<{ role: string; content: string }>;
    };
    const systemPrompt = call.input.find((m) => m.role === 'system')?.content ?? '';

    expect(systemPrompt).not.toContain('RECENT CULTURAL NOTES');
  });

  it('omits sessions with empty string culturalNote from the anti-repeat block', async () => {
    await generateSessionPlan({
      userId: 'user-1',
      userName: 'Tester',
      userLevel: 'beginner',
      sessionHistory: [
        {
          date: '2025-01-01',
          topic: 'Greetings',
          accuracy: 70,
          strengths: [],
          weaknesses: [],
          keyPhrases: [],
          culturalNote: '   ', // whitespace only
        },
      ],
    });

    const call = mockResponsesCreate.mock.calls[0]?.[0] as {
      input: Array<{ role: string; content: string }>;
    };
    const systemPrompt = call.input.find((m) => m.role === 'system')?.content ?? '';

    expect(systemPrompt).not.toContain('RECENT CULTURAL NOTES');
  });

  it('prompt instructs the model to avoid repeating sumimasen-style micro-themes', async () => {
    await generateSessionPlan({
      userId: 'user-1',
      userName: 'Tester',
      userLevel: 'beginner',
      sessionHistory: [],
    });

    const call = mockResponsesCreate.mock.calls[0]?.[0] as {
      input: Array<{ role: string; content: string }>;
    };
    const systemPrompt = call.input.find((m) => m.role === 'system')?.content ?? '';

    expect(systemPrompt).toContain('sumimasen');
    expect(systemPrompt).toContain('Avoid repeating recent cultural notes');
  });
});

// ---------------------------------------------------------------------------
// generateSessionPlan — prior handoff notes (handoffNotes vs nextSteps)
// ---------------------------------------------------------------------------

describe('generateSessionPlan — prior handoff notes context', () => {
  beforeEach(() => {
    mockResponsesCreate.mockReset();
    mockModelOutput(minimalSessionPlanPayload());
  });

  it('uses handoffNotes when present in a session history entry', async () => {
    await generateSessionPlan({
      userId: 'user-1',
      userName: 'Tester',
      userLevel: 'beginner',
      sessionHistory: [
        {
          date: '2025-01-01',
          topic: 'Ordering food',
          accuracy: 70,
          strengths: [],
          weaknesses: ['particle errors'],
          keyPhrases: [],
          handoffNotes: ['Extend polite particle patterns.'],
        },
      ],
    });

    const call = mockResponsesCreate.mock.calls[0]?.[0] as {
      input: Array<{ role: string; content: string }>;
    };
    const systemPrompt = call.input.find((m) => m.role === 'system')?.content ?? '';

    expect(systemPrompt).toContain('PRIOR SESSION HANDOFF');
    expect(systemPrompt).toContain('Extend polite particle patterns.');
  });

  it('falls back to nextSteps for legacy session entries that have no handoffNotes', async () => {
    await generateSessionPlan({
      userId: 'user-1',
      userName: 'Tester',
      userLevel: 'beginner',
      sessionHistory: [
        {
          date: '2025-01-01',
          topic: 'Greetings',
          accuracy: 65,
          strengths: [],
          weaknesses: ['vowel length'],
          keyPhrases: [],
          nextSteps: ['Practice long vowels in everyday phrases.'],
          // no handoffNotes — legacy entry
        },
      ],
    });

    const call = mockResponsesCreate.mock.calls[0]?.[0] as {
      input: Array<{ role: string; content: string }>;
    };
    const systemPrompt = call.input.find((m) => m.role === 'system')?.content ?? '';

    expect(systemPrompt).toContain('PRIOR SESSION HANDOFF');
    expect(systemPrompt).toContain('Practice long vowels in everyday phrases.');
  });

  it('prefers handoffNotes over nextSteps when both are present (new-style entry)', async () => {
    await generateSessionPlan({
      userId: 'user-1',
      userName: 'Tester',
      userLevel: 'beginner',
      sessionHistory: [
        {
          date: '2025-01-01',
          topic: 'Transport',
          accuracy: 72,
          strengths: [],
          weaknesses: [],
          keyPhrases: [],
          handoffNotes: ['Build on directional vocabulary.'],
          nextSteps: ['Old next steps text.'],
        },
      ],
    });

    const call = mockResponsesCreate.mock.calls[0]?.[0] as {
      input: Array<{ role: string; content: string }>;
    };
    const systemPrompt = call.input.find((m) => m.role === 'system')?.content ?? '';

    expect(systemPrompt).toContain('Build on directional vocabulary.');
    expect(systemPrompt).not.toContain('Old next steps text.');
  });

  it('includes the category rotation soft-guidance instruction', async () => {
    await generateSessionPlan({
      userId: 'user-1',
      userName: 'Tester',
      userLevel: 'beginner',
      sessionHistory: [],
    });

    const call = mockResponsesCreate.mock.calls[0]?.[0] as {
      input: Array<{ role: string; content: string }>;
    };
    const systemPrompt = call.input.find((m) => m.role === 'system')?.content ?? '';

    // Category rotation is authoritative; handoff notes must not override it
    expect(systemPrompt).toContain(
      'do not override category rotation or force artificial continuity',
    );
  });
});
