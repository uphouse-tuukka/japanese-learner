import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadAccess: vi.fn(),
  skipGoal: vi.fn(),
}));

vi.mock('$lib/server/spoken-mission-access', () => ({
  loadSpokenMissionAttemptAccess: mocks.loadAccess,
}));
vi.mock('$lib/server/spoken-missions-db', async (importOriginal) => {
  const original = await importOriginal<typeof import('$lib/server/spoken-missions-db')>();
  return { ...original, skipSpokenMissionGoal: mocks.skipGoal };
});

import { POST } from './skip/+server';

const definition = {
  missionId: 'mission-order-restaurant',
  version: 'restaurant-order-v3',
  supersededVersions: ['restaurant-order-v1', 'restaurant-order-v2'],
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
      retrySuggestion: {
        japanese: 'ラーメンを一つお願いします。',
        romaji: 'raamen o hitotsu onegaishimasu.',
      },
    },
    {
      key: 'respond',
      title: 'Respond',
      learnerGoal: 'Answer the follow-up.',
      serverLines: [{ japanese: 'お水は？', romaji: 'o-mizu wa?', english: 'Water?' }],
      alternatives: ['お水で。'],
      rubric: 'Accept water.',
      retrySuggestion: { japanese: 'お水でお願いします。', romaji: 'o-mizu de onegaishimasu.' },
    },
    {
      key: 'repair',
      title: 'Repair',
      learnerGoal: 'Repair the order.',
      serverLines: [{ japanese: '二つですね。', romaji: 'futatsu desu ne.', english: 'Two?' }],
      alternatives: ['一つです。'],
      rubric: 'Accept one.',
      retrySuggestion: { japanese: '一つです。', romaji: 'hitotsu desu.' },
    },
  ],
  suggestedPhrase: { japanese: '一つです。', romaji: 'hitotsu desu.', english: 'One.' },
} as const;

const retryEntry = {
  goalKey: 'order',
  turnNumber: 1,
  npcJapanese: 'ご注文はお決まりですか。',
  npcRomaji: 'go-chuumon wa okimari desu ka.',
  transcript: 'さようなら',
  outcome: 'retry',
  confidence: 'high',
  feedback: 'The response did not place an order.',
  supportUsed: false,
  writtenSupportRevealed: true,
  clientResponseId: 'retry-1',
  assessedAt: '2026-07-17T09:00:00.000Z',
} as const;

const attempt = {
  id: 'spokenmission-v3',
  userId: 'user-1',
  missionId: 'mission-order-restaurant',
  definitionVersion: 'restaurant-order-v3',
  status: 'in_progress',
  currentTurn: 1,
  supportUsed: false,
  currentTurnSupportUsed: false,
  currentTurnWrittenSupportRevealed: true,
  successfulTurnCount: 0,
  wordingVariant: 0,
  conversationLog: [retryEntry],
  evidenceState: null,
  completedAt: null,
  createdAt: '2026-07-17T09:00:00.000Z',
  updatedAt: '2026-07-17T09:00:00.000Z',
} as const;

function request(userId = 'user-1', turnNumber = 1): Request {
  return new Request('http://localhost/api/missions/mission-order-restaurant/spoken/skip', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      userId,
      attemptId: attempt.id,
      turnNumber,
      clientSkipId: 'skip-1',
    }),
  });
}

function cookies(selectedUser = 'user-1') {
  return { get: (name: string) => (name === 'selected_user' ? selectedUser : undefined) };
}

async function skip(userId = 'user-1', turnNumber = 1, selectedUser = 'user-1') {
  return POST({
    params: { id: 'mission-order-restaurant' },
    request: request(userId, turnNumber),
    cookies: cookies(selectedUser),
  } as never);
}

