import { mount, tick, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import type {
  SpokenMissionBriefing,
  SpokenMissionServerTurn,
  SpokenMissionStartResponse,
  SpokenMissionSupportResponse,
  SpokenMissionTurnResponse,
  SpokenMissionWrittenSupportResponse,
} from '$lib/types';

const mocks = vi.hoisted(() => ({
  recorderStart: vi.fn(),
  onRecordingReady: null as null | ((recording: { audio: Blob; mimeType: string }) => void),
  requestEnglishSupport: vi.fn(),
  requestStart: vi.fn(),
  requestTurn: vi.fn(),
  requestWrittenSupport: vi.fn(),
  speak: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('./spoken-mission-client', () => ({
  requestSpokenMissionStart: mocks.requestStart,
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

const startPayload: SpokenMissionStartResponse = {
  attemptId: 'spokenmission-v2',
  definitionVersion: 'restaurant-order-v2',
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
  },
  nextTurn: secondTurn,
  isComplete: false,
  result: null,
};

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
