import { createClient, type Client } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  client: null as Client | null,
  assess: vi.fn(),
  checkBudget: vi.fn(),
  seedMissions: vi.fn(),
}));

vi.mock('$lib/server/db-client', () => ({
  getClient: () => {
    if (!harness.client) throw new Error('Test database client was not initialized.');
    return harness.client;
  },
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

function startRequest(startOver = false): Request {
  return new Request('http://localhost/api/missions/mission-order-restaurant/spoken/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'user-1', startOver }),
  });
}

function turnRequest(input: {
  attemptId: string;
  turnNumber: number;
  clientResponseId: string;
  englishSupportRevealed?: boolean;
}): Request {
  const form = new FormData();
  form.set('userId', 'user-1');
  form.set('attemptId', input.attemptId);
  form.set('turnNumber', String(input.turnNumber));
  form.set('clientResponseId', input.clientResponseId);
  form.set('englishSupportRevealed', String(input.englishSupportRevealed ?? false));
  form.set('audio', new File(['voice'], `turn-${input.turnNumber}.webm`, { type: 'audio/webm' }));
  return new Request('http://localhost/api/missions/mission-order-restaurant/spoken/turn', {
    method: 'POST',
    body: form,
  });
}

function supportRequest(attemptId: string, turnNumber: number): Request {
  return new Request('http://localhost/api/missions/mission-order-restaurant/spoken/support', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'user-1', attemptId, turnNumber }),
  });
}

function writtenSupportRequest(attemptId: string, turnNumber: number): Request {
  return new Request(
    'http://localhost/api/missions/mission-order-restaurant/spoken/written-support',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', attemptId, turnNumber }),
    },
  );
}

