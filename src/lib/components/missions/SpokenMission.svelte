<script lang="ts">
  import { onDestroy } from 'svelte';
  import SpokenMissionBriefingView from './SpokenMissionBriefing.svelte';
  import SpokenMissionHistoryView from './SpokenMissionHistory.svelte';
  import SpokenMissionResultView from './SpokenMissionResult.svelte';
  import SpokenMissionTurnView from './SpokenMissionTurn.svelte';
  import {
    requestSpokenMissionStart,
    requestSpokenMissionTurn,
    SpokenMissionTurnRequestError,
  } from './spoken-mission-client';
  import {
    createAudioRecorder,
    type AudioRecorderController,
    type AudioRecorderStatus,
  } from '$lib/utils/audio-recorder';
  import { isSpeaking, speak, stop } from '$lib/utils/tts';
  import type {
    SpokenMissionBriefing,
    SpokenMissionEvidenceState,
    SpokenMissionHistoryEntry,
    SpokenMissionResult,
    SpokenMissionServerTurn,
    SpokenMissionSupportResponse,
    SpokenMissionTurnRecovery,
    SpokenMissionTurnResponse,
  } from '$lib/types';

  type Props = {
    missionId: string;
    userId: string;
    briefing: SpokenMissionBriefing;
    bestEvidence: SpokenMissionEvidenceState | 'untried';
    resumable: { currentTurn: number; completedGoalCount: number } | null;
    onChooseWritten: () => void;
  };

  type Stage = 'briefing' | 'starting' | 'active' | 'complete';
  type SubmissionState = 'idle' | 'processing' | 'feedback' | 'error';
  type SupportDisclosureState = 'idle' | 'processing';
  type PendingRecording = {
    audio: Blob;
    responseId: string;
    mimeType: string;
  };

  let { missionId, userId, briefing, bestEvidence, resumable, onChooseWritten }: Props = $props();

  let stage = $state<Stage>('briefing');
  let submissionState = $state<SubmissionState>('idle');
  let submissionRecovery = $state<SpokenMissionTurnRecovery>('none');
  let attemptId = $state('');
  let currentTurn = $state<SpokenMissionServerTurn | null>(null);
  let pendingNextTurn = $state<SpokenMissionServerTurn | null>(null);
  let supportRevealed = $state(false);
  let revealedEnglishSupport = $state<string | null>(null);
  let supportDisclosureState = $state<SupportDisclosureState>('idle');
  let attemptSupportUsed = $state(false);
  let history = $state<SpokenMissionHistoryEntry[]>([]);
  let assessment = $state<SpokenMissionTurnResponse['assessment'] | null>(null);
  let result = $state<SpokenMissionResult | null>(null);
  let errorMessage = $state('');
  let pendingRecording = $state<PendingRecording | null>(null);
  let recorderStatus = $state<AudioRecorderStatus>('idle');
  let recordingSeconds = $state(0);
  let recorderError = $state('');
  let audioPlaying = $state(false);
  let audioPoll: ReturnType<typeof setInterval> | null = null;
  let recorder: AudioRecorderController | null = null;

  const canRecord = $derived(
    submissionState === 'idle' && (recorderStatus === 'idle' || recorderStatus === 'error'),
  );

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

  async function startMission(startOver: boolean): Promise<void> {
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
      attemptSupportUsed = payload.supportUsed;
      supportRevealed = false;
      revealedEnglishSupport = null;
      supportDisclosureState = 'idle';
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
    form.set('supportRevealed', String(supportRevealed));
    const extension = pendingRecording.mimeType.includes('mp4') ? 'mp4' : 'webm';
    form.set('audio', pendingRecording.audio, `spoken-mission-turn.${extension}`);

    try {
      const payload = await requestSpokenMissionTurn({ missionId, form });

      assessment = payload.assessment;
      pendingNextTurn = payload.nextTurn;
      result = payload.result;
      pendingRecording = null;
      submissionState = 'feedback';
      if (payload.isComplete && payload.result) stage = 'complete';
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
    currentTurn = pendingNextTurn;
    pendingNextTurn = null;
    supportRevealed = false;
    revealedEnglishSupport = null;
    supportDisclosureState = 'idle';
    assessment = null;
    submissionState = 'idle';
    submissionRecovery = 'none';
    recorder?.retry();
  }

  async function revealSupport(): Promise<void> {
    if (!currentTurn || supportDisclosureState === 'processing') return;
    supportDisclosureState = 'processing';
    errorMessage = '';
    try {
      const response = await fetch(`/api/missions/${missionId}/spoken/support`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId,
          attemptId,
          turnNumber: currentTurn.turnNumber,
        }),
      });
      const payload = (await response.json()) as Partial<SpokenMissionSupportResponse> & {
        error?: string;
      };
      if (!response.ok || !payload.englishSupport || payload.supportUsed !== true) {
        throw new Error(payload.error ?? 'Could not reveal English support.');
      }

      revealedEnglishSupport = payload.englishSupport;
      supportRevealed = true;
      attemptSupportUsed = true;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Could not reveal English support.';
    } finally {
      supportDisclosureState = 'idle';
    }
  }

  function clearAudioPoll(): void {
    if (audioPoll) clearInterval(audioPoll);
    audioPoll = null;
  }

  async function playServerLine(): Promise<void> {
    if (!currentTurn) return;
    if (audioPlaying || isSpeaking()) {
      stop();
      audioPlaying = false;
      clearAudioPoll();
      return;
    }

    audioPlaying = true;
    audioPoll = setInterval(() => {
      if (!isSpeaking()) {
        audioPlaying = false;
        clearAudioPoll();
      }
    }, 80);
    try {
      await speak(currentTurn.npcDialogue.japanese);
    } finally {
      audioPlaying = false;
      clearAudioPoll();
    }
  }

  onDestroy(() => {
    recorder?.dispose();
    stop();
    clearAudioPoll();
  });
</script>

{#if stage === 'briefing'}
  <SpokenMissionBriefingView
    {briefing}
    {bestEvidence}
    {resumable}
    {errorMessage}
    onStart={startMission}
    {onChooseWritten}
  />
{:else if stage === 'starting'}
  <section class="starting" aria-live="polite" aria-busy="true">
    <span class="ink-pulse" aria-hidden="true">話</span>
    <p>Preparing the restaurant conversation…</p>
  </section>
{:else if stage === 'active' && currentTurn}
  {#if history.length > 0}
    <SpokenMissionHistoryView {history} />
  {/if}
  <SpokenMissionTurnView
    {currentTurn}
    maxRecordingSeconds={briefing.maxRecordingSeconds}
    {supportRevealed}
    englishSupport={revealedEnglishSupport}
    {supportDisclosureState}
    {attemptSupportUsed}
    {assessment}
    {pendingNextTurn}
    {recorderStatus}
    {recordingSeconds}
    {submissionState}
    {submissionRecovery}
    {canRecord}
    {audioPlaying}
    {recorderError}
    {errorMessage}
    hasPendingAudio={pendingRecording !== null}
    onPlayServerLine={playServerLine}
    onRevealSupport={revealSupport}
    onContinue={continueToNextGoal}
    onRetryGoal={retryGoal}
    onStartRecording={startRecording}
    onStopRecording={stopRecording}
    onCancelRecording={cancelRecording}
    onRetryUpload={submitRecording}
    {onChooseWritten}
  />
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
