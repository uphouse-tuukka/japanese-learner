import { beforeEach, describe, expect, it, vi } from 'vitest';

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

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/session/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/session/generate', () => {
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
    mockCreateSessionRecord.mockResolvedValue({
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
    });
    mockAttachExercisesToSession.mockResolvedValue(undefined);
    mockRecordUsageEvent.mockResolvedValue(undefined);
  });

  it('returns a timeout error instead of hanging forever when generation stalls', async () => {
    vi.stubEnv('SESSION_GENERATION_TIMEOUT_MS', '10');
    mockGenerateSessionPlan.mockImplementation(() => new Promise(() => {}));

    const result = await Promise.race([
      POST({ request: buildRequest({ userId: 'user-1', exerciseCount: 8 }) } as never),
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
        lesson: {
          topic: 'Ordering food',
          category: 'food_dining',
          explanation: 'Learn a few polite ordering phrases.',
          culturalNote: 'Be polite with staff.',
          keyPhrases: [],
        },
        exercises: [],
        tokenUsage: {
          input: 10,
          output: 20,
        },
        metadata: {},
      });

    const response = await POST({
      request: buildRequest({ userId: 'user-1', exerciseCount: 8 }),
    } as never);

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenCalledTimes(2);
  });
});
