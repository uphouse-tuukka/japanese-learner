import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assess: vi.fn(),
  budget: vi.fn(),
  categoryCount: vi.fn(),
  getAttempt: vi.fn(),
  getMission: vi.fn(),
  getUser: vi.fn(),
  record: vi.fn(),
}));

vi.mock('$lib/server/config', () => ({
  config: { missions: { unlockAllOverride: false } },
}));
vi.mock('$lib/server/missions-db', () => ({
  getCategorySessionCount: mocks.categoryCount,
  getMissionById: mocks.getMission,
}));
vi.mock('$lib/server/spoken-missions-db', async (importOriginal) => {
  const original = await importOriginal<typeof import('$lib/server/spoken-missions-db')>();
  return {
    ...original,
    getSpokenMissionAttempt: mocks.getAttempt,
    recordSpokenMissionAssessment: mocks.record,
  };
});
vi.mock('$lib/server/token-limiter', () => ({ checkBudget: mocks.budget }));
vi.mock('$lib/server/users', () => ({ getUser: mocks.getUser }));
vi.mock('$lib/server/voice-assessment', async (importOriginal) => {
  const original = await importOriginal<typeof import('$lib/server/voice-assessment')>();
  return { ...original, assessMissionVoiceTurn: mocks.assess };
});

import { POST } from './turn/+server';

const mission = {
  id: 'mission-order-restaurant',
  category: 'food_dining',
  startUnlocked: false,
  unlockSessionsRequired: 2,
};

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

function request(overrides: Record<string, string | Blob> = {}): Request {
  const form = new FormData();
  const values: Record<string, string | Blob> = {
    userId: 'user-1',
    attemptId: 'spokenmission-1',
    turnNumber: '1',
    clientResponseId: 'client-response-1',
    supportRevealed: 'false',
    audio: new File(['voice'], 'answer.webm', { type: 'audio/webm' }),
    ...overrides,
  };
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return new Request('http://localhost/api/missions/mission-order-restaurant/spoken/turn', {
    method: 'POST',
    body: form,
  });
}

function cookies(selectedUser = 'user-1') {
  return { get: (name: string) => (name === 'selected_user' ? selectedUser : undefined) };
}

async function turn(
  overrides: Record<string, string | Blob> = {},
  selectedUser = 'user-1',
  missionId = 'mission-order-restaurant',
): Promise<Response> {
  return POST({
    params: { id: missionId },
    request: request(overrides),
    cookies: cookies(selectedUser),
  } as never);
}