describe('unlocked restaurant Spoken Mission route flow', () => {
  beforeEach(async () => {
    vi.resetModules();
    harness.client = createClient({ url: 'file::memory:' });
    harness.seedMissions.mockReset().mockResolvedValue(undefined);
    harness.checkBudget.mockReset().mockResolvedValue({ allowed: true });
    harness.assess.mockReset();
    const db = await import('$lib/server/db');
    await db.insertUser({ id: 'user-1', name: 'Test User', level: 'beginner' });
    await harness.client.execute({
      sql: `INSERT INTO user_streaks (
        user_id, current_streak, longest_streak, last_activity_date, daily_goal_met, updated_at
      ) VALUES (?, 4, 9, '2026-07-12', 1, '2026-07-12T12:00:00.000Z')`,
      args: ['user-1'],
    });
  });

  afterEach(() => {
    harness.client = null;
  });

  it('returns one current attempt when simultaneous fresh starts race', async () => {
    const startRoute = await import('./spoken/start/+server');

    const responses = await Promise.all([
      startRoute.POST({
        params: { id: 'mission-order-restaurant' },
        request: startRequest(),
        cookies: cookies(),
      } as never),
      startRoute.POST({
        params: { id: 'mission-order-restaurant' },
        request: startRequest(),
        cookies: cookies(),
      } as never),
    ]);
    const starts = await Promise.all(responses.map((response) => response.json()));

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(new Set(starts.map((start) => start.attemptId))).toHaveLength(1);
    expect(starts.filter((start) => start.resumed)).toHaveLength(1);
    const activeAttempts = await harness.client!.execute({
      sql: `SELECT id FROM user_spoken_missions
        WHERE user_id = ? AND mission_id = ? AND status = 'in_progress'`,
      args: ['user-1', 'mission-order-restaurant'],
    });
    expect(activeAttempts.rows).toHaveLength(1);
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
    expect(started.turn).not.toHaveProperty('englishSupport');
    expect(JSON.stringify(started)).not.toContain('Are you ready to order?');

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
      assessment: {
        outcome: 'accepted',
        transcript: 'いいえ、ラーメン一つです。',
        feedback: 'You repaired the misunderstanding.',
      },
      nextTurn: null,
      isComplete: true,
      result: {
        evidenceState: 'independent',
        goals: [
          {
            goalKey: 'order',
            transcript: 'ラーメンを一つお願いします。',
            outcome: 'accepted',
            confidence: 'high',
            feedback: 'You clearly ordered one ramen.',
            supportUsed: false,
            clientResponseId: 'client-response-1',
          },
          {
            goalKey: 'respond',
            transcript: 'お水でお願いします。',
            outcome: 'accepted',
            confidence: 'medium',
            feedback: 'You answered the drink question.',
            supportUsed: false,
            clientResponseId: 'client-response-2',
          },
          {
            goalKey: 'repair',
            transcript: 'いいえ、ラーメン一つです。',
            outcome: 'accepted',
            confidence: 'high',
            feedback: 'You repaired the misunderstanding.',
            supportUsed: false,
            clientResponseId: 'client-response-3',
          },
        ],
      },
    });
    expect(Object.keys(completed.result.goals[0]).sort()).toEqual(
      [
        'assessedAt',
        'clientResponseId',
        'confidence',
        'feedback',
        'goalKey',
        'npcJapanese',
        'npcRomaji',
        'outcome',
        'supportUsed',
        'title',
        'transcript',
        'turnNumber',
        'writtenSupportRevealed',
      ].sort(),
    );

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
      `SELECT COUNT(*) AS total FROM sessions`,
    ]);
    expect(unrelatedCounts.map((result) => Number(result.rows[0]?.total ?? 0))).toEqual([
      0, 0, 0, 0,
    ]);

    const streak = await harness.client!.execute({
      sql: `SELECT current_streak, longest_streak, last_activity_date, daily_goal_met
        FROM user_streaks WHERE user_id = ?`,
      args: ['user-1'],
    });
    expect(streak.rows[0]).toMatchObject({
      current_streak: 4,
      longest_streak: 9,
      last_activity_date: '2026-07-12',
      daily_goal_met: 1,
    });

    const readiness = await harness.client!.execute({
      sql: `SELECT level, progress_journal FROM users WHERE id = ?`,
      args: ['user-1'],
    });
    expect(readiness.rows[0]).toMatchObject({ level: 'beginner', progress_journal: null });
  });

  it('restores progress across refresh and starts over with fresh wording without retaining audio', async () => {
    harness.assess.mockResolvedValue({
      outcome: 'accepted',
      transcript: 'ラーメンを一つお願いします。',
      confidence: 'high',
      feedback: 'You clearly ordered one ramen.',
    });

    const startRoute = await import('./spoken/start/+server');
    const turnRoute = await import('./spoken/turn/+server');
    const firstStartResponse = await startRoute.POST({
      params: { id: 'mission-order-restaurant' },
      request: startRequest(),
      cookies: cookies(),
    } as never);
    const firstStart = await firstStartResponse.json();

    const firstTurnResponse = await turnRoute.POST({
      params: { id: 'mission-order-restaurant' },
      request: turnRequest({
        attemptId: firstStart.attemptId,
        turnNumber: 1,
        clientResponseId: 'resume-first-turn',
      }),
      cookies: cookies(),
    } as never);
    expect(firstTurnResponse.status).toBe(200);

    const refreshedResponse = await startRoute.POST({
      params: { id: 'mission-order-restaurant' },
      request: startRequest(),
      cookies: cookies(),
    } as never);
    const refreshed = await refreshedResponse.json();
    expect(refreshed).toMatchObject({
      attemptId: firstStart.attemptId,
      resumed: true,
      turn: { turnNumber: 2, goalKey: 'respond' },
      history: [
        {
          goalKey: 'order',
          assessment: {
            transcript: 'ラーメンを一つお願いします。',
            outcome: 'accepted',
            feedback: 'You clearly ordered one ramen.',
          },
        },
      ],
    });
    expect(JSON.stringify(refreshed.history)).not.toContain('"audio":');

    const firstAttempt = await (
      await import('$lib/server/spoken-missions-db')
    ).getSpokenMissionAttempt(firstStart.attemptId);
    const replacementResponse = await startRoute.POST({
      params: { id: 'mission-order-restaurant' },
      request: startRequest(true),
      cookies: cookies(),
    } as never);
    const replacement = await replacementResponse.json();
    const spoken = await import('$lib/server/spoken-missions-db');
    const abandoned = await spoken.getSpokenMissionAttempt(firstStart.attemptId);
    const replacementAttempt = await spoken.getSpokenMissionAttempt(replacement.attemptId);

    expect(replacement).toMatchObject({ resumed: false, history: [], turn: { turnNumber: 1 } });
    expect(replacement.attemptId).not.toBe(firstStart.attemptId);
    expect(abandoned?.status).toBe('abandoned');
    expect(replacementAttempt?.status).toBe('in_progress');
    expect(replacementAttempt?.wordingVariant).not.toBe(firstAttempt?.wordingVariant);

    const abandonedTurnResponse = await turnRoute.POST({
      params: { id: 'mission-order-restaurant' },
      request: turnRequest({
        attemptId: firstStart.attemptId,
        turnNumber: 2,
        clientResponseId: 'abandoned-extra-turn',
      }),
      cookies: cookies(),
    } as never);
    expect(abandonedTurnResponse.status).toBe(400);
    expect(harness.assess).toHaveBeenCalledTimes(1);
  });

  it('restores written Japanese and romaji independently without downgrading evidence', async () => {
    harness.assess.mockResolvedValue({
      outcome: 'accepted',
      transcript: '返事',
      confidence: 'high',
      feedback: 'Goal accomplished.',
    });

    const startRoute = await import('./spoken/start/+server');
    const writtenSupportRoute = await import('./spoken/written-support/+server');
    const turnRoute = await import('./spoken/turn/+server');
    const startedResponse = await startRoute.POST({
      params: { id: 'mission-order-restaurant' },
      request: startRequest(),
      cookies: cookies(),
    } as never);
    const started = await startedResponse.json();

    for (let requestNumber = 0; requestNumber < 2; requestNumber += 1) {
      const revealResponse = await writtenSupportRoute.POST({
        params: { id: 'mission-order-restaurant' },
        request: writtenSupportRequest(started.attemptId, 1),
        cookies: cookies(),
      } as never);
      expect(revealResponse.status).toBe(200);
      await expect(revealResponse.json()).resolves.toEqual({
        writtenText: {
          japanese: expect.any(String),
          romaji: expect.any(String),
        },
        writtenSupportRevealed: true,
      });
    }

    const refreshedResponse = await startRoute.POST({
      params: { id: 'mission-order-restaurant' },
      request: startRequest(),
      cookies: cookies(),
    } as never);
    await expect(refreshedResponse.json()).resolves.toMatchObject({
      resumed: true,
      supportUsed: false,
      currentTurnEnglishSupportRevealed: false,
      currentTurnEnglishSupport: null,
      currentTurnWrittenSupportRevealed: true,
    });

    let finalPayload: Record<string, unknown> | null = null;
    for (const turnNumber of [1, 2, 3]) {
      const response = await turnRoute.POST({
        params: { id: 'mission-order-restaurant' },
        request: turnRequest({
          attemptId: started.attemptId,
          turnNumber,
          clientResponseId: `written-support-${turnNumber}`,
        }),
        cookies: cookies(),
      } as never);
      expect(response.status).toBe(200);
      finalPayload = await response.json();
    }

    expect(finalPayload).toMatchObject({
      isComplete: true,
      result: { evidenceState: 'independent' },
    });
  });

  it('completes with Supported evidence after English help and keeps support use monotonic', async () => {
    harness.assess
      .mockResolvedValueOnce({
        outcome: 'retry',
        transcript: 'ラーメンですか。',
        confidence: 'high',
        feedback: 'Try ordering one ramen.',
      })
      .mockResolvedValueOnce({
        outcome: 'accepted',
        transcript: 'ラーメンを一つお願いします。',
        confidence: 'high',
        feedback: 'You clearly ordered one ramen.',
      })
      .mockResolvedValueOnce({
        outcome: 'accepted',
        transcript: 'お水でお願いします。',
        confidence: 'high',
        feedback: 'You answered the drink question.',
      })
      .mockResolvedValueOnce({
        outcome: 'accepted',
        transcript: 'いいえ、ラーメン一つです。',
        confidence: 'high',
        feedback: 'You repaired the misunderstanding.',
      });

    const startRoute = await import('./spoken/start/+server');
    const supportRoute = await import('./spoken/support/+server');
    const turnRoute = await import('./spoken/turn/+server');
    const startResponse = await startRoute.POST({
      params: { id: 'mission-order-restaurant' },
      request: startRequest(),
      cookies: cookies(),
    } as never);
    const started = await startResponse.json();

    const supportResponse = await supportRoute.POST({
      params: { id: 'mission-order-restaurant' },
      request: supportRequest(started.attemptId, 1),
      cookies: cookies(),
    } as never);
    expect(supportResponse.status).toBe(200);
    await expect(supportResponse.json()).resolves.toEqual({
      englishSupport: expect.any(String),
      supportUsed: true,
    });

    const spoken = await import('$lib/server/spoken-missions-db');
    await expect(spoken.getSpokenMissionAttempt(started.attemptId)).resolves.toMatchObject({
      currentTurn: 1,
      supportUsed: true,
      currentTurnSupportUsed: true,
    });

    const resumeResponse = await startRoute.POST({
      params: { id: 'mission-order-restaurant' },
      request: startRequest(),
      cookies: cookies(),
    } as never);
    await expect(resumeResponse.json()).resolves.toMatchObject({
      resumed: true,
      supportUsed: true,
      currentTurnEnglishSupportRevealed: true,
      currentTurnEnglishSupport: expect.any(String),
      turn: { turnNumber: 1 },
    });

    const supportedRetry = await turnRoute.POST({
      params: { id: 'mission-order-restaurant' },
      request: turnRequest({
        attemptId: started.attemptId,
        turnNumber: 1,
        clientResponseId: 'supported-retry',
        englishSupportRevealed: false,
      }),
      cookies: cookies(),
    } as never);
    expect(supportedRetry.status).toBe(200);
    await expect(supportedRetry.json()).resolves.toMatchObject({
      assessment: { outcome: 'retry' },
      isComplete: false,
    });

    await expect(spoken.getSpokenMissionAttempt(started.attemptId)).resolves.toMatchObject({
      currentTurn: 1,
      supportUsed: true,
      currentTurnSupportUsed: true,
      conversationLog: [{ supportUsed: true }],
    });

    for (const turnNumber of [1, 2, 3]) {
      const response = await turnRoute.POST({
        params: { id: 'mission-order-restaurant' },
        request: turnRequest({
          attemptId: started.attemptId,
          turnNumber,
          clientResponseId: `supported-accepted-${turnNumber}`,
          englishSupportRevealed: false,
        }),
        cookies: cookies(),
      } as never);
      expect(response.status).toBe(200);
      const payload = await response.json();
      if (turnNumber === 3) {
        expect(payload).toMatchObject({
          isComplete: true,
          result: {
            evidenceState: 'supported',
            goals: [
              { goalKey: 'order', supportUsed: true },
              { goalKey: 'respond', supportUsed: false },
              { goalKey: 'repair', supportUsed: false },
            ],
            suggestedPhrase: {
              japanese: 'すみません、ラーメンは一つです。',
              romaji: 'sumimasen, raamen wa hitotsu desu.',
              english: 'Sorry, it is one ramen.',
            },
          },
        });
      }
    }

    await expect(spoken.getSpokenMissionAttempt(started.attemptId)).resolves.toMatchObject({
      status: 'completed',
      supportUsed: true,
      currentTurnSupportUsed: false,
      evidenceState: 'supported',
    });
    await expect(
      spoken.getBestSpokenMissionEvidence('user-1', 'mission-order-restaurant'),
    ).resolves.toBe('supported');
  });

  it('keeps Japanese, romaji, replay, and a Japanese repetition request independent', async () => {
    harness.assess
      .mockResolvedValueOnce({
        outcome: 'retry',
        transcript: 'もう一度お願いします。',
        confidence: 'high',
        feedback: 'The server repeats the question. Now complete the current goal.',
      })
      .mockResolvedValueOnce({
        outcome: 'accepted',
        transcript: 'ラーメンを一つお願いします。',
        confidence: 'high',
        feedback: 'You clearly ordered one ramen.',
      })
      .mockResolvedValueOnce({
        outcome: 'accepted',
        transcript: 'お水でお願いします。',
        confidence: 'high',
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
    const started = await startResponse.json();
    expect(started.turn).toMatchObject({
      npcDialogue: {
        japanese: expect.any(String),
        romaji: expect.any(String),
      },
    });

    const repetitionResponse = await turnRoute.POST({
      params: { id: 'mission-order-restaurant' },
      request: turnRequest({
        attemptId: started.attemptId,
        turnNumber: 1,
        clientResponseId: 'repeat-in-japanese',
      }),
      cookies: cookies(),
    } as never);
    expect(repetitionResponse.status).toBe(200);
    await expect(repetitionResponse.json()).resolves.toMatchObject({
      assessment: {
        outcome: 'retry',
        transcript: 'もう一度お願いします。',
      },
      isComplete: false,
    });

    const spoken = await import('$lib/server/spoken-missions-db');
    await expect(spoken.getSpokenMissionAttempt(started.attemptId)).resolves.toMatchObject({
      currentTurn: 1,
      supportUsed: false,
    });

    let completed: Record<string, unknown> | null = null;
    for (const turnNumber of [1, 2, 3]) {
      const response = await turnRoute.POST({
        params: { id: 'mission-order-restaurant' },
        request: turnRequest({
          attemptId: started.attemptId,
          turnNumber,
          clientResponseId: `baseline-accepted-${turnNumber}`,
        }),
        cookies: cookies(),
      } as never);
      expect(response.status).toBe(200);
      completed = await response.json();
    }
    expect(completed).toMatchObject({
      isComplete: true,
      result: { evidenceState: 'independent' },
    });
  });

  it('does not downgrade earlier Independent evidence after a later Supported route completion', async () => {
    harness.assess.mockResolvedValue({
      outcome: 'accepted',
      transcript: 'ラーメンを一つお願いします。',
      confidence: 'high',
      feedback: 'Goal accomplished.',
    });

    const startRoute = await import('./spoken/start/+server');
    const supportRoute = await import('./spoken/support/+server');
    const turnRoute = await import('./spoken/turn/+server');

    async function completeAttempt(prefix: string, supported: boolean): Promise<string> {
      const startResponse = await startRoute.POST({
        params: { id: 'mission-order-restaurant' },
        request: startRequest(),
        cookies: cookies(),
      } as never);
      const started = await startResponse.json();
      if (supported) {
        const supportResponse = await supportRoute.POST({
          params: { id: 'mission-order-restaurant' },
          request: supportRequest(started.attemptId, 1),
          cookies: cookies(),
        } as never);
        expect(supportResponse.status).toBe(200);
      }
      let finalEvidence = '';
      for (const turnNumber of [1, 2, 3]) {
        const response = await turnRoute.POST({
          params: { id: 'mission-order-restaurant' },
          request: turnRequest({
            attemptId: started.attemptId,
            turnNumber,
            clientResponseId: `${prefix}-${turnNumber}`,
            englishSupportRevealed: false,
          }),
          cookies: cookies(),
        } as never);
        const payload = await response.json();
        finalEvidence = payload.result?.evidenceState ?? finalEvidence;
      }
      return finalEvidence;
    }

    await expect(completeAttempt('independent', false)).resolves.toBe('independent');
    await expect(completeAttempt('supported', true)).resolves.toBe('supported');

    const spoken = await import('$lib/server/spoken-missions-db');
    await expect(
      spoken.getBestSpokenMissionEvidence('user-1', 'mission-order-restaurant'),
    ).resolves.toBe('independent');
  });
});
