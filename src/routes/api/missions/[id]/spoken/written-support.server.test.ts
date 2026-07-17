import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadAccess: vi.fn(),
  markWrittenSupport: vi.fn(),
}));

vi.mock('$lib/server/spoken-mission-access', () => ({
  loadSpokenMissionAttemptAccess: mocks.loadAccess,
}));

vi.mock('$lib/server/spoken-missions-db', async (importOriginal) => {
  const original = await importOriginal<typeof import('$lib/server/spoken-missions-db')>();
  return {
    ...original,
    markSpokenMissionWrittenSupportRevealed: mocks.markWrittenSupport,
  };
});

import { POST } from './written-support/+server';

const definition = {
  missionId: 'mission-order-restaurant',
  version: 'restaurant-order-v2',
  canDo: 'I can manage a short order conversation in a restaurant.',
  briefing: {
    situation: 'At a restaurant.',
    assessment: 'Intent is assessed.',
    evidence: 'English support changes evidence.',
    privacy: 'Raw audio is discarded.',
  },
  approximateMinutes: 2,
  maxRecordingSeconds: 12,
  goals: [
    {
      key: 'order',
      title: 'Order',
      learnerGoal: 'Order ramen.',
      serverLines: [
        {
          japanese: 'ご注文はお決まりですか。',
          romaji: 'go-chuumon wa okimari desu ka.',
          english: 'Are you ready to order?',
        },
      ],
      alternatives: ['ラーメンをください。'],
      rubric: 'Accept a ramen order.',
    },
    {
      key: 'respond',
      title: 'Respond',
      learnerGoal: 'Answer the follow-up.',
      serverLines: [{ japanese: 'お水は？', romaji: 'o-mizu wa?', english: 'Water?' }],
      alternatives: ['お水で。'],
      rubric: 'Accept water.',
    },
    {
      key: 'repair',
      title: 'Repair',
      learnerGoal: 'Repair the order.',
      serverLines: [{ japanese: '二つですね。', romaji: 'futatsu desu ne.', english: 'Two?' }],
      alternatives: ['一つです。'],
      rubric: 'Accept one.',
    },
  ],
  suggestedPhrase: { japanese: '一つです。', romaji: 'hitotsu desu.', english: 'One.' },
} as const;

const attempt = {
  id: 'spokenmission-v2',
  userId: 'user-1',
  missionId: 'mission-order-restaurant',
  definitionVersion: 'restaurant-order-v2',
  status: 'in_progress',
  currentTurn: 1,
  supportUsed: false,
  currentTurnSupportUsed: false,
  currentTurnWrittenSupportRevealed: false,
  successfulTurnCount: 0,
  wordingVariant: 0,
  conversationLog: [],
  evidenceState: null,
  completedAt: null,
  createdAt: '2026-07-16T09:00:00.000Z',
  updatedAt: '2026-07-16T09:00:00.000Z',
} as const;

function request(userId = 'user-1', turnNumber = 1): Request {
  return new Request(
    'http://localhost/api/missions/mission-order-restaurant/spoken/written-support',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, attemptId: attempt.id, turnNumber }),
    },
  );
}

function cookies(selectedUser = 'user-1') {
  return { get: (name: string) => (name === 'selected_user' ? selectedUser : undefined) };
}

async function reveal(userId = 'user-1', turnNumber = 1, selectedUser = 'user-1') {
  return POST({
    params: { id: 'mission-order-restaurant' },
    request: request(userId, turnNumber),
    cookies: cookies(selectedUser),
  } as never);
}

describe('POST /api/missions/[id]/spoken/written-support', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.loadAccess.mockResolvedValue({
      ok: true,
      mission: { id: 'mission-order-restaurant' },
      definition,
      attempt,
    });
    mocks.markWrittenSupport.mockResolvedValue({
      ...attempt,
      currentTurnWrittenSupportRevealed: true,
    });
  });

  it('returns paired authored text without marking English support', async () => {
    const response = await reveal();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      writtenText: {
        japanese: 'ご注文はお決まりですか。',
        romaji: 'go-chuumon wa okimari desu ka.',
      },
      writtenSupportRevealed: true,
    });
    expect(mocks.markWrittenSupport).toHaveBeenCalledWith({
      attemptId: attempt.id,
      userId: 'user-1',
      missionId: 'mission-order-restaurant',
      definitionVersion: 'restaurant-order-v2',
      turnNumber: 1,
    });
  });

  it('rejects selected-profile mismatch before loading the attempt', async () => {
    const response = await reveal('user-2', 1, 'user-1');

    expect(response.status).toBe(403);
    expect(mocks.loadAccess).not.toHaveBeenCalled();
    expect(mocks.markWrittenSupport).not.toHaveBeenCalled();
  });

  it('rejects stale turns without changing disclosure state', async () => {
    const response = await reveal('user-1', 2);

    expect(response.status).toBe(409);
    expect(mocks.markWrittenSupport).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, error: 'Mission is locked.', status: 403 }, 403],
    [{ ok: false, error: 'Forbidden.', status: 403 }, 403],
    [{ ok: false, error: 'Spoken Mission definition changed.', status: 409 }, 409],
  ] as const)('preserves access-boundary failures', async (access, status) => {
    mocks.loadAccess.mockResolvedValue(access);

    const response = await reveal();

    expect(response.status).toBe(status);
    expect(mocks.markWrittenSupport).not.toHaveBeenCalled();
  });
});
