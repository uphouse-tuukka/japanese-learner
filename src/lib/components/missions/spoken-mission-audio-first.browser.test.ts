import { mount, tick, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import type {
  SpokenMissionBriefing,
  SpokenMissionEvidenceResult,
  SpokenMissionServerTurn,
  SpokenMissionSkipResponse,
  SpokenMissionStartResponse,
  SpokenMissionSupportResponse,
  SpokenMissionTurnResponse,
  SpokenMissionWrittenSupportResponse,
} from '$lib/types';

const mocks = vi.hoisted(() => ({
  recorderStart: vi.fn(),
  onRecordingReady: null as null | ((recording: { audio: Blob; mimeType: string }) => void),
  requestEnglishSupport: vi.fn(),
  requestSkip: vi.fn(),
  requestStart: vi.fn(),
  requestTurn: vi.fn(),
  requestWrittenSupport: vi.fn(),
  speak: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('./spoken-mission-client', () => ({
  requestSpokenMissionStart: mocks.requestStart,
  requestSpokenMissionSkip: mocks.requestSkip,
  requestSpokenMissionEnglishSupport: mocks.requestEnglishSupport,
  requestSpokenMissionWrittenSupport: mocks.requestWrittenSupport,
  requestSpokenMissionTurn: mocks.requestTurn,
  SpokenMissionTurnRequestError: class extends Error {},
}));

vi.mock('$lib/utils/audio-recorder', () => ({
  createAudioRecorder: (options: {
    onRecordingReady: (recording: { audio: Blob; mimeType: string }) => void;
  }) => {
    mocks.onRecordingReady = options.onRecordingReady;
    return {
      start: mocks.recorderStart,
      stop: vi.fn(),
      cancel: vi.fn(),
      retry: vi.fn(),
      dispose: vi.fn(),
    };
  },
}));

vi.mock('$lib/utils/tts', () => ({
  speak: mocks.speak,
  stop: mocks.stop,
}));

import SpokenMission from './SpokenMission.svelte';

const briefing: SpokenMissionBriefing = {
  canDo: 'I can manage a short order conversation in a restaurant.',
  situation: 'You are ordering at a busy ramen restaurant.',
  assessment: 'Communicative intent is assessed, not accent.',
  evidence: 'English listening support produces Supported evidence.',
  privacy: 'Raw audio is discarded after assessment.',
  approximateMinutes: 2,
  maxRecordingSeconds: 12,
  goals: [
    { key: 'order', title: 'Order' },
    { key: 'respond', title: 'Respond' },
    { key: 'repair', title: 'Repair' },
  ],
};

const firstTurn: SpokenMissionServerTurn = {
  turnNumber: 1,
  goalKey: 'order',
  goalTitle: 'Order',
  npcDialogue: {
    japanese: 'ご注文はお決まりですか。',
    romaji: 'go-chuumon wa okimari desu ka.',
  },
};

const secondTurn: SpokenMissionServerTurn = {
  turnNumber: 2,
  goalKey: 'respond',
  goalTitle: 'Respond',
  npcDialogue: {
    japanese: 'お飲み物はいかがですか。',
    romaji: 'o-nomimono wa ikaga desu ka.',
  },
};

const thirdTurn: SpokenMissionServerTurn = {
  turnNumber: 3,
  goalKey: 'repair',
  goalTitle: 'Repair',
  npcDialogue: { japanese: '二つですね。', romaji: 'futatsu desu ne.' },
};

const startPayload: SpokenMissionStartResponse = {
  attemptId: 'spokenmission-v3',
  definitionVersion: 'restaurant-order-v3',
  supportPolicy: {
    englishListeningSupport: 'optional',
    evidenceWithoutEnglishSupport: 'independent',
    evidenceWithEnglishSupport: 'supported',
  },
  briefing,
  turn: firstTurn,
  history: [],
  totalTurns: 3,
  resumed: false,
  supportUsed: false,
  currentTurnEnglishSupportRevealed: false,
  currentTurnEnglishSupport: null,
  currentTurnWrittenSupportRevealed: false,
};

const acceptedTurn: SpokenMissionTurnResponse = {
  duplicate: false,
  assessment: {
    transcript: 'ラーメンを一つお願いします。',
    outcome: 'accepted',
    confidence: 'high',
    feedback: 'You ordered one ramen.',
    retrySuggestion: null,
  },
  nextTurn: secondTurn,
  isComplete: false,
  result: null,
};

function evidenceResult(
  evidenceState: SpokenMissionEvidenceResult['evidenceState'],
): SpokenMissionEvidenceResult {
  return {
    kind: 'evidence',
    evidenceState,
    canDo: briefing.canDo,
    goals: [
      {
        goalKey: 'order',
        title: 'Order',
        turnNumber: 1,
        npcJapanese: firstTurn.npcDialogue.japanese,
        npcRomaji: firstTurn.npcDialogue.romaji,
        transcript: 'ラーメンを一つお願いします。',
        outcome: 'accepted',
        confidence: 'high',
        feedback: 'You ordered one ramen.',
        supportUsed: evidenceState === 'supported',
        writtenSupportRevealed: evidenceState === 'independent',
        clientResponseId: 'response-1',
        assessedAt: '2026-07-17T09:00:00.000Z',
      },
      {
        goalKey: 'respond',
        title: 'Respond',
        turnNumber: 2,
        npcJapanese: secondTurn.npcDialogue.japanese,
        npcRomaji: secondTurn.npcDialogue.romaji,
        transcript: 'お水でお願いします。',
        outcome: 'accepted',
        confidence: 'high',
        feedback: 'You requested water.',
        supportUsed: false,
        writtenSupportRevealed: false,
        clientResponseId: 'response-2',
        assessedAt: '2026-07-17T09:01:00.000Z',
      },
      {
        goalKey: 'repair',
        title: 'Repair',
        turnNumber: 3,
        npcJapanese: thirdTurn.npcDialogue.japanese,
        npcRomaji: thirdTurn.npcDialogue.romaji,
        transcript: 'いいえ、一つです。',
        outcome: 'accepted',
        confidence: 'high',
        feedback: 'You corrected the order.',
        supportUsed: false,
        writtenSupportRevealed: false,
        clientResponseId: 'response-3',
        assessedAt: '2026-07-17T09:02:00.000Z',
      },
    ],
    suggestedPhrase: {
      japanese: 'すみません、ラーメンは一つです。',
      romaji: 'sumimasen, raamen wa hitotsu desu.',
      english: 'Sorry, it is one ramen.',
    },
  };
}

function acceptedResponse(
  nextTurn: SpokenMissionServerTurn | null,
  result: SpokenMissionEvidenceResult | null = null,
): SpokenMissionTurnResponse {
  return {
    duplicate: false,
    assessment: {
      transcript: 'ラーメンを一つお願いします。',
      outcome: 'accepted',
      confidence: 'high',
      feedback: 'The response completed this goal.',
      retrySuggestion: null,
    },
    nextTurn,
    isComplete: result !== null,
    result,
  };
}

function button(label: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === label,
  );
  if (!match) throw new Error(`Expected visible button: ${label}`);
  return match;
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await tick();
  await Promise.resolve();
  await tick();
}

async function withStartedMission(run: () => Promise<void>): Promise<void> {
  mocks.requestStart.mockResolvedValue(startPayload);
  const component = mount(SpokenMission, {
    target: document.body,
    props: {
      missionId: 'mission-order-restaurant',
      userId: 'user-1',
      briefing,
      bestEvidence: 'untried',
      resumable: null,
      onChooseWritten: vi.fn(),
    },
  });

  try {
    button('Start Spoken Mission').click();
    await settle();
    await run();
  } finally {
    await unmount(component);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  mocks.onRecordingReady = null;
  vi.resetAllMocks();
});

it('keeps the restaurant turn audio-first until each support action is chosen', async () => {
  mocks.speak.mockImplementation(async (_text, options) => {
    options?.onPlaybackStart?.();
  });
  mocks.requestWrittenSupport.mockResolvedValue({
    writtenText: firstTurn.npcDialogue,
    writtenSupportRevealed: true,
  } satisfies SpokenMissionWrittenSupportResponse);
  mocks.requestEnglishSupport.mockResolvedValue({
    englishSupport: 'Are you ready to order?',
    supportUsed: true,
  } satisfies SpokenMissionSupportResponse);

  await withStartedMission(async () => {
    expect(document.body.textContent).not.toContain(firstTurn.npcDialogue.japanese);
    expect(document.body.textContent).not.toContain(firstTurn.npcDialogue.romaji);

    button('Listen').click();
    await settle();
    expect(mocks.speak).toHaveBeenCalledWith(
      firstTurn.npcDialogue.japanese,
      expect.objectContaining({ preferBrowser: false }),
    );
    expect(mocks.recorderStart).not.toHaveBeenCalled();

    button('Reveal written text').click();
    await settle();
    expect(document.body.textContent).toContain(firstTurn.npcDialogue.japanese);
    expect(document.body.textContent).toContain(firstTurn.npcDialogue.romaji);
    expect(document.body.textContent).not.toContain('Are you ready to order?');

    button('Reveal English support').click();
    await settle();
    expect(document.body.textContent).toContain('Are you ready to order?');
    expect(mocks.recorderStart).not.toHaveBeenCalled();
  });
});

it('cancels a loading server line when the learner advances turns', async () => {
  let resolveTurn!: (value: SpokenMissionTurnResponse) => void;
  mocks.requestTurn.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveTurn = resolve;
      }),
  );

  let playbackSignal: AbortSignal | undefined;
  mocks.speak.mockImplementation(
    (_text, options) =>
      new Promise<void>((_resolve, reject) => {
        playbackSignal = options?.signal;
        playbackSignal?.addEventListener('abort', () => reject(playbackSignal?.reason), {
          once: true,
        });
      }),
  );

  await withStartedMission(async () => {
    button('Listen').click();
    await settle();

    expect(button('Loading audio…').disabled).toBe(true);
    mocks.onRecordingReady?.({ audio: new Blob(['audio']), mimeType: 'audio/webm' });
    await settle();

    expect(button('Reveal written text').disabled).toBe(true);
    expect(button('Reveal English support').disabled).toBe(true);
    button('Reveal written text').click();
    button('Reveal English support').click();
    expect(mocks.requestWrittenSupport).not.toHaveBeenCalled();
    expect(mocks.requestEnglishSupport).not.toHaveBeenCalled();

    resolveTurn(acceptedTurn);
    await settle();
    expect(button('Reveal written text').disabled).toBe(true);
    expect(button('Reveal English support').disabled).toBe(true);
    button('Continue').click();
    await settle();

    expect(playbackSignal?.aborted).toBe(true);
    expect(button('Listen').disabled).toBe(false);
    expect(document.body.textContent).not.toContain('Japanese audio is playing.');
  });
});

