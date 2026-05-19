import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAttachExercisesToSession,
  mockBuildPracticeSession,
  mockCreateSessionRecord,
  mockDeleteStaleGhostSessions,
  mockGetDebugExercises,
} = vi.hoisted(() => ({
  mockAttachExercisesToSession: vi.fn(),
  mockBuildPracticeSession: vi.fn(),
  mockCreateSessionRecord: vi.fn(),
  mockDeleteStaleGhostSessions: vi.fn(),
  mockGetDebugExercises: vi.fn(),
}));

vi.mock('$app/environment', () => ({
  browser: false,
  building: false,
  dev: true,
  version: 'test',
}));

vi.mock('$lib/server/db', () => ({
  attachExercisesToSession: mockAttachExercisesToSession,
  createSessionRecord: mockCreateSessionRecord,
  deleteStaleGhostSessions: mockDeleteStaleGhostSessions,
}));

vi.mock('$lib/server/debug-exercises', () => ({
  getDebugExercises: mockGetDebugExercises,
}));

vi.mock('$lib/server/practice', () => ({
  buildPracticeSession: mockBuildPracticeSession,
}));

import { POST } from './generate/+server';

const lesson = {
  topic: 'Review from previous sessions',
  explanation: 'Practice weak items.',
  culturalNote: 'Review often.',
  keyPhrases: [],
};

const practiceExercises = [
  {
    id: 'exercise-1',
    type: 'multiple_choice',
    title: 'Greetings',
    japanese: 'こんにちは',
    romaji: 'konnichiwa',
    englishContext: 'Hello',
    tags: ['greeting'],
    difficulty: 1,
    question: 'What does こんにちは mean?',
    choices: ['Hello', 'Goodbye'],
    correctAnswer: 'Hello',
  },
];

const debugExercises = [
  {
    id: 'debug-exercise-1',
    type: 'multiple_choice',
    title: 'Debug greeting',
    japanese: 'こんにちは',
    romaji: 'konnichiwa',
    englishContext: 'Hello',
    tags: ['debug'],
    difficulty: 1,
    question: 'What does こんにちは mean?',
    choices: ['Hello', 'Goodbye'],
    correctAnswer: 'Hello',
  },
];

