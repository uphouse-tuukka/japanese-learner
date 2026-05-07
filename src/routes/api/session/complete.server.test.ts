import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCompleteSessionRecord,
  mockGenerateSessionSummary,
  mockGenerateUpdatedJournal,
  mockGetProgressJournal,
  mockGetRecentSessionSummaries,
  mockGetSessionExercises,
  mockGetUserById,
  mockInsertExerciseResults,
  mockProcessSessionCompletion,
  mockRecordUsageEvent,
  mockUpdateProgressJournal,
  mockCheckBudget,
} = vi.hoisted(() => ({
  mockCompleteSessionRecord: vi.fn(),
  mockGenerateSessionSummary: vi.fn(),
  mockGenerateUpdatedJournal: vi.fn(),
  mockGetProgressJournal: vi.fn(),
  mockGetRecentSessionSummaries: vi.fn(),
  mockGetSessionExercises: vi.fn(),
  mockGetUserById: vi.fn(),
  mockInsertExerciseResults: vi.fn(),
  mockProcessSessionCompletion: vi.fn(),
  mockRecordUsageEvent: vi.fn(),
  mockUpdateProgressJournal: vi.fn(),
  mockCheckBudget: vi.fn(),
}));

vi.mock('$lib/server/db', () => ({
  completeSessionRecord: mockCompleteSessionRecord,
  getProgressJournal: mockGetProgressJournal,
  getRecentSessionSummaries: mockGetRecentSessionSummaries,
  getSessionExercises: mockGetSessionExercises,
  getUserById: mockGetUserById,
  insertExerciseResults: mockInsertExerciseResults,
  updateProgressJournal: mockUpdateProgressJournal,
}));

vi.mock('$lib/server/ai', () => ({
  generateSessionSummary: mockGenerateSessionSummary,
  generateUpdatedJournal: mockGenerateUpdatedJournal,
}));

vi.mock('$lib/server/token-limiter', () => ({
  checkBudget: mockCheckBudget,
  recordUsageEvent: mockRecordUsageEvent,
}));

vi.mock('$lib/server/gamification', () => ({
  processSessionCompletion: mockProcessSessionCompletion,
}));

