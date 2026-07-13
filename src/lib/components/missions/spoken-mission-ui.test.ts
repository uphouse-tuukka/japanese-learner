import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import SpokenMissionResult from './SpokenMissionResult.svelte';
import SpokenMissionTurn from './SpokenMissionTurn.svelte';
import type {
  SpokenMissionResult as SpokenMissionResultData,
  SpokenMissionServerTurn,
} from '$lib/types';

const serverTurn: SpokenMissionServerTurn = {
  turnNumber: 1,
  goalKey: 'order',
  goalTitle: 'Order',
  npcDialogue: {
    japanese: 'ご注文はお決まりですか。',
    romaji: 'go-chuumon wa okimari desu ka.',
  },
  englishSupport: 'Are you ready to order?',
};

const result: SpokenMissionResultData = {
  evidenceState: 'supported',
  canDo: 'I can complete the restaurant task.',
  goals: [
    {
      goalKey: 'order',
      title: 'Order',
      turnNumber: 1,
      npcJapanese: 'ご注文はお決まりですか。',
      npcRomaji: 'go-chuumon wa okimari desu ka.',
      transcript: 'ラーメンを一つお願いします。',
      outcome: 'accepted',
      confidence: 'high',
      feedback: 'You ordered one ramen.',
      supportUsed: true,
      clientResponseId: 'response-1',
      assessedAt: '2026-07-13T12:00:00.000Z',
    },
    {
      goalKey: 'respond',
      title: 'Respond',
      turnNumber: 2,
      npcJapanese: 'お飲み物はいかがですか。',
      npcRomaji: 'o-nomimono wa ikaga desu ka.',
      transcript: 'お水でお願いします。',
      outcome: 'accepted',
      confidence: 'high',
      feedback: 'You answered the question.',
      supportUsed: false,
      clientResponseId: 'response-2',
      assessedAt: '2026-07-13T12:01:00.000Z',
    },
    {
      goalKey: 'repair',
      title: 'Repair',
      turnNumber: 3,
      npcJapanese: 'チャーシュー麺を二つですね。',
      npcRomaji: 'chaashuumen o futatsu desu ne.',
      transcript: 'いいえ、ラーメン一つです。',
      outcome: 'accepted',
      confidence: 'high',
      feedback: 'You repaired the misunderstanding.',
      supportUsed: false,
      clientResponseId: 'response-3',
      assessedAt: '2026-07-13T12:02:00.000Z',
    },
  ],
  suggestedPhrase: {
    japanese: 'すみません、ラーメンは一つです。',
    romaji: 'sumimasen, raamen wa hitotsu desu.',
    english: 'Sorry, it is one ramen.',
  },
};

function renderTurn(input: { supportRevealed: boolean; attemptSupportUsed: boolean }): string {
  return render(SpokenMissionTurn, {
    props: {
      currentTurn: serverTurn,
      maxRecordingSeconds: 12,
      supportRevealed: input.supportRevealed,
      englishSupport: input.supportRevealed ? serverTurn.englishSupport : null,
      supportDisclosureState: 'idle',
      attemptSupportUsed: input.attemptSupportUsed,
      assessment: null,
      pendingNextTurn: null,
      recorderStatus: 'idle',
      recordingSeconds: 0,
      submissionState: 'idle',
      canRecord: true,
      audioPlaying: false,
      recorderError: '',
      errorMessage: '',
      hasPendingAudio: false,
      onPlayServerLine: vi.fn(),
      onRevealSupport: vi.fn(),
      onContinue: vi.fn(),
      onRetryGoal: vi.fn(),
      onStartRecording: vi.fn(),
      onStopRecording: vi.fn(),
      onCancelRecording: vi.fn(),
      onRetryUpload: vi.fn(),
      onChooseWritten: vi.fn(),
    },
  }).body;
}

describe('Spoken Mission learner-visible support UI', () => {
  it('offers optional English help and clearly marks the attempt after disclosure', () => {
    const hidden = renderTurn({ supportRevealed: false, attemptSupportUsed: false });
    expect(hidden).toContain('ご注文はお決まりですか。');
    expect(hidden).toContain('go-chuumon wa okimari desu ka.');
    expect(hidden).toContain('Replay Japanese');
    expect(hidden).toContain('Reveal English support');
    expect(hidden).not.toContain('Are you ready to order?');

    const revealed = renderTurn({ supportRevealed: true, attemptSupportUsed: true });
    expect(revealed).toContain('English support used');
    expect(revealed).toContain('Are you ready to order?');

    const laterTurn = renderTurn({ supportRevealed: false, attemptSupportUsed: true });
    expect(laterTurn).toContain(
      'English support was used earlier in this attempt. Completion will be Supported.',
    );
  });

  it('explains Supported evidence while retaining every goal and the fresh-practice phrase', () => {
    const html = render(SpokenMissionResult, {
      props: { result, onTryAgain: vi.fn() },
    }).body;

    expect(html).toContain('Supported evidence');
    expect(html).toContain(
      'You used English listening support during this attempt, so this evidence is Supported.',
    );
    expect(html).toContain('Order');
    expect(html).toContain('Respond');
    expect(html).toContain('Repair');
    expect(html).toContain('One phrase to keep fresh');
    expect(html).toContain('すみません、ラーメンは一つです。');

    const independentHtml = render(SpokenMissionResult, {
      props: {
        result: { ...result, evidenceState: 'independent' },
        onTryAgain: vi.fn(),
      },
    }).body;
    expect(independentHtml).toContain('Independent evidence');
    expect(independentHtml).toContain(
      'You completed all three goals without English listening support.',
    );
    expect(independentHtml).toContain('✓ Order');
    expect(independentHtml).toContain('✓ Respond');
    expect(independentHtml).toContain('✓ Repair');
    expect(independentHtml).toContain('One phrase to keep fresh');
    expect(independentHtml).toContain('すみません、ラーメンは一つです。');
  });
});