it('ignores written support that resolves after the learner advances turns', async () => {
  mocks.requestTurn.mockResolvedValue(acceptedTurn);

  let resolveFirstWrittenSupport!: (value: SpokenMissionWrittenSupportResponse) => void;
  let resolveSecondWrittenSupport!: (value: SpokenMissionWrittenSupportResponse) => void;
  mocks.requestWrittenSupport
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstWrittenSupport = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecondWrittenSupport = resolve;
        }),
    );

  await withStartedMission(async () => {
    button('Reveal written text').click();
    await settle();
    mocks.onRecordingReady?.({ audio: new Blob(['audio']), mimeType: 'audio/webm' });
    await settle();
    button('Continue').click();
    await settle();
    button('Reveal written text').click();
    await settle();

    resolveFirstWrittenSupport({
      writtenText: firstTurn.npcDialogue,
      writtenSupportRevealed: true,
    });
    await settle();

    expect(document.body.textContent).toContain('Goal 2 of 3');
    expect(document.body.textContent).not.toContain(firstTurn.npcDialogue.japanese);
    expect(document.body.textContent).not.toContain(firstTurn.npcDialogue.romaji);
    expect(button('Revealing written text…').disabled).toBe(true);

    resolveSecondWrittenSupport({
      writtenText: secondTurn.npcDialogue,
      writtenSupportRevealed: true,
    });
    await settle();

    expect(document.body.textContent).toContain(secondTurn.npcDialogue.japanese);
    expect(document.body.textContent).toContain(secondTurn.npcDialogue.romaji);
  });
});

