import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAwardBadge,
  mockGetMissionById,
  mockGetUserMission,
  mockHasCompletedMissionInMode,
  mockProcessMissionCompletion,
  mockUpdateUserMission,
} = vi.hoisted(() => ({
  mockAwardBadge: vi.fn(),
  mockGetMissionById: vi.fn(),
  mockGetUserMission: vi.fn(),
  mockHasCompletedMissionInMode: vi.fn(),
  mockProcessMissionCompletion: vi.fn(),
  mockUpdateUserMission: vi.fn(),
}));

vi.mock('$lib/server/missions-db', () => ({
  awardBadge: mockAwardBadge,
  getMissionById: mockGetMissionById,
  getUserMission: mockGetUserMission,
  hasCompletedMissionInMode: mockHasCompletedMissionInMode,
  updateUserMission: mockUpdateUserMission,
}));

vi.mock('$lib/server/gamification', () => ({
  processMissionCompletion: mockProcessMissionCompletion,
}));

import { POST } from './complete/+server';

const xpBreakdown = {
  missionCompletion: 10,
  correctResponses: 8,
  naturalPhrasing: 4,
  total: 22,
};

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/missions/mission-1/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildRawRequest(body: string): Request {
  return new Request('http://localhost/api/missions/mission-1/complete', {
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

async function completeMission(
  body: unknown,
  selectedUserId: string | null = 'user-1',
): Promise<Response> {
  return POST({ request: buildRequest(body), cookies: buildCookies(selectedUserId) } as never);
}

function userMission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-mission-1',
    userId: 'user-1',
    missionId: 'mission-1',
    mode: 'immersion',
    status: 'in_progress',
    exchanges: 5,
    correctResponses: 4,
    score: 0,
    xpEarned: 0,
    badgeEarned: false,
    conversationLog: [],
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

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

function badge(overrides: Record<string, unknown> = {}) {
  return {
    id: 'badge-1',
    userId: 'user-1',
    missionId: 'mission-1',
    badgeEmoji: '🍜',
    badgeName: 'Ramen Confident',
    badgeStatement: 'You can order ramen with confidence.',
    earnedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function expectNoServerCalls() {
  expect(mockGetUserMission).not.toHaveBeenCalled();
  expect(mockProcessMissionCompletion).not.toHaveBeenCalled();
  expect(mockHasCompletedMissionInMode).not.toHaveBeenCalled();
  expect(mockGetMissionById).not.toHaveBeenCalled();
  expect(mockAwardBadge).not.toHaveBeenCalled();
  expect(mockUpdateUserMission).not.toHaveBeenCalled();
}

function expectNoCompletionWrites() {
  expect(mockProcessMissionCompletion).not.toHaveBeenCalled();
  expect(mockHasCompletedMissionInMode).not.toHaveBeenCalled();
  expect(mockGetMissionById).not.toHaveBeenCalled();
  expect(mockAwardBadge).not.toHaveBeenCalled();
  expect(mockUpdateUserMission).not.toHaveBeenCalled();
}

describe('POST /api/missions/[id]/complete', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockAwardBadge.mockReset();
    mockGetMissionById.mockReset();
    mockGetUserMission.mockReset();
    mockHasCompletedMissionInMode.mockReset();
    mockProcessMissionCompletion.mockReset();
    mockUpdateUserMission.mockReset();

    mockAwardBadge.mockResolvedValue(badge());
    mockGetMissionById.mockResolvedValue(mission());
    mockGetUserMission.mockResolvedValue(userMission());
    mockHasCompletedMissionInMode.mockResolvedValue(false);
    mockProcessMissionCompletion.mockResolvedValue({ xpBreakdown, newMilestones: [] });
    mockUpdateUserMission.mockResolvedValue(undefined);
  });

  it('completes a mission for a matching selected_user cookie using the trimmed userId and keeps the success response shape', async () => {
    const response = await completeMission(
      {
        userId: ' user-1 ',
        userMissionId: ' user-mission-1 ',
        naturalPhrasings: 2.8,
      },
      ' user-1 ',
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      exchanges: 5,
      correctResponses: 4,
      score: 80,
      passed: true,
      xpBreakdown,
      badgeEarned: badge(),
      confidenceStatement: 'You can order ramen with confidence.',
    });
    expect(payload).not.toHaveProperty('ok');

    expect(mockGetUserMission).toHaveBeenCalledWith('user-mission-1');
    expect(mockProcessMissionCompletion).toHaveBeenCalledWith('user-1', 'mission-1', {
      mode: 'immersion',
      correctResponses: 4,
      totalExchanges: 5,
      naturalPhrasings: 2,
    });
    expect(mockHasCompletedMissionInMode).toHaveBeenCalledWith('user-1', 'mission-1', 'immersion');
    expect(mockGetMissionById).toHaveBeenCalledWith('mission-1');
    expect(mockAwardBadge).toHaveBeenCalledWith({
      userId: 'user-1',
      missionId: 'mission-1',
      badgeEmoji: '🍜',
      badgeName: 'Ramen Confident',
      badgeStatement: 'You can order ramen with confidence.',
    });
    expect(mockUpdateUserMission).toHaveBeenCalledWith('user-mission-1', {
      status: 'completed',
      completedAt: expect.any(String),
      score: 80,
      xpEarned: 22,
      badgeEarned: true,
    });
  });

  it('completes a mission when no selected_user cookie is present', async () => {
    mockGetUserMission.mockResolvedValueOnce(
      userMission({ mode: 'practice', correctResponses: 3 }),
    );

    const response = await completeMission(
      { userId: ' user-1 ', userMissionId: ' user-mission-1 ' },
      null,
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      exchanges: 5,
      correctResponses: 3,
      score: 60,
      passed: false,
      xpBreakdown,
      badgeEarned: null,
      confidenceStatement: null,
    });
    expect(payload).not.toHaveProperty('ok');
    expect(mockProcessMissionCompletion).toHaveBeenCalledWith('user-1', 'mission-1', {
      mode: 'practice',
      correctResponses: 3,
      totalExchanges: 5,
      naturalPhrasings: 0,
    });
    expect(mockHasCompletedMissionInMode).not.toHaveBeenCalled();
    expect(mockUpdateUserMission).toHaveBeenCalledWith(
      'user-mission-1',
      expect.objectContaining({ score: 60, xpEarned: 22, badgeEarned: false }),
    );
  });

  it('returns 403 before DB or gamification calls when selected_user does not match body userId', async () => {
    const response = await completeMission(
      { userId: 'user-2', userMissionId: 'user-mission-1' },
      'user-1',
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Selected user does not match request user.',
    });
    expectNoServerCalls();
  });

  it('returns 400 for invalid JSON before DB or gamification calls', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST({
      request: buildRawRequest('{not json'),
      cookies: buildCookies('user-1'),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Invalid JSON body.' });
    expectNoServerCalls();
  });

  it.each([
    ['missing userId', { userMissionId: 'user-mission-1' }],
    ['blank userId', { userId: '   ', userMissionId: 'user-mission-1' }],
    ['missing userMissionId', { userId: 'user-1' }],
    ['blank userMissionId', { userId: 'user-1', userMissionId: '   ' }],
  ])('returns 400 for %s before DB or gamification calls', async (_name, body) => {
    const response = await completeMission(body);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Missing userId or userMissionId.',
    });
    expectNoServerCalls();
  });

  it('returns 400 for a blank selected_user cookie before DB or gamification calls', async () => {
    const response = await completeMission(
      { userId: 'user-1', userMissionId: 'user-mission-1' },
      '   ',
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Invalid selected user.' });
    expectNoServerCalls();
  });

  it('keeps the existing userMission.userId mismatch 403 after fetching the user mission but before completion writes', async () => {
    mockGetUserMission.mockResolvedValueOnce(userMission({ userId: 'user-2' }));

    const response = await completeMission(
      { userId: ' user-1 ', userMissionId: ' user-mission-1 ' },
      'user-1',
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Forbidden.' });
    expect(mockGetUserMission).toHaveBeenCalledWith('user-mission-1');
    expectNoCompletionWrites();
  });
});
