import { vi } from 'vitest';
import type {
  SpokenMissionSubmissionState,
  SpokenMissionAudioStatus,
  SpokenMissionSupportDisclosureState,
  SpokenMissionTurnActions,
  SpokenMissionTurnProps,
} from './spoken-mission-turn-contract';
import type {
  SpokenMissionAssessment,
  SpokenMissionServerTurn,
  SpokenMissionTurnRecovery,
} from '$lib/types';
import type { AudioRecorderStatus } from '$lib/utils/audio-recorder';

export const spokenMissionServerTurn: SpokenMissionServerTurn = {
  turnNumber: 1,
  goalKey: 'order',
  goalTitle: 'Order',
  npcDialogue: {
    japanese: 'ご注文はお決まりですか。',
    romaji: 'go-chuumon wa okimari desu ka.',
  },
};

export const spokenMissionEnglishSupport = 'Are you ready to order?';

export type SpokenMissionTurnFixtureInput = {
  writtenSupportRevealed?: boolean;
  englishSupportRevealed?: boolean;
  englishSupportUsedDuringAttempt?: boolean;
  englishSupportDisclosureState?: SpokenMissionSupportDisclosureState;
  recorderStatus?: AudioRecorderStatus;
  recorderError?: string;
  recordingSeconds?: number;
  canRecord?: boolean;
  submissionState?: SpokenMissionSubmissionState;
  submissionRecovery?: SpokenMissionTurnRecovery;
  assessment?: SpokenMissionAssessment;
  pendingNextTurn?: SpokenMissionServerTurn;
  hasPendingAudio?: boolean;
  errorMessage?: string;
  audioStatus?: SpokenMissionAudioStatus;
};

export function createSpokenMissionTurnActions() {
  return {
    recorder: {
      start: vi.fn(),
      stop: vi.fn(),
      cancel: vi.fn(),
    },
    support: {
      revealWritten: vi.fn(),
      revealEnglish: vi.fn(),
    },
    assessment: {
      continue: vi.fn(),
      retryGoal: vi.fn(),
    },
    recovery: {
      retryUpload: vi.fn(),
      recordAgain: vi.fn(),
      chooseWritten: vi.fn(),
    },
    audio: {
      toggleServerLine: vi.fn(),
    },
  } satisfies SpokenMissionTurnActions;
}

export function createSpokenMissionTurnProps(
  input: SpokenMissionTurnFixtureInput = {},
  actions: SpokenMissionTurnActions = createSpokenMissionTurnActions(),
): SpokenMissionTurnProps {
  const englishSupportRevealed = input.englishSupportRevealed ?? false;
  return {
    viewState: {
      turn: spokenMissionServerTurn,
      recorder: {
        maxRecordingSeconds: 12,
        status: input.recorderStatus ?? 'idle',
        recordingSeconds: input.recordingSeconds ?? 0,
        canRecord: input.canRecord ?? true,
        errorMessage: input.recorderError ?? '',
      },
      support: {
        written: {
          revealed: input.writtenSupportRevealed ?? false,
          text: input.writtenSupportRevealed ? spokenMissionServerTurn.npcDialogue : null,
          disclosureState: input.englishSupportDisclosureState ?? 'idle',
        },
        english: {
          revealed: englishSupportRevealed,
          text: englishSupportRevealed ? spokenMissionEnglishSupport : null,
          disclosureState: input.englishSupportDisclosureState ?? 'idle',
          usedDuringAttempt: input.englishSupportUsedDuringAttempt ?? false,
        },
      },
      assessment: {
        submissionState: input.submissionState ?? 'idle',
        result:
          input.submissionState === 'feedback'
            ? (input.assessment ?? {
                transcript: 'ラーメンを一つお願いします。',
                outcome: 'accepted',
                confidence: 'high',
                feedback: 'You ordered one ramen.',
              })
            : null,
        pendingNextTurn: input.pendingNextTurn ?? null,
      },
      recovery: {
        submissionRecovery: input.submissionRecovery ?? 'none',
        hasPendingAudio: input.hasPendingAudio ?? false,
        errorMessage: input.errorMessage ?? '',
      },
      audio: {
        status: input.audioStatus ?? 'idle',
      },
    },
    actions,
  };
}