describe('POST /api/missions/[id]/spoken/skip', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.loadAccess.mockResolvedValue({
      ok: true,
      mission: { id: 'mission-order-restaurant' },
      definition,
      attempt,
    });
    mocks.skipGoal.mockImplementation(async (input) => ({
      status: 'recorded',
      attempt: {
        ...attempt,
        status: 'in_progress',
        currentTurn: 2,
        currentTurnWrittenSupportRevealed: false,
        conversationLog: [
          retryEntry,
          {
            kind: 'skipped',
            goalKey: 'order',
            turnNumber: 1,
            npcJapanese: input.npcJapanese,
            npcRomaji: input.npcRomaji,
            supportUsed: false,
            writtenSupportRevealed: true,
            clientSkipId: input.clientSkipId,
            skippedAt: '2026-07-17T09:01:00.000Z',
          },
        ],
      },
      event: { kind: 'skipped', clientSkipId: input.clientSkipId },
    }));
  });

  it('advances through an authored durable skip without audio or assessment input', async () => {
    const response = await skip();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      duplicate: false,
      nextTurn: { turnNumber: 2, goalKey: 'respond' },
      isComplete: false,
      result: null,
      history: [
        { kind: 'assessment', assessment: { outcome: 'retry' } },
        { kind: 'skipped', goalKey: 'order' },
      ],
    });
    expect(mocks.skipGoal).toHaveBeenCalledWith({
      attemptId: attempt.id,
      userId: 'user-1',
      missionId: 'mission-order-restaurant',
      definitionVersion: 'restaurant-order-v3',
      turnNumber: 1,
      goalKey: 'order',
      npcJapanese: 'ご注文はお決まりですか。',
      npcRomaji: 'go-chuumon wa okimari desu ka.',
      clientSkipId: 'skip-1',
    });
  });

  it('rejects a selected-user mismatch before loading or mutating the attempt', async () => {
    const response = await skip('user-2', 1, 'user-1');

    expect(response.status).toBe(403);
    expect(mocks.loadAccess).not.toHaveBeenCalled();
    expect(mocks.skipGoal).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, error: 'User not found.', status: 404 }, 404],
    [{ ok: false, error: 'Mission not found.', status: 404 }, 404],
    [{ ok: false, error: 'Mission is locked.', status: 403 }, 403],
    [{ ok: false, error: 'Forbidden.', status: 403 }, 403],
    [{ ok: false, error: 'Mission mismatch for attempt.', status: 400 }, 400],
    [{ ok: false, error: 'Spoken Mission definition changed.', status: 409 }, 409],
  ] as const)('preserves the shared attempt-access failure %#', async (access, status) => {
    mocks.loadAccess.mockResolvedValue(access);

    const response = await skip();

    expect(response.status).toBe(status);
    expect(mocks.skipGoal).not.toHaveBeenCalled();
  });

  it('returns the same terminal incomplete result for a repeated skip request', async () => {
    const accepted = (goalKey: 'order' | 'respond', turnNumber: number) => ({
      goalKey,
      turnNumber,
      npcJapanese: '日本語',
      npcRomaji: 'nihongo',
      transcript: '返事',
      outcome: 'accepted' as const,
      confidence: 'high' as const,
      feedback: 'Accepted.',
      supportUsed: false,
      clientResponseId: `accepted-${turnNumber}`,
      assessedAt: '2026-07-17T09:00:00.000Z',
    });
    const skippedEvent = {
      kind: 'skipped' as const,
      goalKey: 'repair' as const,
      turnNumber: 3,
      npcJapanese: '二つですね。',
      npcRomaji: 'futatsu desu ne.',
      supportUsed: false,
      writtenSupportRevealed: false,
      clientSkipId: 'skip-1',
      skippedAt: '2026-07-17T09:02:00.000Z',
    };
    const incompleteAttempt = {
      ...attempt,
      status: 'incomplete',
      currentTurn: 3,
      successfulTurnCount: 2,
      conversationLog: [accepted('order', 1), accepted('respond', 2), skippedEvent],
      completedAt: '2026-07-17T09:02:00.000Z',
    };
    mocks.loadAccess.mockResolvedValue({
      ok: true,
      mission: { id: 'mission-order-restaurant' },
      definition,
      attempt: incompleteAttempt,
    });
    mocks.skipGoal.mockResolvedValue({
      status: 'duplicate',
      attempt: incompleteAttempt,
      event: skippedEvent,
    });

    const response = await skip('user-1', 3);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      duplicate: true,
      nextTurn: null,
      isComplete: true,
      result: {
        kind: 'incomplete',
        goals: [
          { goalKey: 'order', status: 'accepted' },
          { goalKey: 'respond', status: 'accepted' },
          { goalKey: 'repair', status: 'skipped' },
        ],
      },
    });
  });

  it('maps server-authoritative skip ineligibility to a conflict without mutation retries', async () => {
    const { SpokenMissionProgressConflictError } = await import('$lib/server/spoken-missions-db');
    mocks.skipGoal.mockRejectedValue(new SpokenMissionProgressConflictError());

    const response = await skip();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: 'This goal can only be skipped after an incorrect assessment.',
    });
  });
});
