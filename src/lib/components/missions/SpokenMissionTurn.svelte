<script lang="ts">
  import { tick } from 'svelte';
  import type {
    SpokenMissionSubmissionState,
    SpokenMissionTurnProps,
  } from './spoken-mission-turn-contract';
  import type { AudioRecorderStatus } from '$lib/utils/audio-recorder';

  let { viewState, actions }: SpokenMissionTurnProps = $props();

  let currentTurn = $derived(viewState.turn);
  let maxRecordingSeconds = $derived(viewState.recorder.maxRecordingSeconds);
  let recorderStatus = $derived(viewState.recorder.status);
  let recordingSeconds = $derived(viewState.recorder.recordingSeconds);
  let canRecord = $derived(viewState.recorder.canRecord);
  let recorderError = $derived(viewState.recorder.errorMessage);
  let supportActionsEnabled = $derived(viewState.support.actionsEnabled);
  let writtenSupportRevealed = $derived(viewState.support.written.revealed);
  let writtenSupport = $derived(viewState.support.written.text);
  let writtenSupportDisclosureState = $derived(viewState.support.written.disclosureState);
  let englishSupportRevealed = $derived(viewState.support.english.revealed);
  let englishSupport = $derived(viewState.support.english.text);
  let englishSupportDisclosureState = $derived(viewState.support.english.disclosureState);
  let englishSupportUsedDuringAttempt = $derived(viewState.support.english.usedDuringAttempt);
  let submissionState = $derived(viewState.assessment.submissionState);
  let skipState = $derived(viewState.assessment.skipState);
  let assessment = $derived(viewState.assessment.result);
  let pendingNextTurn = $derived(viewState.assessment.pendingNextTurn);
  let submissionRecovery = $derived(viewState.recovery.submissionRecovery);
  let hasPendingAudio = $derived(viewState.recovery.hasPendingAudio);
  let errorMessage = $derived(viewState.recovery.errorMessage);
  let audioStatus = $derived(viewState.audio.status);

  let headingElement = $state<HTMLHeadingElement>();
  let writtenCopyElement = $state<HTMLDivElement>();
  let englishSupportCopyElement = $state<HTMLDivElement>();
  let feedbackHeadingElement = $state<HTMLHeadingElement>();
  let recordButtonElement = $state<HTMLButtonElement>();
  let stopButtonElement = $state<HTMLButtonElement>();
  let recorderErrorElement = $state<HTMLParagraphElement>();
  let errorMessageElement = $state<HTMLParagraphElement>();
  let focusedTurnNumber = 0;
  let previousRecorderStatus: AudioRecorderStatus | null = null;
  let previousSubmissionState: SpokenMissionSubmissionState | null = null;
  let previousSubmissionTurnNumber: number | null = null;
  let previousWrittenSupportRevealed: boolean | null = null;
  let previousEnglishSupportRevealed: boolean | null = null;

  function focusAfterRender(getElement: () => HTMLElement | undefined): void {
    void tick().then(() => getElement()?.focus());
  }

  $effect(() => {
    const turnNumber = currentTurn.turnNumber;
    if (turnNumber === focusedTurnNumber) return;
    focusedTurnNumber = turnNumber;
    focusAfterRender(() => headingElement);
  });

  $effect(() => {
    const revealed = writtenSupportRevealed;
    if (revealed && previousWrittenSupportRevealed === false) {
      focusAfterRender(() => writtenCopyElement);
    }
    previousWrittenSupportRevealed = revealed;
  });

  $effect(() => {
    const revealed = englishSupportRevealed;
    if (revealed && previousEnglishSupportRevealed === false) {
      focusAfterRender(() => englishSupportCopyElement);
    }
    previousEnglishSupportRevealed = revealed;
  });

  $effect(() => {
    const nextSubmissionState = submissionState;
    const nextTurnNumber = currentTurn.turnNumber;
    if (nextSubmissionState === 'feedback' && previousSubmissionState !== null) {
      focusAfterRender(() => feedbackHeadingElement);
    } else if (nextSubmissionState === 'error' && previousSubmissionState !== 'error') {
      focusAfterRender(() => errorMessageElement);
    } else if (
      nextSubmissionState === 'idle' &&
      (previousSubmissionState === 'feedback' || previousSubmissionState === 'error') &&
      previousSubmissionTurnNumber === nextTurnNumber
    ) {
      focusAfterRender(() => recordButtonElement);
    }
    previousSubmissionState = nextSubmissionState;
    previousSubmissionTurnNumber = nextTurnNumber;
  });

  $effect(() => {
    const nextRecorderStatus = recorderStatus;
    if (nextRecorderStatus === 'recording' && previousRecorderStatus !== null) {
      focusAfterRender(() => stopButtonElement);
    } else if (nextRecorderStatus === 'idle' && previousRecorderStatus === 'recording') {
      focusAfterRender(() => recordButtonElement);
    } else if (
      (nextRecorderStatus === 'error' || nextRecorderStatus === 'unsupported') &&
      nextRecorderStatus !== previousRecorderStatus
    ) {
      focusAfterRender(() => recorderErrorElement);
    }
    previousRecorderStatus = nextRecorderStatus;
  });
