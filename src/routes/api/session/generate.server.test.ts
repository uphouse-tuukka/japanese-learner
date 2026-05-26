import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGenerateSessionPlan,
  mockDeleteStaleGhostSessions,
  mockGetCompletedAiExerciseResultsForUser,
  mockGetCompletedAiSessionsForUser,
  mockGetExerciseResultsForUser,
  mockGetSessionsForUser,
  mockCreateSessionRecord,
  mockAttachExercisesToSession,
  mockCheckBudget,
  mockRecordUsageEvent,
  mockGetUser,
} = vi.hoisted(() => ({
  mockGenerateSessionPlan: vi.fn(),
  mockDeleteStaleGhostSessions: vi.fn(),
  mockGetCompletedAiExerciseResultsForUser: vi.fn(),
  mockGetCompletedAiSessionsForUser: vi.fn(),
  mockGetExerciseResultsForUser: vi.fn(),
  mockGetSessionsForUser: vi.fn(),
  mockCreateSessionRecord: vi.fn(),
  mockAttachExercisesToSession: vi.fn(),
  mockCheckBudget: vi.fn(),
  mockRecordUsageEvent: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('$lib/server/ai', () => ({
  generateSessionPlan: mockGenerateSessionPlan,
  TOPIC_CATEGORIES: [{ key: 'greetings_basics' }, { key: 'food_dining' }],
}));

vi.mock('$lib/server/db', () => ({
  attachExercisesToSession: mockAttachExercisesToSession,
  createSessionRecord: mockCreateSessionRecord,
  deleteStaleGhostSessions: mockDeleteStaleGhostSessions,
  getCompletedAiExerciseResultsForUser: mockGetCompletedAiExerciseResultsForUser,
  getCompletedAiSessionsForUser: mockGetCompletedAiSessionsForUser,
  getExerciseResultsForUser: mockGetExerciseResultsForUser,
  getSessionsForUser: mockGetSessionsForUser,
}));

vi.mock('$lib/server/token-limiter', () => ({
  checkBudget: mockCheckBudget,
  recordUsageEvent: mockRecordUsageEvent,
}));

vi.mock('$lib/server/users', () => ({
  getUser: mockGetUser,
}));

import { POST } from './generate/+server';

const lesson = {
  topic: 'Basic greetings',
  category: 'greetings_basics',
  explanation: 'Learn a few polite greeting phrases.',
  culturalNote: 'Use a calm, friendly greeting when entering a small shop.',
  keyPhrases: [],
};

const alternateCategoryLesson = {
  ...lesson,
  topic: 'Ordering food',
  category: 'food_dining',
  explanation: 'Learn a few polite ordering phrases.',
  culturalNote: 'Be polite with staff.',
};

const exercises = [
  {
    id: 'exercise-1',
    type: 'multiple_choice',
    title: 'Ordering food',
    japanese: 'ください',
    romaji: 'kudasai',
    englishContext: 'Please give me...',
    tags: ['food'],
    difficulty: 1,
    question: 'What does ください mean?',
    choices: ['Please', 'Goodbye'],
    correctAnswer: 'Please',
  },
];

const session = {
  id: 'session-1',
  userId: 'user-1',
  mode: 'ai',
  status: 'planned',
  model: 'gpt-5.4',
  tokenInput: 10,
  tokenOutput: 20,
  summary: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  completedAt: null,
};

const generatedPlan = {
  model: 'gpt-5.4',
  lesson,
  exercises,
  tokenUsage: {
    input: 10,
    output: 20,
  },
  metadata: {},
};

function buildGeneratedPlan(
  overrides: {
    lesson?: Partial<typeof lesson>;
    tokenUsage?: { input: number; output: number };
    model?: string;
  } = {},
) {
  return {
    model: overrides.model ?? generatedPlan.model,
    lesson: { ...lesson, ...overrides.lesson },
    exercises,
    tokenUsage: overrides.tokenUsage ?? generatedPlan.tokenUsage,
    metadata: {},
  };
}

function buildSessionSummary(input: {
  category: string;
  topic: string;
  accuracy?: number;
  keyPhraseDetails?: Array<{
    japanese?: string;
    romaji?: string;
    english?: string;
    usage?: string;
  }>;
  keyPhrases?: string[];
  weaknesses?: string[];
  handoffNotes?: string[];
}) {
  const keyPhraseDetails = input.keyPhraseDetails ?? [];
  return JSON.stringify({
    summaryText: `Summary for ${input.topic}`,
    category: input.category,
    topic: input.topic,
    accuracy: input.accuracy ?? 80,
    strengths: [],
    weaknesses: input.weaknesses ?? [],
    nextSteps: [],
    handoffNotes: input.handoffNotes ?? [],
    exerciseTypes: ['multiple_choice'],
    keyPhrases:
      input.keyPhrases ??
      keyPhraseDetails
        .map((phrase) => phrase.japanese ?? phrase.romaji ?? phrase.english ?? '')
        .filter(Boolean),
    keyPhraseDetails,
  });
}

function buildCompletedAiSession(input: {
  id: string;
  createdAt: string;
  category: string;
  topic: string;
  accuracy?: number;
  keyPhraseDetails?: Array<{
    japanese?: string;
    romaji?: string;
    english?: string;
    usage?: string;
  }>;
  weaknesses?: string[];
  handoffNotes?: string[];
}) {
  return {
    id: input.id,
    userId: 'user-1',
    mode: 'ai',
    status: 'completed',
    model: 'gpt-5.4',
    tokenInput: 10,
    tokenOutput: 20,
    summary: buildSessionSummary(input),
    createdAt: input.createdAt,
    completedAt: input.createdAt,
  };
}

function buildMultipleChoiceExercise(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exercise-coverage-1',
    type: 'multiple_choice',
    title: 'Request politely',
    japanese: 'ください',
    romaji: 'kudasai',
    englishContext: 'Please give me...',
    tags: ['food'],
    difficulty: 1,
    question: 'What does ください (kudasai) mean?',
    choices: ['Please', 'Goodbye'],
    correctAnswer: 'Please',
    ...overrides,
  };
}

function buildMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    name: 'Test User',
    level: 'beginner',
    japaneseWritingEnabled: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastActiveAt: null,
    progressJournal: null,
    ...overrides,
  };
}

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/session/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildRawRequest(body: string): Request {
  return new Request('http://localhost/api/session/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

function buildCookies(selectedUserId: string | null = 'user-1') {
  const cookieValue = selectedUserId ?? undefined;

  return {
    get(name: string) {
      return name === 'selected_user' ? cookieValue : undefined;
    },
  };
}

async function generateSession(body: unknown, selectedUserId: string | null = 'user-1') {
  return POST({ request: buildRequest(body), cookies: buildCookies(selectedUserId) } as never);
}

function expectNoGenerationDbOrTokenWrites() {
  expect(mockGenerateSessionPlan).not.toHaveBeenCalled();
  expect(mockDeleteStaleGhostSessions).not.toHaveBeenCalled();
  expect(mockGetCompletedAiExerciseResultsForUser).not.toHaveBeenCalled();
  expect(mockGetCompletedAiSessionsForUser).not.toHaveBeenCalled();
  expect(mockGetExerciseResultsForUser).not.toHaveBeenCalled();
  expect(mockGetSessionsForUser).not.toHaveBeenCalled();
  expect(mockCreateSessionRecord).not.toHaveBeenCalled();
  expect(mockAttachExercisesToSession).not.toHaveBeenCalled();
  expect(mockCheckBudget).not.toHaveBeenCalled();
  expect(mockRecordUsageEvent).not.toHaveBeenCalled();
  expect(mockGetUser).not.toHaveBeenCalled();
}

describe('POST /api/session/generate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.unstubAllEnvs();
    mockGenerateSessionPlan.mockReset();
    mockDeleteStaleGhostSessions.mockReset();
    mockGetCompletedAiExerciseResultsForUser.mockReset();
    mockGetCompletedAiSessionsForUser.mockReset();
    mockGetExerciseResultsForUser.mockReset();
    mockGetSessionsForUser.mockReset();
    mockCreateSessionRecord.mockReset();
    mockAttachExercisesToSession.mockReset();
    mockCheckBudget.mockReset();
    mockRecordUsageEvent.mockReset();
    mockGetUser.mockReset();

    mockCheckBudget.mockResolvedValue({ allowed: true });
    mockGetUser.mockResolvedValue(buildMockUser());
    mockGetCompletedAiExerciseResultsForUser.mockResolvedValue([]);
    mockGetCompletedAiSessionsForUser.mockResolvedValue([]);
    mockGetSessionsForUser.mockResolvedValue([]);
    mockGetExerciseResultsForUser.mockResolvedValue([]);
    mockGenerateSessionPlan.mockResolvedValue(generatedPlan);
    mockCreateSessionRecord.mockResolvedValue(session);
    mockAttachExercisesToSession.mockResolvedValue(undefined);
    mockRecordUsageEvent.mockResolvedValue(undefined);
  });

  it('generates a session for a matching selected_user cookie using the trimmed userId and clamped exerciseCount', async () => {
    const response = await generateSession({ userId: ' user-1 ', exerciseCount: 99 }, ' user-1 ');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      state: 'active',
      session,
      lesson,
      exercises,
    });
    expect(mockDeleteStaleGhostSessions).toHaveBeenCalledWith('user-1');
    expect(mockCheckBudget).toHaveBeenCalledWith('user-1');
    expect(mockGetUser).toHaveBeenCalledWith('user-1');
    expect(mockGetSessionsForUser).toHaveBeenCalledWith('user-1', 10);
    expect(mockGetCompletedAiSessionsForUser).toHaveBeenCalledWith('user-1');
    expect(mockGetCompletedAiExerciseResultsForUser).toHaveBeenCalledWith('user-1');
    expect(mockGetExerciseResultsForUser).toHaveBeenCalledWith('user-1');
    expect(mockGenerateSessionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        exerciseCount: 12,
        japaneseWritingEnabled: false,
      }),
    );
    expect(mockCreateSessionRecord).toHaveBeenCalledWith({
      userId: 'user-1',
      mode: 'ai',
      status: 'planned',
      model: 'gpt-5.4',
      tokenInput: 10,
      tokenOutput: 20,
    });
    expect(mockAttachExercisesToSession).toHaveBeenCalledWith('session-1', exercises);
    expect(mockRecordUsageEvent).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      model: 'gpt-5.4',
      tokensIn: 10,
      tokensOut: 20,
    });
  });

  it('generates a session when no selected_user cookie is present', async () => {
    const response = await generateSession({ userId: ' user-1 ', exerciseCount: 2 }, null);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      state: 'active',
      session,
      lesson,
      exercises,
    });
    expect(mockDeleteStaleGhostSessions).toHaveBeenCalledWith('user-1');
    expect(mockGenerateSessionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        exerciseCount: 4,
      }),
    );
  });

  it('passes the persisted Japanese writing preference into session generation', async () => {
    mockGetUser.mockResolvedValueOnce(buildMockUser({ japaneseWritingEnabled: true }));

    const response = await generateSession(
      { userId: 'user-1', exerciseCount: 8, japaneseWritingEnabled: false },
      'user-1',
    );

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        japaneseWritingEnabled: true,
      }),
    );
  });

  it('builds Coverage Evidence from full completed AI history and joined exercise results for generation', async () => {
    mockGetUser.mockResolvedValueOnce(
      buildMockUser({
        progressJournal: 'Learner still hesitates on ください (kudasai) requests.',
      }),
    );
    mockGetCompletedAiSessionsForUser.mockResolvedValueOnce([
      buildCompletedAiSession({
        id: 'session-2',
        createdAt: '2026-05-03T08:00:00.000Z',
        category: 'food_dining',
        topic: 'Restaurant requests',
        accuracy: 45,
        weaknesses: ['Needs more practice with ください (kudasai).'],
        handoffNotes: ['Review ください (kudasai) before moving on.'],
        keyPhraseDetails: [
          {
            japanese: 'ください',
            romaji: 'kudasai',
            english: 'please give me',
            usage: 'Use when requesting an item.',
          },
        ],
      }),
      buildCompletedAiSession({
        id: 'session-1',
        createdAt: '2026-05-02T08:00:00.000Z',
        category: 'food_dining',
        topic: 'Ordering food',
        keyPhraseDetails: [
          {
            japanese: 'すみません',
            romaji: 'sumimasen',
            english: 'excuse me',
            usage: 'Use to get attention politely.',
          },
        ],
      }),
    ]);
    mockGetCompletedAiExerciseResultsForUser.mockResolvedValueOnce([
      {
        sessionId: 'session-2',
        exerciseId: 'exercise-coverage-1',
        isCorrect: false,
        answerText: 'I said kudasai too late',
        createdAt: '2026-05-03T08:10:00.000Z',
        exercise: buildMultipleChoiceExercise(),
      },
    ]);
    mockGenerateSessionPlan.mockResolvedValueOnce(
      buildGeneratedPlan({
        lesson: { topic: 'Restaurant payment', category: 'food_dining' },
      }),
    );

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 }, 'user-1');

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        learningJournal: 'Learner still hesitates on ください (kudasai) requests.',
        totalSessionCount: 2,
        coverageEvidence: expect.objectContaining({
          source: {
            totalCompletedAiSessions: 2,
            parseableCompletedAiSessions: 2,
            ignoredCompletedAiSessions: 0,
          },
          categoryRotation: expect.objectContaining({
            currentCategory: 'food_dining',
            currentCategoryStreak: 2,
            selectedCategory: 'food_dining',
            selectionReason: 'continued_current_category_for_review_candidate',
          }),
          avoidKeyPhrases: expect.arrayContaining([
            expect.objectContaining({ display: 'ください (kudasai)' }),
            expect.objectContaining({ display: 'すみません (sumimasen)' }),
          ]),
          reviewCandidates: expect.arrayContaining([
            expect.objectContaining({
              type: 'key_phrase',
              display: 'ください (kudasai)',
            }),
          ]),
        }),
      }),
    );
  });

  it('returns the existing budget-exhausted response shape', async () => {
    const budgetInfo = { allowed: false, remainingTokens: 0, limit: 100 };
    mockCheckBudget.mockResolvedValueOnce(budgetInfo);

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 }, 'user-1');

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      state: 'budget_exhausted',
      session: null,
      lesson: null,
      exercises: [],
      budgetInfo,
    });
    expect(mockGenerateSessionPlan).not.toHaveBeenCalled();
    expect(mockCreateSessionRecord).not.toHaveBeenCalled();
    expect(mockAttachExercisesToSession).not.toHaveBeenCalled();
    expect(mockRecordUsageEvent).not.toHaveBeenCalled();
  });

  it('returns 403 without generation/DB/token writes when selected_user does not match body userId', async () => {
    const response = await generateSession({ userId: 'user-2', exerciseCount: 8 }, 'user-1');

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Selected user does not match request user.',
    });
    expectNoGenerationDbOrTokenWrites();
  });

  it('returns 400 for invalid JSON without generation/DB/token writes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST({
      request: buildRawRequest('{not json'),
      cookies: buildCookies('user-1'),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Invalid JSON body.' });
    expectNoGenerationDbOrTokenWrites();
  });

  it.each([
    ['missing', {}],
    ['blank', { userId: '   ', exerciseCount: 8 }],
  ])('returns 400 for a %s userId without generation/DB/token writes', async (_caseName, body) => {
    const response = await generateSession(body, 'user-1');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Missing userId.' });
    expectNoGenerationDbOrTokenWrites();
  });

  it('returns a timeout error instead of hanging forever when generation stalls', async () => {
    vi.stubEnv('SESSION_GENERATION_TIMEOUT_MS', '10');
    mockGenerateSessionPlan.mockImplementation(() => new Promise(() => {}));

    const result = await Promise.race([
      generateSession({ userId: 'user-1', exerciseCount: 8 }, 'user-1'),
      new Promise((resolve) => setTimeout(() => resolve('timed-out-in-test'), 60)),
    ]);

    expect(result).not.toBe('timed-out-in-test');

    const response = result as Response;
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: expect.stringMatching(/timed out/i),
    });
  });

  it('records rejected generation usage with a null session id and retries after curriculum validation rejects the first plan', async () => {
    mockGenerateSessionPlan
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          lesson: alternateCategoryLesson,
          tokenUsage: { input: 11, output: 22 },
        }),
      )
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          lesson: { topic: 'First greetings', category: 'greetings_basics' },
          tokenUsage: { input: 13, output: 21 },
        }),
      );

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 }, 'user-1');

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenCalledTimes(2);
    expect(mockCreateSessionRecord).toHaveBeenCalledWith({
      userId: 'user-1',
      mode: 'ai',
      status: 'planned',
      model: 'gpt-5.4',
      tokenInput: 13,
      tokenOutput: 21,
    });
    expect(mockRecordUsageEvent).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      sessionId: null,
      model: 'gpt-5.4',
      tokensIn: 11,
      tokensOut: 22,
    });
    expect(mockRecordUsageEvent).toHaveBeenNthCalledWith(2, {
      userId: 'user-1',
      sessionId: 'session-1',
      model: 'gpt-5.4',
      tokensIn: 13,
      tokensOut: 21,
    });
  });

  it('fails closed without creating a session when both generation attempts violate curriculum rails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGenerateSessionPlan
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          lesson: alternateCategoryLesson,
          tokenUsage: { input: 11, output: 22 },
        }),
      )
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          lesson: alternateCategoryLesson,
          tokenUsage: { input: 12, output: 23 },
        }),
      );

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 }, 'user-1');

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Failed to generate AI teaching session.',
    });
    expect(mockGenerateSessionPlan).toHaveBeenCalledTimes(2);
    expect(mockCreateSessionRecord).not.toHaveBeenCalled();
    expect(mockAttachExercisesToSession).not.toHaveBeenCalled();
    expect(mockRecordUsageEvent).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      sessionId: null,
      model: 'gpt-5.4',
      tokensIn: 11,
      tokensOut: 22,
    });
    expect(mockRecordUsageEvent).toHaveBeenNthCalledWith(2, {
      userId: 'user-1',
      sessionId: null,
      model: 'gpt-5.4',
      tokensIn: 12,
      tokensOut: 23,
    });
  });

  it('retries once before failing the whole request', async () => {
    mockGenerateSessionPlan
      .mockRejectedValueOnce(new Error('temporary upstream failure'))
      .mockResolvedValueOnce({
        model: 'gpt-5.4',
        lesson,
        exercises,
        tokenUsage: {
          input: 10,
          output: 20,
        },
        metadata: {},
      });

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 }, 'user-1');

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenCalledTimes(2);
  });
});
