import { createClient, type Client } from '@libsql/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const dbHarness = vi.hoisted(() => ({
  client: null as Client | null,
  runDatabaseMigrations: vi.fn(),
  seedMissions: vi.fn(),
}));

vi.mock('./db-client', () => ({
  getClient: () => {
    if (!dbHarness.client) throw new Error('Test database client was not initialized.');
    return dbHarness.client;
  },
}));

vi.mock('./db-migrations', () => ({
  runDatabaseMigrations: dbHarness.runDatabaseMigrations,
}));

vi.mock('./missions-seed', () => ({
  seedMissions: dbHarness.seedMissions,
}));

async function loadRepositories() {
  vi.resetModules();
  dbHarness.client = createClient({ url: 'file::memory:' });
  dbHarness.runDatabaseMigrations.mockResolvedValue(undefined);
  dbHarness.seedMissions.mockResolvedValue(undefined);
  const db = await import('./db');
  const spoken = await import('./spoken-missions-db');
  await db.insertUser({ id: 'user-1', name: 'Test User', level: 'beginner' });
  return spoken;
}

describe('Spoken Mission persistence', () => {
  afterEach(() => {
    dbHarness.client = null;
    dbHarness.runDatabaseMigrations.mockReset();
    dbHarness.seedMissions.mockReset();
  });

  it('creates and resumes a profile-scoped attempt in the dedicated model', async () => {
    const spoken = await loadRepositories();

    const created = await spoken.createSpokenMissionAttempt({
      userId: 'user-1',
      missionId: 'mission-order-restaurant',
      definitionVersion: 'restaurant-order-v1',
      wordingVariant: 1,
    });

    expect(created).toMatchObject({
      id: expect.stringMatching(/^spokenmission-/),
      userId: 'user-1',
      missionId: 'mission-order-restaurant',
      definitionVersion: 'restaurant-order-v1',
      status: 'in_progress',
      currentTurn: 1,
      supportUsed: false,
      successfulTurnCount: 0,
      wordingVariant: 1,
      conversationLog: [],
      evidenceState: null,
    });

    await expect(
      spoken.getResumableSpokenMissionAttempt('user-1', 'mission-order-restaurant'),
    ).resolves.toMatchObject({ id: created.id, currentTurn: 1 });
    await expect(
      spoken.getResumableSpokenMissionAttempt('user-2', 'mission-order-restaurant'),
    ).resolves.toBeNull();
  });

  it('records idempotent goal evidence and completes the third accepted goal atomically', async () => {
    const spoken = await loadRepositories();
    const attempt = await spoken.createSpokenMissionAttempt({
      userId: 'user-1',
      missionId: 'mission-order-restaurant',
      definitionVersion: 'restaurant-order-v1',
      wordingVariant: 0,
    });

    const recordTurn = (turnNumber: number, clientResponseId: string, supportUsed = false) =>
      spoken.recordSpokenMissionAssessment({
        attemptId: attempt.id,
        userId: 'user-1',
        missionId: 'mission-order-restaurant',
        definitionVersion: 'restaurant-order-v1',
        turnNumber,
        evidence: {
          goalKey: ['order', 'respond', 'repair'][turnNumber - 1] as 'order' | 'respond' | 'repair',
          turnNumber,
          npcJapanese: 'ご注文はお決まりですか。',
          npcRomaji: 'go-chuumon wa okimari desu ka.',
          transcript: 'ラーメンを一つお願いします。',
          outcome: 'accepted' as const,
          confidence: 'high' as const,
          feedback: 'Goal accomplished.',
          supportUsed,
          clientResponseId,
          assessedAt: '2026-07-13T12:00:00.000Z',
        },
      });

    await expect(recordTurn(1, 'response-1')).resolves.toMatchObject({
      status: 'recorded',
      attempt: { currentTurn: 2, successfulTurnCount: 1, status: 'in_progress' },
    });
    await expect(recordTurn(1, 'response-1')).resolves.toMatchObject({
      status: 'duplicate',
      attempt: { currentTurn: 2, successfulTurnCount: 1, conversationLog: [expect.anything()] },
    });
    await expect(recordTurn(2, 'response-2')).resolves.toMatchObject({
      status: 'recorded',
      attempt: { currentTurn: 3, successfulTurnCount: 2, status: 'in_progress' },
    });
    await expect(recordTurn(3, 'response-3')).resolves.toMatchObject({
      status: 'recorded',
      attempt: {
        currentTurn: 3,
        successfulTurnCount: 3,
        status: 'completed',
        evidenceState: 'independent',
        completedAt: expect.any(String),
        conversationLog: [expect.anything(), expect.anything(), expect.anything()],
      },
    });

    await expect(
      spoken.getResumableSpokenMissionAttempt('user-1', 'mission-order-restaurant'),
    ).resolves.toBeNull();
    await expect(
      spoken.getBestSpokenMissionEvidence('user-1', 'mission-order-restaurant'),
    ).resolves.toBe('independent');
  });

  it('keeps Independent as the best evidence after a later Supported completion', async () => {
    const spoken = await loadRepositories();

    async function completeAttempt(supportUsed: boolean): Promise<void> {
      const attempt = await spoken.createSpokenMissionAttempt({
        userId: 'user-1',
        missionId: 'mission-order-restaurant',
        definitionVersion: 'restaurant-order-v1',
        wordingVariant: 0,
      });
      for (const turnNumber of [1, 2, 3]) {
        await spoken.recordSpokenMissionAssessment({
          attemptId: attempt.id,
          userId: 'user-1',
          missionId: 'mission-order-restaurant',
          definitionVersion: 'restaurant-order-v1',
          turnNumber,
          evidence: {
            goalKey: ['order', 'respond', 'repair'][turnNumber - 1] as
              | 'order'
              | 'respond'
              | 'repair',
            turnNumber,
            npcJapanese: '日本語',
            npcRomaji: 'nihongo',
            transcript: '返事',
            outcome: 'accepted',
            confidence: 'high',
            feedback: 'Accepted.',
            supportUsed: supportUsed && turnNumber === 1,
            clientResponseId: `${supportUsed ? 'supported' : 'independent'}-${turnNumber}`,
            assessedAt: '2026-07-13T12:00:00.000Z',
          },
        });
      }
    }

    await completeAttempt(false);
    await completeAttempt(true);

    await expect(
      spoken.getBestSpokenMissionEvidence('user-1', 'mission-order-restaurant'),
    ).resolves.toBe('independent');
  });

  it('keeps Retry and Could not assess on the current goal while support use stays monotonic', async () => {
    const spoken = await loadRepositories();
    const attempt = await spoken.createSpokenMissionAttempt({
      userId: 'user-1',
      missionId: 'mission-order-restaurant',
      definitionVersion: 'restaurant-order-v1',
      wordingVariant: 0,
    });

    const baseEvidence = {
      goalKey: 'order' as const,
      turnNumber: 1,
      npcJapanese: 'ご注文は？',
      npcRomaji: 'go-chuumon wa?',
      transcript: 'さようなら',
      confidence: 'high' as const,
      feedback: 'Try ordering one item.',
      supportUsed: true,
      assessedAt: '2026-07-13T12:00:00.000Z',
    };

    const retry = await spoken.recordSpokenMissionAssessment({
      attemptId: attempt.id,
      userId: 'user-1',
      missionId: 'mission-order-restaurant',
      definitionVersion: 'restaurant-order-v1',
      turnNumber: 1,
      evidence: {
        ...baseEvidence,
        outcome: 'retry',
        clientResponseId: 'retry-1',
      },
    });
    expect(retry.attempt).toMatchObject({
      currentTurn: 1,
      successfulTurnCount: 0,
      supportUsed: true,
      evidenceState: null,
    });

    const unassessable = await spoken.recordSpokenMissionAssessment({
      attemptId: attempt.id,
      userId: 'user-1',
      missionId: 'mission-order-restaurant',
      definitionVersion: 'restaurant-order-v1',
      turnNumber: 1,
      evidence: {
        ...baseEvidence,
        transcript: null,
        confidence: null,
        feedback: 'No speech was detected.',
        supportUsed: false,
        outcome: 'could_not_assess',
        clientResponseId: 'unassessable-1',
      },
    });
    expect(unassessable.attempt).toMatchObject({
      currentTurn: 1,
      successfulTurnCount: 0,
      supportUsed: true,
      evidenceState: null,
      conversationLog: [
        { outcome: 'retry', supportUsed: true },
        { outcome: 'could_not_assess', supportUsed: false },
      ],
    });
    await expect(
      spoken.getBestSpokenMissionEvidence('user-1', 'mission-order-restaurant'),
    ).resolves.toBeNull();
  });
});
