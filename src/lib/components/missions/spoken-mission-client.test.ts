import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestSpokenMissionStart } from './spoken-mission-client';

const originalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'sessionStorage',
);

function restoreSessionStorage(): void {
  if (originalSessionStorageDescriptor) {
    Object.defineProperty(globalThis, 'sessionStorage', originalSessionStorageDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
}

function startResponse(resumed: boolean): Response {
  return Response.json({
    attemptId: resumed ? 'spokenmission-resumed' : 'spokenmission-fresh',
    briefing: {
      canDo: 'I can complete the restaurant task.',
      situation: 'At a restaurant.',
      assessment: 'Intent is assessed, not accent.',
      privacy: 'Raw audio is discarded.',
      approximateMinutes: 2,
      maxRecordingSeconds: 12,
      goals: [],
    },
    turn: {
      turnNumber: resumed ? 2 : 1,
      goalKey: resumed ? 'respond' : 'order',
      goalTitle: resumed ? 'Respond' : 'Order',
      npcDialogue: { japanese: 'お水は？', romaji: 'o-mizu wa?' },
      englishSupport: 'Water?',
    },
    history: resumed
      ? [
          {
            goalKey: 'order',
            goalTitle: 'Order',
            turnNumber: 1,
            npcDialogue: { japanese: 'ご注文は？', romaji: 'go-chuumon wa?' },
            assessment: {
              transcript: 'ラーメンを一つお願いします。',
              outcome: 'accepted',
              confidence: 'high',
              feedback: 'You ordered one ramen.',
            },
            supportUsed: false,
            assessedAt: '2026-07-13T12:00:00.000Z',
          },
        ]
      : [],
    totalTurns: 3,
    resumed,
    supportUsed: false,
  });
}

afterEach(() => {
  restoreSessionStorage();
});

describe('Spoken Mission browser start boundary', () => {
  it.each([
    ['Resume', false, true],
    ['Start over', true, false],
  ] as const)(
    'sends the %s intent and returns server resume state',
    async (_label, startOver, resumed) => {
      const fetcher = vi.fn().mockResolvedValue(startResponse(resumed));

      const result = await requestSpokenMissionStart({
        missionId: 'mission-order-restaurant',
        userId: 'user-1',
        startOver,
        fetcher,
      });

      expect(fetcher).toHaveBeenCalledWith('/api/missions/mission-order-restaurant/spoken/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'user-1', startOver }),
      });
      expect(result.resumed).toBe(resumed);
      expect(result.history).toHaveLength(resumed ? 1 : 0);
    },
  );

  it('keeps restored transcripts and assessments out of browser storage', async () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: storage,
    });

    const result = await requestSpokenMissionStart({
      missionId: 'mission-order-restaurant',
      userId: 'user-1',
      startOver: false,
      fetcher: vi.fn().mockResolvedValue(startResponse(true)),
    });

    expect(result.history[0]?.assessment.transcript).toBe('ラーメンを一つお願いします。');
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
