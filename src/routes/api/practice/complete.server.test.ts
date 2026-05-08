import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCompleteSessionRecord,
  mockGenerateUpdatedJournal,
  mockGetProgressJournal,
  mockGetUserById,
  mockInsertExerciseResults,
  mockProcessSessionCompletion,
  mockRecordUsageEvent,
  mockUpdateProgressJournal,
  mockRunBackgroundTask,
} = vi.hoisted(() => ({
  mockCompleteSessionRecord: vi.fn(),
  mockGenerateUpdatedJournal: vi.fn(),
  mockGetProgressJournal: vi.fn(),
  mockGetUserById: vi.fn(),
  mockInsertExerciseResults: vi.fn(),
  mockProcessSessionCompletion: vi.fn(),
  mockRecordUsageEvent: vi.fn(),
  mockUpdateProgressJournal: vi.fn(),
  mockRunBackgroundTask: vi.fn(),
}));

vi.mock('$lib/server/db', () => ({
  completeSessionRecord: mockCompleteSessionRecord,
  getProgressJournal: mockGetProgressJournal,
  getUserById: mockGetUserById,
  insertExerciseResults: mockInsertExerciseResults,
  updateProgressJournal: mockUpdateProgressJournal,
}));

vi.mock('$lib/server/ai', () => ({
  generateUpdatedJournal: mockGenerateUpdatedJournal,
}));

vi.mock('$lib/server/token-limiter', () => ({
  recordUsageEvent: mockRecordUsageEvent,
}));

vi.mock('$lib/server/gamification', () => ({
  processSessionCompletion: mockProcessSessionCompletion,
}));

vi.mock('$lib/server/background-task', () => ({
  runBackgroundTask: mockRunBackgroundTask,
}));

