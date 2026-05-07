import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockEvaluateUserResponse,
  mockGenerateMissionTurn,
  mockGetMissionById,
  mockGetUserMission,
  mockRecordMissionTokenUsage,
  mockUpdateUserMission,
} = vi.hoisted(() => ({
  mockEvaluateUserResponse: vi.fn(),
  mockGenerateMissionTurn: vi.fn(),
  mockGetMissionById: vi.fn(),
  mockGetUserMission: vi.fn(),
  mockRecordMissionTokenUsage: vi.fn(),
  mockUpdateUserMission: vi.fn(),
}));

vi.mock('$lib/server/config', () => ({
  config: {
    missions: {
      maxTurnsPerMission: 3,
    },
  },
}));

vi.mock('$lib/server/missions-db', () => ({
  getMissionById: mockGetMissionById,
  getUserMission: mockGetUserMission,
  updateUserMission: mockUpdateUserMission,
}));

vi.mock('$lib/server/missions-ai', () => ({
  evaluateUserResponse: mockEvaluateUserResponse,
  generateMissionTurn: mockGenerateMissionTurn,
  recordMissionTokenUsage: mockRecordMissionTokenUsage,
}));

import { config } from '$lib/server/config';
import { POST } from './respond/+server';

const evaluationTokenUsage = {
  model: 'gpt-5.4',
  input: 10,
  output: 15,
  total: 25,
};

