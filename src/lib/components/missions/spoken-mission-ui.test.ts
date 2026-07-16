import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import SpokenMissionBriefing from './SpokenMissionBriefing.svelte';
import SpokenMissionChoiceStatus from './SpokenMissionChoiceStatus.svelte';
import SpokenMissionHistory from './SpokenMissionHistory.svelte';
import SpokenMissionResult from './SpokenMissionResult.svelte';
import SpokenMissionTurn from './SpokenMissionTurn.svelte';
import {
  createSpokenMissionTurnProps,
  spokenMissionEnglishSupport,
  spokenMissionServerTurn,
  type SpokenMissionTurnFixtureInput,
} from './spoken-mission-turn.test-fixtures';
import type {
  SpokenMissionResult as SpokenMissionResultData,
  SpokenMissionAssessment,
  SpokenMissionHistoryEntry,
} from '$lib/types';

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
    writtenSupportRevealed: true,
    assessedAt: '2026-07-13T12:00:00.000Z',
  },
];

function renderTurn(input: SpokenMissionTurnFixtureInput): string {
  return render(SpokenMissionTurn, {
    props: createSpokenMissionTurnProps(input),
  }).body;
}

describe('Spoken Mission learner-visible support UI', () => {
  it.each([
    ['untried', 'Untried'],
    ['supported', 'Supported'],
    ['independent', 'Independent'],
  ] as const)(
    'shows %s evidence alongside resumable progress on the mission chooser',
    (bestEvidence, evidenceLabel) => {
      const html = render(SpokenMissionChoiceStatus, {
        props: {
          bestEvidence,
          resumable: { currentTurn: 2, completedGoalCount: 1 },
        },
      }).body;

      expect(html).toContain(`>${evidenceLabel}</span>`);
      expect(html).toContain('Resume goal 2');
      expect(html).toContain(`${evidenceLabel} evidence. Resume at goal 2 of 3.`);
    },
  );

  it('exposes programmatic focus destinations for each changing mission stage', () => {
    const briefingHtml = render(SpokenMissionBriefing, {
      props: {
        briefing: {
          canDo: 'I can complete the restaurant task.',
          situation: 'At a restaurant.',
          assessment: 'Intent is assessed, not accent.',
          evidence:
            'Complete every goal without English listening support for Independent evidence. Using English listening support records Supported evidence.',
          privacy: 'Raw audio is discarded.',
          approximateMinutes: 2,
          maxRecordingSeconds: 12,
          goals: [
            { key: 'order', title: 'Order' },
            { key: 'respond', title: 'Respond' },
            { key: 'repair', title: 'Repair' },
          ],
        },
        bestEvidence: 'untried',
        resumable: null,
        errorMessage: '',
        onStart: vi.fn(),
        onChooseWritten: vi.fn(),
      },
    }).body;
    const turnHtml = renderTurn({
      englishSupportRevealed: false,
      englishSupportUsedDuringAttempt: false,
    });
    const supportHtml = renderTurn({ writtenSupportRevealed: true });
    const feedbackHtml = renderTurn({
      englishSupportRevealed: false,
      englishSupportUsedDuringAttempt: false,
      submissionState: 'feedback',
    });
    const errorHtml = renderTurn({
      englishSupportRevealed: false,
      englishSupportUsedDuringAttempt: false,
      submissionState: 'error',
      errorMessage: 'The network request failed.',
    });
    const resultHtml = render(SpokenMissionResult, {
      props: { result, onTryAgain: vi.fn() },
    }).body;

    expect(briefingHtml).toMatch(/<h2[^>]*id="spoken-heading"[^>]*tabindex="-1"/);
    expect(turnHtml).toMatch(/<h2[^>]*id="turn-heading"[^>]*tabindex="-1"/);
    expect(supportHtml).toMatch(/<div[^>]*class="written-copy[^>]*tabindex="-1"/);
    expect(feedbackHtml).toMatch(/<h3[^>]*class="outcome[^>]*tabindex="-1"/);
    expect(errorHtml).toMatch(/<p[^>]*role="alert"[^>]*tabindex="-1"/);
    expect(resultHtml).toMatch(/<h2[^>]*id="result-heading"[^>]*tabindex="-1"/);
  });

  it('explains retained evidence and the effect of English listening support before recording', () => {
    const html = render(SpokenMissionBriefing, {
      props: {
        briefing: {
          canDo: 'I can complete the restaurant task.',
          situation: 'At a restaurant.',
          assessment: 'Intent is assessed, not accent.',
          evidence:
            'Complete every goal without English listening support for Independent evidence. Using English listening support records Supported evidence.',
          privacy:
            'Transcripts and semantic assessments are retained. Raw audio is discarded after assessment.',
          approximateMinutes: 2,
          maxRecordingSeconds: 12,
          goals: [
            { key: 'order', title: 'Order' },
            { key: 'respond', title: 'Respond' },
            { key: 'repair', title: 'Repair' },
          ],
        },
        bestEvidence: 'untried',
        resumable: null,
        errorMessage: '',
        onStart: vi.fn(),
        onChooseWritten: vi.fn(),
      },
    }).body;

    expect(html).toContain('Transcripts and semantic assessments are retained.');
    expect(html).toContain('Raw audio is discarded after assessment.');
    expect(html).toContain('without English listening support for Independent evidence');
    expect(html).toContain('English listening support records Supported evidence');
  });

  it('offers resume and Start over while explaining the saved progress', () => {
    const html = render(SpokenMissionBriefing, {
      props: {
        briefing: {
          canDo: 'I can complete the restaurant task.',
          situation: 'At a restaurant.',
          assessment: 'Intent is assessed, not accent.',
          evidence:
            'Complete every goal without English listening support for Independent evidence. Using English listening support records Supported evidence.',
          privacy: 'Raw audio is discarded.',
          approximateMinutes: 2,
          maxRecordingSeconds: 12,
          goals: [
            { key: 'order', title: 'Order' },
            { key: 'respond', title: 'Respond' },
            { key: 'repair', title: 'Repair' },
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

  it('keeps unrevealed server text hidden in restored history', () => {
    const html = render(SpokenMissionHistory, {
      props: {
        history: [{ ...history[0], writtenSupportRevealed: false }],
      },
    }).body;

    expect(html).not.toContain(history[0].npcDialogue.japanese);
    expect(html).not.toContain(history[0].npcDialogue.romaji);
    expect(html).toContain(history[0].assessment.transcript);
  });

  it('starts audio-first and reveals written and English support independently', () => {
    const hidden = renderTurn({
      englishSupportRevealed: false,
      englishSupportUsedDuringAttempt: false,
    });
    expect(hidden).not.toContain(spokenMissionServerTurn.npcDialogue.japanese);
    expect(hidden).not.toContain('go-chuumon wa okimari desu ka.');
    expect(hidden).toContain('Listen');
    expect(hidden).toContain('Reveal written text');
    expect(hidden).toContain('Reveal English support');
    expect(hidden).not.toContain('Are you ready to order?');

    const written = renderTurn({ writtenSupportRevealed: true });
    expect(written).toContain(spokenMissionServerTurn.npcDialogue.japanese);
    expect(written).toContain(spokenMissionServerTurn.npcDialogue.romaji);
    expect(written).toContain('Written hint');

    const english = renderTurn({
      englishSupportRevealed: true,
      englishSupportUsedDuringAttempt: true,
    });
    expect(english).toContain('English support used');
    expect(english).toContain(spokenMissionEnglishSupport);

    const laterTurn = renderTurn({
      englishSupportRevealed: false,
      englishSupportUsedDuringAttempt: true,
    });
    expect(laterTurn).toContain(
      'English support was used earlier in this attempt. Completion will be Supported.',
    );
  });

  it.each([
    ['loading', 'Loading audio…'],
    ['playing', 'Stop audio'],
    ['stopped', 'Replay Japanese'],
    ['error', 'Audio unavailable. Try again.'],
  ] as const)('announces the %s server-audio state', (audioStatus, visibleText) => {
    expect(renderTurn({ audioStatus })).toContain(visibleText);
  });

  it('offers the recovery that matches the failure and always keeps Written Mission available', () => {
    const invalidAudio = renderTurn({
      englishSupportRevealed: false,
      englishSupportUsedDuringAttempt: false,
      submissionState: 'error',
      submissionRecovery: 'record_again',
      errorMessage: 'Unsupported audio format. Please try recording again.',
    });
    expect(invalidAudio).toContain('Record again');
    expect(invalidAudio).not.toContain('Retry upload');
    expect(invalidAudio).toContain('Use Written Mission');

    const networkFailure = renderTurn({
      englishSupportRevealed: false,
      englishSupportUsedDuringAttempt: false,
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
      englishSupportRevealed: false,
      englishSupportUsedDuringAttempt: false,
      recorderStatus: 'error',
      recorderError: 'Microphone permission was denied. Retry recording or use Written Mission.',
    });
    expect(permissionDenied).toContain('Microphone permission was denied');
    expect(permissionDenied).toContain('Record response');
    expect(permissionDenied).toContain('Use Written Mission');

    const unsupported = renderTurn({
      englishSupportRevealed: false,
      englishSupportUsedDuringAttempt: false,
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

  it('shows the transcript and semantic feedback for every completed goal', () => {
    const html = render(SpokenMissionResult, {
      props: { result, onTryAgain: vi.fn() },
    }).body;

    for (const goal of result.goals) {
      expect(html).toContain(goal.transcript);
      expect(html).toContain(goal.feedback);
    }
    expect(html).toContain('You repaired the misunderstanding.');
  });

  it.each([
    [
      'retry',
      {
        transcript: 'ラーメンですか。',
        outcome: 'retry',
        confidence: 'high',
        feedback: 'Try ordering one item.',
      },
      'Try this goal again',
    ],
    [
      'could not assess',
      {
        transcript: null,
        outcome: 'could_not_assess',
        confidence: null,
        feedback: 'No speech was detected. Please try recording again.',
      },
      'Could not assess',
    ],
  ] satisfies Array<[string, SpokenMissionAssessment, string]>)(
    'keeps %s feedback and the recording retry action unchanged',
    (_case, assessment, heading) => {
      const html = renderTurn({
        englishSupportRevealed: false,
        englishSupportUsedDuringAttempt: false,
        submissionState: 'feedback',
        assessment,
      });

      expect(html).toContain(heading);
      expect(html).toContain(assessment.feedback);
      expect(html).toContain('Record again');
    },
  );
});