const session = {
  id: 'session-1',
  userId: 'user-1',
  mode: 'practice',
  status: 'planned',
  model: 'practice-review',
  tokenInput: 0,
  tokenOutput: 0,
  summary: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  completedAt: null,
};

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/practice/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildRawRequest(body: string): Request {
  return new Request('http://localhost/api/practice/generate', {
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

async function generatePractice(body: unknown, selectedUserId: string | null = 'user-1') {
  return POST({ request: buildRequest(body), cookies: buildCookies(selectedUserId) } as never);
}

function expectNoGenerationWrites() {
  expect(mockDeleteStaleGhostSessions).not.toHaveBeenCalled();
  expect(mockBuildPracticeSession).not.toHaveBeenCalled();
  expect(mockCreateSessionRecord).not.toHaveBeenCalled();
  expect(mockAttachExercisesToSession).not.toHaveBeenCalled();
  expect(mockGetDebugExercises).not.toHaveBeenCalled();
}

describe('POST /api/practice/generate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockAttachExercisesToSession.mockReset();
    mockBuildPracticeSession.mockReset();
    mockCreateSessionRecord.mockReset();
    mockDeleteStaleGhostSessions.mockReset();
    mockGetDebugExercises.mockReset();

    mockAttachExercisesToSession.mockResolvedValue(undefined);
    mockBuildPracticeSession.mockResolvedValue({
      id: 'practice-plan-1',
      userId: 'user-1',
      mode: 'practice',
      createdAt: '2026-01-01T00:00:00.000Z',
      model: 'practice-review',
      lesson,
      exercises: practiceExercises,
      tokenUsage: { input: 0, output: 0 },
      metadata: {},
    });
    mockCreateSessionRecord.mockResolvedValue(session);
    mockDeleteStaleGhostSessions.mockResolvedValue(undefined);
    mockGetDebugExercises.mockReturnValue(debugExercises);
  });

  it('generates practice for a matching selected_user cookie using the trimmed userId', async () => {
    const response = await generatePractice({ userId: ' user-1 ', exerciseCount: 8 }, ' user-1 ');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      state: 'active',
      session,
      lesson,
      exercises: practiceExercises,
    });
    expect(mockDeleteStaleGhostSessions).toHaveBeenCalledWith('user-1');
    expect(mockBuildPracticeSession).toHaveBeenCalledWith('user-1', { exerciseCount: 8 });
    expect(mockCreateSessionRecord).toHaveBeenCalledWith({
      userId: 'user-1',
      mode: 'practice',
      status: 'planned',
      model: 'practice-review',
    });
    expect(mockAttachExercisesToSession).toHaveBeenCalledWith('session-1', practiceExercises);
    expect(mockGetDebugExercises).not.toHaveBeenCalled();
  });

  it('generates practice when no selected_user cookie is present', async () => {
    const response = await generatePractice({ userId: ' user-1 ', exerciseCount: 5 }, null);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      state: 'active',
      lesson,
      exercises: practiceExercises,
    });
    expect(mockDeleteStaleGhostSessions).toHaveBeenCalledWith('user-1');
    expect(mockBuildPracticeSession).toHaveBeenCalledWith('user-1', { exerciseCount: 5 });
    expect(mockCreateSessionRecord).toHaveBeenCalledWith({
      userId: 'user-1',
      mode: 'practice',
      status: 'planned',
      model: 'practice-review',
    });
    expect(mockAttachExercisesToSession).toHaveBeenCalledWith('session-1', practiceExercises);
  });

  it('returns 403 without generation writes when selected_user does not match body userId', async () => {
    const response = await generatePractice({ userId: 'user-2', exerciseCount: 8 }, 'user-1');

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Selected user does not match request user.',
    });
    expectNoGenerationWrites();
  });

  it('returns 400 for invalid JSON without generation writes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST({
      request: buildRawRequest('{not json'),
      cookies: buildCookies('user-1'),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Invalid JSON body.' });
    expectNoGenerationWrites();
  });

  it('returns 400 for a missing or blank userId without generation writes', async () => {
    const response = await generatePractice({ userId: '   ', exerciseCount: 8 }, 'user-1');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Missing userId.' });
    expectNoGenerationWrites();
  });

  it('returns 400 for an invalid debugExerciseType in dev without creating a session', async () => {
    const response = await generatePractice(
      { userId: 'user-1', exerciseCount: 3, debugExerciseType: 'not-real' },
      'user-1',
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Invalid debugExerciseType.',
    });
    expectNoGenerationWrites();
  });

  it('returns debug exercises in dev without building a normal practice plan', async () => {
    const debugSession = { ...session, model: 'debug' };
    mockCreateSessionRecord.mockResolvedValueOnce(debugSession);

    const response = await generatePractice(
      { userId: ' user-1 ', exerciseCount: 2, debugExerciseType: 'multiple_choice' },
      ' user-1 ',
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      state: 'active',
      session: debugSession,
      lesson: null,
      exercises: debugExercises,
    });
    expect(mockDeleteStaleGhostSessions).toHaveBeenCalledWith('user-1');
    expect(mockGetDebugExercises).toHaveBeenCalledWith('multiple_choice', 2);
    expect(mockBuildPracticeSession).not.toHaveBeenCalled();
    expect(mockCreateSessionRecord).toHaveBeenCalledWith({
      userId: 'user-1',
      mode: 'practice',
      status: 'planned',
      model: 'debug',
    });
    expect(mockAttachExercisesToSession).toHaveBeenCalledWith('session-1', debugExercises);
  });

  it('accepts speaking as a dev debug exercise type', async () => {
    const debugSession = { ...session, model: 'debug' };
    mockCreateSessionRecord.mockResolvedValueOnce(debugSession);

    const response = await generatePractice(
      { userId: 'user-1', exerciseCount: 2, debugExerciseType: 'speaking' },
      'user-1',
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      state: 'active',
      session: debugSession,
      lesson: null,
      exercises: debugExercises,
    });
    expect(mockGetDebugExercises).toHaveBeenCalledWith('speaking', 2);
    expect(mockBuildPracticeSession).not.toHaveBeenCalled();
    expect(mockAttachExercisesToSession).toHaveBeenCalledWith('session-1', debugExercises);
  });
});