import { POST } from './complete/+server';

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/session/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildRawRequest(body: string): Request {
  return new Request('http://localhost/api/session/complete', {
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

function validResults() {
  return [
    {
      exerciseId: 'exercise-1',
      answerText: 'こんにちは',
      isCorrect: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      exerciseId: 'exercise-2',
      answerText: '',
      isCorrect: false,
    },
  ];
}

async function completeSession(
  body: unknown,
  selectedUserId: string | null = 'user-1',
): Promise<Response> {
  return POST({ request: buildRequest(body), cookies: buildCookies(selectedUserId) } as never);
}

function expectNoWrites() {
  expect(mockInsertExerciseResults).not.toHaveBeenCalled();
  expect(mockCompleteSessionRecord).not.toHaveBeenCalled();
  expect(mockUpdateProgressJournal).not.toHaveBeenCalled();
  expect(mockGetUserById).not.toHaveBeenCalled();
  expect(mockGetSessionExercises).not.toHaveBeenCalled();
  expect(mockGetProgressJournal).not.toHaveBeenCalled();
  expect(mockGetRecentSessionSummaries).not.toHaveBeenCalled();
  expect(mockGenerateSessionSummary).not.toHaveBeenCalled();
  expect(mockGenerateUpdatedJournal).not.toHaveBeenCalled();
  expect(mockCheckBudget).not.toHaveBeenCalled();
  expect(mockRecordUsageEvent).not.toHaveBeenCalled();
  expect(mockProcessSessionCompletion).not.toHaveBeenCalled();
}

describe('POST /api/session/complete', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockCompleteSessionRecord.mockReset();
    mockGenerateSessionSummary.mockReset();
    mockGenerateUpdatedJournal.mockReset();
    mockGetProgressJournal.mockReset();
    mockGetRecentSessionSummaries.mockReset();
    mockGetSessionExercises.mockReset();
    mockGetUserById.mockReset();
    mockInsertExerciseResults.mockReset();
    mockProcessSessionCompletion.mockReset();
    mockRecordUsageEvent.mockReset();
    mockUpdateProgressJournal.mockReset();
    mockCheckBudget.mockReset();

    mockCompleteSessionRecord.mockResolvedValue(undefined);
    mockGenerateSessionSummary.mockResolvedValue({
      summary: {
        sessionId: 'session-1',
        userId: 'user-1',
        summary: 'AI generated summary',
        strengths: ['Strong recall'],
        weaknesses: ['Keep practicing'],
        nextSteps: ['Review once'],
        accuracy: 100,
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
      handoffNotes: ['Review once'],
      tokenUsage: {
        model: 'gpt-5.4',
        tokensIn: 10,
        tokensOut: 20,
      },
    });
    mockGenerateUpdatedJournal.mockResolvedValue({
      journal: 'updated progress journal',
      tokenUsage: {
        model: 'gpt-5.4',
        tokensIn: 1,
        tokensOut: 2,
      },
    });
    mockGetProgressJournal.mockResolvedValue(null);
    mockGetRecentSessionSummaries.mockResolvedValue([]);
    mockGetSessionExercises.mockResolvedValue([
      {
        sessionId: 'session-1',
        exerciseId: 'exercise-1',
        orderIndex: 0,
        exercise: {
          id: 'exercise-1',
          type: 'translation',
          title: 'Ordering Food',
          japanese: 'こんにちは',
          romaji: 'konnichiwa',
          englishContext: 'Greeting someone',
          tags: ['greeting'],
          difficulty: 1,
          direction: 'en_to_ja',
          prompt: 'Say hello.',
          expectedAnswer: 'こんにちは',
          acceptedAnswers: ['こんにちは'],
        },
      },
    ]);
    mockGetUserById.mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      level: 'beginner',
      japaneseWritingEnabled: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastActiveAt: null,
      progressJournal: null,
    });
    mockInsertExerciseResults.mockResolvedValue(undefined);
    mockProcessSessionCompletion.mockResolvedValue({ totalXp: 12 });
    mockRecordUsageEvent.mockResolvedValue(undefined);
    mockUpdateProgressJournal.mockResolvedValue(undefined);
    mockCheckBudget.mockResolvedValue({ allowed: false, reason: 'budget_unavailable' });
  });

  it('completes a valid session for a matching selected_user cookie using the trimmed userId', async () => {
    const response = await completeSession(
      {
        userId: ' user-1 ',
        sessionId: 'session-1',
        results: validResults(),
        lessonTopic: 'Ordering Food',
      },
      ' user-1 ',
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      state: 'done',
      summary: {
        sessionId: 'session-1',
        userId: 'user-1',
        summary: 'You answered 1 out of 2 correctly (50%).',
      },
      xp: { totalXp: 12 },
    });
    expect(mockInsertExerciseResults).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      mode: 'ai',
      results: [
        { exerciseId: 'exercise-1', answerText: 'こんにちは', isCorrect: true },
        { exerciseId: 'exercise-2', answerText: '', isCorrect: false },
      ],
    });
    expect(mockGetUserById).toHaveBeenCalledWith('user-1');
    expect(mockCheckBudget).toHaveBeenCalledWith('user-1');
    expect(mockProcessSessionCompletion).toHaveBeenCalledWith(
      'user-1',
      'session-1',
      [
        {
          exerciseId: 'exercise-1',
          answerText: 'こんにちは',
          isCorrect: true,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        { exerciseId: 'exercise-2', answerText: '', isCorrect: false },
      ],
      1,
    );
  });

  it('completes a valid session when no selected_user cookie is present', async () => {
    const response = await completeSession(
      { userId: ' user-1 ', sessionId: 'session-1', results: validResults() },
      null,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, state: 'done' });
    expect(mockInsertExerciseResults).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', sessionId: 'session-1' }),
    );
    expect(mockGetUserById).toHaveBeenCalledWith('user-1');
    expect(mockProcessSessionCompletion).toHaveBeenCalledWith(
      'user-1',
      'session-1',
      expect.any(Array),
      1,
    );
  });

  it('returns 403 before writes or downstream calls when selected_user does not match body userId', async () => {
    const response = await completeSession(
      { userId: 'user-2', sessionId: 'session-1', results: validResults() },
      'user-1',
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Selected user does not match request user.',
    });
    expectNoWrites();
  });

  it('returns 400 for invalid JSON before writes or downstream calls', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST({
      request: buildRawRequest('{not json'),
      cookies: buildCookies('user-1'),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Invalid JSON body.' });
    expectNoWrites();
  });

  it('returns 400 for a blank userId before writes or downstream calls', async () => {
    const response = await completeSession(
      { userId: '   ', sessionId: 'session-1', results: validResults() },
      'user-1',
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Missing userId or sessionId.',
    });
    expectNoWrites();
  });

  it('returns 400 for a blank selected_user cookie before writes or downstream calls', async () => {
    const response = await completeSession(
      { userId: 'user-1', sessionId: 'session-1', results: validResults() },
      '   ',
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Invalid selected user.' });
    expectNoWrites();
  });

  it('returns 400 for missing userId and does not write DB records', async () => {
    const response = await completeSession({ sessionId: 'session-1', results: validResults() });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Missing userId or sessionId.',
    });
    expectNoWrites();
  });

  it('returns 400 for missing sessionId and does not write DB records', async () => {
    const response = await completeSession({ userId: 'user-1', results: validResults() });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Missing userId or sessionId.',
    });
    expectNoWrites();
  });

  it('returns 400 for non-array results and does not write DB records', async () => {
    const response = await completeSession({
      userId: 'user-1',
      sessionId: 'session-1',
      results: 'not an array',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Missing or invalid results.',
    });
    expectNoWrites();
  });

  it('returns 400 for empty results and does not write DB records', async () => {
    const response = await completeSession({
      userId: 'user-1',
      sessionId: 'session-1',
      results: [],
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Missing or invalid results.',
    });
    expectNoWrites();
  });

  it('returns 400 for malformed result items and does not write DB records', async () => {
    const response = await completeSession({
      userId: 'user-1',
      sessionId: 'session-1',
      results: [{ exerciseId: 'exercise-1', answerText: 'こんにちは' }],
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Missing or invalid results.',
    });
    expectNoWrites();
  });

  it('uses fallback summary when budget is unavailable and skips AI summary generation', async () => {
    const response = await completeSession({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
      lessonTopic: 'Ordering Food',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      state: 'done',
      summary: {
        sessionId: 'session-1',
        userId: 'user-1',
        summary: 'You answered 1 out of 2 correctly (50%).',
        accuracy: 50,
      },
      xp: { totalXp: 12 },
    });
    expect(mockInsertExerciseResults).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      mode: 'ai',
      results: [
        { exerciseId: 'exercise-1', answerText: 'こんにちは', isCorrect: true },
        { exerciseId: 'exercise-2', answerText: '', isCorrect: false },
      ],
    });
    expect(mockGenerateSessionSummary).not.toHaveBeenCalled();
    expect(mockCompleteSessionRecord).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({ tokenInput: 0, tokenOutput: 0, summary: expect.any(String) }),
    );
  });

  it('keeps XP processing failures non-fatal after storing results and completing the record', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockProcessSessionCompletion.mockRejectedValueOnce(new Error('xp service unavailable'));

    const response = await completeSession({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      state: 'done',
      xp: null,
    });
    expect(mockInsertExerciseResults).toHaveBeenCalledOnce();
    expect(mockCompleteSessionRecord).toHaveBeenCalledOnce();
    expect(mockProcessSessionCompletion).toHaveBeenCalledOnce();
  });
});
