import type {
  SpokenMissionServerTurn,
  SpokenMissionTurnRecovery,
  SpokenMissionTurnResponse,
} from '$lib/types';
import type { AudioRecorderStatus } from '$lib/utils/audio-recorder';

export type SpokenMissionSubmissionState = 'idle' | 'processing' | 'feedback' | 'error';
export type SpokenMissionSupportDisclosureState = 'idle' | 'processing';
export type SpokenMissionAudioStatus = 'idle' | 'loading' | 'playing' | 'stopped' | 'error';

export type SpokenMissionTurnViewState = {
  turn: SpokenMissionServerTurn;
  recorder: {
    maxRecordingSeconds: number;
    status: AudioRecorderStatus;
    recordingSeconds: number;
    canRecord: boolean;
    errorMessage: string;
  };
  support: {
    written: {
      revealed: boolean;
      text: SpokenMissionServerTurn['npcDialogue'] | null;
      disclosureState: SpokenMissionSupportDisclosureState;
    };
    english: {
      revealed: boolean;
      text: string | null;
      disclosureState: SpokenMissionSupportDisclosureState;
      usedDuringAttempt: boolean;
    };
  };
  assessment: {
    submissionState: SpokenMissionSubmissionState;
    result: SpokenMissionTurnResponse['assessment'] | null;
    pendingNextTurn: SpokenMissionServerTurn | null;
  };
  recovery: {
    submissionRecovery: SpokenMissionTurnRecovery;
    hasPendingAudio: boolean;
    errorMessage: string;
  };
  audio: {
    status: SpokenMissionAudioStatus;
  };
};

export type SpokenMissionTurnActions = {
  recorder: {
    start: () => void;
    stop: () => void;
    cancel: () => void;
  };
  support: {
    revealWritten: () => void;
    revealEnglish: () => void;
  };
  assessment: {
    continue: () => void;
    retryGoal: () => void;
  };
  recovery: {
    retryUpload: () => void;
    recordAgain: () => void;
    chooseWritten: () => void;
  };
  audio: {
    toggleServerLine: () => void;
  };
};

export type SpokenMissionTurnProps = {
  viewState: SpokenMissionTurnViewState;
  actions: SpokenMissionTurnActions;
};
