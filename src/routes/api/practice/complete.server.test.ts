import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CLAIMED_AT = '2026-01-01T00:00:00.000Z';

const {
  mockClaimSessionCompletion,
  mockCompleteSessionRecord,
  mockGenerateUpdatedJournal,
  mockGetProgressJournal,
  mockGetUserById,
  mockInsertExerciseResults,
  mockProcessSessionCompletion,
  mockRecordUsageEvent,
  mockResetSessionCompletionClaim,
  mockUpdateProgressJournal,
  mockRunBackgroundTask,
} = vi.hoisted(() => ({
  mockClaimSessionCompletion: vi.fn(),
  mockCompleteSessionRecord: vi.fn(),
  mockGenerateUpdatedJournal: vi.fn(),
  mockGetProgressJournal: vi.fn(),
  mockGetUserById: vi.fn(),
  mockInsertExerciseResults: vi.fn(),
  mockProcessSessionCompletion: vi.fn(),
  mockRecordUsageEvent: vi.fn(),
  mockResetSessionCompletionClaim: vi.fn(),
  mockUpdateProgressJournal: vi.fn(),
  mockRunBackgroundTask: vi.fn(),
}));

vi.mock('$lib/server/db', () => ({
  claimSessionCompletion: mockClaimSessionCompletion,
  completeSessionRecord: mockCompleteSessionRecord,
  getProgressJournal: mockGetProgressJournal,
  getUserById: mockGetUserById,
  insertExerciseResults: mockInsertExerciseResults,
  resetSessionCompletionClaim: mockResetSessionCompletionClaim,
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
  expect(mockClaimSessionCompletion).not.toHaveBeenCalled();
  expect(mockGetUserById).not.toHaveBeenCalled();
  expect(mockGenerateUpdatedJournal).not.toHaveBeenCalled();
  expect(mockRecordUsageEvent).not.toHaveBeenCalled();
  expect(mockResetSessionCompletionClaim).not.toHaveBeenCalled();
  expect(mockProcessSessionCompletion).not.toHaveBeenCalled();
  expect(mockRunBackgroundTask).not.toHaveBeenCalled();
}

describe('POST /api/practice/complete', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockClaimSessionCompletion.mockReset();
    mockCompleteSessionRecord.mockReset();
    mockGenerateUpdatedJournal.mockReset();
    mockGetProgressJournal.mockReset();
    mockGetUserById.mockReset();
    mockInsertExerciseResults.mockReset();
    mockProcessSessionCompletion.mockReset();
    mockRecordUsageEvent.mockReset();
    mockResetSessionCompletionClaim.mockReset();
    mockUpdateProgressJournal.mockReset();
    mockRunBackgroundTask.mockReset();

    mockClaimSessionCompletion.mockResolvedValue({ status: 'claimed', claimedAt: CLAIMED_AT });
    mockCompleteSessionRecord.mockResolvedValue(true);
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
    mockResetSessionCompletionClaim.mockResolvedValue(undefined);
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
      completionClaimedAt: CLAIMED_AT,
      mode: 'practice',
      results: [
        { exerciseId: 'exercise-1', answerText: 'こんにちは', isCorrect: true },
        { exerciseId: 'exercise-2', answerText: '', isCorrect: false },
      ],
    });
    expect(mockCompleteSessionRecord).toHaveBeenCalledWith('session-1', {
      summary: 'Practice complete: 1/2 correct (50%).',
      completionClaimedAt: CLAIMED_AT,
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

  it('returns completed practice state without duplicate writes when completion is retried', async () => {
    mockClaimSessionCompletion.mockResolvedValueOnce({
      status: 'already_completed',
      session: {
        id: 'session-1',
        userId: 'user-1',
        mode: 'practice',
        status: 'completed',
        model: null,
        tokenInput: 0,
        tokenOutput: 0,
        summary: 'Practice complete: 2/2 correct (100%).',
        createdAt: '2026-01-01T00:00:00.000Z',
        completedAt: '2026-01-01T00:05:00.000Z',
      },
    });

    const response = await completePractice({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      state: 'done',
      summary: {
        sessionId: 'session-1',
        userId: 'user-1',
        summary: 'Practice complete: 2/2 correct (100%).',
        strengths: ['Consistent results in review mode'],
        weaknesses: ['Aim for faster recall next time'],
        accuracy: 100,
        generatedAt: expect.any(String),
      },
      xp: null,
    });
    expect(mockInsertExerciseResults).not.toHaveBeenCalled();
    expect(mockCompleteSessionRecord).not.toHaveBeenCalled();
    expect(mockGetProgressJournal).not.toHaveBeenCalled();
    expect(mockGetUserById).not.toHaveBeenCalled();
    expect(mockGenerateUpdatedJournal).not.toHaveBeenCalled();
    expect(mockRecordUsageEvent).not.toHaveBeenCalled();
    expect(mockProcessSessionCompletion).not.toHaveBeenCalled();
    expect(mockRunBackgroundTask).not.toHaveBeenCalled();
  });

  it('does not leak another user completed practice summary on retry', async () => {
    mockClaimSessionCompletion.mockResolvedValueOnce({ status: 'not_found' });

    const response = await completePractice({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Session not found.',
    });
    expect(mockInsertExerciseResults).not.toHaveBeenCalled();
    expect(mockCompleteSessionRecord).not.toHaveBeenCalled();
    expect(mockGetProgressJournal).not.toHaveBeenCalled();
    expect(mockGetUserById).not.toHaveBeenCalled();
    expect(mockGenerateUpdatedJournal).not.toHaveBeenCalled();
    expect(mockRecordUsageEvent).not.toHaveBeenCalled();
    expect(mockProcessSessionCompletion).not.toHaveBeenCalled();
    expect(mockRunBackgroundTask).not.toHaveBeenCalled();
  });

  it('returns 409 without side effects while another practice completion request owns the session claim', async () => {
    mockClaimSessionCompletion.mockResolvedValueOnce({ status: 'busy' });

    const response = await completePractice({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Session completion is already in progress.',
    });
    expect(mockInsertExerciseResults).not.toHaveBeenCalled();
    expect(mockCompleteSessionRecord).not.toHaveBeenCalled();
    expect(mockGetProgressJournal).not.toHaveBeenCalled();
    expect(mockGetUserById).not.toHaveBeenCalled();
    expect(mockGenerateUpdatedJournal).not.toHaveBeenCalled();
    expect(mockRecordUsageEvent).not.toHaveBeenCalled();
    expect(mockProcessSessionCompletion).not.toHaveBeenCalled();
    expect(mockRunBackgroundTask).not.toHaveBeenCalled();
  });

  it('resets a claimed practice session after completion write failure so retry can complete', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockCompleteSessionRecord.mockRejectedValueOnce(new Error('temporary write failure'));

    const failedResponse = await completePractice({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
    });

    expect(failedResponse.status).toBe(500);
    await expect(failedResponse.json()).resolves.toEqual({
      ok: false,
      error: 'Failed to complete practice session.',
    });
    expect(mockResetSessionCompletionClaim).toHaveBeenCalledWith('user-1', 'session-1', CLAIMED_AT);
    expect(mockProcessSessionCompletion).not.toHaveBeenCalled();
    expect(mockRunBackgroundTask).not.toHaveBeenCalled();
    expect(mockRecordUsageEvent).not.toHaveBeenCalled();

    const retryResponse = await completePractice({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
    });

    expect(retryResponse.status).toBe(200);
    await expect(retryResponse.json()).resolves.toMatchObject({
      ok: true,
      state: 'done',
      xp: { totalXp: 12 },
    });
    expect(mockClaimSessionCompletion).toHaveBeenCalledTimes(2);
    expect(mockCompleteSessionRecord).toHaveBeenCalledTimes(2);
    expect(mockProcessSessionCompletion).toHaveBeenCalledTimes(1);
  });

  it('returns busy without resetting when the practice completion claim is no longer current', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockCompleteSessionRecord.mockResolvedValueOnce(false);

    const response = await completePractice({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Session completion is already in progress.',
    });
    expect(mockResetSessionCompletionClaim).not.toHaveBeenCalled();
    expect(mockProcessSessionCompletion).not.toHaveBeenCalled();
    expect(mockRunBackgroundTask).not.toHaveBeenCalled();
    expect(mockRecordUsageEvent).not.toHaveBeenCalled();
  });

  it('keeps a completed practice response successful when post-completion telemetry scheduling fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRunBackgroundTask.mockImplementationOnce(() => {
      throw new Error('scheduler unavailable');
    });

    const response = await completePractice({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      state: 'done',
      xp: { totalXp: 12 },
    });
    expect(mockCompleteSessionRecord).toHaveBeenCalledOnce();
    expect(mockProcessSessionCompletion).toHaveBeenCalledOnce();
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
