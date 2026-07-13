import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bestEvidence: vi.fn(),
  categoryCount: vi.fn(),
  completedMode: vi.fn(),
  getDefinition: vi.fn(),
  getMission: vi.fn(),
  getUser: vi.fn(),
  resumable: vi.fn(),
}));

vi.mock('$lib/server/config', () => ({
  config: { missions: { unlockAllOverride: false } },
}));
vi.mock('$lib/server/db', () => ({ getUserById: mocks.getUser }));
vi.mock('$lib/server/missions-db', () => ({
  getCategorySessionCount: mocks.categoryCount,
  getMissionById: mocks.getMission,
  hasCompletedMissionInMode: mocks.completedMode,
}));
vi.mock('$lib/server/spoken-missions', async (importOriginal) => {
  const original = await importOriginal<typeof import('$lib/server/spoken-missions')>();
  return { ...original, getSpokenMissionDefinition: mocks.getDefinition };
});
vi.mock('$lib/server/spoken-missions-db', () => ({
  getBestSpokenMissionEvidence: mocks.bestEvidence,
  getResumableSpokenMissionAttempt: mocks.resumable,
}));

import { load } from './+page.server';

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
      learnerGoal: 'Order.',
      serverLines: [],
      alternatives: [],
      rubric: '',
    },
    {
      key: 'respond',
      title: 'Respond',
      learnerGoal: 'Respond.',
      serverLines: [],
      alternatives: [],
      rubric: '',
    },
    {
      key: 'repair',
      title: 'Repair',
      learnerGoal: 'Repair.',
      serverLines: [],
      alternatives: [],
      rubric: '',
    },
  ],
  suggestedPhrase: { japanese: '', romaji: '', english: '' },
} as const;

function cookies() {
  return {
    get: (name: string) => (name === 'selected_user' ? 'user-1' : undefined),
    delete: vi.fn(),
  };
}

describe('mission detail loader Spoken Mission availability', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getUser.mockResolvedValue({ id: 'user-1' });
    mocks.getMission.mockResolvedValue({
      id: 'mission-order-restaurant',
      category: 'food_dining',
      startUnlocked: false,
      unlockSessionsRequired: 2,
    });
    mocks.categoryCount.mockResolvedValue(2);
    mocks.completedMode.mockResolvedValue(false);
    mocks.bestEvidence.mockResolvedValue('independent');
    mocks.resumable.mockResolvedValue({ currentTurn: 2, supportUsed: false });
    mocks.getDefinition.mockReturnValue(definition);
  });

  it('exposes the authored briefing, best evidence, resume metadata, and separate written progress', async () => {
    const data = await load({
      params: { id: 'mission-order-restaurant' },
      cookies: cookies(),
    } as never);

    expect(data).toMatchObject({
      unlocked: true,
      writtenProgress: { completedPractice: false, completedImmersion: false },
      spokenMission: {
        bestEvidence: 'independent',
        resumable: { currentTurn: 2, supportUsed: false },
        briefing: {
          definitionVersion: 'restaurant-order-v1',
          goals: [{ key: 'order' }, { key: 'respond' }, { key: 'repair' }],
        },
      },
    });
  });

  it('returns no Spoken Mission data for a non-enabled scenario so Written Mission opens directly', async () => {
    mocks.getMission.mockResolvedValue({
      id: 'mission-first-meeting',
      category: 'greetings_basics',
      startUnlocked: true,
      unlockSessionsRequired: 0,
    });
    mocks.getDefinition.mockReturnValue(null);

    const data = await load({
      params: { id: 'mission-first-meeting' },
      cookies: cookies(),
    } as never);

    expect(data).toMatchObject({ unlocked: true, spokenMission: null });
    expect(mocks.bestEvidence).not.toHaveBeenCalled();
    expect(mocks.resumable).not.toHaveBeenCalled();
  });
});
