<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { OnAnswer, SpeakingExercise as SpeakingExerciseData } from '$lib/types';
  import {
    shouldSubmitStoppedRecording,
    type RecordingStopIntent,
  } from './speaking-recorder-state';
  import ExerciseFrame from './shared/ExerciseFrame.svelte';
  import ExerciseResultPanel from './shared/ExerciseResultPanel.svelte';
  import ExerciseStatusPanel from './shared/ExerciseStatusPanel.svelte';

  interface Props {
    exercise: SpeakingExerciseData;
    onAnswer: OnAnswer;
  }

  type RecordingState =
    | 'idle'
    | 'requesting_permission'
    | 'recording'
    | 'processing'
    | 'answered'
    | 'error'
    | 'unsupported';

  type SpeakingCheckResponse =
    | {
        ok: true;
        transcript: string;
        correct: boolean;
        confidence: 'high' | 'medium' | 'low';
        feedback?: string;
      }
    | {
        ok: false;
        error: string;
      };

  let { exercise, onAnswer }: Props = $props();

  let recordingState = $state<RecordingState>('idle');
  let errorMessage = $state('');
  let transcript = $state('');
  let isCorrect = $state(false);
  let feedback = $state('');
  let recordingSeconds = $state(0);
  let selectedMimeType = $state('');

  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let recordingStopIntent: RecordingStopIntent = 'submit';
  let stopTimer: ReturnType<typeof setTimeout> | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  const maxRecordingSeconds = $derived(
    Math.min(Math.max(Math.round(exercise.maxRecordingSeconds ?? 12), 5), 20),
  );
  const canRecord = $derived(recordingState === 'idle' || recordingState === 'error');
  const canContinue = $derived(
    recordingState === 'answered' || recordingState === 'error' || recordingState === 'unsupported',
  );
  const recordingLabel = $derived(`${recordingSeconds}s / ${maxRecordingSeconds}s`);

  function chooseMimeType(): string {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? '';
  }

  function stopTimers(): void {
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
    }
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function releaseStream(): void {
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  function resetRecorder(): void {
    recordingStopIntent = 'cancel';
    stopTimers();
    releaseStream();
    mediaRecorder = null;
    chunks = [];
  }

  function resetForExercise(): void {
    resetRecorder();
    recordingState =
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof MediaRecorder === 'undefined'
        ? 'unsupported'
        : 'idle';
    errorMessage = '';
    transcript = '';
    isCorrect = false;
    feedback = '';
    recordingSeconds = 0;
    selectedMimeType = '';
  }

  function buildMetadataFormData(audio: Blob): FormData {
    const formData = new FormData();
    const extension = selectedMimeType.includes('mp4') ? 'mp4' : 'webm';
    formData.set('audio', audio, `speaking-answer.${extension}`);
    formData.set('prompt', exercise.prompt);
    formData.set('responseKind', exercise.responseKind);
    formData.set('expectedAnswer', exercise.expectedAnswer);
    formData.set('expectedRomaji', exercise.expectedRomaji);
    formData.set('acceptedAnswers', JSON.stringify(exercise.acceptedAnswers));
    formData.set('rubric', exercise.rubric);
    return formData;
  }

  async function submitAudio(audio: Blob): Promise<void> {
    recordingState = 'processing';
    errorMessage = '';

    try {
      const response = await fetch('/api/speaking/check', {
        method: 'POST',
        body: buildMetadataFormData(audio),
      });
      const data = (await response.json()) as SpeakingCheckResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(data.ok === false ? data.error : 'Speaking check failed.');
      }

      transcript = data.transcript;
      isCorrect = data.correct;
      feedback = data.feedback ?? '';
      recordingState = 'answered';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Speaking check failed.';
      recordingState = 'error';
    }
  }

  async function startRecording(): Promise<void> {
    if (!canRecord) return;

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof MediaRecorder === 'undefined'
    ) {
      recordingState = 'unsupported';
      errorMessage = 'Microphone recording is not supported in this browser.';
      return;
    }

    recordingState = 'requesting_permission';
    errorMessage = '';
    transcript = '';
    isCorrect = false;
    feedback = '';
    recordingSeconds = 0;
    chunks = [];
    recordingStopIntent = 'submit';

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      selectedMimeType = chooseMimeType();
      mediaRecorder = selectedMimeType
        ? new MediaRecorder(mediaStream, { mimeType: selectedMimeType })
        : new MediaRecorder(mediaStream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const stopIntent = recordingStopIntent;
        stopTimers();
        releaseStream();
        const audio = new Blob(chunks, { type: selectedMimeType || 'audio/webm' });
        chunks = [];
        mediaRecorder = null;
        recordingStopIntent = 'submit';

        if (shouldSubmitStoppedRecording(stopIntent, audio.size)) {
          void submitAudio(audio);
          return;
        }

        recordingState = 'idle';
        recordingSeconds = 0;
      };

      mediaRecorder.onerror = () => {
        resetRecorder();
        errorMessage = 'Recording failed. Please try again.';
        recordingState = 'error';
      };

      mediaRecorder.start();
      recordingState = 'recording';
      tickTimer = setInterval(() => {
        recordingSeconds = Math.min(recordingSeconds + 1, maxRecordingSeconds);
      }, 1000);
      stopTimer = setTimeout(() => stopRecording(), maxRecordingSeconds * 1000);
    } catch (error) {
      resetRecorder();
      errorMessage =
        error instanceof Error && error.name === 'NotAllowedError'
          ? 'Microphone permission was denied. You can retry or continue without credit.'
          : 'Could not start microphone recording. Please try again.';
      recordingState = 'error';
    }
  }

  function stopRecording(): void {
    recordingStopIntent = 'submit';
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  }

  function cancelRecording(): void {
    recordingStopIntent = 'cancel';
    stopTimers();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    } else {
      resetRecorder();
    }
    recordingState = 'idle';
    recordingSeconds = 0;
    errorMessage = '';
  }

  function continueToNext(): void {
    onAnswer({
      exerciseId: exercise.id,
      answerText: transcript || '[speaking unavailable]',
      isCorrect,
    });
  }

  $effect(() => {
    exercise.id;
    resetForExercise();
  });

  onDestroy(() => {
    resetRecorder();
  });
