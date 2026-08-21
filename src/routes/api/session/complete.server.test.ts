import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CLAIMED_AT = '2026-01-01T00:00:00.000Z';
const plannedKeyPhraseDetails = [
  {
    japanese: 'ラーメンをください',
    romaji: 'raamen o kudasai',
    english: 'Ramen, please.',
    usage: 'Use while ordering.',
  },
  {
    japanese: 'おすすめは何ですか',
    romaji: 'osusume wa nan desu ka',
    english: 'What do you recommend?',
    usage: 'Use to ask for a recommendation.',
  },
  {
    japanese: 'お会計をお願いします',
    romaji: 'okaikei o onegaishimasu',
    english: 'The bill, please.',
    usage: 'Use when ready to pay.',
  },
];

const {
  mockClaimSessionCompletion,
  mockCompleteSessionRecord,
  mockGenerateSessionSummary,
  mockGenerateUpdatedJournal,
  mockGetLatestCompletedLearningSessionSummary,
  mockGetProgressJournal,
  mockGetRecentSessionSummaries,
  mockGetSession,
  mockGetSessionExercises,
  mockGetUserById,
  mockInsertExerciseResults,
  mockLogError,
  mockProcessSessionCompletion,
  mockPersistGeneratedJournal,
  mockRecordUsageEvent,
  mockResetSessionCompletionClaim,
  mockCheckBudget,
  mockRunBackgroundTask,
} = vi.hoisted(() => ({
  mockClaimSessionCompletion: vi.fn(),
  mockCompleteSessionRecord: vi.fn(),
  mockGenerateSessionSummary: vi.fn(),
  mockGenerateUpdatedJournal: vi.fn(),
  mockGetLatestCompletedLearningSessionSummary: vi.fn(),
  mockGetProgressJournal: vi.fn(),
  mockGetRecentSessionSummaries: vi.fn(),
  mockGetSession: vi.fn(),
  mockGetSessionExercises: vi.fn(),
  mockGetUserById: vi.fn(),
  mockInsertExerciseResults: vi.fn(),
  mockLogError: vi.fn(),
  mockProcessSessionCompletion: vi.fn(),
  mockPersistGeneratedJournal: vi.fn(),
  mockRecordUsageEvent: vi.fn(),
  mockResetSessionCompletionClaim: vi.fn(),
  mockCheckBudget: vi.fn(),
  mockRunBackgroundTask: vi.fn(),
}));

