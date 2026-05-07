import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGenerateSessionPlan,
  mockDeleteStaleGhostSessions,
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
  topic: 'Ordering food',
  category: 'food_dining',
  explanation: 'Learn a few polite ordering phrases.',
  culturalNote: 'Be polite with staff.',
  keyPhrases: [],
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
    mockGetExerciseResultsForUser.mockReset();
    mockGetSessionsForUser.mockReset();
    mockCreateSessionRecord.mockReset();
    mockAttachExercisesToSession.mockReset();
    mockCheckBudget.mockReset();
    mockRecordUsageEvent.mockReset();
    mockGetUser.mockReset();

    mockCheckBudget.mockResolvedValue({ allowed: true });
    mockGetUser.mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      level: 'beginner',
    });
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
    expect(mockGetExerciseResultsForUser).toHaveBeenCalledWith('user-1');
    expect(mockGenerateSessionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        exerciseCount: 12,
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
