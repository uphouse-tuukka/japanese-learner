<script lang="ts">
  import type { SpokenMissionServerTurn, SpokenMissionTurnResponse } from '$lib/types';
  import type { AudioRecorderStatus } from '$lib/utils/audio-recorder';

  type SubmissionState = 'idle' | 'processing' | 'feedback' | 'error';
  type SupportDisclosureState = 'idle' | 'processing';

  type Props = {
    currentTurn: SpokenMissionServerTurn;
    maxRecordingSeconds: number;
    supportRevealed: boolean;
    englishSupport: string | null;
    supportDisclosureState: SupportDisclosureState;
    attemptSupportUsed: boolean;
    assessment: SpokenMissionTurnResponse['assessment'] | null;
    pendingNextTurn: SpokenMissionServerTurn | null;
    recorderStatus: AudioRecorderStatus;
    recordingSeconds: number;
    submissionState: SubmissionState;
    canRecord: boolean;
    audioPlaying: boolean;
    recorderError: string;
    errorMessage: string;
    hasPendingAudio: boolean;
    onPlayServerLine: () => void;
    onRevealSupport: () => void;
    onContinue: () => void;
    onRetryGoal: () => void;
    onStartRecording: () => void;
    onStopRecording: () => void;
    onCancelRecording: () => void;
    onRetryUpload: () => void;
    onChooseWritten: () => void;
  };

  let {
    currentTurn,
    maxRecordingSeconds,
    supportRevealed,
    englishSupport,
    supportDisclosureState,
    attemptSupportUsed,
    assessment,
    pendingNextTurn,
    recorderStatus,
    recordingSeconds,
    submissionState,
    canRecord,
    audioPlaying,
    recorderError,
    errorMessage,
    hasPendingAudio,
    onPlayServerLine,
    onRevealSupport,
    onContinue,
    onRetryGoal,
    onStartRecording,
    onStopRecording,
    onCancelRecording,
    onRetryUpload,
    onChooseWritten,
  }: Props = $props();
</script>

