import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import SpokenMissionBriefing from './SpokenMissionBriefing.svelte';
import SpokenMissionHistory from './SpokenMissionHistory.svelte';
import SpokenMissionResult from './SpokenMissionResult.svelte';
import SpokenMissionTurn from './SpokenMissionTurn.svelte';
import type {
  SpokenMissionResult as SpokenMissionResultData,
  SpokenMissionHistoryEntry,
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

const history: SpokenMissionHistoryEntry[] = [
  {
    goalKey: 'order',
    goalTitle: 'Order',
    turnNumber: 1,
    npcDialogue: {
      japanese: 'ご注文はお決まりですか。',
      romaji: 'go-chuumon wa okimari desu ka.',
    },
    assessment: {
      transcript: 'ラーメンを一つお願いします。',
      outcome: 'accepted',
      confidence: 'high',
      feedback: 'You clearly ordered one ramen.',
    },
    supportUsed: false,
    assessedAt: '2026-07-13T12:00:00.000Z',
  },
];

function renderTurn(input: {
  supportRevealed: boolean;
  attemptSupportUsed: boolean;
  submissionState?: 'idle' | 'processing' | 'feedback' | 'error';
  submissionRecovery?: 'retry_upload' | 'record_again' | 'none';
  hasPendingAudio?: boolean;
  recorderStatus?:
    | 'idle'
    | 'requesting_permission'
    | 'recording'
    | 'stopping'
    | 'error'
    | 'unsupported';
  recorderError?: string;
  errorMessage?: string;
}): string {
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
      recorderStatus: input.recorderStatus ?? 'idle',
      recordingSeconds: 0,
      submissionState: input.submissionState ?? 'idle',
      submissionRecovery: input.submissionRecovery ?? 'none',
      canRecord: true,
      audioPlaying: false,
      recorderError: input.recorderError ?? '',
      errorMessage: input.errorMessage ?? '',
      hasPendingAudio: input.hasPendingAudio ?? false,
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
  it('offers resume and Start over while explaining the saved progress', () => {
    const html = render(SpokenMissionBriefing, {
      props: {
        briefing: {
          canDo: 'I can complete the restaurant task.',
          situation: 'At a restaurant.',
          assessment: 'Intent is assessed, not accent.',
          privacy: 'Raw audio is discarded.',
          approximateMinutes: 2,
          maxRecordingSeconds: 12,
          goals: [
            { key: 'order', title: 'Order', learnerGoal: 'Order ramen.' },
            { key: 'respond', title: 'Respond', learnerGoal: 'Answer a follow-up.' },
            { key: 'repair', title: 'Repair', learnerGoal: 'Correct a mistake.' },
          ],
        },
        bestEvidence: 'independent',
        resumable: { currentTurn: 2, completedGoalCount: 1 },
        errorMessage: '',
        onStart: vi.fn(),
        onChooseWritten: vi.fn(),
      },
    }).body;

    expect(html).toContain('Resume goal 2');
    expect(html).toContain('Start over');
    expect(html).toContain('1 of 3 goals complete');
    expect(html).toMatch(/transcript and feedback will be\s+restored/);
  });

  it('renders the stored conversation transcript and assessment on resume', () => {
    const html = render(SpokenMissionHistory, { props: { history } }).body;

    expect(html).toContain('Restored conversation');
    expect(html).toContain('ご注文はお決まりですか。');
    expect(html).toContain('ラーメンを一つお願いします。');
    expect(html).toContain('Accepted');
    expect(html).toContain('You clearly ordered one ramen.');
  });

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

  it('offers the recovery that matches the failure and always keeps Written Mission available', () => {
    const invalidAudio = renderTurn({
      supportRevealed: false,
      attemptSupportUsed: false,
      submissionState: 'error',
      submissionRecovery: 'record_again',
      errorMessage: 'Unsupported audio format. Please try recording again.',
    });
    expect(invalidAudio).toContain('Record again');
    expect(invalidAudio).not.toContain('Retry upload');
    expect(invalidAudio).toContain('Use Written Mission');

    const networkFailure = renderTurn({
      supportRevealed: false,
      attemptSupportUsed: false,
      submissionState: 'error',
      submissionRecovery: 'retry_upload',
      hasPendingAudio: true,
      errorMessage: 'Could not reach the assessment service. Your attempt is saved.',
    });
    expect(networkFailure).toContain('Retry upload');
    expect(networkFailure).not.toContain('Record again');
    expect(networkFailure).toContain('Use Written Mission');
  });

  it('offers Written Mission after microphone denial or unsupported recording', () => {
    const permissionDenied = renderTurn({
      supportRevealed: false,
      attemptSupportUsed: false,
      recorderStatus: 'error',
      recorderError: 'Microphone permission was denied. Retry recording or use Written Mission.',
    });
    expect(permissionDenied).toContain('Microphone permission was denied');
    expect(permissionDenied).toContain('Record response');
    expect(permissionDenied).toContain('Use Written Mission');

    const unsupported = renderTurn({
      supportRevealed: false,
      attemptSupportUsed: false,
      recorderStatus: 'unsupported',
      recorderError: 'This browser cannot record a supported WebM or MP4 audio format.',
    });
    expect(unsupported).toContain('cannot record a supported WebM or MP4 audio format');
    expect(unsupported).not.toContain('Record response');
    expect(unsupported).toContain('Use Written Mission');
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
