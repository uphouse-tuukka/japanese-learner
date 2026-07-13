<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    createAudioRecorder,
    type AudioRecorderController,
    type AudioRecorderStatus,
  } from '$lib/utils/audio-recorder';
  import { isSpeaking, speak, stop } from '$lib/utils/tts';
  import type {
    SpokenMissionBriefing,
    SpokenMissionEvidenceState,
    SpokenMissionResult,
    SpokenMissionServerTurn,
    SpokenMissionStartResponse,
    SpokenMissionTurnResponse,
  } from '$lib/types';

  type Props = {
    missionId: string;
    userId: string;
    briefing: SpokenMissionBriefing;
    bestEvidence: SpokenMissionEvidenceState | 'untried';
    resumable: { currentTurn: number; supportUsed: boolean } | null;
    onChooseWritten: () => void;
  };

  type Stage = 'briefing' | 'starting' | 'active' | 'complete';
  type SubmissionState = 'idle' | 'processing' | 'feedback' | 'error';

  let { missionId, userId, briefing, bestEvidence, resumable, onChooseWritten }: Props = $props();

  let stage = $state<Stage>('briefing');
  let submissionState = $state<SubmissionState>('idle');
  let attemptId = $state('');
  let definitionVersion = $state('');
  let currentTurn = $state<SpokenMissionServerTurn | null>(null);
  let pendingNextTurn = $state<SpokenMissionServerTurn | null>(null);
  let supportRevealed = $state(false);
  let attemptSupportUsed = $state(false);
  let assessment = $state<SpokenMissionTurnResponse['assessment'] | null>(null);
  let result = $state<SpokenMissionResult | null>(null);
  let errorMessage = $state('');
  let pendingAudio = $state<Blob | null>(null);
  let pendingResponseId = $state('');
  let recorderStatus = $state<AudioRecorderStatus>('idle');
  let recordingSeconds = $state(0);
  let selectedMimeType = $state('');
  let recorderError = $state('');
  let audioPlaying = $state(false);
  let audioPoll: ReturnType<typeof setInterval> | null = null;
  let recorder: AudioRecorderController | null = null;

  const canRecord = $derived(
    submissionState === 'idle' && (recorderStatus === 'idle' || recorderStatus === 'error'),
  );
  const evidenceLabel = $derived(
    bestEvidence === 'untried'
      ? 'Untried'
      : bestEvidence === 'independent'
        ? 'Independent'
        : 'Supported',
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
        selectedMimeType = snapshot.mimeType;
        recorderError = snapshot.errorMessage?.includes('permission was denied')
          ? 'Microphone permission was denied. Retry recording or use Written Mission.'
          : (snapshot.errorMessage ??
            (snapshot.status === 'unsupported'
              ? 'Microphone recording is not supported in this browser.'
              : ''));
      },
      onRecordingReady: ({ audio, mimeType }) => {
        selectedMimeType = mimeType;
        pendingAudio = audio;
        pendingResponseId = createResponseId();
        void submitRecording();
      },
    });
  }

  async function startMission(startOver: boolean): Promise<void> {
    stage = 'starting';
    errorMessage = '';
    try {
      const response = await fetch(`/api/missions/${missionId}/spoken/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId, startOver }),
      });
      const payload = (await response.json()) as SpokenMissionStartResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Could not start Spoken Mission.');

      attemptId = payload.attemptId;
      definitionVersion = payload.definitionVersion;
      currentTurn = payload.turn;
      attemptSupportUsed = payload.supportUsed;
      supportRevealed = false;
      submissionState = 'idle';
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
    if (!pendingAudio || !pendingResponseId || !currentTurn) return;
    submissionState = 'processing';
    errorMessage = '';

    const form = new FormData();
    form.set('userId', userId);
    form.set('attemptId', attemptId);
    form.set('definitionVersion', definitionVersion);
    form.set('turnNumber', String(currentTurn.turnNumber));
    form.set('clientResponseId', pendingResponseId);
    form.set('supportRevealed', String(supportRevealed));
    const extension = selectedMimeType.includes('mp4') ? 'mp4' : 'webm';
    form.set('audio', pendingAudio, `spoken-mission-turn.${extension}`);

    try {
      const response = await fetch(`/api/missions/${missionId}/spoken/turn`, {
        method: 'POST',
        body: form,
      });
      const payload = (await response.json()) as SpokenMissionTurnResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Could not assess this response.');

      assessment = payload.assessment;
      pendingNextTurn = payload.nextTurn;
      result = payload.result;
      pendingAudio = null;
      pendingResponseId = '';
      submissionState = 'feedback';
      if (payload.isComplete && payload.result) {
        stage = 'complete';
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Could not assess this response.';
      submissionState = 'error';
    }
  }

  function retryGoal(): void {
    assessment = null;
    errorMessage = '';
    pendingAudio = null;
    pendingResponseId = '';
    submissionState = 'idle';
    recorder?.retry();
  }

  function continueToNextGoal(): void {
    if (!pendingNextTurn) return;
    currentTurn = pendingNextTurn;
    pendingNextTurn = null;
    supportRevealed = false;
    assessment = null;
    submissionState = 'idle';
    recorder?.retry();
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
      await speak(currentTurn.npcDialogue.japanese, { preferBrowser: true });
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
  <section class="spoken-shell briefing" aria-labelledby="spoken-heading">
    <div class="spoken-kicker">
      <span class="mic-seal" aria-hidden="true">
        <svg viewBox="0 0 24 24"
          ><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" /><path
            d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v4M9 21h6"
          /></svg
        >
      </span>
      <span>Spoken Mission</span>
      <span class="evidence-chip" data-evidence={bestEvidence}>{evidenceLabel}</span>
    </div>

    <div class="briefing-lead">
      <p class="eyebrow">Can-do</p>
      <h2 id="spoken-heading">{briefing.canDo}</h2>
      <p>{briefing.situation}</p>
    </div>

    <ol class="goal-list" aria-label="Mission goals">
      {#each briefing.goals as goal, index (goal.key)}
        <li>
          <span class="goal-number">{index + 1}</span>
          <span><strong>{goal.title}</strong><small>{goal.learnerGoal}</small></span>
        </li>
      {/each}
    </ol>

    <div class="briefing-notes">
      <p><strong>About {briefing.approximateMinutes} minutes.</strong> {briefing.assessment}</p>
      <p><strong>Audio privacy.</strong> {briefing.privacy}</p>
    </div>

    {#if errorMessage}
      <p class="message error" role="alert">{errorMessage}</p>
    {/if}

    <div class="briefing-actions">
      {#if resumable}
        <button class="btn btn-primary" type="button" onclick={() => startMission(false)}>
          Resume goal {resumable.currentTurn}
        </button>
        <button class="btn btn-secondary" type="button" onclick={() => startMission(true)}>
          Start over
        </button>
      {:else}
        <button class="btn btn-primary" type="button" onclick={() => startMission(false)}>
          Start Spoken Mission
        </button>
      {/if}
      <button class="btn btn-ghost" type="button" onclick={onChooseWritten}
        >Choose Written Mission</button
      >
    </div>
    <p class="permission-note">Microphone permission is requested only when you press Record.</p>
  </section>
{:else if stage === 'starting'}
  <section class="spoken-shell starting" aria-live="polite" aria-busy="true">
    <span class="ink-pulse" aria-hidden="true">話</span>
    <p>Preparing the restaurant conversation…</p>
  </section>
{:else if stage === 'active' && currentTurn}
  <section class="spoken-shell active" aria-labelledby="turn-heading">
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
        <button class="line-button" type="button" onclick={playServerLine}>
          {audioPlaying ? 'Stop audio' : 'Replay Japanese'}
        </button>
        {#if !supportRevealed}
          <button
            class="line-button support"
            type="button"
            onclick={() => {
              supportRevealed = true;
              attemptSupportUsed = true;
            }}
          >
            Reveal English support
          </button>
        {/if}
      </div>
      {#if supportRevealed}
        <div class="support-copy">
          <span>English support used</span>
          <p>{currentTurn.englishSupport}</p>
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
          <button class="btn btn-primary" type="button" onclick={continueToNextGoal}
            >Continue</button
          >
        {:else}
          <button class="btn btn-primary" type="button" onclick={retryGoal}>Record again</button>
        {/if}
      </article>
    {:else}
      <div class="record-panel">
        <div class="record-status" aria-live="polite">
          {#if recorderStatus === 'recording'}
            <span class="recording-dot" aria-hidden="true"></span>
            <strong>Recording {recordingSeconds}s / {briefing.maxRecordingSeconds}s</strong>
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
            <button class="btn btn-primary record-button" type="button" onclick={stopRecording}
              >Stop and assess</button
            >
            <button class="btn btn-ghost" type="button" onclick={cancelRecording}>Cancel</button>
          {:else if recorderStatus === 'requesting_permission' || recorderStatus === 'stopping' || submissionState === 'processing'}
            <button class="btn btn-primary" type="button" disabled>Working…</button>
          {:else if submissionState === 'error' && pendingAudio}
            <button class="btn btn-primary" type="button" onclick={submitRecording}
              >Retry upload</button
            >
          {:else if recorderStatus !== 'unsupported'}
            <button
              class="btn btn-primary record-button"
              type="button"
              disabled={!canRecord}
              onclick={startRecording}
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
{:else if stage === 'complete' && result}
  <section class="spoken-shell result" aria-labelledby="result-heading">
    <div class="result-seal" data-evidence={result.evidenceState} aria-hidden="true">話</div>
    <p class="eyebrow">Spoken Mission complete</p>
    <h2 id="result-heading">
      {result.evidenceState === 'independent' ? 'Independent evidence' : 'Supported evidence'}
    </h2>
    <p class="result-can-do">{result.canDo}</p>

    <div class="evidence-list">
      {#each result.goals as goal}
        <article>
          <span>✓ {goal.title}</span>
          <p lang="ja">{goal.transcript}</p>
        </article>
      {/each}
    </div>

    <article class="practice-phrase">
      <span>One phrase to keep fresh</span>
      <p class="japanese">{result.suggestedPhrase.japanese}</p>
      <p class="romaji">{result.suggestedPhrase.romaji}</p>
      <small>{result.suggestedPhrase.english}</small>
    </article>

    <p class="result-note">
      This is task evidence only. It does not award XP, badges, streak credit, or Written Mission
      completion.
    </p>
    <div class="briefing-actions">
      <a class="btn btn-primary" href="/missions">Back to Travel Missions</a>
      <button class="btn btn-secondary" type="button" onclick={() => startMission(true)}
        >Try again</button
      >
    </div>
  </section>
{/if}

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
  .spoken-kicker,
  .turn-header,
  .server-label,
  .line-actions,
  .record-actions,
  .briefing-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .spoken-kicker {
    color: var(--text-bokashi);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-wide);
  }
  .mic-seal {
    width: 2rem;
    height: 2rem;
    display: grid;
    place-items: center;
    border-radius: 999px;
    color: var(--accent-shu);
    background: var(--accent-shu-wash);
  }
  .mic-seal svg {
    width: 1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .evidence-chip {
    margin-left: auto;
    padding: var(--space-1) var(--space-3);
    border-radius: 999px;
    border: 1px solid var(--border-light);
    background: var(--bg-washi);
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
  }
  .evidence-chip[data-evidence='independent'] {
    border-color: var(--accent-matcha);
    background: var(--accent-matcha-wash);
    color: var(--accent-matcha);
  }
  .briefing-lead {
    max-width: 42rem;
    display: grid;
    gap: var(--space-2);
  }
  .briefing-lead h2,
  .briefing-lead p,
  .eyebrow,
  .server-line p,
  .record-status small,
  .assessment p,
  .result p,
  .practice-phrase p {
    margin: 0;
  }
  .briefing-lead h2 {
    font-size: clamp(var(--text-xl), 4vw, var(--text-3xl));
    font-weight: var(--weight-light);
  }
  .eyebrow {
    color: var(--accent-shu);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
  }
  .goal-list {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .goal-list li {
    min-width: 0;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--bg-washi);
    border-top: 2px solid var(--accent-shu);
    border-radius: var(--radius-md);
  }
  .goal-list strong,
  .goal-list small {
    display: block;
  }
  .goal-list small {
    margin-top: var(--space-1);
  }
  .goal-number {
    color: var(--accent-shu);
    font-size: var(--text-xl);
    font-weight: var(--weight-light);
  }
  .briefing-notes {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-4);
    border: 1px solid var(--border-light);
    background: var(--bg-shoji);
  }
  .briefing-notes p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-bokashi);
  }
  .permission-note {
    margin: calc(var(--space-2) * -1) 0 0;
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
  }
  .starting {
    min-height: 18rem;
    place-items: center;
    align-content: center;
    text-align: center;
  }
  .ink-pulse {
    font-size: var(--text-4xl);
    color: var(--accent-shu);
    animation: ink-pulse 1.8s var(--ease-in-out) infinite;
  }
  .turn-header {
    justify-content: space-between;
  }
  .turn-header h2 {
    margin: 0;
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
  .result {
    text-align: center;
    justify-items: center;
  }
  .result-seal {
    width: 5rem;
    height: 5rem;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: var(--accent-matcha-wash);
    border: 2px solid var(--accent-matcha);
    color: var(--accent-matcha);
    font-size: var(--text-3xl);
  }
  .result h2 {
    margin: calc(var(--space-3) * -1) 0 0;
    font-size: var(--text-3xl);
  }
  .result-can-do {
    max-width: 38rem;
    color: var(--text-bokashi);
  }
  .evidence-list {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
    text-align: left;
  }
  .evidence-list article {
    min-width: 0;
    padding: var(--space-4);
    border: 1px solid var(--border-light);
    background: var(--bg-shoji);
  }
  .evidence-list span {
    color: var(--accent-matcha);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
  }
  .evidence-list p {
    margin-top: var(--space-2);
    overflow-wrap: anywhere;
  }
  .practice-phrase {
    width: 100%;
    padding: var(--space-5);
    text-align: left;
    border-left: 3px solid var(--accent-shu);
    background: var(--bg-washi);
  }
  .practice-phrase > span {
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
  }
  .practice-phrase .japanese {
    margin-top: var(--space-2);
  }
  .result-note {
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
  }
  @keyframes ink-pulse {
    50% {
      opacity: 0.35;
      transform: scale(0.94);
    }
  }
  @media (max-width: 37.5rem) {
    .goal-list,
    .evidence-list {
      grid-template-columns: 1fr;
    }
    .evidence-chip {
      margin-left: 0;
    }
    .briefing-actions,
    .record-actions {
      align-items: stretch;
    }
    .briefing-actions :global(.btn),
    .record-actions :global(.btn) {
      width: 100%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ink-pulse,
    .recording-dot {
      animation: none;
    }
  }
</style>