</script>

<section class="spoken-shell" aria-labelledby="turn-heading">
  <header class="turn-header">
    <div>
      <p class="eyebrow">Goal {currentTurn.turnNumber} of 3</p>
      <h2 id="turn-heading" tabindex="-1" bind:this={headingElement}>{currentTurn.goalTitle}</h2>
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
    <div class="line-actions">
      <button
        class="line-button"
        type="button"
        disabled={audioStatus === 'loading'}
        onclick={actions.audio.toggleServerLine}
      >
        {audioStatus === 'idle'
          ? 'Listen'
          : audioStatus === 'loading'
            ? 'Loading audio…'
            : audioStatus === 'playing'
              ? 'Stop audio'
              : audioStatus === 'error'
                ? 'Retry audio'
                : 'Replay Japanese'}
      </button>
      {#if !writtenSupportRevealed}
        <button
          class="line-button support"
          type="button"
          disabled={!supportActionsEnabled || writtenSupportDisclosureState === 'processing'}
          onclick={actions.support.revealWritten}
        >
          {writtenSupportDisclosureState === 'processing'
            ? 'Revealing written text…'
            : 'Reveal written text'}
        </button>
      {/if}
      {#if !englishSupportRevealed}
        <button
          class="line-button support"
          type="button"
          disabled={!supportActionsEnabled || englishSupportDisclosureState === 'processing'}
          onclick={actions.support.revealEnglish}
        >
          {englishSupportDisclosureState === 'processing'
            ? 'Revealing English support…'
            : 'Reveal English support'}
        </button>
      {/if}
    </div>
    <div class="audio-status" role="status" aria-live="polite">
      {#if audioStatus === 'loading'}
        Loading audio…
      {:else if audioStatus === 'playing'}
        Japanese audio is playing.
      {:else if audioStatus === 'stopped'}
        Japanese audio stopped.
      {:else if audioStatus === 'error'}
        Audio unavailable. Try again.
      {/if}
    </div>
    {#if writtenSupportRevealed && writtenSupport}
      <div class="written-copy" role="status" tabindex="-1" bind:this={writtenCopyElement}>
        <span>Written hint</span>
        <p class="japanese">{writtenSupport.japanese}</p>
        <p class="romaji">{writtenSupport.romaji}</p>
      </div>
    {/if}
    {#if englishSupportRevealed && englishSupport}
      <div class="support-copy" role="status" tabindex="-1" bind:this={englishSupportCopyElement}>
        <span>English support used</span>
        <p>{englishSupport}</p>
      </div>
    {:else if englishSupportUsedDuringAttempt}
      <p class="prior-support">
        English support was used earlier in this attempt. Completion will be Supported.
      </p>
    {/if}
  </article>

  {#if submissionState === 'feedback' && assessment}
    <article class="assessment" data-outcome={assessment.outcome} aria-live="polite">
      <h3 class="outcome" tabindex="-1" bind:this={feedbackHeadingElement}>
        {assessment.outcome === 'accepted'
          ? 'Accepted'
          : assessment.outcome === 'retry'
            ? 'Try this goal again'
            : 'Could not assess'}
      </h3>
      {#if assessment.transcript}
        <div class="transcript">
          <span>Transcript</span>
          <p>{assessment.transcript}</p>
        </div>
      {/if}
      <p class="feedback">{assessment.feedback}</p>
      {#if assessment.outcome === 'retry' && assessment.retrySuggestion}
        <div class="retry-suggestion">
          <span>Try saying</span>
          <p class="japanese" lang="ja">{assessment.retrySuggestion.japanese}</p>
          <p class="romaji">{assessment.retrySuggestion.romaji}</p>
        </div>
      {/if}
      {#if assessment.outcome === 'accepted' && pendingNextTurn}
        <button class="btn btn-primary" type="button" onclick={actions.assessment.continue}
          >Continue</button
        >
      {:else if assessment.outcome === 'retry' && assessment.retrySuggestion}
        <div class="retry-actions">
          <button
            class="btn btn-primary"
            type="button"
            onclick={actions.assessment.retryGoal}
            disabled={skipState === 'processing'}>Record again</button
          >
          <button
            class="btn btn-ghost"
            type="button"
            disabled={skipState === 'processing'}
            aria-busy={skipState === 'processing'}
            onclick={actions.assessment.skipGoal}
          >
            {skipState === 'processing' ? 'Skipping goal…' : 'Skip goal'}
          </button>
        </div>
        <p class="skip-warning">
          Continuing after a skip means this attempt will not earn Independent or Supported
          evidence.
        </p>
        {#if skipState === 'processing'}
          <p class="skip-status" role="status" aria-live="polite">
            Saving the skip and preparing the next goal…
          </p>
        {/if}
      {:else}
        <button class="btn btn-primary" type="button" onclick={actions.assessment.retryGoal}
          >Record again</button
        >
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
          <button
            class="btn btn-primary record-button"
            type="button"
            bind:this={stopButtonElement}
            onclick={actions.recorder.stop}>Stop and assess</button
          >
          <button class="btn btn-ghost" type="button" onclick={actions.recorder.cancel}
            >Cancel</button
          >
        {:else if recorderStatus === 'requesting_permission' || recorderStatus === 'stopping' || submissionState === 'processing'}
          <button class="btn btn-primary" type="button" disabled>Working…</button>
        {:else if submissionState === 'error'}
          {#if submissionRecovery === 'retry_upload' && hasPendingAudio}
            <button class="btn btn-primary" type="button" onclick={actions.recovery.retryUpload}
              >Retry upload</button
            >
          {/if}
          {#if submissionRecovery === 'record_again'}
            <button class="btn btn-secondary" type="button" onclick={actions.recovery.recordAgain}
              >Record again</button
            >
          {/if}
          <button class="btn btn-secondary" type="button" onclick={actions.recovery.chooseWritten}
            >Use Written Mission</button
          >
        {:else if recorderStatus !== 'unsupported'}
          <button
            class="btn btn-primary record-button"
            type="button"
            disabled={!canRecord}
            bind:this={recordButtonElement}
            onclick={actions.recorder.start}
          >
            <span class="record-icon" aria-hidden="true"></span> Record response
          </button>
        {/if}
        {#if submissionState !== 'error' && (recorderStatus === 'unsupported' || recorderStatus === 'error')}
          <button class="btn btn-secondary" type="button" onclick={actions.recovery.chooseWritten}
            >Use Written Mission</button
          >
        {/if}
      </div>
    </div>
  {/if}

  {#if recorderError}
    <p class="message error" role="alert" tabindex="-1" bind:this={recorderErrorElement}>
      {recorderError}
    </p>
  {/if}
  {#if errorMessage}
    <p class="message error" role="alert" tabindex="-1" bind:this={errorMessageElement}>
      {errorMessage}
    </p>
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
  .audio-status {
    min-height: 1.25rem;
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
  }
  .line-button {
    min-height: 2.75rem;
    padding: var(--space-2) 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--accent-shu);
    font-size: var(--text-sm);
  }
  .line-button.support {
    color: var(--text-bokashi);
  }
  .written-copy,
  .support-copy {
    margin-top: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--border-light);
    background: var(--bg-washi);
  }
  .support-copy {
    background: var(--accent-gold-wash);
    border-color: var(--accent-gold);
  }
  .written-copy span,
  .support-copy span {
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    text-transform: uppercase;
  }
  .written-copy span {
    color: var(--text-bokashi);
  }
  .support-copy span {
    color: var(--state-warning);
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
    margin: 0;
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
  .retry-suggestion {
    min-width: 0;
    padding: var(--space-4);
    border-left: 3px solid var(--accent-shu);
    background: var(--bg-washi);
    display: grid;
    gap: var(--space-1);
  }
  .retry-suggestion span {
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
  }
  .retry-actions {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .skip-warning {
    color: var(--state-warning);
    font-size: var(--text-sm);
  }
  .skip-status {
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
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
    .record-actions,
    .retry-actions {
      align-items: stretch;
    }
    .record-actions :global(.btn),
    .retry-actions :global(.btn) {
      width: 100%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .recording-dot {
      animation: none;
    }
  }
</style>
