import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  abandon: vi.fn(),
  create: vi.fn(),
  getCategorySessionCount: vi.fn(),
  getDefinition: vi.fn(),
  getMissionById: vi.fn(),
  getMostRecentVariant: vi.fn(),
  getResumable: vi.fn(),
  getUser: vi.fn(),
  selectVariant: vi.fn(),
}));

vi.mock('$lib/server/config', () => ({
  config: { missions: { unlockAllOverride: false } },
}));

vi.mock('$lib/server/missions-db', () => ({
  getCategorySessionCount: mocks.getCategorySessionCount,
  getMissionById: mocks.getMissionById,
}));

vi.mock('$lib/server/spoken-missions-db', async (importOriginal) => {
  const original = await importOriginal<typeof import('$lib/server/spoken-missions-db')>();
  return {
    ...original,
    abandonSpokenMissionAttempt: mocks.abandon,
    createSpokenMissionAttempt: mocks.create,
    getMostRecentSpokenMissionVariant: mocks.getMostRecentVariant,
    getResumableSpokenMissionAttempt: mocks.getResumable,
  };
});

vi.mock('$lib/server/spoken-missions', async (importOriginal) => {
  const original = await importOriginal<typeof import('$lib/server/spoken-missions')>();
  return {
    ...original,
    getSpokenMissionDefinition: mocks.getDefinition,
    selectSpokenMissionVariant: mocks.selectVariant,
  };
});

vi.mock('$lib/server/users', () => ({ getUser: mocks.getUser }));

import { POST } from './start/+server';
import { SpokenMissionProgressConflictError } from '$lib/server/spoken-missions-db';

const definition = {
  missionId: 'mission-order-restaurant',
  version: 'restaurant-order-v1',
  canDo: 'I can complete the restaurant task.',
  briefing: {
    situation: 'At a restaurant.',
    assessment: 'Intent is assessed, not accent.',
    privacy: 'Raw audio is discarded.',
  },
  approximateMinutes: 2,
  maxRecordingSeconds: 12,
  goals: [
    {
      key: 'order',
      title: 'Order',
      learnerGoal: 'Order ramen.',
      serverLines: [{ japanese: 'ご注文は？', romaji: 'go-chuumon wa?', english: 'Your order?' }],
      alternatives: ['ラーメンをください。'],
      rubric: 'Accept an order.',
    },
    {
      key: 'respond',
      title: 'Respond',
      learnerGoal: 'Answer a follow-up.',
      serverLines: [{ japanese: 'お水は？', romaji: 'o-mizu wa?', english: 'Water?' }],
      alternatives: ['お水で。'],
      rubric: 'Accept water.',
    },
    {
      key: 'repair',
      title: 'Repair',
      learnerGoal: 'Correct a mistake.',
      serverLines: [{ japanese: '二つですね。', romaji: 'futatsu desu ne.', english: 'Two?' }],
      alternatives: ['一つです。'],
      rubric: 'Accept correction.',
    },
  ],
  suggestedPhrase: { japanese: '一つです。', romaji: 'hitotsu desu.', english: 'One.' },
} as const;

const attempt = {
  id: 'spokenmission-1',
  userId: 'user-1',
  missionId: 'mission-order-restaurant',
  definitionVersion: 'restaurant-order-v1',
  status: 'in_progress',
  currentTurn: 1,
  supportUsed: false,
  successfulTurnCount: 0,
  wordingVariant: 0,
  conversationLog: [],
  evidenceState: null,
  completedAt: null,
  createdAt: '2026-07-13T12:00:00.000Z',
  updatedAt: '2026-07-13T12:00:00.000Z',
} as const;