describe('POST /api/missions/[id]/spoken/turn validation', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getUser.mockResolvedValue({ id: 'user-1' });
    mocks.getMission.mockResolvedValue(mission);
    mocks.categoryCount.mockResolvedValue(2);
    mocks.getAttempt.mockResolvedValue(attempt);
    mocks.budget.mockResolvedValue({ allowed: true });
    mocks.assess.mockResolvedValue({
      outcome: 'retry',
      transcript: 'さようなら',
      confidence: 'high',
      feedback: 'Try ordering one item.',
    });
    mocks.record.mockImplementation(async (input) => ({
      status: 'recorded',
      attempt: { ...attempt, conversationLog: [input.evidence] },
      evidence: input.evidence,
    }));
  });

  it('assesses against server-owned goal criteria and keeps incorrect intent on the goal', async () => {
    const response = await turn({
      expectedAnswer: 'Client tries to replace the expected answer',
      rubric: 'Client tries to accept everything',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      assessment: { outcome: 'retry', transcript: 'さようなら' },
      nextTurn: null,
      isComplete: false,
    });
    expect(mocks.assess).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        goal: 'Order one ramen.',
        alternatives: expect.arrayContaining(['ラーメンを一つお願いします。']),
        rubric: expect.stringContaining('one ramen'),
      }),
    );
    expect(mocks.assess.mock.calls[0][0]).not.toHaveProperty('expectedAnswer');
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId: 'spokenmission-1',
        turnNumber: 1,
        evidence: expect.objectContaining({ outcome: 'retry', supportUsed: false }),
      }),
    );
  });

  it('rejects a selected-user mismatch before profile, mission, attempt, budget, or AI work', async () => {
    const response = await turn({ userId: 'user-2' }, 'user-1');

    expect(response.status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.getMission).not.toHaveBeenCalled();
    expect(mocks.getAttempt).not.toHaveBeenCalled();
    expect(mocks.budget).not.toHaveBeenCalled();
    expect(mocks.assess).not.toHaveBeenCalled();
  });

  it('rejects a missing user before mission, attempt, budget, or AI work', async () => {
    mocks.getUser.mockResolvedValue(null);
    const response = await turn();

    expect(response.status).toBe(404);
    expect(mocks.getMission).not.toHaveBeenCalled();
    expect(mocks.getAttempt).not.toHaveBeenCalled();
    expect(mocks.budget).not.toHaveBeenCalled();
  });

  it('rechecks unlock state before loading or assessing the attempt', async () => {
    mocks.categoryCount.mockResolvedValue(1);
    const response = await turn();

    expect(response.status).toBe(403);
    expect(mocks.getAttempt).not.toHaveBeenCalled();
    expect(mocks.assess).not.toHaveBeenCalled();
  });

  it('rejects scenarios without Spoken Mission configuration before attempt or AI work', async () => {
    mocks.getMission.mockResolvedValue({ ...mission, id: 'mission-first-meeting' });
    const response = await turn({}, 'user-1', 'mission-first-meeting');

    expect(response.status).toBe(404);
    expect(mocks.getAttempt).not.toHaveBeenCalled();
    expect(mocks.assess).not.toHaveBeenCalled();
  });

  it('rejects attempt ownership, mission, definition, and current-turn mismatches', async () => {
    for (const changedAttempt of [
      { ...attempt, userId: 'user-2' },
      { ...attempt, missionId: 'mission-first-meeting' },
      { ...attempt, definitionVersion: 'old-definition' },
      { ...attempt, currentTurn: 2 },
    ]) {
      mocks.getAttempt.mockResolvedValueOnce(changedAttempt);
      const response = await turn();
      expect([400, 403, 409]).toContain(response.status);
    }
    expect(mocks.assess).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it.each(['completed', 'abandoned'] as const)(
    'rejects a new turn submission for a %s attempt',
    async (status) => {
      mocks.getAttempt.mockResolvedValue({ ...attempt, status });

      const response = await turn();

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: 'Spoken Mission attempt is not in progress.',
      });
      expect(mocks.budget).not.toHaveBeenCalled();
      expect(mocks.assess).not.toHaveBeenCalled();
      expect(mocks.record).not.toHaveBeenCalled();
    },
  );

  it.each(['completed', 'abandoned'] as const)(
    'rejects a replayed turn submission for a %s attempt',
    async (status) => {
      mocks.getAttempt.mockResolvedValue({
        ...attempt,
        status,
        conversationLog: [
          {
            goalKey: 'order',
            turnNumber: 1,
            npcJapanese: 'ご注文はお決まりですか。',
            npcRomaji: 'go-chuumon wa okimari desu ka.',
            transcript: 'ラーメンをください。',
            outcome: 'accepted',
            confidence: 'high',
            feedback: 'Accepted.',
            supportUsed: false,
            clientResponseId: 'client-response-1',
            assessedAt: '2026-07-13T12:00:00.000Z',
          },
        ],
      });

      const response = await turn();

      expect(response.status).toBe(400);
      expect(mocks.budget).not.toHaveBeenCalled();
      expect(mocks.assess).not.toHaveBeenCalled();
      expect(mocks.record).not.toHaveBeenCalled();
    },
  );

  it('validates audio bounds before checking budget', async () => {
    const response = await turn({
      audio: new File(['not audio'], 'answer.txt', { type: 'text/plain' }),
    });

    expect(response.status).toBe(400);
    expect(mocks.budget).not.toHaveBeenCalled();
    expect(mocks.assess).not.toHaveBeenCalled();
  });

  it('preserves the attempt when the AI budget is exhausted', async () => {
    mocks.budget.mockResolvedValue({ allowed: false });
    const response = await turn();

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Daily AI budget exhausted. Your attempt is saved.',
    });
    expect(mocks.assess).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
