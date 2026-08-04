import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGenerateSessionPlan,
  mockDeleteStaleGhostSessions,
  mockGetCompletedAiExerciseResultsForUser,
  mockGetCompletedAiSessionsForUser,
  mockGetExerciseResultsForUser,
  mockGetSessionsForUser,
  mockCreateSessionRecord,
  mockAttachExercisesToSession,
  mockClaimSessionCompletion,
  mockCompleteSessionRecord,
  mockGetProgressJournal,
  mockGetRecentSessionSummaries,
  mockGetSession,
  mockGetSessionExercises,
  mockGetUserById,
  mockInsertExerciseResults,
  mockResetSessionCompletionClaim,
  mockCheckBudget,
  mockRecordUsageEvent,
  mockGetUser,
  mockProcessSessionCompletion,
} = vi.hoisted(() => ({
  mockGenerateSessionPlan: vi.fn(),
  mockDeleteStaleGhostSessions: vi.fn(),
  mockGetCompletedAiExerciseResultsForUser: vi.fn(),
  mockGetCompletedAiSessionsForUser: vi.fn(),
  mockGetExerciseResultsForUser: vi.fn(),
  mockGetSessionsForUser: vi.fn(),
  mockCreateSessionRecord: vi.fn(),
  mockAttachExercisesToSession: vi.fn(),
  mockClaimSessionCompletion: vi.fn(),
  mockCompleteSessionRecord: vi.fn(),
  mockGetProgressJournal: vi.fn(),
  mockGetRecentSessionSummaries: vi.fn(),
  mockGetSession: vi.fn(),
  mockGetSessionExercises: vi.fn(),
  mockGetUserById: vi.fn(),
  mockInsertExerciseResults: vi.fn(),
  mockResetSessionCompletionClaim: vi.fn(),
  mockCheckBudget: vi.fn(),
  mockRecordUsageEvent: vi.fn(),
  mockGetUser: vi.fn(),
  mockProcessSessionCompletion: vi.fn(),
}));

vi.mock('$lib/server/ai', () => ({
  generateSessionPlan: mockGenerateSessionPlan,
}));

vi.mock('$lib/server/db', () => ({
  attachExercisesToSession: mockAttachExercisesToSession,
  createSessionRecord: mockCreateSessionRecord,
  deleteStaleGhostSessions: mockDeleteStaleGhostSessions,
  getCompletedAiExerciseResultsForUser: mockGetCompletedAiExerciseResultsForUser,
  getCompletedAiSessionsForUser: mockGetCompletedAiSessionsForUser,
  getExerciseResultsForUser: mockGetExerciseResultsForUser,
  getSessionsForUser: mockGetSessionsForUser,
  claimSessionCompletion: mockClaimSessionCompletion,
  completeSessionRecord: mockCompleteSessionRecord,
  getProgressJournal: mockGetProgressJournal,
  getRecentSessionSummaries: mockGetRecentSessionSummaries,
  getSession: mockGetSession,
  getSessionExercises: mockGetSessionExercises,
  getUserById: mockGetUserById,
  insertExerciseResults: mockInsertExerciseResults,
  resetSessionCompletionClaim: mockResetSessionCompletionClaim,
}));

vi.mock('$lib/server/token-limiter', () => ({
  checkBudget: mockCheckBudget,
  recordUsageEvent: mockRecordUsageEvent,
}));

vi.mock('$lib/server/users', () => ({
  getUser: mockGetUser,
}));

vi.mock('$lib/server/gamification', () => ({
  processSessionCompletion: mockProcessSessionCompletion,
}));

import { POST as GENERATE_POST } from './generate/+server';
import { POST as COMPLETE_POST } from './complete/+server';

const keyPhrases = [
  {
    japanese: 'こんにちは',
    romaji: 'konnichiwa',
    english: 'Hello',
    usage: 'Use as a daytime greeting.',
  },
  {
    japanese: 'はじめまして',
    romaji: 'hajimemashite',
    english: 'Nice to meet you',
    usage: 'Use when meeting someone for the first time.',
  },
  {
    japanese: 'よろしくお願いします',
    romaji: 'yoroshiku onegaishimasu',
    english: 'Please treat me kindly',
    usage: 'Use to close a first introduction politely.',
  },
];

const lesson = {
  topic: 'Basic greetings',
  category: 'greetings_basics',
  explanation: 'Learn a few polite greeting phrases.',
  culturalNote: 'Use a calm, friendly greeting when entering a small shop.',
  keyPhrases,
};

const exercises = [
  {
    id: 'exercise-1',
    type: 'multiple_choice',
    title: 'Choose the meaning',
    japanese: 'こんにちは',
    romaji: 'konnichiwa',
    englishContext: 'Greeting someone',
    tags: ['greeting'],
    difficulty: 1,
    question: 'What does こんにちは (konnichiwa) mean?',
    choices: ['Hello', 'Goodbye'],
    correctAnswer: 'Hello',
  },
];

const generatedPlan = {
  model: 'gpt-5.4',
  lesson,
  exercises,
  tokenUsage: { input: 10, output: 20 },
  metadata: { learningObjectiveId: 'greetings_basics.greet_by_time' },
};

const session = {
  id: 'session-1',
  userId: 'user-1',
  mode: 'ai',
  status: 'planned',
  model: 'gpt-5.4',
  tokenInput: 10,
  tokenOutput: 20,
  summary: null,
  plannedCoverage: null,
  createdAt: '2026-08-04T11:00:00.000Z',
  completedAt: null,
};