it('retains delayed English support use after the learner advances turns', async () => {
  mocks.requestTurn.mockResolvedValue(acceptedTurn);

  let resolveEnglishSupport!: (value: SpokenMissionSupportResponse) => void;
  mocks.requestEnglishSupport.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveEnglishSupport = resolve;
      }),
  );

  await withStartedMission(async () => {
    button('Reveal English support').click();
    await settle();
    mocks.onRecordingReady?.({ audio: new Blob(['audio']), mimeType: 'audio/webm' });
    await settle();
    button('Continue').click();
    await settle();

    resolveEnglishSupport({
      englishSupport: 'Are you ready to order?',
      supportUsed: true,
    });
    await settle();

    expect(document.body.textContent).toContain('Goal 2 of 3');
    expect(document.body.textContent).toContain(
      'English support was used earlier in this attempt. Completion will be Supported.',
    );
    expect(document.body.textContent).not.toContain('Are you ready to order?');
  });
});

it('completes with Independent evidence after written support and three accepted goals', async () => {
  mocks.requestWrittenSupport.mockResolvedValue({
    writtenText: firstTurn.npcDialogue,
    writtenSupportRevealed: true,
  } satisfies SpokenMissionWrittenSupportResponse);
  mocks.requestTurn
    .mockResolvedValueOnce(acceptedResponse(secondTurn))
    .mockResolvedValueOnce(acceptedResponse(thirdTurn))
    .mockResolvedValueOnce(acceptedResponse(null, evidenceResult('independent')));

  await withStartedMission(async () => {
    button('Reveal written text').click();
    await settle();
    expect(document.body.textContent).toContain(firstTurn.npcDialogue.japanese);
    expect(document.body.textContent).toContain(firstTurn.npcDialogue.romaji);

    mocks.onRecordingReady?.({ audio: new Blob(['first']), mimeType: 'audio/webm' });
    await settle();
    button('Continue').click();
    await settle();
    mocks.onRecordingReady?.({ audio: new Blob(['second']), mimeType: 'audio/webm' });
    await settle();
    button('Continue').click();
    await settle();
    mocks.onRecordingReady?.({ audio: new Blob(['third']), mimeType: 'audio/webm' });
    await settle();

    expect(document.body.textContent).toContain('Independent evidence');
    expect(document.body.textContent).toContain(
      'You completed all three goals without English listening support.',
    );
    expect(document.activeElement?.textContent).toContain('Independent evidence');
    const firstSubmission = mocks.requestTurn.mock.calls[0]?.[0].form as FormData;
    expect(firstSubmission.get('englishSupportRevealed')).toBe('false');
  });
});