vi.mock('$lib/server/db', () => ({
  claimSessionCompletion: mockClaimSessionCompletion,
  completeSessionRecord: mockCompleteSessionRecord,
  getLatestCompletedLearningSessionSummary: mockGetLatestCompletedLearningSessionSummary,
  getProgressJournal: mockGetProgressJournal,
  getRecentSessionSummaries: mockGetRecentSessionSummaries,
  getSession: mockGetSession,
  getSessionExercises: mockGetSessionExercises,
  getUserById: mockGetUserById,
  insertExerciseResults: mockInsertExerciseResults,
  resetSessionCompletionClaim: mockResetSessionCompletionClaim,
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

vi.mock('$lib/server/background-task', () => ({
  runBackgroundTask: mockRunBackgroundTask,
}));

vi.mock('$lib/server/logger', () => ({
  logError: mockLogError,
}));

vi.mock('$lib/server/progress-journal', () => ({
  persistGeneratedJournal: mockPersistGeneratedJournal,
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
  expect(mockPersistGeneratedJournal).not.toHaveBeenCalled();
  expect(mockClaimSessionCompletion).not.toHaveBeenCalled();
  expect(mockGetUserById).not.toHaveBeenCalled();
  expect(mockGetSessionExercises).not.toHaveBeenCalled();
  expect(mockGetLatestCompletedLearningSessionSummary).not.toHaveBeenCalled();
  expect(mockGetProgressJournal).not.toHaveBeenCalled();
  expect(mockGetRecentSessionSummaries).not.toHaveBeenCalled();
  expect(mockGetSession).not.toHaveBeenCalled();
  expect(mockGenerateSessionSummary).not.toHaveBeenCalled();
  expect(mockGenerateUpdatedJournal).not.toHaveBeenCalled();
  expect(mockCheckBudget).not.toHaveBeenCalled();
  expect(mockRecordUsageEvent).not.toHaveBeenCalled();
  expect(mockResetSessionCompletionClaim).not.toHaveBeenCalled();
  expect(mockProcessSessionCompletion).not.toHaveBeenCalled();
  expect(mockRunBackgroundTask).not.toHaveBeenCalled();
}

describe('POST /api/session/complete', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockClaimSessionCompletion.mockReset();
    mockCompleteSessionRecord.mockReset();
    mockGenerateSessionSummary.mockReset();
    mockGenerateUpdatedJournal.mockReset();
    mockGetLatestCompletedLearningSessionSummary.mockReset();
    mockGetProgressJournal.mockReset();
    mockGetRecentSessionSummaries.mockReset();
    mockGetSession.mockReset();
    mockGetSessionExercises.mockReset();
    mockGetUserById.mockReset();
    mockInsertExerciseResults.mockReset();
    mockLogError.mockReset();
    mockProcessSessionCompletion.mockReset();
    mockPersistGeneratedJournal.mockReset();
    mockRecordUsageEvent.mockReset();
    mockResetSessionCompletionClaim.mockReset();
    mockCheckBudget.mockReset();
    mockRunBackgroundTask.mockReset();

    mockClaimSessionCompletion.mockResolvedValue({ status: 'claimed', claimedAt: CLAIMED_AT });
    mockCompleteSessionRecord.mockResolvedValue(true);
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
      reviewIntents: [],
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
    mockGetLatestCompletedLearningSessionSummary.mockResolvedValue(null);
    mockGetRecentSessionSummaries.mockResolvedValue([]);
    mockGetSession.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      mode: 'ai',
      status: 'completing',
      model: 'gpt-5.4',
      tokenInput: 10,
      tokenOutput: 20,
      summary: null,
      plannedCoverage: {
        version: 1,
        category: 'food_dining',
        learningObjectiveId: 'food_dining.order_food_and_drinks',
        lessonTopic: 'Ordering Food',
        culturalNote: 'Use polite request forms with restaurant staff.',
        keyPhraseDetails: plannedKeyPhraseDetails,
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      completedAt: CLAIMED_AT,
    });
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
    mockResetSessionCompletionClaim.mockResolvedValue(undefined);
    mockPersistGeneratedJournal.mockResolvedValue(undefined);
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
      completionClaimedAt: CLAIMED_AT,
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

  it('returns completed session state without duplicate writes when completion is retried', async () => {
    mockClaimSessionCompletion.mockResolvedValueOnce({
      status: 'already_completed',
      session: {
        id: 'session-1',
        userId: 'user-1',
        mode: 'ai',
        status: 'completed',
        model: 'gpt-5.4',
        tokenInput: 10,
        tokenOutput: 20,
        summary: JSON.stringify({
          summaryText: 'Stored completed summary',
          topic: 'Ordering Food',
          accuracy: 50,
          strengths: ['Stored strength'],
          weaknesses: ['Stored weakness'],
          nextSteps: ['Stored next step'],
          exerciseTypes: ['translation'],
          keyPhrases: ['こんにちは'],
          miniLesson: null,
          levelUpRecommendation: {
            recommendedLevel: 'elementary',
            reason: 'Your recent sessions show consistent mastery.',
          },
          hadLevelUpRecommendation: true,
        }),
        createdAt: '2026-01-01T00:00:00.000Z',
        completedAt: '2026-01-01T00:05:00.000Z',
      },
    });

    const response = await completeSession({
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
        summary: 'Stored completed summary',
        strengths: ['Stored strength'],
        weaknesses: ['Stored weakness'],
        nextSteps: ['Stored next step'],
        accuracy: 50,
        generatedAt: expect.any(String),
        miniLesson: null,
        levelUpRecommendation: {
          recommendedLevel: 'elementary',
          reason: 'Your recent sessions show consistent mastery.',
        },
      },
      xp: null,
    });
    expect(mockInsertExerciseResults).not.toHaveBeenCalled();
    expect(mockCompleteSessionRecord).not.toHaveBeenCalled();
    expect(mockGetUserById).not.toHaveBeenCalled();
    expect(mockGetSessionExercises).not.toHaveBeenCalled();
    expect(mockGetProgressJournal).not.toHaveBeenCalled();
    expect(mockGetRecentSessionSummaries).not.toHaveBeenCalled();
    expect(mockGenerateSessionSummary).not.toHaveBeenCalled();
    expect(mockGenerateUpdatedJournal).not.toHaveBeenCalled();
    expect(mockCheckBudget).not.toHaveBeenCalled();
    expect(mockRecordUsageEvent).not.toHaveBeenCalled();
    expect(mockProcessSessionCompletion).not.toHaveBeenCalled();
    expect(mockRunBackgroundTask).not.toHaveBeenCalled();
  });

  it('does not leak another user completed session summary on retry', async () => {
    mockClaimSessionCompletion.mockResolvedValueOnce({ status: 'not_found' });

    const response = await completeSession({
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
    expect(mockGetUserById).not.toHaveBeenCalled();
    expect(mockGetSessionExercises).not.toHaveBeenCalled();
    expect(mockGetProgressJournal).not.toHaveBeenCalled();
    expect(mockGetRecentSessionSummaries).not.toHaveBeenCalled();
    expect(mockGenerateSessionSummary).not.toHaveBeenCalled();
    expect(mockGenerateUpdatedJournal).not.toHaveBeenCalled();
    expect(mockCheckBudget).not.toHaveBeenCalled();
    expect(mockRecordUsageEvent).not.toHaveBeenCalled();
    expect(mockProcessSessionCompletion).not.toHaveBeenCalled();
    expect(mockRunBackgroundTask).not.toHaveBeenCalled();
  });

  it('returns 409 without side effects while another completion request owns the session claim', async () => {
    mockClaimSessionCompletion.mockResolvedValueOnce({ status: 'busy' });

    const response = await completeSession({
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
    expect(mockGetUserById).not.toHaveBeenCalled();
    expect(mockGetSessionExercises).not.toHaveBeenCalled();
    expect(mockGetProgressJournal).not.toHaveBeenCalled();
    expect(mockGetRecentSessionSummaries).not.toHaveBeenCalled();
    expect(mockGenerateSessionSummary).not.toHaveBeenCalled();
    expect(mockGenerateUpdatedJournal).not.toHaveBeenCalled();
    expect(mockCheckBudget).not.toHaveBeenCalled();
    expect(mockRecordUsageEvent).not.toHaveBeenCalled();
    expect(mockProcessSessionCompletion).not.toHaveBeenCalled();
    expect(mockRunBackgroundTask).not.toHaveBeenCalled();
  });

  it('resets a claimed session after completion write failure so retry can complete', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockCompleteSessionRecord.mockRejectedValueOnce(new Error('temporary write failure'));

    const failedResponse = await completeSession({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
    });

    expect(failedResponse.status).toBe(500);
    await expect(failedResponse.json()).resolves.toEqual({
      ok: false,
      error: 'Failed to complete session.',
    });
    expect(mockResetSessionCompletionClaim).toHaveBeenCalledWith('user-1', 'session-1', CLAIMED_AT);
    expect(mockProcessSessionCompletion).not.toHaveBeenCalled();
    expect(mockRunBackgroundTask).not.toHaveBeenCalled();
    expect(mockRecordUsageEvent).not.toHaveBeenCalled();

    const retryResponse = await completeSession({
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

  it('returns busy without resetting when the completion claim is no longer current', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockCompleteSessionRecord.mockResolvedValueOnce(false);

    const response = await completeSession({
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

  it('keeps a completed session response successful when post-completion telemetry fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockCheckBudget.mockResolvedValueOnce({ allowed: true });
    mockRecordUsageEvent.mockRejectedValueOnce(new Error('token logging unavailable'));

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
      xp: { totalXp: 12 },
    });
    expect(mockCompleteSessionRecord).toHaveBeenCalledOnce();
    expect(mockProcessSessionCompletion).toHaveBeenCalledOnce();
    expect(mockRunBackgroundTask).toHaveBeenCalledWith(
      'session-complete-journal-update',
      expect.any(Function),
      {
        route: 'api/session/complete',
        sessionId: 'session-1',
        userId: 'user-1',
      },
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
      completionClaimedAt: CLAIMED_AT,
      mode: 'ai',
      results: [
        { exerciseId: 'exercise-1', answerText: 'こんにちは', isCorrect: true },
        { exerciseId: 'exercise-2', answerText: '', isCorrect: false },
      ],
    });
    expect(mockGenerateSessionSummary).not.toHaveBeenCalled();
    expect(mockCompleteSessionRecord).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        tokenInput: 0,
        tokenOutput: 0,
        completionClaimedAt: CLAIMED_AT,
        summary: expect.any(String),
      }),
    );
  });

  it('fails closed before storing results when server-owned coverage metadata is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetSession.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      mode: 'ai',
      status: 'completing',
      model: 'gpt-5.4',
      tokenInput: 10,
      tokenOutput: 20,
      summary: null,
      plannedCoverage: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      completedAt: CLAIMED_AT,
    });

    const response = await completeSession({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
      lessonTopic: 'Browser-authored fallback must not be accepted',
      category: 'shopping',
      culturalNote: 'Browser-authored note',
      keyPhrases: ['browser phrase'],
      keyPhraseDetails: [{ japanese: '偽' }],
    });

    expect(response.status).toBe(500);
    expect(mockInsertExerciseResults).not.toHaveBeenCalled();
    expect(mockCompleteSessionRecord).not.toHaveBeenCalled();
    expect(mockResetSessionCompletionClaim).toHaveBeenCalledWith('user-1', 'session-1', CLAIMED_AT);
  });

  it.each([
    ['missing', {}],
    [
      'blank',
      {
        lessonTopic: '   ',
        category: '   ',
        culturalNote: '   ',
        keyPhrases: [],
        keyPhraseDetails: [],
      },
    ],
    [
      'altered',
      {
        lessonTopic: 'Altered browser topic',
        category: 'shopping',
        culturalNote: 'Altered browser note',
        keyPhrases: ['altered phrase'],
        keyPhraseDetails: [{ japanese: '偽' }],
      },
    ],
    [
      'malformed',
      {
        lessonTopic: { unexpected: true },
        category: 42,
        culturalNote: ['unexpected'],
        keyPhrases: 'not-an-array',
        keyPhraseDetails: 'not-an-array',
      },
    ],
  ])(
    'uses server-owned generated coverage when resumed browser metadata is %s',
    async (_case, browserMetadata) => {
      mockGetSession.mockResolvedValueOnce({
        id: 'session-1',
        userId: 'user-1',
        mode: 'ai',
        status: 'completing',
        model: 'gpt-5.4',
        tokenInput: 10,
        tokenOutput: 20,
        summary: null,
        plannedCoverage: {
          version: 1,
          category: 'food_dining',
          learningObjectiveId: 'food_dining.order_food_and_drinks',
          lessonTopic: 'Ordering ramen',
          culturalNote: 'Ticket machines are common.',
          keyPhraseDetails: plannedKeyPhraseDetails,
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        completedAt: CLAIMED_AT,
      });

      const response = await completeSession({
        userId: 'user-1',
        sessionId: 'session-1',
        results: validResults(),
        ...browserMetadata,
      });

      expect(response.status).toBe(200);
      const [, completion] = mockCompleteSessionRecord.mock.calls[0] as [
        string,
        { summary: string; tokenInput: number; tokenOutput: number },
      ];
      const storedMeta = JSON.parse(completion.summary) as Record<string, unknown>;

      expect(storedMeta).toMatchObject({
        category: 'food_dining',
        learningObjectiveId: 'food_dining.order_food_and_drinks',
        topic: 'Ordering ramen',
        culturalNote: 'Ticket machines are common.',
        keyPhrases: ['ラーメンをください', 'おすすめは何ですか', 'お会計をお願いします'],
        keyPhraseDetails: plannedKeyPhraseDetails,
        coverageSource: 'server_generated_plan',
      });
    },
  );

  it('persists server-validated structured review intent with completed coverage', async () => {
    mockCheckBudget.mockResolvedValueOnce({ allowed: true });
    mockGetSession.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      mode: 'ai',
      status: 'completing',
      model: 'gpt-5.4',
      tokenInput: 10,
      tokenOutput: 20,
      summary: null,
      plannedCoverage: {
        version: 1,
        category: 'food_dining',
        learningObjectiveId: 'food_dining.order_food_and_drinks',
        lessonTopic: 'Ordering ramen',
        culturalNote: 'Ticket machines are common.',
        keyPhraseDetails: plannedKeyPhraseDetails,
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      completedAt: CLAIMED_AT,
    });
    mockGenerateSessionSummary.mockResolvedValueOnce({
      summary: {
        sessionId: 'session-1',
        userId: 'user-1',
        summary: 'AI generated summary',
        strengths: ['Strong recall'],
        weaknesses: ['Keep practicing'],
        accuracy: 50,
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
      handoffNotes: ['Positive mention of ramen ordering.'],
      reviewIntents: [
        {
          type: 'key_phrase',
          identity: 'ja:ラーメンをください',
          display: 'ラーメンをください (raamen o kudasai)',
          reason: 'The learner missed the production item.',
          reviewRequested: true,
        },
      ],
      tokenUsage: { model: 'gpt-5.4', tokensIn: 10, tokensOut: 20 },
    });

    const response = await completeSession({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
    });

    expect(response.status).toBe(200);
    expect(mockGenerateSessionSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonTopic: 'Ordering ramen',
        lessonKeyPhrases: plannedKeyPhraseDetails,
      }),
    );
    const [, completion] = mockCompleteSessionRecord.mock.calls[0] as [string, { summary: string }];
    expect(JSON.parse(completion.summary)).toMatchObject({
      reviewIntents: [
        {
          type: 'key_phrase',
          identity: 'ja:ラーメンをください',
          reviewRequested: true,
        },
      ],
    });
  });

  it('persists the complete promotion recommendation for completion retries', async () => {
    mockCheckBudget.mockResolvedValueOnce({ allowed: true });
    mockGenerateSessionSummary.mockResolvedValueOnce({
      summary: {
        sessionId: 'session-1',
        userId: 'user-1',
        summary: 'Your recent work shows consistent mastery.',
        strengths: ['Strong recall'],
        weaknesses: ['Keep expanding your range'],
        accuracy: 100,
        generatedAt: '2026-01-01T00:00:00.000Z',
        levelUpRecommendation: {
          recommendedLevel: 'elementary',
          reason: 'Your recent sessions show consistent mastery.',
        },
      },
      handoffNotes: [],
      reviewIntents: [],
      tokenUsage: { model: 'gpt-5.4', tokensIn: 10, tokensOut: 20 },
    });

    const response = await completeSession({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      summary: {
        levelUpRecommendation: {
          recommendedLevel: 'elementary',
          reason: 'Your recent sessions show consistent mastery.',
        },
      },
    });
    const [, completion] = mockCompleteSessionRecord.mock.calls[0] as [string, { summary: string }];
    expect(JSON.parse(completion.summary)).toMatchObject({
      levelUpRecommendation: {
        recommendedLevel: 'elementary',
        reason: 'Your recent sessions show consistent mastery.',
      },
      hadLevelUpRecommendation: true,
    });
  });

  it.each([
    {
      name: 'the immediately previous Learning Session included a promotion',
      previousPromotionFlag: true,
      recentPromotionFlags: [],
      expectedSuppression: true,
    },
    {
      name: 'only an older parseable session included a promotion',
      previousPromotionFlag: null,
      recentPromotionFlags: [true],
      expectedSuppression: false,
    },
  ])(
    'suppresses promotion when $name',
    async ({ previousPromotionFlag, recentPromotionFlags, expectedSuppression }) => {
      mockCheckBudget.mockResolvedValueOnce({ allowed: true });
      mockGetLatestCompletedLearningSessionSummary.mockResolvedValueOnce(
        previousPromotionFlag === null
          ? null
          : {
              summaryText: 'Immediately previous summary',
              topic: 'Immediately previous topic',
              accuracy: 90,
              strengths: ['Consistent recall'],
              weaknesses: [],
              exerciseTypes: ['translation'],
              keyPhrases: [],
              hadLevelUpRecommendation: previousPromotionFlag,
            },
      );
      mockGetRecentSessionSummaries.mockResolvedValueOnce(
        recentPromotionFlags.map((hadLevelUpRecommendation, index) => ({
          summaryText: `Recent summary ${index + 1}`,
          topic: `Recent topic ${index + 1}`,
          accuracy: 90,
          strengths: ['Consistent recall'],
          weaknesses: [],
          exerciseTypes: ['translation'],
          keyPhrases: [],
          hadLevelUpRecommendation,
        })),
      );

      const response = await completeSession({
        userId: 'user-1',
        sessionId: 'session-1',
        results: validResults(),
      });

      expect(response.status).toBe(200);
      expect(mockGetLatestCompletedLearningSessionSummary).toHaveBeenCalledWith('user-1');
      expect(mockGenerateSessionSummary).toHaveBeenCalledWith(
        expect.objectContaining({ suppressPromotion: expectedSuppression }),
      );
    },
  );

  it('ignores partially malformed browser-authored key phrase details', async () => {
    const response = await completeSession({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
      lessonTopic: 'Ordering Food',
      keyPhrases: ['legacy request phrase'],
      keyPhraseDetails: [
        {
          japanese: '  すみません  ',
          romaji: ' sumimasen ',
          english: ' Excuse me ',
          usage: ' Getting attention. ',
        },
        {
          japanese: ' ',
          romaji: ' kore wa ',
          english: ' This is ',
          usage: ' ',
        },
        {
          english: ' Thank you. ',
          usage: ' Gratitude. ',
        },
        {
          japanese: ' ',
          romaji: ' ',
          english: ' ',
          usage: 'Usage alone is not a phrase.',
        },
        'not an object',
        { japanese: 42, romaji: null, english: undefined, usage: 'Malformed text fields.' },
      ],
    });

    expect(response.status).toBe(200);
    const [, completion] = mockCompleteSessionRecord.mock.calls[0] as [
      string,
      { summary: string; tokenInput: number; tokenOutput: number },
    ];
    const storedMeta = JSON.parse(completion.summary) as Record<string, unknown>;

    expect(storedMeta.keyPhraseDetails).toEqual(plannedKeyPhraseDetails);
    expect(storedMeta.keyPhrases).toEqual([
      'ラーメンをください',
      'おすすめは何ですか',
      'お会計をお願いします',
    ]);
  });

  it('ignores oversized browser-authored key phrase details', async () => {
    const keyPhraseDetails = Array.from({ length: 12 }, (_, index) => ({
      japanese: `表現${index + 1}`,
      romaji: `hyougen ${index + 1}`,
      english: `Phrase ${index + 1}`,
      usage: `Usage ${index + 1}`,
    }));

    const response = await completeSession({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
      lessonTopic: 'Ordering Food',
      keyPhraseDetails,
    });

    expect(response.status).toBe(200);
    const [, completion] = mockCompleteSessionRecord.mock.calls[0] as [
      string,
      { summary: string; tokenInput: number; tokenOutput: number },
    ];
    const storedMeta = JSON.parse(completion.summary) as Record<string, unknown>;

    expect(storedMeta.keyPhraseDetails).toEqual(plannedKeyPhraseDetails);
    expect(storedMeta.keyPhrases).toEqual([
      'ラーメンをください',
      'おすすめは何ですか',
      'お会計をお願いします',
    ]);
  });

  it('ignores overlong browser-authored key phrase detail fields', async () => {
    const longJapanese = `すみません${'あ'.repeat(200)}`;
    const longRomaji = `sumimasen ${'x'.repeat(200)}`;
    const longEnglish = `Excuse me ${'y'.repeat(200)}`;
    const longUsage = `Getting attention ${'z'.repeat(200)}`;

    const response = await completeSession({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
      lessonTopic: 'Ordering Food',
      keyPhraseDetails: [
        {
          japanese: longJapanese,
          romaji: longRomaji,
          english: longEnglish,
          usage: longUsage,
        },
      ],
    });

    expect(response.status).toBe(200);
    const [, completion] = mockCompleteSessionRecord.mock.calls[0] as [
      string,
      { summary: string; tokenInput: number; tokenOutput: number },
    ];
    const storedMeta = JSON.parse(completion.summary) as Record<string, unknown>;

    expect(storedMeta.keyPhraseDetails).toEqual(plannedKeyPhraseDetails);
    expect(storedMeta.keyPhrases).toEqual([
      'ラーメンをください',
      'おすすめは何ですか',
      'お会計をお願いします',
    ]);
  });

  it('ignores legacy browser-authored key phrases', async () => {
    const response = await completeSession({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
      lessonTopic: 'Ordering Food',
      keyPhrases: ['  legacy phrase  '],
      keyPhraseDetails: [{ usage: 'Usage without phrase text is invalid.' }, null],
    });

    expect(response.status).toBe(200);
    const [, completion] = mockCompleteSessionRecord.mock.calls[0] as [
      string,
      { summary: string; tokenInput: number; tokenOutput: number },
    ];
    const storedMeta = JSON.parse(completion.summary) as Record<string, unknown>;

    expect(storedMeta.keyPhrases).toEqual([
      'ラーメンをください',
      'おすすめは何ですか',
      'お会計をお願いします',
    ]);
    expect(storedMeta.keyPhraseDetails).toEqual(plannedKeyPhraseDetails);
  });

  it('schedules AI journal updates through the shared background helper', async () => {
    mockCheckBudget.mockResolvedValueOnce({ allowed: true });

    const response = await completeSession({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
      lessonTopic: 'Ordering Food',
      category: 'restaurant',
      keyPhrases: ['konnichiwa'],
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, state: 'done' });

    expect(mockRunBackgroundTask).toHaveBeenCalledOnce();
    const [taskName, task, meta] = mockRunBackgroundTask.mock.calls[0] as [
      string,
      () => Promise<void>,
      Record<string, unknown>,
    ];
    expect(taskName).toBe('session-complete-journal-update');
    expect(meta).toEqual({
      route: 'api/session/complete',
      sessionId: 'session-1',
      userId: 'user-1',
    });
    expect(mockPersistGeneratedJournal).not.toHaveBeenCalled();

    await task();

    expect(mockGenerateUpdatedJournal).toHaveBeenCalledWith({
      currentJournal: null,
      sessionSummary: expect.objectContaining({ summary: 'AI generated summary' }),
      sessionMeta: {
        category: 'food_dining',
        topic: 'Ordering Food',
        exerciseTypes: ['translation'],
        keyPhrases: ['ラーメンをください', 'おすすめは何ですか', 'お会計をお願いします'],
      },
      userLevel: 'beginner',
    });
    expect(mockPersistGeneratedJournal).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      currentJournal: null,
      journal: 'updated progress journal',
      tokenUsage: {
        model: 'gpt-5.4',
        tokensIn: 1,
        tokensOut: 2,
      },
    });
  });

  it('keeps journal scheduling failures non-fatal and uses sanitized logging', async () => {
    const schedulingError = new Error('deferred lifecycle unavailable');
    mockCheckBudget.mockResolvedValueOnce({ allowed: true });
    mockRunBackgroundTask.mockRejectedValueOnce(schedulingError);

    const response = await completeSession({
      userId: 'user-1',
      sessionId: 'session-1',
      results: validResults(),
      lessonTopic: 'Ordering Food',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, state: 'done' });
    expect(mockLogError).toHaveBeenCalledWith(
      'api/session/complete',
      'journal scheduling failed (non-fatal)',
      {
        error: schedulingError,
        sessionId: 'session-1',
        userId: 'user-1',
      },
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
