import { mount, tick, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recorderStart: vi.fn(),
  requestEnglishSupport: vi.fn(),
  requestStart: vi.fn(),
  requestWrittenSupport: vi.fn(),
  speak: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('./spoken-mission-client', () => ({
  requestSpokenMissionStart: mocks.requestStart,
  requestSpokenMissionEnglishSupport: mocks.requestEnglishSupport,
  requestSpokenMissionWrittenSupport: mocks.requestWrittenSupport,
  requestSpokenMissionTurn: vi.fn(),
  SpokenMissionTurnRequestError: class extends Error {},
}));

vi.mock('$lib/utils/audio-recorder', () => ({
  createAudioRecorder: () => ({
    start: mocks.recorderStart,
    stop: vi.fn(),
    cancel: vi.fn(),
    retry: vi.fn(),
    dispose: vi.fn(),
  }),
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
  Object.values(mocks).forEach((mock) => mock.mockReset());
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