it('completes with Supported evidence after English listening support', async () => {
  mocks.requestEnglishSupport.mockResolvedValue({
    englishSupport: 'Are you ready to order?',
    supportUsed: true,
  } satisfies SpokenMissionSupportResponse);
  mocks.requestTurn
    .mockResolvedValueOnce(acceptedResponse(secondTurn))
    .mockResolvedValueOnce(acceptedResponse(thirdTurn))
    .mockResolvedValueOnce(acceptedResponse(null, evidenceResult('supported')));

  await withStartedMission(async () => {
    button('Reveal English support').click();
    await settle();
    expect(document.body.textContent).toContain('Are you ready to order?');

    mocks.onRecordingReady?.({ audio: new Blob(['first']), mimeType: 'audio/webm' });
    await settle();
    button('Continue').click();
    await settle();
    mocks.onRecordingReady?.({ audio: new Blob(['second']), mimeType: 'audio/webm' });
    await settle();
    button('Continue').click();
    await settle();
    mocks.onRecordingReady?.({ audio: new Blob(['third']), mimeType: 'audio/webm' });
    await settle();

    expect(document.body.textContent).toContain('Supported evidence');
    expect(document.body.textContent).toContain(
      'You used English listening support during this attempt, so this evidence is Supported.',
    );
    const firstSubmission = mocks.requestTurn.mock.calls[0]?.[0].form as FormData;
    expect(firstSubmission.get('englishSupportRevealed')).toBe('true');
  });
});

it('keeps technical assessment recovery separate from semantic retry coaching', async () => {
  mocks.requestTurn.mockResolvedValue({
    duplicate: false,
    assessment: {
      transcript: '',
      outcome: 'could_not_assess',
      confidence: 'low',
      feedback: 'The recording was not clear enough to assess.',
      retrySuggestion: null,
    },
    nextTurn: null,
    isComplete: false,
    result: null,
  } satisfies SpokenMissionTurnResponse);

  await withStartedMission(async () => {
    mocks.onRecordingReady?.({ audio: new Blob(['unclear']), mimeType: 'audio/webm' });
    await settle();

    expect(document.body.textContent).toContain('Could not assess');
    expect(document.body.textContent).toContain('The recording was not clear enough to assess.');
    expect(document.body.textContent).not.toContain('Try saying');
    expect(document.body.textContent).not.toContain('Skip goal');
    expect(button('Record again')).toBeDefined();
    expect(document.activeElement?.textContent).toContain('Could not assess');
  });
});