import { POST } from './complete/+server';

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/practice/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildRawRequest(body: string): Request {
  return new Request('http://localhost/api/practice/complete', {
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

async function completePractice(
  body: unknown,
  selectedUserId: string | null = 'user-1',
): Promise<Response> {
  return POST({ request: buildRequest(body), cookies: buildCookies(selectedUserId) } as never);
}

function expectNoWrites() {
  expect(mockInsertExerciseResults).not.toHaveBeenCalled();
  expect(mockCompleteSessionRecord).not.toHaveBeenCalled();
  expect(mockUpdateProgressJournal).not.toHaveBeenCalled();
  expect(mockGetProgressJournal).not.toHaveBeenCalled();
  expect(mockGetUserById).not.toHaveBeenCalled();
  expect(mockGenerateUpdatedJournal).not.toHaveBeenCalled();
  expect(mockRecordUsageEvent).not.toHaveBeenCalled();
  expect(mockProcessSessionCompletion).not.toHaveBeenCalled();
  expect(mockRunBackgroundTask).not.toHaveBeenCalled();
}

describe('POST /api/practice/complete', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockCompleteSessionRecord.mockReset();
    mockGenerateUpdatedJournal.mockReset();
    mockGetProgressJournal.mockReset();
    mockGetUserById.mockReset();
    mockInsertExerciseResults.mockReset();
    mockProcessSessionCompletion.mockReset();
    mockRecordUsageEvent.mockReset();
    mockUpdateProgressJournal.mockReset();
    mockRunBackgroundTask.mockReset();

    mockCompleteSessionRecord.mockResolvedValue(undefined);
    mockGenerateUpdatedJournal.mockResolvedValue({
      journal: 'updated progress journal',
      tokenUsage: {
        model: 'gpt-5.4',
        tokensIn: 1,
        tokensOut: 2,
      },
    });
    mockGetProgressJournal.mockResolvedValue(null);
    mockGetUserById.mockResolvedValue(null);
    mockInsertExerciseResults.mockResolvedValue(undefined);
    mockProcessSessionCompletion.mockResolvedValue({ totalXp: 12 });
    mockRecordUsageEvent.mockResolvedValue(undefined);
    mockUpdateProgressJournal.mockResolvedValue(undefined);
  });

  it('returns a local summary for a matching selected_user cookie using the trimmed userId', async () => {
    const response = await completePractice(
      {
        userId: ' user-1 ',
        sessionId: 'session-1',
        results: validResults(),
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
        summary: 'Practice complete: 1/2 correct (50%).',
        accuracy: 50,
      },
      xp: { totalXp: 12 },
    });
    expect(mockInsertExerciseResults).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      mode: 'practice',
      results: [
        { exerciseId: 'exercise-1', answerText: 'こんにちは', isCorrect: true },
        { exerciseId: 'exercise-2', answerText: '', isCorrect: false },
      ],
    });
    expect(mockCompleteSessionRecord).toHaveBeenCalledWith('session-1', {
      summary: 'Practice complete: 1/2 correct (50%).',
    });
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

  it('returns a local summary when no selected_user cookie is present', async () => {
    const response = await completePractice(
      {
        userId: ' user-1 ',
        sessionId: 'session-1',
        results: validResults(),
      },
      null,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, state: 'done' });
    expect(mockInsertExerciseResults).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', sessionId: 'session-1' }),
    );
    expect(mockProcessSessionCompletion).toHaveBeenCalledWith(
      'user-1',
      'session-1',
      expect.any(Array),
      1,
    );
  });

  it('returns 403 before writes or downstream calls when selected_user does not match body userId', async () => {
    const response = await completePractice(
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
    const response = await completePractice(
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
    const response = await completePractice(
      { userId: 'user-1', sessionId: 'session-1', results: validResults() },
      '   ',
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Invalid selected user.' });
    expectNoWrites();
  });

  it('returns 400 for missing userId and does not write DB records', async () => {
    const response = await completePractice({ sessionId: 'session-1', results: validResults() });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Missing userId or sessionId.',
    });
    expectNoWrites();
  });

  it('returns 400 for missing sessionId and does not write DB records', async () => {
    const response = await completePractice({ userId: 'user-1', results: validResults() });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Missing userId or sessionId.',
    });
    expectNoWrites();
  });

  it('returns 400 for non-array results and does not write DB records', async () => {
    const response = await completePractice({
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
    const response = await completePractice({
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
    const response = await completePractice({
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

  it('schedules progress-journal updates through the shared background helper', async () => {
    mockGetUserById.mockResolvedValueOnce({
      id: 'user-1',
      name: 'Test User',
      level: 'beginner',
      japaneseWritingEnabled: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastActiveAt: null,
      progressJournal: null,
    });

    const response = await completePractice({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, state: 'done' });

    expect(mockRunBackgroundTask).toHaveBeenCalledOnce();
    const [taskName, task, meta] = mockRunBackgroundTask.mock.calls[0] as [
      string,
      () => Promise<void>,
      Record<string, unknown>,
    ];
    expect(taskName).toBe('practice-complete-journal-update');
    expect(meta).toEqual({
      route: 'api/practice/complete',
      sessionId: 'session-1',
      userId: 'user-1',
    });
    expect(mockGetProgressJournal).not.toHaveBeenCalled();
    expect(mockUpdateProgressJournal).not.toHaveBeenCalled();

    await task();

    expect(mockGetProgressJournal).toHaveBeenCalledWith('user-1');
    expect(mockGetUserById).toHaveBeenCalledWith('user-1');
    expect(mockGenerateUpdatedJournal).toHaveBeenCalledWith({
      currentJournal: null,
      sessionSummary: expect.objectContaining({ summary: 'Practice complete: 1/2 correct (50%).' }),
      sessionMeta: {
        category: 'practice_review',
        topic: 'practice_review',
        exerciseTypes: [],
        keyPhrases: [],
      },
      userLevel: 'beginner',
    });
    expect(mockUpdateProgressJournal).toHaveBeenCalledWith('user-1', 'updated progress journal');
    expect(mockRecordUsageEvent).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      model: 'gpt-5.4',
      tokensIn: 1,
      tokensOut: 2,
    });
  });

  it('keeps XP processing failures non-fatal after storing results and completing the record', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockProcessSessionCompletion.mockRejectedValueOnce(new Error('xp service unavailable'));

    const response = await completePractice({
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
