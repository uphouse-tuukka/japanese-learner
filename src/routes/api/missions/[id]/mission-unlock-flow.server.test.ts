import { createClient, type Client } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  client: null as Client | null,
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
  config: {
    missions: {
      unlockAllOverride: false,
    },
  },
}));

function cookies(userId: string) {
  return { get: (name: string) => (name === 'selected_user' ? userId : undefined) };
}

function startRequest(userId: string): Request {
  return new Request('http://localhost/api/missions/mission-order-restaurant/spoken/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
}

async function startSpokenMission(userId: string): Promise<Response> {
  const route = await import('./spoken/start/+server');
  return route.POST({
    params: { id: 'mission-order-restaurant' },
    request: startRequest(userId),
    cookies: cookies(userId),
  } as never);
}

async function catalogMission(userId: string) {
  const { getMissionsWithProgress } = await import('$lib/server/missions-db');
  const missions = await getMissionsWithProgress(userId);
  return missions.find((mission) => mission.id === 'mission-order-restaurant');
}

describe('Travel Mission unlock agreement', () => {
  beforeEach(async () => {
    vi.resetModules();
    harness.client = createClient({ url: 'file::memory:' });
    harness.runDatabaseMigrations.mockReset().mockResolvedValue(undefined);
    harness.seedMissions.mockReset().mockResolvedValue(undefined);

    const db = await import('$lib/server/db');
    await db.insertUser({ id: 'threshold-user', name: 'Threshold User', level: 'beginner' });
    await db.insertUser({ id: 'override-user', name: 'Override User', level: 'beginner' });
    await harness.client.execute({
      sql: `INSERT INTO missions (
        id, title, category, difficulty, sequence, scenario_prompt, badge_emoji,
        badge_name, badge_statement, unlock_sessions_required, start_unlocked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'mission-order-restaurant',
        'Order at a Restaurant',
        'food_dining',
        'medium',
        1,
        'Order one item at a restaurant.',
        '🍜',
        'Ramen Regular',
        'You can order at a restaurant.',
        2,
        0,
      ],
    });
  });

  afterEach(() => {
    harness.client = null;
  });

  it('keeps catalog display and Spoken Mission authorization locked below the threshold and unlocked at it', async () => {
    const db = await import('$lib/server/db');
    await db.createSession({
      id: 'food-session-1',
      userId: 'threshold-user',
      mode: 'ai',
      status: 'completed',
      summary: JSON.stringify({ category: 'food_dining' }),
    });

    await expect(catalogMission('threshold-user')).resolves.toMatchObject({ unlocked: false });
    const lockedResponse = await startSpokenMission('threshold-user');
    expect(lockedResponse.status).toBe(403);
    await expect(lockedResponse.json()).resolves.toMatchObject({ error: 'Mission is locked.' });

    await db.createSession({
      id: 'food-session-2',
      userId: 'threshold-user',
      mode: 'ai',
      status: 'completed',
      summary: JSON.stringify({ category: 'food_dining' }),
    });

    await expect(catalogMission('threshold-user')).resolves.toMatchObject({ unlocked: true });
    const unlockedResponse = await startSpokenMission('threshold-user');
    expect(unlockedResponse.status).toBe(200);
  });

  it('keeps catalog display and Spoken Mission authorization aligned under the development override', async () => {
    const { config } = await import('$lib/server/config');
    config.missions.unlockAllOverride = true;

    await expect(catalogMission('override-user')).resolves.toMatchObject({ unlocked: true });
    const response = await startSpokenMission('override-user');
    expect(response.status).toBe(200);
  });
});