</script>

<ExerciseFrame title={exercise.title} ariaLabel="Speaking exercise" kicker="Speaking practice">
  {#snippet meta()}
    <span class="duration-pill">Up to {maxRecordingSeconds}s</span>
  {/snippet}

  <p class="prompt">{exercise.prompt}</p>

  {#if recordingState === 'answered'}
    <ExerciseResultPanel
      state={isCorrect ? 'correct' : 'incorrect'}
      title={isCorrect ? 'Correct!' : 'Not quite'}
    >
      <div class="result-grid">
        <div class="answer-card">
          <span class="label">Transcript</span>
          <p class="answer-text">{transcript}</p>
        </div>
        <div class="answer-card">
          <span class="label">Expected</span>
          <p class="answer-text">{exercise.expectedAnswer}</p>
          {#if exercise.expectedRomaji}
            <p class="expected-romaji">({exercise.expectedRomaji})</p>
          {/if}
        </div>
      </div>
      {#if feedback}
        <p class="feedback">{feedback}</p>
      {/if}
    </ExerciseResultPanel>
  {/if}

  <div class="exercise-actions speaking-actions">
    {#if recordingState === 'recording'}
      <button class="btn btn-primary" type="button" onclick={stopRecording}>Stop and check</button>
      <button class="btn btn-ghost" type="button" onclick={cancelRecording}>Cancel</button>
    {:else if recordingState === 'processing' || recordingState === 'requesting_permission'}
      <button class="btn btn-primary" type="button" disabled>Working…</button>
    {:else if recordingState === 'answered'}
      <button class="btn btn-primary" type="button" onclick={continueToNext}>Continue</button>
    {:else if recordingState === 'unsupported'}
      <button class="btn btn-ghost" type="button" onclick={continueToNext}
        >Continue without credit</button
      >
    {:else}
      <button class="btn btn-primary" type="button" onclick={startRecording}>Start recording</button
      >
      {#if canContinue}
        <button class="btn btn-ghost" type="button" onclick={continueToNext}>
          Continue without credit
        </button>
      {/if}
    {/if}
  </div>

  <div class="speaking-status">
    {#if recordingState === 'unsupported'}
      <ExerciseStatusPanel tone="warning">
        <p>{errorMessage || 'Microphone recording is not supported in this browser.'}</p>
        <p class="small">You can continue without credit and try this exercise later.</p>
      </ExerciseStatusPanel>
    {:else if recordingState === 'requesting_permission'}
      <ExerciseStatusPanel>
        <p>Requesting microphone permission…</p>
      </ExerciseStatusPanel>
    {:else if recordingState === 'recording'}
      <ExerciseStatusPanel>
        <span class="recording-line" aria-live="polite">
          <span class="recording-dot" aria-hidden="true"></span>
          <span>Recording {recordingLabel}</span>
        </span>
      </ExerciseStatusPanel>
    {:else if recordingState === 'processing'}
      <ExerciseStatusPanel>
        <p>Transcribing and checking your answer…</p>
      </ExerciseStatusPanel>
    {:else if recordingState === 'error'}
      <ExerciseStatusPanel tone="error" role="alert">
        <p>{errorMessage}</p>
        <p class="small">Raw audio is discarded after the check attempt.</p>
      </ExerciseStatusPanel>
    {:else}
      <p class="exercise-note">
        Audio is sent for transcription, then discarded. Only the transcript is used as your answer.
      </p>
    {/if}
  </div>
</ExerciseFrame>

<style>
  .duration-pill {
    border: 1px solid var(--border-light);
    border-radius: 999px;
    color: var(--text-bokashi);
    font-size: var(--text-sm);
    padding: var(--space-1) var(--space-3);
  }

  .prompt {
    color: var(--text-sumi);
    font-size: var(--text-lg);
    margin: 0;
  }

  .small,
  .label,
  .expected-romaji {
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
  }

  .recording-line {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .recording-dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 999px;
    background: var(--state-error);
    animation: pulse 1s infinite;
  }

  .result-grid {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  }

  .answer-card {
    display: grid;
    align-content: start;
    gap: var(--space-1);
  }

  .answer-text,
  .expected-romaji,
  .feedback,
  .small {
    margin: 0;
  }

  .label {
    display: block;
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
  }

  .speaking-status {
    display: grid;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }

    50% {
      opacity: 0.35;
    }
  }
</style>