it('continues after a semantic retry is skipped and finishes with an incomplete result', async () => {
  mocks.requestTurn
    .mockResolvedValueOnce({
      duplicate: false,
      assessment: {
        transcript: 'さようなら',
        outcome: 'retry',
        confidence: 'high',
        feedback: 'The response did not place an order.',
        retrySuggestion: {
          japanese: 'ラーメンを一つお願いします。',
          romaji: 'raamen o hitotsu onegaishimasu.',
        },
      },
      nextTurn: null,
      isComplete: false,
      result: null,
    } satisfies SpokenMissionTurnResponse)
    .mockResolvedValueOnce({ ...acceptedTurn, nextTurn: thirdTurn })
    .mockResolvedValueOnce({
      duplicate: false,
      assessment: {
        transcript: 'いいえ、一つです。',
        outcome: 'accepted',
        confidence: 'high',
        feedback: 'You corrected the order.',
        retrySuggestion: null,
      },
      nextTurn: null,
      isComplete: true,
      result: {
        kind: 'incomplete',
        canDo: briefing.canDo,
        goals: [
          { goalKey: 'order', title: 'Order', status: 'skipped' },
          { goalKey: 'respond', title: 'Respond', status: 'accepted' },
          { goalKey: 'repair', title: 'Repair', status: 'accepted' },
        ],
      },
    } satisfies SpokenMissionTurnResponse);
  const skipPayload: SpokenMissionSkipResponse = {
    duplicate: false,
    nextTurn: secondTurn,
    history: [
      {
        kind: 'assessment',
        goalKey: 'order',
        goalTitle: 'Order',
        turnNumber: 1,
        npcDialogue: firstTurn.npcDialogue,
        assessment: {
          transcript: 'さようなら',
          outcome: 'retry',
          confidence: 'high',
          feedback: 'The response did not place an order.',
        },
        supportUsed: false,
        writtenSupportRevealed: false,
        assessedAt: '2026-07-17T09:00:00.000Z',
      },
      {
        kind: 'skipped',
        goalKey: 'order',
        goalTitle: 'Order',
        turnNumber: 1,
        npcDialogue: firstTurn.npcDialogue,
        supportUsed: false,
        writtenSupportRevealed: false,
        skippedAt: '2026-07-17T09:01:00.000Z',
      },
    ],
    isComplete: false,
    result: null,
  };
  let resolveSkip!: (value: SpokenMissionSkipResponse) => void;
  mocks.requestSkip.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveSkip = resolve;
      }),
  );

  await withStartedMission(async () => {
    mocks.onRecordingReady?.({ audio: new Blob(['first']), mimeType: 'audio/webm' });
    await settle();
    expect(document.body.textContent).toContain('ラーメンを一つお願いします。');
    expect(document.body.textContent).toContain('raamen o hitotsu onegaishimasu.');
    const retrySuggestion = document.querySelector<HTMLElement>('.retry-suggestion');
    expect(retrySuggestion?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Try saying ラーメンを一つお願いします。 raamen o hitotsu onegaishimasu.',
    );
    const retryActions = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.retry-actions button'),
    );
    expect(retryActions.map((action) => action.textContent?.trim())).toEqual([
      'Record again',
      'Skip goal',
    ]);
    expect(retryActions[0]?.classList.contains('btn-primary')).toBe(true);
    expect(retryActions[1]?.classList.contains('btn-ghost')).toBe(true);
    expect(document.body.textContent?.replace(/\s+/g, ' ')).not.toContain('Skip goal >');
    expect(document.activeElement?.textContent).toContain('Try this goal again');

    button('Skip goal').click();
    await settle();
    expect(document.body.textContent).toContain('Skipping goal…');
    expect(document.body.textContent).not.toContain('Transcribing and assessing');
    expect(mocks.requestSkip).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId: 'spokenmission-v3',
        turnNumber: 1,
        clientSkipId: expect.any(String),
      }),
    );
    resolveSkip(skipPayload);
    await settle();
    expect(document.body.textContent).toContain('Goal 2 of 3');
    expect(document.body.textContent).toContain('Skipped');
    expect(document.activeElement?.textContent).toContain('Respond');

    mocks.onRecordingReady?.({ audio: new Blob(['second']), mimeType: 'audio/webm' });
    await settle();
    button('Continue').click();
    await settle();
    expect(document.body.textContent).toContain('Goal 3 of 3');

    mocks.onRecordingReady?.({ audio: new Blob(['third']), mimeType: 'audio/webm' });
    await settle();
    expect(document.body.textContent).toContain('Incomplete attempt');
    expect(document.body.textContent).toContain('Your previous best evidence is unchanged.');
    expect(document.activeElement?.textContent).toContain('Incomplete attempt');
    expect(button('Try again')).toBeDefined();
  });
});