const user = {
  id: 'user-1',
  name: 'Test User',
  level: 'beginner',
  japaneseWritingEnabled: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lastActiveAt: null,
  progressJournal: null,
};

function cookies() {
  return {
    get(name: string) {
      return name === 'selected_user' ? 'user-1' : undefined;
    },
  };
}

function request(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Learning Session generation-to-completion retention lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckBudget.mockResolvedValue({ allowed: true });
    mockGetUser.mockResolvedValue(user);
    mockGetUserById.mockResolvedValue(user);
    mockGetCompletedAiExerciseResultsForUser.mockResolvedValue([]);
    mockGetCompletedAiSessionsForUser.mockResolvedValue([]);
    mockGetSessionsForUser.mockResolvedValue([]);
    mockGetExerciseResultsForUser.mockResolvedValue([]);
    mockGetProgressJournal.mockResolvedValue(null);
    mockGetRecentSessionSummaries.mockResolvedValue([]);
    mockGenerateSessionPlan.mockResolvedValue(generatedPlan);
    mockAttachExercisesToSession.mockResolvedValue(undefined);
    mockInsertExerciseResults.mockResolvedValue(undefined);
    mockResetSessionCompletionClaim.mockResolvedValue(undefined);
    mockRecordUsageEvent.mockResolvedValue(undefined);
    mockProcessSessionCompletion.mockResolvedValue({ totalXp: 12 });
  });

  it('carries generated coverage through resume-safe completion and an idempotent retry', async () => {
    let storedPlannedCoverage: Record<string, unknown> | null = null;
    let storedCompletionSummary: string | null = null;
    mockCreateSessionRecord.mockImplementationOnce(async (input) => {
      storedPlannedCoverage = input.plannedCoverage as Record<string, unknown>;
      return { ...session, plannedCoverage: input.plannedCoverage };
    });

    const generationResponse = await GENERATE_POST({
      request: request('http://localhost/api/session/generate', {
        userId: 'user-1',
        exerciseCount: 8,
      }),
      cookies: cookies(),
    } as never);

    expect(generationResponse.status).toBe(200);
    expect(storedPlannedCoverage).toMatchObject({
      category: 'greetings_basics',
      learningObjectiveId: 'greetings_basics.greet_by_time',
      lessonTopic: 'Basic greetings',
      keyPhraseDetails: keyPhrases,
    });

    mockClaimSessionCompletion.mockResolvedValueOnce({
      status: 'claimed',
      claimedAt: '2026-08-04T12:00:00.000Z',
    });
    mockGetSession.mockResolvedValueOnce({
      ...session,
      status: 'completing',
      plannedCoverage: storedPlannedCoverage,
      completedAt: '2026-08-04T12:00:00.000Z',
    });
    mockGetSessionExercises.mockResolvedValueOnce(
      exercises.map((exercise, orderIndex) => ({
        sessionId: session.id,
        exerciseId: exercise.id,
        orderIndex,
        exercise,
      })),
    );
    mockCheckBudget.mockResolvedValueOnce({ allowed: false, reason: 'budget_unavailable' });
    mockCompleteSessionRecord.mockImplementationOnce(async (_sessionId, completion) => {
      storedCompletionSummary = completion.summary;
      return true;
    });

    const results = [{ exerciseId: 'exercise-1', answerText: 'Hello', isCorrect: true }];
    const completionResponse = await COMPLETE_POST({
      request: request('http://localhost/api/session/complete', {
        userId: 'user-1',
        sessionId: session.id,
        results,
        lessonTopic: 'Corrupted browser topic',
        category: 'shopping',
        culturalNote: 'Corrupted browser note',
        keyPhrases: ['偽'],
        keyPhraseDetails: [{ japanese: '偽' }],
      }),
      cookies: cookies(),
    } as never);

    expect(completionResponse.status).toBe(200);
    expect(JSON.parse(storedCompletionSummary ?? '{}')).toMatchObject({
      category: 'greetings_basics',
      learningObjectiveId: 'greetings_basics.greet_by_time',
      topic: 'Basic greetings',
      keyPhraseDetails: keyPhrases,
      coverageSource: 'server_generated_plan',
    });
    expect(mockInsertExerciseResults).toHaveBeenCalledOnce();
    expect(mockCompleteSessionRecord).toHaveBeenCalledOnce();
    expect(mockRecordUsageEvent).toHaveBeenCalledOnce();
    expect(mockRecordUsageEvent).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      model: 'gpt-5.4',
      tokensIn: 10,
      tokensOut: 20,
    });

    mockClaimSessionCompletion.mockResolvedValueOnce({
      status: 'already_completed',
      session: {
        ...session,
        status: 'completed',
        plannedCoverage: storedPlannedCoverage,
        summary: storedCompletionSummary,
        completedAt: '2026-08-04T12:00:00.000Z',
      },
    });
    const retryResponse = await COMPLETE_POST({
      request: request('http://localhost/api/session/complete', {
        userId: 'user-1',
        sessionId: session.id,
        results,
      }),
      cookies: cookies(),
    } as never);

    expect(retryResponse.status).toBe(200);
    await expect(retryResponse.json()).resolves.toMatchObject({
      ok: true,
      state: 'done',
      summary: { sessionId: session.id, accuracy: 100 },
      xp: null,
    });
    expect(mockInsertExerciseResults).toHaveBeenCalledOnce();
    expect(mockCompleteSessionRecord).toHaveBeenCalledOnce();
    expect(mockRecordUsageEvent).toHaveBeenCalledOnce();
  });
});