function request(body: unknown): Request {
  return new Request('http://localhost/api/missions/mission-order-restaurant/spoken/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function cookies(selectedUser = 'user-1') {
  return { get: (name: string) => (name === 'selected_user' ? selectedUser : undefined) };
}

async function start(body: unknown, selectedUser = 'user-1'): Promise<Response> {
  return POST({
    params: { id: 'mission-order-restaurant' },
    request: request(body),
    cookies: cookies(selectedUser),
  } as never);
}

describe('POST /api/missions/[id]/spoken/start', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getDefinition.mockReturnValue(definition);
    mocks.getMissionById.mockResolvedValue({
      id: 'mission-order-restaurant',
      category: 'food_dining',
      startUnlocked: false,
      unlockSessionsRequired: 2,
    });
    mocks.getUser.mockResolvedValue({ id: 'user-1' });
    mocks.getCategorySessionCount.mockResolvedValue(2);
    mocks.getResumable.mockResolvedValue(null);
    mocks.getMostRecentVariant.mockResolvedValue(null);
    mocks.selectVariant.mockReturnValue(0);
    mocks.create.mockResolvedValue(attempt);
  });

  it('creates a dedicated attempt and returns only the authored briefing and current turn', async () => {
    const response = await start({ userId: ' user-1 ', startOver: false }, ' user-1 ');

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      attemptId: 'spokenmission-1',
      briefing: {
        canDo: definition.canDo,
        maxRecordingSeconds: 12,
        goals: [
          { key: 'order', title: 'Order', learnerGoal: 'Order ramen.' },
          { key: 'respond', title: 'Respond' },
          { key: 'repair', title: 'Repair' },
        ],
      },
      turn: {
        turnNumber: 1,
        goalKey: 'order',
        npcDialogue: { japanese: 'ご注文は？', romaji: 'go-chuumon wa?' },
        englishSupport: 'Your order?',
      },
      totalTurns: 3,
      resumed: false,
      supportUsed: false,
    });
    expect(JSON.stringify(payload)).not.toContain('rubric');
    expect(JSON.stringify(payload)).not.toContain('alternatives');
    expect(mocks.create).toHaveBeenCalledWith({
      userId: 'user-1',
      missionId: 'mission-order-restaurant',
      definitionVersion: 'restaurant-order-v1',
      wordingVariant: 0,
    });
  });

  it('resumes the profile attempt unless Start over is explicit', async () => {
    mocks.getResumable.mockResolvedValue({
      ...attempt,
      currentTurn: 2,
      successfulTurnCount: 1,
      conversationLog: [
        {
          goalKey: 'order',
          turnNumber: 1,
          npcJapanese: 'ご注文は？',
          npcRomaji: 'go-chuumon wa?',
          transcript: 'ラーメンをください。',
          outcome: 'accepted',
          confidence: 'high',
          feedback: 'You ordered ramen.',
          supportUsed: false,
          clientResponseId: 'private-response-id',
          assessedAt: '2026-07-13T12:01:00.000Z',
        },
      ],
    });

    const response = await start({ userId: 'user-1' });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      attemptId: 'spokenmission-1',
      resumed: true,
      turn: { turnNumber: 2, goalKey: 'respond' },
      history: [
        {
          goalKey: 'order',
          goalTitle: 'Order',
          turnNumber: 1,
          npcDialogue: { japanese: 'ご注文は？', romaji: 'go-chuumon wa?' },
          assessment: {
            transcript: 'ラーメンをください。',
            outcome: 'accepted',
            confidence: 'high',
            feedback: 'You ordered ramen.',
          },
          supportUsed: false,
          assessedAt: '2026-07-13T12:01:00.000Z',
        },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain('private-response-id');
    expect(JSON.stringify(payload)).not.toContain('"audio":');
    expect(mocks.abandon).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('abandons only the in-progress attempt when Start over is explicit', async () => {
    mocks.getResumable.mockResolvedValue(attempt);

    const response = await start({ userId: 'user-1', startOver: true });

    expect(response.status).toBe(200);
    expect(mocks.abandon).toHaveBeenCalledWith({
      attemptId: 'spokenmission-1',
      userId: 'user-1',
      missionId: 'mission-order-restaurant',
    });
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it('rejects a selected-profile mismatch before reading or changing attempts', async () => {
    const response = await start({ userId: 'user-2' }, 'user-1');

    expect(response.status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.getMissionById).not.toHaveBeenCalled();
    expect(mocks.getResumable).not.toHaveBeenCalled();
    expect(mocks.abandon).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('returns a recoverable conflict when the resumable attempt changes during Start over', async () => {
    mocks.getResumable.mockResolvedValue(attempt);
    mocks.abandon.mockRejectedValue(new SpokenMissionProgressConflictError());

    const response = await start({ userId: 'user-1', startOver: true });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Spoken Mission progress changed. Reload and try again.',
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('uses the immediately previous attempt variant when selecting fresh wording', async () => {
    mocks.getMostRecentVariant.mockResolvedValue(0);
    mocks.selectVariant.mockReturnValue(1);
    mocks.create.mockResolvedValue({ ...attempt, wordingVariant: 1 });

    const response = await start({ userId: 'user-1' });

    expect(response.status).toBe(200);
    expect(mocks.selectVariant).toHaveBeenCalledWith(definition, 0);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ wordingVariant: 1 }));
  });

  it('rejects locked access before loading or changing attempts', async () => {
    mocks.getCategorySessionCount.mockResolvedValue(1);

    const response = await start({ userId: 'user-1' });

    expect(response.status).toBe(403);
    expect(mocks.getResumable).not.toHaveBeenCalled();
    expect(mocks.abandon).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects scenarios without server-owned Spoken Mission configuration', async () => {
    mocks.getDefinition.mockReturnValue(null);

    const response = await start({ userId: 'user-1' });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Spoken Mission is not available for this scenario.',
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
