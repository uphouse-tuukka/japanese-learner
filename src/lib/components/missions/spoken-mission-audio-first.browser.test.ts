import { mount, tick, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';

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

const briefing = {
  canDo: 'I can manage a short order conversation in a restaurant.',
  situation: 'You are ordering at a busy ramen restaurant.',
  assessment: 'Communicative intent is assessed, not accent.',
  evidence: 'English listening support produces Supported evidence.',
  privacy: 'Raw audio is discarded after assessment.',
  approximateMinutes: 2,
  maxRecordingSeconds: 12,
  goals: [
    { key: 'order' as const, title: 'Order' },
    { key: 'respond' as const, title: 'Respond' },
    { key: 'repair' as const, title: 'Repair' },
  ],
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

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  mocks.onRecordingReady = null;
  vi.resetAllMocks();
});

it('keeps the restaurant turn audio-first until each support action is chosen', async () => {
  mocks.requestStart.mockResolvedValue({
    attemptId: 'spokenmission-v2',
    definitionVersion: 'restaurant-order-v2',
    supportPolicy: {
      englishListeningSupport: 'optional',
      evidenceWithoutEnglishSupport: 'independent',
      evidenceWithEnglishSupport: 'supported',
    },
    briefing,
    turn: {
      turnNumber: 1,
      goalKey: 'order',
      goalTitle: 'Order',
      npcDialogue: {
        japanese: 'ご注文はお決まりですか。',
        romaji: 'go-chuumon wa okimari desu ka.',
      },
    },
    history: [],
    totalTurns: 3,
    resumed: false,
    supportUsed: false,
    currentTurnEnglishSupportRevealed: false,
    currentTurnEnglishSupport: null,
    currentTurnWrittenSupportRevealed: false,
  });
  mocks.speak.mockImplementation(async (_text, options) => {
    options?.onPlaybackStart?.();
  });
  mocks.requestWrittenSupport.mockResolvedValue({
    writtenText: {
      japanese: 'ご注文はお決まりですか。',
      romaji: 'go-chuumon wa okimari desu ka.',
    },
    writtenSupportRevealed: true,
  });
  mocks.requestEnglishSupport.mockResolvedValue({
    englishSupport: 'Are you ready to order?',
    supportUsed: true,
  });

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

    expect(document.body.textContent).not.toContain('ご注文はお決まりですか。');
    expect(document.body.textContent).not.toContain('go-chuumon wa okimari desu ka.');

    button('Listen').click();
    await settle();
    expect(mocks.speak).toHaveBeenCalledWith(
      'ご注文はお決まりですか。',
      expect.objectContaining({ preferBrowser: false }),
    );
    expect(mocks.recorderStart).not.toHaveBeenCalled();

    button('Reveal written text').click();
    await settle();
    expect(document.body.textContent).toContain('ご注文はお決まりですか。');
    expect(document.body.textContent).toContain('go-chuumon wa okimari desu ka.');
    expect(document.body.textContent).not.toContain('Are you ready to order?');

    button('Reveal English support').click();
    await settle();
    expect(document.body.textContent).toContain('Are you ready to order?');
    expect(mocks.recorderStart).not.toHaveBeenCalled();
  } finally {
    await unmount(component);
  }
});

it('cancels a loading server line when the learner advances turns', async () => {
  const firstTurn = {
    turnNumber: 1,
    goalKey: 'order' as const,
    goalTitle: 'Order',
    npcDialogue: {
      japanese: 'ご注文はお決まりですか。',
      romaji: 'go-chuumon wa okimari desu ka.',
    },
  };
  const secondTurn = {
    turnNumber: 2,
    goalKey: 'respond' as const,
    goalTitle: 'Respond',
    npcDialogue: {
      japanese: 'お飲み物はいかがですか。',
      romaji: 'o-nomimono wa ikaga desu ka.',
    },
  };
  mocks.requestStart.mockResolvedValue({
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
  });
  mocks.requestTurn.mockResolvedValue({
    assessment: {
      transcript: 'ラーメンを一つお願いします。',
      outcome: 'accepted',
      confidence: 'high',
      feedback: 'You ordered one ramen.',
    },
    nextTurn: secondTurn,
    isComplete: false,
    result: null,
  });

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
    button('Listen').click();
    await settle();

    expect(button('Loading audio…').disabled).toBe(true);
    mocks.onRecordingReady?.({ audio: new Blob(['audio']), mimeType: 'audio/webm' });
    await settle();
    button('Continue').click();
    await settle();

    expect(playbackSignal?.aborted).toBe(true);
    expect(button('Listen').disabled).toBe(false);
    expect(document.body.textContent).not.toContain('Japanese audio is playing.');
  } finally {
    await unmount(component);
  }
});

it('ignores written support that resolves after the learner advances turns', async () => {
  const firstTurn = {
    turnNumber: 1,
    goalKey: 'order' as const,
    goalTitle: 'Order',
    npcDialogue: {
      japanese: 'ご注文はお決まりですか。',
      romaji: 'go-chuumon wa okimari desu ka.',
    },
  };
  const secondTurn = {
    turnNumber: 2,
    goalKey: 'respond' as const,
    goalTitle: 'Respond',
    npcDialogue: {
      japanese: 'お飲み物はいかがですか。',
      romaji: 'o-nomimono wa ikaga desu ka.',
    },
  };
  mocks.requestStart.mockResolvedValue({
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
  });
  mocks.requestTurn.mockResolvedValue({
    assessment: {
      transcript: 'ラーメンを一つお願いします。',
      outcome: 'accepted',
      confidence: 'high',
      feedback: 'You ordered one ramen.',
    },
    nextTurn: secondTurn,
    isComplete: false,
    result: null,
  });

  type WrittenSupportResponse = {
    writtenText: { japanese: string; romaji: string };
    writtenSupportRevealed: true;
  };
  let resolveFirstWrittenSupport!: (value: WrittenSupportResponse) => void;
  let resolveSecondWrittenSupport!: (value: WrittenSupportResponse) => void;
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
  } finally {
    await unmount(component);
  }
});
