import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCheckBudget,
  mockCreateUserMission,
  mockGenerateMissionTurn,
  mockGetCategorySessionCount,
  mockGetMissionById,
  mockGetUser,
  mockRecordMissionTokenUsage,
  mockUpdateUserMission,
} = vi.hoisted(() => ({
  mockCheckBudget: vi.fn(),
  mockCreateUserMission: vi.fn(),
  mockGenerateMissionTurn: vi.fn(),
  mockGetCategorySessionCount: vi.fn(),
  mockGetMissionById: vi.fn(),
  mockGetUser: vi.fn(),
  mockRecordMissionTokenUsage: vi.fn(),
  mockUpdateUserMission: vi.fn(),
}));

vi.mock('$lib/server/config', () => ({
  config: {
    missions: {
      maxTurnsPerMission: 7,
      unlockAllOverride: false,
    },
  },
}));

vi.mock('$lib/server/missions-db', () => ({
  createUserMission: mockCreateUserMission,
  getCategorySessionCount: mockGetCategorySessionCount,
  getMissionById: mockGetMissionById,
  updateUserMission: mockUpdateUserMission,
}));

vi.mock('$lib/server/missions-ai', () => ({
  generateMissionTurn: mockGenerateMissionTurn,
  recordMissionTokenUsage: mockRecordMissionTokenUsage,
}));

vi.mock('$lib/server/token-limiter', () => ({
  checkBudget: mockCheckBudget,
}));

vi.mock('$lib/server/users', () => ({
  getUser: mockGetUser,
}));

import { config } from '$lib/server/config';
import { POST } from './start/+server';

const tokenUsage = {
  model: 'gpt-5.4',
  input: 10,
  output: 20,
  total: 30,
};

const turn = {
  turnNumber: 1,
  npcDialogue: {
    japanese: 'いらっしゃいませ。',
    romaji: 'irasshaimase.',
  },
  userResponse: null,
  feedback: null,
  choices: [
    {
      japanese: 'ラーメンをください。',
      romaji: 'raamen o kudasai.',
      english: 'Ramen, please.',
      isCorrect: true,
    },
    {
      japanese: 'さようなら。',
      romaji: 'sayounara.',
      english: 'Goodbye.',
      isCorrect: false,
    },
    {
      japanese: 'おはようございます。',
      romaji: 'ohayou gozaimasu.',
      english: 'Good morning.',
      isCorrect: false,
    },
  ],
};

