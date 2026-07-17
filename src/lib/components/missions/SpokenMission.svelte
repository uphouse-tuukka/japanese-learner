<script lang="ts">
  import { onDestroy } from 'svelte';
  import SpokenMissionBriefingView from './SpokenMissionBriefing.svelte';
  import SpokenMissionHistoryView from './SpokenMissionHistory.svelte';
  import SpokenMissionResultView from './SpokenMissionResult.svelte';
  import SpokenMissionTurnView from './SpokenMissionTurn.svelte';
  import type {
    SpokenMissionAudioStatus,
    SpokenMissionSubmissionState,
    SpokenMissionSupportDisclosureState,
    SpokenMissionTurnActions,
    SpokenMissionTurnViewState,
  } from './spoken-mission-turn-contract';
  import {
    requestSpokenMissionEnglishSupport,
    requestSpokenMissionStart,
    requestSpokenMissionTurn,
    requestSpokenMissionWrittenSupport,
    SpokenMissionTurnRequestError,
  } from './spoken-mission-client';
  import {
    createAudioRecorder,
    type AudioRecorderController,
    type AudioRecorderStatus,
  } from '$lib/utils/audio-recorder';
  import { speak, stop } from '$lib/utils/tts';
  import type {
    SpokenMissionBriefing,
    SpokenMissionEvidenceState,
    SpokenMissionHistoryEntry,
    SpokenMissionResult,
    SpokenMissionResumeProgress,
    SpokenMissionServerTurn,
    SpokenMissionTurnRecovery,
    SpokenMissionTurnResponse,
  } from '$lib/types';

  type Props = {
    missionId: string;
    userId: string;
    briefing: SpokenMissionBriefing;
    bestEvidence: SpokenMissionEvidenceState | 'untried';
    resumable: SpokenMissionResumeProgress | null;
    definitionUpdated?: boolean;
    onChooseWritten: () => void;
  };

  type Stage = 'briefing' | 'starting' | 'active' | 'complete';
  type PendingRecording = {
    audio: Blob;
    responseId: string;
    mimeType: string;
  };

  let {
    missionId,
    userId,
    briefing,
    bestEvidence,
    resumable,
    definitionUpdated = false,
    onChooseWritten,
  }: Props = $props();

  let stage = $state<Stage>('briefing');
  let submissionState = $state<SpokenMissionSubmissionState>('idle');
  let submissionRecovery = $state<SpokenMissionTurnRecovery>('none');
  let attemptId = $state('');
  let currentTurn = $state<SpokenMissionServerTurn | null>(null);
  let pendingNextTurn = $state<SpokenMissionServerTurn | null>(null);
  let englishSupportRevealed = $state(false);
  let revealedEnglishSupport = $state<string | null>(null);
  let englishSupportDisclosureState = $state<SpokenMissionSupportDisclosureState>('idle');
  let writtenSupportRevealed = $state(false);
  let revealedWrittenSupport = $state<SpokenMissionServerTurn['npcDialogue'] | null>(null);
  let writtenSupportDisclosureState = $state<SpokenMissionSupportDisclosureState>('idle');
  let englishSupportUsedDuringAttempt = $state(false);
  let history = $state<SpokenMissionHistoryEntry[]>([]);
  let assessment = $state<SpokenMissionTurnResponse['assessment'] | null>(null);
  let result = $state<SpokenMissionResult | null>(null);
  let errorMessage = $state('');
  let pendingRecording = $state<PendingRecording | null>(null);
  let recorderStatus = $state<AudioRecorderStatus>('idle');
  let recordingSeconds = $state(0);
  let recorderError = $state('');
  let audioStatus = $state<SpokenMissionAudioStatus>('idle');
  let recorder: AudioRecorderController | null = null;
  let audioPlaybackController: AbortController | null = null;
  let supportRequestGeneration = 0;

  const canRecord = $derived(
    submissionState === 'idle' && (recorderStatus === 'idle' || recorderStatus === 'error'),
  );

  let activeTurnState = $derived.by((): SpokenMissionTurnViewState | null => {
    if (!currentTurn) return null;
    return {
      turn: currentTurn,
      recorder: {
        maxRecordingSeconds: briefing.maxRecordingSeconds,
        status: recorderStatus,
        recordingSeconds,
        canRecord,
        errorMessage: recorderError,
      },
      support: {
        written: {
          revealed: writtenSupportRevealed,
          text: revealedWrittenSupport,
          disclosureState: writtenSupportDisclosureState,
        },
        english: {
          revealed: englishSupportRevealed,
          text: revealedEnglishSupport,
          disclosureState: englishSupportDisclosureState,
          usedDuringAttempt: englishSupportUsedDuringAttempt,
        },
      },
      assessment: {
        submissionState,
        result: assessment,
        pendingNextTurn,
      },
      recovery: {
        submissionRecovery,
        hasPendingAudio: pendingRecording !== null,
        errorMessage,
      },
      audio: {
        status: audioStatus,
      },
    };
  });

  function createResponseId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `spoken-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function resetRecorder(): void {
    recorder?.dispose();
    recorder = createAudioRecorder({
      maxDurationSeconds: briefing.maxRecordingSeconds,
      onStateChange: (snapshot) => {
        recorderStatus = snapshot.status;
        recordingSeconds = snapshot.elapsedSeconds;
        recorderError = snapshot.errorMessage?.includes('permission was denied')
          ? 'Microphone permission was denied. Retry recording or use Written Mission.'
          : (snapshot.errorMessage ??
            (snapshot.status === 'unsupported'
              ? 'Microphone recording is not supported in this browser.'
              : ''));
      },
      onRecordingReady: ({ audio, mimeType }) => {
        pendingRecording = { audio, mimeType, responseId: createResponseId() };
        void submitRecording();
      },
    });
  }

  function stopServerLinePlayback(nextStatus?: SpokenMissionAudioStatus): void {
    audioPlaybackController?.abort();
    audioPlaybackController = null;
    stop();
    if (nextStatus) audioStatus = nextStatus;
  }

  function ownsServerLinePlayback(controller: AbortController): boolean {
    return !controller.signal.aborted && audioPlaybackController === controller;
  }

  function ownsSupportRequest(
    generation: number,
    requestAttemptId: string,
    turnNumber: number,
  ): boolean {
    return (
      generation === supportRequestGeneration &&
      ownsSupportAttempt(requestAttemptId) &&
      currentTurn?.turnNumber === turnNumber
    );
  }

  function ownsSupportAttempt(requestAttemptId: string): boolean {
    return stage === 'active' && attemptId === requestAttemptId;
  }

  async function startMission(startOver: boolean): Promise<void> {
    supportRequestGeneration += 1;
    stopServerLinePlayback('idle');
    stage = 'starting';
    errorMessage = '';
    try {
      const payload = await requestSpokenMissionStart({
        missionId,
        userId,
        startOver,
      });

      attemptId = payload.attemptId;
      currentTurn = payload.turn;
      history = payload.history;
      englishSupportUsedDuringAttempt = payload.supportUsed;
      englishSupportRevealed = payload.currentTurnEnglishSupportRevealed;
      revealedEnglishSupport = payload.currentTurnEnglishSupport;
      englishSupportDisclosureState = 'idle';
      writtenSupportRevealed = payload.currentTurnWrittenSupportRevealed;
      revealedWrittenSupport = payload.currentTurnWrittenSupportRevealed
        ? payload.turn.npcDialogue
        : null;
      writtenSupportDisclosureState = 'idle';
      submissionState = 'idle';
      submissionRecovery = 'none';
      stage = 'active';
      resetRecorder();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Could not start Spoken Mission.';
      stage = 'briefing';
    }
  }

  async function startRecording(): Promise<void> {
    if (!canRecord) return;
    assessment = null;
    errorMessage = '';
    recorderError = '';
    await recorder?.start();
  }

  function stopRecording(): void {
    recorder?.stop();
  }

  function cancelRecording(): void {
    recorder?.cancel();
    recorderError = '';
  }

  async function submitRecording(): Promise<void> {
    if (!pendingRecording || !currentTurn) return;
    submissionState = 'processing';
    submissionRecovery = 'none';
    errorMessage = '';

    const form = new FormData();
    form.set('userId', userId);
    form.set('attemptId', attemptId);
    form.set('turnNumber', String(currentTurn.turnNumber));
    form.set('clientResponseId', pendingRecording.responseId);
    form.set('englishSupportRevealed', String(englishSupportRevealed));
    const extension = pendingRecording.mimeType.includes('mp4') ? 'mp4' : 'webm';
    form.set('audio', pendingRecording.audio, `spoken-mission-turn.${extension}`);

    try {
      const payload = await requestSpokenMissionTurn({ missionId, form });

      assessment = payload.assessment;
      pendingNextTurn = payload.nextTurn;
      result = payload.result;
      pendingRecording = null;
      submissionState = 'feedback';
      if (payload.isComplete && payload.result) {
        stopServerLinePlayback('idle');
        stage = 'complete';
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Could not assess this response.';
      submissionRecovery = error instanceof SpokenMissionTurnRequestError ? error.recovery : 'none';
      if (submissionRecovery === 'record_again') {
        pendingRecording = null;
      }
      submissionState = 'error';
    }
  }

  function retryGoal(): void {
    assessment = null;
    errorMessage = '';
    pendingRecording = null;
    submissionState = 'idle';
    submissionRecovery = 'none';
    recorder?.retry();
  }

  function continueToNextGoal(): void {
    if (!pendingNextTurn) return;
    supportRequestGeneration += 1;
    currentTurn = pendingNextTurn;
    pendingNextTurn = null;
    englishSupportRevealed = false;
    revealedEnglishSupport = null;
    englishSupportDisclosureState = 'idle';
    writtenSupportRevealed = false;
    revealedWrittenSupport = null;
    writtenSupportDisclosureState = 'idle';
    stopServerLinePlayback('idle');
    assessment = null;
    submissionState = 'idle';
    submissionRecovery = 'none';
    recorder?.retry();
  }

  async function revealEnglishSupport(): Promise<void> {
    if (!currentTurn || englishSupportDisclosureState === 'processing') return;
    const generation = supportRequestGeneration;
    const requestAttemptId = attemptId;
    const turnNumber = currentTurn.turnNumber;
    englishSupportDisclosureState = 'processing';
    errorMessage = '';
    try {
      const payload = await requestSpokenMissionEnglishSupport({
        missionId,
        userId,
        attemptId: requestAttemptId,
        turnNumber,
      });

      if (!ownsSupportAttempt(requestAttemptId)) return;
      englishSupportUsedDuringAttempt = payload.supportUsed;
      if (!ownsSupportRequest(generation, requestAttemptId, turnNumber)) return;
      revealedEnglishSupport = payload.englishSupport;
      englishSupportRevealed = true;
    } catch (error) {
      if (!ownsSupportRequest(generation, requestAttemptId, turnNumber)) return;
      errorMessage = error instanceof Error ? error.message : 'Could not reveal English support.';
    } finally {
      if (ownsSupportRequest(generation, requestAttemptId, turnNumber)) {
        englishSupportDisclosureState = 'idle';
      }
    }
  }

  async function revealWrittenSupport(): Promise<void> {
    if (!currentTurn || writtenSupportDisclosureState === 'processing') return;
    const generation = supportRequestGeneration;
    const requestAttemptId = attemptId;
    const turnNumber = currentTurn.turnNumber;
    writtenSupportDisclosureState = 'processing';
    errorMessage = '';
    try {
      const payload = await requestSpokenMissionWrittenSupport({
        missionId,
        userId,
        attemptId: requestAttemptId,
        turnNumber,
      });

      if (!ownsSupportRequest(generation, requestAttemptId, turnNumber)) return;
      revealedWrittenSupport = payload.writtenText;
      writtenSupportRevealed = true;
    } catch (error) {
      if (!ownsSupportRequest(generation, requestAttemptId, turnNumber)) return;
      errorMessage = error instanceof Error ? error.message : 'Could not reveal written text.';
    } finally {
      if (ownsSupportRequest(generation, requestAttemptId, turnNumber)) {
        writtenSupportDisclosureState = 'idle';
      }
    }
  }

  async function playServerLine(): Promise<void> {
    if (!currentTurn) return;
    if (audioStatus === 'playing') {
      stopServerLinePlayback('stopped');
      return;
    }
    if (audioStatus === 'loading') return;

    const playbackController = new AbortController();
    audioPlaybackController = playbackController;
    audioStatus = 'loading';
    let playbackFailed = false;
    try {
      await speak(currentTurn.npcDialogue.japanese, {
        preferBrowser: false,
        signal: playbackController.signal,
        onPlaybackStart: () => {
          if (!ownsServerLinePlayback(playbackController)) {
            stop();
            return;
          }
          audioStatus = 'playing';
        },
        onPlaybackError: () => {
          if (!ownsServerLinePlayback(playbackController)) {
            return;
          }
          playbackFailed = true;
          audioStatus = 'error';
        },
      });
      if (!ownsServerLinePlayback(playbackController)) {
        return;
      }
      audioPlaybackController = null;
      if (!playbackFailed) audioStatus = 'stopped';
    } catch {
      if (!ownsServerLinePlayback(playbackController)) {
        return;
      }
      audioPlaybackController = null;
      audioStatus = 'error';
    }
  }

  onDestroy(() => {
    supportRequestGeneration += 1;
    recorder?.dispose();
    stopServerLinePlayback();
  });

  const turnActions: SpokenMissionTurnActions = {
    recorder: {
      start: startRecording,
      stop: stopRecording,
      cancel: cancelRecording,
    },
    support: {
      revealWritten: revealWrittenSupport,
      revealEnglish: revealEnglishSupport,
    },
    assessment: {
      continue: continueToNextGoal,
      retryGoal,
    },
    recovery: {
      retryUpload: submitRecording,
      recordAgain: retryGoal,
      chooseWritten: () => onChooseWritten(),
    },
    audio: {
      toggleServerLine: playServerLine,
    },
  };
</script>

{#if stage === 'briefing'}
  <SpokenMissionBriefingView
    {briefing}
    {bestEvidence}
    {resumable}
    {definitionUpdated}
    {errorMessage}
    onStart={startMission}
    {onChooseWritten}
  />
{:else if stage === 'starting'}
  <section class="starting" aria-live="polite" aria-busy="true">
    <span class="ink-pulse" aria-hidden="true">話</span>
    <p>Preparing the restaurant conversation…</p>
  </section>
{:else if stage === 'active' && activeTurnState}
  {#if history.length > 0}
    <SpokenMissionHistoryView {history} />
  {/if}
  <SpokenMissionTurnView viewState={activeTurnState} actions={turnActions} />
{:else if stage === 'complete' && result}
  <SpokenMissionResultView {result} onTryAgain={() => startMission(true)} />
{/if}

<style>
  .starting {
    min-width: 0;
    min-height: 18rem;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    background: var(--bg-white);
    box-shadow: var(--shadow-card);
    padding: clamp(var(--space-5), 4vw, var(--space-8));
    display: grid;
    gap: var(--space-5);
    place-items: center;
    align-content: center;
    text-align: center;
    overflow: hidden;
  }
  .starting p {
    margin: 0;
  }
  .ink-pulse {
    font-size: var(--text-4xl);
    color: var(--accent-shu);
    animation: ink-pulse 1.8s var(--ease-in-out) infinite;
  }
  @keyframes ink-pulse {
    50% {
      opacity: 0.35;
      transform: scale(0.94);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ink-pulse {
      animation: none;
    }
  }
</style>