<section class="spoken-shell" aria-labelledby="turn-heading">
  <header class="turn-header">
    <div>
      <p class="eyebrow">Goal {currentTurn.turnNumber} of 3</p>
      <h2 id="turn-heading">{currentTurn.goalTitle}</h2>
    </div>
    <div class="goal-dots" aria-label={`Goal ${currentTurn.turnNumber} of 3`}>
      {#each [1, 2, 3] as goalNumber}
        <span
          class:done={goalNumber < currentTurn.turnNumber}
          class:current={goalNumber === currentTurn.turnNumber}
        ></span>
      {/each}
    </div>
  </header>

  <article class="server-line">
    <div class="server-label">
      <span aria-hidden="true">店</span><span>Restaurant server</span>
    </div>
    <p class="japanese">{currentTurn.npcDialogue.japanese}</p>
    <p class="romaji">{currentTurn.npcDialogue.romaji}</p>
    <div class="line-actions">
      <button class="line-button" type="button" onclick={onPlayServerLine}>
        {audioPlaying ? 'Stop audio' : 'Replay Japanese'}
      </button>
      {#if !supportRevealed}
        <button
          class="line-button support"
          type="button"
          disabled={supportDisclosureState === 'processing'}
          onclick={onRevealSupport}
        >
          {supportDisclosureState === 'processing'
            ? 'Revealing English support…'
            : 'Reveal English support'}
        </button>
      {/if}
    </div>
    {#if supportRevealed && englishSupport}
      <div class="support-copy">
        <span>English support used</span>
        <p>{englishSupport}</p>
      </div>
    {:else if attemptSupportUsed}
      <p class="prior-support">
        English support was used earlier in this attempt. Completion will be Supported.
      </p>
    {/if}
  </article>

  {#if submissionState === 'feedback' && assessment}
    <article class="assessment" data-outcome={assessment.outcome} aria-live="polite">
      <p class="outcome">
        {assessment.outcome === 'accepted'
          ? 'Accepted'
          : assessment.outcome === 'retry'
            ? 'Try this goal again'
            : 'Could not assess'}
      </p>
      {#if assessment.transcript}
        <div class="transcript">
          <span>Transcript</span>
          <p>{assessment.transcript}</p>
        </div>
      {/if}
      <p class="feedback">{assessment.feedback}</p>
      {#if assessment.outcome === 'accepted' && pendingNextTurn}
        <button class="btn btn-primary" type="button" onclick={onContinue}>Continue</button>
      {:else}
        <button class="btn btn-primary" type="button" onclick={onRetryGoal}>Record again</button>
      {/if}
    </article>
  {:else}
    <div class="record-panel">
      <div class="record-status" aria-live="polite">
        {#if recorderStatus === 'recording'}
          <span class="recording-dot" aria-hidden="true"></span>
          <strong>Recording {recordingSeconds}s / {maxRecordingSeconds}s</strong>
          <small>Stops automatically at the time limit.</small>
        {:else if recorderStatus === 'requesting_permission'}
          <strong>Requesting microphone permission…</strong>
        {:else if recorderStatus === 'stopping' || submissionState === 'processing'}
          <strong>Transcribing and assessing your response…</strong>
          <small>Communicative intent only. Accent is not scored.</small>
        {:else}
          <strong>Hold the floor when you are ready.</strong>
          <small>One short response. Raw audio is discarded after assessment.</small>
        {/if}
      </div>

      <div class="record-actions">
        {#if recorderStatus === 'recording'}
          <button class="btn btn-primary record-button" type="button" onclick={onStopRecording}
            >Stop and assess</button
          >
          <button class="btn btn-ghost" type="button" onclick={onCancelRecording}>Cancel</button>
        {:else if recorderStatus === 'requesting_permission' || recorderStatus === 'stopping' || submissionState === 'processing'}
          <button class="btn btn-primary" type="button" disabled>Working…</button>
        {:else if submissionState === 'error' && hasPendingAudio}
          <button class="btn btn-primary" type="button" onclick={onRetryUpload}>Retry upload</button
          >
        {:else if recorderStatus !== 'unsupported'}
          <button
            class="btn btn-primary record-button"
            type="button"
            disabled={!canRecord}
            onclick={onStartRecording}
          >
            <span class="record-icon" aria-hidden="true"></span> Record response
          </button>
        {/if}
        {#if recorderStatus === 'unsupported' || recorderStatus === 'error'}
          <button class="btn btn-secondary" type="button" onclick={onChooseWritten}
            >Use Written Mission</button
          >
        {/if}
      </div>
    </div>
  {/if}

  {#if recorderError}
    <p class="message error" role="alert">{recorderError}</p>
  {/if}
  {#if errorMessage}
    <p class="message error" role="alert">{errorMessage}</p>
  {/if}
</section>

<style>
  .spoken-shell {
    min-width: 0;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    background: var(--bg-white);
    box-shadow: var(--shadow-card);
    padding: clamp(var(--space-5), 4vw, var(--space-8));
    display: grid;
    gap: var(--space-5);
    overflow: hidden;
  }
  .turn-header,
  .server-label,
  .line-actions,
  .record-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .turn-header {
    justify-content: space-between;
  }
  .turn-header h2,
  .eyebrow,
  .server-line p,
  .record-status small,
  .assessment p {
    margin: 0;
  }
  .eyebrow {
    color: var(--accent-shu);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
  }
  .goal-dots {
    display: flex;
    gap: var(--space-2);
  }
  .goal-dots span {
    width: 1.8rem;
    height: 3px;
    background: var(--border-light);
  }
  .goal-dots span.done {
    background: var(--accent-matcha);
  }
  .goal-dots span.current {
    background: var(--accent-shu);
  }
  .server-line {
    padding: clamp(var(--space-5), 5vw, var(--space-8));
    border-left: 4px solid var(--accent-shu);
    background: var(--bg-shoji);
    box-shadow: var(--shadow-sm);
    display: grid;
    gap: var(--space-2);
  }
  .server-label {
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
  }
  .server-label span:first-child {
    width: 2rem;
    height: 2rem;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: var(--accent-shu-wash);
    color: var(--accent-shu);
  }
  .japanese {
    font-size: clamp(var(--text-xl), 5vw, var(--text-3xl));
    line-height: var(--leading-tight);
  }
  .romaji {
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
  }
  .line-actions {
    margin-top: var(--space-3);
  }
  .line-button {
    min-height: auto;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--accent-shu);
    font-size: var(--text-sm);
  }
  .line-button.support {
    color: var(--text-bokashi);
  }
  .support-copy {
    margin-top: var(--space-2);
    padding: var(--space-3);
    background: var(--accent-gold-wash);
    border: 1px solid var(--accent-gold);
  }
  .support-copy span {
    color: var(--state-warning);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    text-transform: uppercase;
  }
  .support-copy p {
    margin-top: var(--space-1);
    color: var(--text-sumi);
  }
  .prior-support {
    margin-top: var(--space-2) !important;
    color: var(--state-warning);
    font-size: var(--text-sm);
  }
  .record-panel {
    padding: var(--space-5);
    border: 1px solid var(--border-light);
    display: grid;
    gap: var(--space-4);
  }
  .record-status {
    display: grid;
    gap: var(--space-1);
  }
  .recording-dot,
  .record-icon {
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 999px;
    background: var(--accent-shu);
    display: inline-block;
  }
  .recording-dot {
    animation: ink-pulse 1s var(--ease-in-out) infinite;
  }
  .record-button {
    min-width: 12rem;
  }
  .assessment {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-5);
    border: 1px solid var(--accent-shu-soft);
    background: var(--accent-shu-wash);
  }
  .assessment[data-outcome='accepted'] {
    border-color: var(--accent-matcha);
    background: var(--accent-matcha-wash);
  }
  .outcome {
    font-size: var(--text-lg);
    font-weight: var(--weight-semibold);
  }
  .transcript {
    display: grid;
    gap: var(--space-1);
  }
  .transcript span {
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
  }
  .transcript p {
    font-size: var(--text-xl);
  }
  .feedback {
    color: var(--text-bokashi);
  }
  .message {
    margin: 0;
    padding: var(--space-3);
    border-radius: var(--radius-md);
  }
  .message.error {
    color: var(--state-error-text);
    background: var(--state-error-wash);
  }
  @keyframes ink-pulse {
    50% {
      opacity: 0.35;
      transform: scale(0.94);
    }
  }
  @media (max-width: 37.5rem) {
    .record-actions {
      align-items: stretch;
    }
    .record-actions :global(.btn) {
      width: 100%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .recording-dot {
      animation: none;
    }
  }
</style>
