import { createClient, type Client } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  client: null as Client | null,
  assess: vi.fn(),
  checkBudget: vi.fn(),
  runDatabaseMigrations: vi.fn(),
  seedMissions: vi.fn(),
}));

vi.mock('$lib/server/db-client', () => ({
  getClient: () => {
    if (!harness.client) throw new Error('Test database client was not initialized.');
    return harness.client;
  },
}));

vi.mock('$lib/server/db-migrations', () => ({
  runDatabaseMigrations: harness.runDatabaseMigrations,
}));

vi.mock('$lib/server/missions-seed', () => ({ seedMissions: harness.seedMissions }));

vi.mock('$lib/server/config', () => ({
  config: { missions: { unlockAllOverride: false } },
}));

vi.mock('$lib/server/missions-db', () => ({
  getCategorySessionCount: vi.fn().mockResolvedValue(2),
  getMissionById: vi.fn().mockResolvedValue({
    id: 'mission-order-restaurant',
    title: 'Order at a Restaurant',
    category: 'food_dining',
    startUnlocked: false,
    unlockSessionsRequired: 2,
  }),
}));

vi.mock('$lib/server/token-limiter', () => ({ checkBudget: harness.checkBudget }));

vi.mock('$lib/server/voice-assessment', async (importOriginal) => {
  const original = await importOriginal<typeof import('$lib/server/voice-assessment')>();
  return { ...original, assessMissionVoiceTurn: harness.assess };
});

function cookies() {
  return { get: (name: string) => (name === 'selected_user' ? 'user-1' : undefined) };
}

function startRequest(): Request {
  return new Request('http://localhost/api/missions/mission-order-restaurant/spoken/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'user-1', startOver: false }),
  });
}

function turnRequest(input: {
  attemptId: string;
  turnNumber: number;
  clientResponseId: string;
}): Request {
  const form = new FormData();
  form.set('userId', 'user-1');
  form.set('attemptId', input.attemptId);
  form.set('definitionVersion', 'restaurant-order-v1');
  form.set('turnNumber', String(input.turnNumber));
  form.set('clientResponseId', input.clientResponseId);
  form.set('supportRevealed', 'false');
  form.set('audio', new File(['voice'], `turn-${input.turnNumber}.webm`, { type: 'audio/webm' }));
  return new Request('http://localhost/api/missions/mission-order-restaurant/spoken/turn', {
    method: 'POST',
    body: form,
  });
}

describe('unlocked restaurant Spoken Mission route flow', () => {
  beforeEach(async () => {
    vi.resetModules();
    harness.client = createClient({ url: 'file::memory:' });
    harness.runDatabaseMigrations.mockReset().mockResolvedValue(undefined);
    harness.seedMissions.mockReset().mockResolvedValue(undefined);
    harness.checkBudget.mockReset().mockResolvedValue({ allowed: true });
    harness.assess.mockReset();
    const db = await import('$lib/server/db');
    await db.insertUser({ id: 'user-1', name: 'Test User', level: 'beginner' });
  });

  afterEach(() => {
    harness.client = null;
  });

  it('completes Order, Respond, and Repair independently and persists evidence idempotently', async () => {
    harness.assess
      .mockResolvedValueOnce({
        outcome: 'accepted',
        transcript: 'ラーメンを一つお願いします。',
        confidence: 'high',
        feedback: 'You clearly ordered one ramen.',
      })
      .mockResolvedValueOnce({
        outcome: 'accepted',
        transcript: 'お水でお願いします。',
        confidence: 'medium',
        feedback: 'You answered the drink question.',
      })
      .mockResolvedValueOnce({
        outcome: 'accepted',
        transcript: 'いいえ、ラーメン一つです。',
        confidence: 'high',
        feedback: 'You repaired the misunderstanding.',
      });

    const startRoute = await import('./spoken/start/+server');
    const turnRoute = await import('./spoken/turn/+server');
    const startResponse = await startRoute.POST({
      params: { id: 'mission-order-restaurant' },
      request: startRequest(),
      cookies: cookies(),
    } as never);
    expect(startResponse.status).toBe(200);
    const started = await startResponse.json();

    const firstRequest = {
      attemptId: String(started.attemptId),
      turnNumber: 1,
      clientResponseId: 'client-response-1',
    };
    const firstResponse = await turnRoute.POST({
      params: { id: 'mission-order-restaurant' },
      request: turnRequest(firstRequest),
      cookies: cookies(),
    } as never);
    expect(firstResponse.status).toBe(200);
    await expect(firstResponse.json()).resolves.toMatchObject({
      duplicate: false,
      assessment: { outcome: 'accepted' },
      nextTurn: { turnNumber: 2, goalKey: 'respond' },
      isComplete: false,
    });

    const duplicateResponse = await turnRoute.POST({
      params: { id: 'mission-order-restaurant' },
      request: turnRequest(firstRequest),
      cookies: cookies(),
    } as never);
    expect(duplicateResponse.status).toBe(200);
    await expect(duplicateResponse.json()).resolves.toMatchObject({
      duplicate: true,
      assessment: { outcome: 'accepted' },
      nextTurn: { turnNumber: 2 },
    });

    const secondResponse = await turnRoute.POST({
      params: { id: 'mission-order-restaurant' },
      request: turnRequest({
        attemptId: started.attemptId,
        turnNumber: 2,
        clientResponseId: 'client-response-2',
      }),
      cookies: cookies(),
    } as never);
    expect(secondResponse.status).toBe(200);
    await expect(secondResponse.json()).resolves.toMatchObject({
      nextTurn: { turnNumber: 3, goalKey: 'repair' },
      isComplete: false,
    });

    const thirdResponse = await turnRoute.POST({
      params: { id: 'mission-order-restaurant' },
      request: turnRequest({
        attemptId: started.attemptId,
        turnNumber: 3,
        clientResponseId: 'client-response-3',
      }),
      cookies: cookies(),
    } as never);
    expect(thirdResponse.status).toBe(200);
    const completed = await thirdResponse.json();
    expect(completed).toMatchObject({
      duplicate: false,
      assessment: { outcome: 'accepted' },
      nextTurn: null,
      isComplete: true,
      result: {
        evidenceState: 'independent',
        goals: [
          { key: 'order', transcript: 'ラーメンを一つお願いします。' },
          { key: 'respond', transcript: 'お水でお願いします。' },
          { key: 'repair', transcript: 'いいえ、ラーメン一つです。' },
        ],
      },
    });

    expect(harness.assess).toHaveBeenCalledTimes(3);
    const spoken = await import('$lib/server/spoken-missions-db');
    await expect(
      spoken.getBestSpokenMissionEvidence('user-1', 'mission-order-restaurant'),
    ).resolves.toBe('independent');
    const attempt = await spoken.getSpokenMissionAttempt(started.attemptId);
    expect(attempt).toMatchObject({
      status: 'completed',
      evidenceState: 'independent',
      successfulTurnCount: 3,
      conversationLog: [expect.anything(), expect.anything(), expect.anything()],
    });
    expect(JSON.stringify(attempt)).not.toContain('voice');

    const unrelatedCounts = await harness.client!.batch([
      `SELECT COUNT(*) AS total FROM user_missions`,
      `SELECT COUNT(*) AS total FROM user_badges`,
      `SELECT COUNT(*) AS total FROM user_xp`,
    ]);
    expect(unrelatedCounts.map((result) => Number(result.rows[0]?.total ?? 0))).toEqual([0, 0, 0]);
  });
});
