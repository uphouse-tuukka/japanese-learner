import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  requestSpokenMissionEnglishSupport,
  requestSpokenMissionSkip,
  requestSpokenMissionStart,
  requestSpokenMissionTurn,
  requestSpokenMissionWrittenSupport,
} from './spoken-mission-client';

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
    definitionVersion: 'restaurant-order-v2',
    supportPolicy: {
      englishListeningSupport: 'optional',
      evidenceWithoutEnglishSupport: 'independent',
      evidenceWithEnglishSupport: 'supported',
    },
    briefing: {
      canDo: 'I can complete the restaurant task.',
      situation: 'At a restaurant.',
      assessment: 'Intent is assessed, not accent.',
      evidence:
        'Complete every goal without English listening support for Independent evidence. Using English listening support records Supported evidence.',
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
    },
    history: resumed
      ? [
          {
            kind: 'assessment',
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
    currentTurnEnglishSupportRevealed: resumed,
    currentTurnEnglishSupport: resumed ? 'Water?' : null,
    currentTurnWrittenSupportRevealed: resumed,
  });
}

function turnForm(): FormData {
  const form = new FormData();
  form.set('audio', new File(['voice-data'], 'turn.webm', { type: 'audio/webm' }));
  return form;
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

    expect(result.history[0]).toMatchObject({
      kind: 'assessment',
      assessment: { transcript: 'ラーメンを一つお願いします。' },
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe('Spoken Mission browser turn boundary', () => {
  it('sends an idempotent skip request without audio', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        duplicate: false,
        nextTurn: { turnNumber: 2, goalKey: 'respond' },
        history: [],
        isComplete: false,
        result: null,
      }),
    );

    await requestSpokenMissionSkip({
      missionId: 'mission-order-restaurant',
      userId: 'user-1',
      attemptId: 'spokenmission-v3',
      turnNumber: 1,
      clientSkipId: 'skip-1',
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      '/api/missions/mission-order-restaurant/spoken/skip',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: 'user-1',
          attemptId: 'spokenmission-v3',
          turnNumber: 1,
          clientSkipId: 'skip-1',
        }),
      }),
    );
    expect(fetcher.mock.calls[0][1].body).not.toBeInstanceOf(FormData);
  });

  it('preserves the recorded response for a network retry', async () => {
    const form = turnForm();

    await expect(
      requestSpokenMissionTurn({
        missionId: 'mission-order-restaurant',
        form,
        fetcher: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      }),
    ).rejects.toMatchObject({
      message: 'Could not reach the assessment service. Your attempt is saved.',
      recovery: 'retry_upload',
    });

    expect(form.get('audio')).toBeInstanceOf(File);
  });

  it.each([
    [
      'unsupported audio',
      400,
      'Unsupported audio format. Please try recording again.',
      'record_again',
    ],
    [
      'oversized audio',
      400,
      'Audio file is too large. Please record a shorter answer.',
      'record_again',
    ],
    ['budget exhaustion', 429, 'Daily AI budget exhausted. Your attempt is saved.', 'retry_upload'],
    [
      'service failure',
      500,
      'Failed to assess Spoken Mission response. Your attempt is saved.',
      'retry_upload',
    ],
  ] as const)('maps %s to a safe recovery action', async (_case, status, error, recovery) => {
    await expect(
      requestSpokenMissionTurn({
        missionId: 'mission-order-restaurant',
        form: turnForm(),
        fetcher: vi
          .fn()
          .mockResolvedValue(Response.json({ ok: false, error, recovery }, { status })),
      }),
    ).rejects.toMatchObject({ message: error, recovery });
  });
});

describe('Spoken Mission browser support boundaries', () => {
  const input = {
    missionId: 'mission-order-restaurant',
    userId: 'user-1',
    attemptId: 'spokenmission-v2',
    turnNumber: 1,
  };

  it('requests paired written support from the dedicated endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        writtenText: { japanese: 'ご注文は？', romaji: 'go-chuumon wa?' },
        writtenSupportRevealed: true,
      }),
    );

    await expect(requestSpokenMissionWrittenSupport({ ...input, fetcher })).resolves.toEqual({
      writtenText: { japanese: 'ご注文は？', romaji: 'go-chuumon wa?' },
      writtenSupportRevealed: true,
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/missions/mission-order-restaurant/spoken/written-support',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          userId: 'user-1',
          attemptId: 'spokenmission-v2',
          turnNumber: 1,
        }),
      }),
    );
  });

  it('keeps English support on its separate endpoint and contract', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ englishSupport: 'Are you ready to order?', supportUsed: true }),
      );

    await expect(requestSpokenMissionEnglishSupport({ ...input, fetcher })).resolves.toEqual({
      englishSupport: 'Are you ready to order?',
      supportUsed: true,
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/missions/mission-order-restaurant/spoken/support',
      expect.any(Object),
    );
  });

  it('uses the English support fallback when the request cannot reach the server', async () => {
    await expect(
      requestSpokenMissionEnglishSupport({
        ...input,
        fetcher: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      }),
    ).rejects.toThrow('Could not reveal English support.');
  });

  it('uses the written support fallback when the response is not JSON', async () => {
    await expect(
      requestSpokenMissionWrittenSupport({
        ...input,
        fetcher: vi
          .fn()
          .mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })),
      }),
    ).rejects.toThrow('Could not reveal written text.');
  });

  it('preserves a structured support API error', async () => {
    await expect(
      requestSpokenMissionEnglishSupport({
        ...input,
        fetcher: vi
          .fn()
          .mockResolvedValue(
            Response.json({ error: 'Attempt is no longer active.' }, { status: 409 }),
          ),
      }),
    ).rejects.toThrow('Attempt is no longer active.');
  });
});