function mission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mission-1',
    title: 'Order ramen',
    category: 'food',
    difficulty: 'easy',
    sequence: 1,
    scenarioPrompt: 'Order ramen at a shop.',
    badgeEmoji: '🍜',
    badgeName: 'Ramen Confident',
    badgeStatement: 'You can order ramen with confidence.',
    unlockSessionsRequired: 0,
    startUnlocked: true,
    ...overrides,
  };
}

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/missions/mission-1/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildRawRequest(body: string): Request {
  return new Request('http://localhost/api/missions/mission-1/start', {
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

async function startMission(
  body: unknown,
  selectedUserId: string | null = 'user-1',
): Promise<Response> {
  return POST({
    params: { id: 'mission-1' },
    request: buildRequest(body),
    cookies: buildCookies(selectedUserId),
  } as never);
}

function expectNoCreateGenerateTokenOrUpdateCalls() {
  expect(mockCreateUserMission).not.toHaveBeenCalled();
  expect(mockGenerateMissionTurn).not.toHaveBeenCalled();
  expect(mockRecordMissionTokenUsage).not.toHaveBeenCalled();
  expect(mockUpdateUserMission).not.toHaveBeenCalled();
}

function expectNoServerCalls() {
  expect(mockGetMissionById).not.toHaveBeenCalled();
  expect(mockGetUser).not.toHaveBeenCalled();
  expect(mockCheckBudget).not.toHaveBeenCalled();
  expect(mockGetCategorySessionCount).not.toHaveBeenCalled();
  expectNoCreateGenerateTokenOrUpdateCalls();
}

describe('POST /api/missions/[id]/start', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockCheckBudget.mockReset();
    mockCreateUserMission.mockReset();
    mockGenerateMissionTurn.mockReset();
    mockGetCategorySessionCount.mockReset();
    mockGetMissionById.mockReset();
    mockGetUser.mockReset();
    mockRecordMissionTokenUsage.mockReset();
    mockUpdateUserMission.mockReset();

    mockCheckBudget.mockResolvedValue({ allowed: true, remainingTokens: 100, limit: 100 });
    mockCreateUserMission.mockResolvedValue('user-mission-1');
    mockGenerateMissionTurn.mockResolvedValue({
      turn,
      sceneDescription: 'You sit down at a lively ramen counter.',
      characterName: '店員',
      characterEmoji: '🍜',
      tokenUsage,
    });
    mockGetCategorySessionCount.mockResolvedValue(0);
    mockGetMissionById.mockResolvedValue(mission());
    mockGetUser.mockResolvedValue({ id: 'user-1', name: 'Test User', level: 'beginner' });
    mockRecordMissionTokenUsage.mockResolvedValue(undefined);
    mockUpdateUserMission.mockResolvedValue(undefined);
  });

  it('starts a mission for a matching selected_user cookie using the trimmed userId and keeps the success response shape', async () => {
    const response = await startMission({ userId: ' user-1 ', mode: 'practice' }, ' user-1 ');

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      userMissionId: 'user-mission-1',
      turn,
      sceneDescription: 'You sit down at a lively ramen counter.',
      characterName: '店員',
      characterEmoji: '🍜',
      totalTurns: config.missions.maxTurnsPerMission,
    });
    expect(payload).not.toHaveProperty('ok');

    expect(mockGetMissionById).toHaveBeenCalledWith('mission-1');
    expect(mockCheckBudget).toHaveBeenCalledWith('user-1');
    expect(mockGetCategorySessionCount).toHaveBeenCalledWith('user-1', 'food');
    expect(mockCreateUserMission).toHaveBeenCalledWith({
      userId: 'user-1',
      missionId: 'mission-1',
      mode: 'practice',
    });
    expect(mockGenerateMissionTurn).toHaveBeenCalledWith({
      mission: mission(),
      mode: 'practice',
      turnNumber: 1,
      totalTurns: config.missions.maxTurnsPerMission,
      conversationHistory: [],
      userLevel: undefined,
    });
    expect(mockRecordMissionTokenUsage).toHaveBeenCalledWith('user-1', tokenUsage);
    expect(mockUpdateUserMission).toHaveBeenCalledWith('user-mission-1', {
      conversationLog: [turn],
    });
  });

  it('starts a mission when no selected_user cookie is present', async () => {
    const response = await startMission({ userId: ' user-1 ', mode: 'immersion' }, null);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      userMissionId: 'user-mission-1',
      turn,
      totalTurns: config.missions.maxTurnsPerMission,
    });
    expect(payload).not.toHaveProperty('ok');
    expect(mockCreateUserMission).toHaveBeenCalledWith({
      userId: 'user-1',
      missionId: 'mission-1',
      mode: 'immersion',
    });
    expect(mockRecordMissionTokenUsage).toHaveBeenCalledWith('user-1', tokenUsage);
    expect(mockUpdateUserMission).toHaveBeenCalledWith('user-mission-1', {
      conversationLog: [turn],
    });
  });

  it('returns 403 before mission DB, budget, AI, token, or update calls when selected_user does not match body userId', async () => {
    const response = await startMission({ userId: 'user-2', mode: 'practice' }, 'user-1');

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Selected user does not match request user.',
    });
    expectNoServerCalls();
  });

  it('returns 400 for invalid JSON before side effects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST({
      params: { id: 'mission-1' },
      request: buildRawRequest('{not json'),
      cookies: buildCookies('user-1'),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Invalid JSON body.' });
    expectNoServerCalls();
  });

  it.each([
    ['missing', { mode: 'practice' }],
    ['blank', { userId: '   ', mode: 'practice' }],
  ])('returns 400 for a %s userId before side effects', async (_caseName, body) => {
    const response = await startMission(body, 'user-1');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Missing userId.' });
    expectNoServerCalls();
  });

  it('returns 400 for a blank selected_user cookie before side effects', async () => {
    const response = await startMission({ userId: 'user-1', mode: 'practice' }, '   ');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Invalid selected user.' });
    expectNoServerCalls();
  });

  it('returns 400 for an invalid mode before side effects', async () => {
    const response = await startMission({ userId: 'user-1', mode: 'story' }, 'user-1');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Invalid mode. Must be practice or immersion.',
    });
    expectNoServerCalls();
  });

  it('returns 404 when the mission is not found before budget, create, generate, token, or update calls', async () => {
    mockGetMissionById.mockResolvedValueOnce(null);

    const response = await startMission({ userId: 'user-1', mode: 'practice' }, 'user-1');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Mission not found.' });
    expect(mockGetMissionById).toHaveBeenCalledWith('mission-1');
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockCheckBudget).not.toHaveBeenCalled();
    expect(mockGetCategorySessionCount).not.toHaveBeenCalled();
    expectNoCreateGenerateTokenOrUpdateCalls();
  });

  it('returns 404 when the user is not found before budget, category count, create, generate, token, or update calls', async () => {
    mockGetUser.mockResolvedValueOnce(null);

    const response = await startMission({ userId: 'user-missing', mode: 'practice' }, null);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'User not found.' });
    expect(mockGetMissionById).toHaveBeenCalledWith('mission-1');
    expect(mockGetUser).toHaveBeenCalledWith('user-missing');
    expect(mockCheckBudget).not.toHaveBeenCalled();
    expect(mockGetCategorySessionCount).not.toHaveBeenCalled();
    expectNoCreateGenerateTokenOrUpdateCalls();
  });

  it('keeps the existing budget exhausted 429 message without create, generate, token, or update calls', async () => {
    mockCheckBudget.mockResolvedValueOnce({ allowed: false, remainingTokens: 0, limit: 100 });

    const response = await startMission({ userId: 'user-1', mode: 'practice' }, 'user-1');

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "You've reached today's AI practice budget. Please try again tomorrow.",
    });
    expect(mockGetMissionById).toHaveBeenCalledWith('mission-1');
    expect(mockCheckBudget).toHaveBeenCalledWith('user-1');
    expect(mockGetCategorySessionCount).not.toHaveBeenCalled();
    expectNoCreateGenerateTokenOrUpdateCalls();
  });

  it('returns 403 for a locked mission before create, generate, token, or update calls', async () => {
    mockGetMissionById.mockResolvedValueOnce(
      mission({ startUnlocked: false, unlockSessionsRequired: 3 }),
    );
    mockGetCategorySessionCount.mockResolvedValueOnce(2);

    const response = await startMission({ userId: 'user-1', mode: 'practice' }, 'user-1');

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Mission is locked.' });
    expect(mockGetMissionById).toHaveBeenCalledWith('mission-1');
    expect(mockCheckBudget).toHaveBeenCalledWith('user-1');
    expect(mockGetCategorySessionCount).toHaveBeenCalledWith('user-1', 'food');
    expectNoCreateGenerateTokenOrUpdateCalls();
  });
});