const generatedTokenUsage = {
  model: 'gpt-5.4',
  input: 20,
  output: 30,
  total: 50,
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

function choice(overrides: Record<string, unknown> = {}) {
  return {
    japanese: 'ラーメンをください。',
    romaji: 'raamen o kudasai.',
    english: 'Ramen, please.',
    isCorrect: true,
    ...overrides,
  };
}

function turn(overrides: Record<string, unknown> = {}) {
  return {
    turnNumber: 1,
    npcDialogue: {
      japanese: 'いらっしゃいませ。',
      romaji: 'irasshaimase.',
    },
    userResponse: null,
    feedback: null,
    choices: [
      choice(),
      choice({
        japanese: 'さようなら。',
        romaji: 'sayounara.',
        english: 'Goodbye.',
        isCorrect: false,
      }),
    ],
    ...overrides,
  };
}

function userMission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-mission-1',
    userId: 'user-1',
    missionId: 'mission-1',
    mode: 'practice',
    status: 'in_progress',
    exchanges: 0,
    correctResponses: 0,
    score: 0,
    xpEarned: 0,
    badgeEarned: false,
    conversationLog: [turn()],
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/missions/mission-1/respond', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildRawRequest(body: string): Request {
  return new Request('http://localhost/api/missions/mission-1/respond', {
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

async function respondToMission(
  body: unknown,
  selectedUserId: string | null = 'user-1',
): Promise<Response> {
  return POST({
    params: { id: 'mission-1' },
    request: buildRequest(body),
    cookies: buildCookies(selectedUserId),
  } as never);
}

function expectNoServerCalls() {
  expect(mockGetUserMission).not.toHaveBeenCalled();
  expect(mockGetMissionById).not.toHaveBeenCalled();
  expect(mockEvaluateUserResponse).not.toHaveBeenCalled();
  expect(mockGenerateMissionTurn).not.toHaveBeenCalled();
  expect(mockRecordMissionTokenUsage).not.toHaveBeenCalled();
  expect(mockUpdateUserMission).not.toHaveBeenCalled();
}

describe('POST /api/missions/[id]/respond', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockEvaluateUserResponse.mockReset();
    mockGenerateMissionTurn.mockReset();
    mockGetMissionById.mockReset();
    mockGetUserMission.mockReset();
    mockRecordMissionTokenUsage.mockReset();
    mockUpdateUserMission.mockReset();

    mockEvaluateUserResponse.mockResolvedValue({
      correct: false,
      message: 'Needs work.',
      tokenUsage: evaluationTokenUsage,
    });
    mockGenerateMissionTurn.mockResolvedValue({
      turn: turn({ turnNumber: 2, choices: [choice()] }),
      tokenUsage: generatedTokenUsage,
    });
    mockGetMissionById.mockResolvedValue(mission());
    mockGetUserMission.mockResolvedValue(userMission());
    mockRecordMissionTokenUsage.mockResolvedValue(undefined);
    mockUpdateUserMission.mockResolvedValue(undefined);
  });

  it('records a practice response for a matching selected_user cookie using trimmed ids and keeps the success response shape', async () => {
    const currentTurn = turn();
    const nextTurn = turn({ turnNumber: 2, choices: [choice()] });
    const answeredTurn = {
      ...currentTurn,
      userResponse: {
        japanese: 'ラーメンをください。',
        romaji: undefined,
      },
      feedback: {
        correct: true,
        message: 'Good!',
      },
    };

    mockGetUserMission.mockResolvedValueOnce(
      userMission({ mode: 'practice', conversationLog: [currentTurn] }),
    );
    mockGenerateMissionTurn.mockResolvedValueOnce({
      turn: nextTurn,
      tokenUsage: generatedTokenUsage,
    });

    const response = await respondToMission(
      {
        userId: ' user-1 ',
        userMissionId: ' user-mission-1 ',
        response: '',
        turnNumber: '1',
        selectedChoiceIndex: 0,
      },
      ' user-1 ',
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      feedback: {
        correct: true,
        message: 'Good!',
      },
      nextTurn,
      isComplete: false,
    });
    expect(payload).not.toHaveProperty('ok');

    expect(mockGetUserMission).toHaveBeenCalledWith('user-mission-1');
    expect(mockGetMissionById).toHaveBeenCalledWith('mission-1');
    expect(mockEvaluateUserResponse).not.toHaveBeenCalled();
    expect(mockGenerateMissionTurn).toHaveBeenCalledWith({
      mission: mission(),
      mode: 'practice',
      turnNumber: 2,
      totalTurns: config.missions.maxTurnsPerMission,
      conversationHistory: [answeredTurn],
      userLevel: undefined,
    });
    expect(mockRecordMissionTokenUsage).toHaveBeenCalledWith('user-1', generatedTokenUsage);
    expect(mockUpdateUserMission).toHaveBeenCalledWith('user-mission-1', {
      conversationLog: [answeredTurn, nextTurn],
      exchanges: 1,
      correctResponses: 1,
    });
  });

  it('records an immersion response when no selected_user cookie is present and does not generate after the last turn', async () => {
    const currentTurn = turn({ turnNumber: 3, choices: undefined, hint: 'Be polite.' });
    const conversationLog = [currentTurn];
    const answeredTurn = {
      ...currentTurn,
      userResponse: {
        japanese: 'ラーメンをください。',
        romaji: undefined,
      },
      feedback: {
        correct: false,
        message: 'Needs work.',
      },
    };

    mockGetUserMission.mockResolvedValueOnce(
      userMission({
        mode: 'immersion',
        conversationLog,
        correctResponses: 2,
      }),
    );

    const response = await respondToMission(
      {
        userId: ' user-1 ',
        userMissionId: ' user-mission-1 ',
        response: '  ラーメンをください。  ',
        turnNumber: 3,
      },
      null,
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      feedback: {
        correct: false,
        message: 'Needs work.',
      },
      nextTurn: null,
      isComplete: true,
    });
    expect(payload).not.toHaveProperty('ok');

    expect(mockGetUserMission).toHaveBeenCalledWith('user-mission-1');
    expect(mockGetMissionById).toHaveBeenCalledWith('mission-1');
    expect(mockEvaluateUserResponse).toHaveBeenCalledWith({
      mission: mission(),
      mode: 'immersion',
      turnNumber: 3,
      npcDialogue: currentTurn.npcDialogue,
      userResponse: 'ラーメンをください。',
      expectedContext: 'Order ramen',
      conversationHistory: conversationLog,
    });
    expect(mockRecordMissionTokenUsage).toHaveBeenCalledWith('user-1', evaluationTokenUsage);
    expect(mockGenerateMissionTurn).not.toHaveBeenCalled();
    expect(mockUpdateUserMission).toHaveBeenCalledWith('user-mission-1', {
      conversationLog: [answeredTurn],
      exchanges: 3,
      correctResponses: 2,
    });
  });

  it('returns 400 for invalid JSON before DB, AI, token, or update calls', async () => {
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
    ['missing userId', { userMissionId: 'user-mission-1', turnNumber: 1 }],
    ['blank userId', { userId: '   ', userMissionId: 'user-mission-1', turnNumber: 1 }],
    ['missing userMissionId', { userId: 'user-1', turnNumber: 1 }],
    ['blank userMissionId', { userId: 'user-1', userMissionId: '   ', turnNumber: 1 }],
    ['invalid turnNumber', { userId: 'user-1', userMissionId: 'user-mission-1', turnNumber: 0 }],
  ])('returns 400 for %s before DB, AI, token, or update calls', async (_caseName, body) => {
    const response = await respondToMission(body, 'user-1');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Missing required fields.',
    });
    expectNoServerCalls();
  });

  it('returns 400 for a blank selected_user cookie before DB, AI, token, or update calls', async () => {
    const response = await respondToMission(
      { userId: 'user-1', userMissionId: 'user-mission-1', turnNumber: 1, selectedChoiceIndex: 0 },
      '   ',
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Invalid selected user.' });
    expectNoServerCalls();
  });

  it('returns 403 before DB, AI, token, or update calls when selected_user does not match body userId', async () => {
    const response = await respondToMission(
      { userId: 'user-2', userMissionId: 'user-mission-1', turnNumber: 1, selectedChoiceIndex: 0 },
      'user-1',
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Selected user does not match request user.',
    });
    expectNoServerCalls();
  });
});
