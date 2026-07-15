import { createClient, type Client } from '@libsql/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  client: null as Client | null,
  runDatabaseMigrations: vi.fn(),
  seedMissions: vi.fn(),
}));

vi.mock('./db-client', () => ({
  getClient: () => {
    if (!harness.client) throw new Error('Test database client was not initialized.');
    return harness.client;
  },
}));
vi.mock('./db-migrations', () => ({ runDatabaseMigrations: harness.runDatabaseMigrations }));
vi.mock('./missions-seed', () => ({ seedMissions: harness.seedMissions }));

describe('mission catalog spoken progress', () => {
  afterEach(() => {
    harness.client = null;
    harness.runDatabaseMigrations.mockReset();
    harness.seedMissions.mockReset();
  });

  it('marks only configured scenarios and exposes the best persisted spoken evidence separately', async () => {
    vi.resetModules();
    harness.client = createClient({ url: 'file::memory:' });
    harness.runDatabaseMigrations.mockResolvedValue(undefined);
    harness.seedMissions.mockResolvedValue(undefined);
    const db = await import('./db');
    const missions = await import('./missions-db');
    const spoken = await import('./spoken-missions-db');
    await db.insertUser({ id: 'user-1', name: 'Test User', level: 'beginner' });
    await harness.client.execute({
      sql: `INSERT INTO missions (
        id, title, category, difficulty, sequence, scenario_prompt, badge_emoji,
        badge_name, badge_statement, unlock_sessions_required, start_unlocked
      ) VALUES
        ('mission-order-restaurant', 'Order at a Restaurant', 'food_dining', 'medium', 1, 'Prompt', '🍜', 'Ramen Regular', 'Statement', 0, 1),
        ('mission-first-meeting', 'First Meeting', 'greetings_basics', 'easy', 1, 'Prompt', '🤝', 'Social Butterfly', 'Statement', 0, 1)`,
    });

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
          goalKey: ['order', 'respond', 'repair'][turnNumber - 1] as 'order' | 'respond' | 'repair',
          turnNumber,
          npcJapanese: '日本語',
          npcRomaji: 'nihongo',
          transcript: '返事',
          outcome: 'accepted',
          confidence: 'high',
          feedback: 'Accepted.',
          supportUsed: false,
          clientResponseId: `response-${turnNumber}`,
          assessedAt: '2026-07-13T12:00:00.000Z',
        },
      });
    }

    const catalog = await missions.getMissionsWithProgress('user-1');
    expect(catalog.find((mission) => mission.id === 'mission-order-restaurant')).toMatchObject({
      spokenAvailable: true,
      spokenEvidence: 'independent',
      completedPractice: false,
      completedImmersion: false,
      badgeEarned: false,
    });
    expect(catalog.find((mission) => mission.id === 'mission-first-meeting')).toMatchObject({
      spokenAvailable: false,
      spokenEvidence: 'untried',
    });
  });
});
