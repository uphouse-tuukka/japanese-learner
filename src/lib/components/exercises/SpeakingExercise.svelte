<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { OnAnswer, SpeakingExercise as SpeakingExerciseData } from '$lib/types';

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
        stopTimers();
        releaseStream();
        const audio = new Blob(chunks, { type: selectedMimeType || 'audio/webm' });
        chunks = [];
        void submitAudio(audio);
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
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  }

  function cancelRecording(): void {
    resetRecorder();
    recordingState = 'idle';
    recordingSeconds = 0;
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

<section class="speaking-exercise card" aria-label="Speaking exercise">
  <div class="speaking-header">
    <p class="exercise-kicker">Speaking practice</p>
    <span class="duration-pill">Up to {maxRecordingSeconds}s</span>
  </div>

  <h2>{exercise.title}</h2>
  <p class="prompt">{exercise.prompt}</p>

  {#if recordingState === 'unsupported'}
    <div class="status-panel warning" role="status">
      <p>{errorMessage || 'Microphone recording is not supported in this browser.'}</p>
      <p class="small">You can continue without credit and try this exercise later.</p>
    </div>
  {:else if recordingState === 'requesting_permission'}
    <div class="status-panel" role="status">
      <p>Requesting microphone permission…</p>
    </div>
  {:else if recordingState === 'recording'}
    <div class="recording-panel" role="status" aria-live="polite">
      <span class="recording-dot" aria-hidden="true"></span>
      <span>Recording {recordingLabel}</span>
    </div>
  {:else if recordingState === 'processing'}
    <div class="status-panel" role="status">
      <p>Transcribing and checking your answer…</p>
    </div>
  {:else if recordingState === 'error'}
    <div class="status-panel error" role="alert">
      <p>{errorMessage}</p>
      <p class="small">Raw audio is discarded after the check attempt.</p>
    </div>
  {/if}

  {#if recordingState === 'answered'}
    <div class="result-panel" class:correct={isCorrect} class:incorrect={!isCorrect} tabindex="-1">
      <p class="result-title">{isCorrect ? 'Correct!' : 'Not quite'}</p>
      <div class="result-grid">
        <div>
          <span class="label">Transcript</span>
          <p>{transcript}</p>
        </div>
        <div>
          <span class="label">Expected</span>
          <p>{exercise.expectedAnswer}</p>
          <p class="romaji">{exercise.expectedRomaji}</p>
        </div>
      </div>
      {#if feedback}
        <p class="feedback">{feedback}</p>
      {/if}
    </div>
  {/if}

  <div class="actions">
    {#if recordingState === 'recording'}
      <button class="btn btn-primary" type="button" onclick={stopRecording}>Stop and check</button>
      <button class="btn btn-ghost" type="button" onclick={cancelRecording}>Cancel</button>
    {:else if recordingState === 'processing' || recordingState === 'requesting_permission'}
      <button class="btn btn-primary" type="button" disabled>Working…</button>
    {:else if recordingState === 'answered'}
      <button class="btn btn-primary" type="button" onclick={continueToNext}>Continue</button>
    {:else}
      <button class="btn btn-primary" type="button" onclick={startRecording}>Start recording</button
      >
      {#if canContinue}
        <button class="btn btn-ghost" type="button" onclick={continueToNext}
          >Continue without credit</button
        >
      {/if}
    {/if}
  </div>

  <p class="privacy-note">
    Audio is sent for transcription, then discarded. Only the transcript is used as your answer.
  </p>
</section>

<style>
  .speaking-exercise {
    display: grid;
    gap: var(--space-4, 1rem);
  }

  .speaking-header,
  .actions,
  .recording-panel {
    display: flex;
    align-items: center;
    gap: var(--space-3, 0.75rem);
    flex-wrap: wrap;
  }

  .speaking-header {
    justify-content: space-between;
  }

  .exercise-kicker,
  .label,
  .privacy-note,
  .small {
    color: var(--text-muted, #64748b);
    font-size: var(--text-sm, 0.875rem);
  }

  .exercise-kicker {
    margin: 0;
    font-weight: var(--weight-medium, 600);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .duration-pill {
    border: 1px solid var(--border-subtle, #dbe4ee);
    border-radius: 999px;
    padding: 0.25rem 0.65rem;
    font-size: var(--text-sm, 0.875rem);
  }

  .prompt {
    font-size: var(--text-lg, 1.1rem);
    margin: 0;
  }

  .status-panel,
  .recording-panel,
  .result-panel {
    border-radius: var(--radius-lg, 0.75rem);
    padding: var(--space-4, 1rem);
    background: var(--bg-washi, #f8fafc);
  }

  .status-panel.warning {
    border: 1px solid var(--accent-kin, #f59e0b);
  }

  .status-panel.error,
  .result-panel.incorrect {
    border: 1px solid var(--state-error, #dc2626);
    background: var(--accent-shu-wash, #fee2e2);
  }

  .result-panel.correct {
    border: 1px solid var(--state-success, #16a34a);
    background: var(--accent-matcha-wash, #dcfce7);
  }

  .recording-dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 999px;
    background: var(--state-error, #dc2626);
    animation: pulse 1s infinite;
  }

  .result-title {
    font-weight: var(--weight-medium, 600);
    margin-top: 0;
  }

  .result-grid {
    display: grid;
    gap: var(--space-3, 0.75rem);
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  }

  .label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: var(--weight-medium, 600);
  }

  .romaji {
    color: var(--text-muted, #64748b);
    font-style: italic;
  }

  .feedback,
  .privacy-note {
    margin-bottom: 0;
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
