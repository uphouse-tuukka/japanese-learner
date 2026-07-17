<script lang="ts">
  import MissionChatTurn from '$lib/components/missions/MissionChatTurn.svelte';
  import MissionChoices from '$lib/components/missions/MissionChoices.svelte';
  import MissionCompletion from '$lib/components/missions/MissionCompletion.svelte';
  import MissionModeBanner from '$lib/components/missions/MissionModeBanner.svelte';
  import SpokenMission from '$lib/components/missions/SpokenMission.svelte';
  import SpokenMissionChoiceStatus from '$lib/components/missions/SpokenMissionChoiceStatus.svelte';
  import { beforeNavigate } from '$app/navigation';
  import { onDestroy, tick } from 'svelte';
  import { canCompleteMission, shouldShowMissionResponseControls } from '$lib/utils/mission-state';
  import type {
    MissionChoice,
    MissionCompleteResponse,
    MissionMode,
    MissionRespondResponse,
    MissionStartResponse,
    MissionTurn,
  } from '$lib/types';
  import type { PageData } from './$types';
  import {
    clearMissionStorage as clearStoredMissionStorage,
    createMissionStorageKey,
    hasSavedMissionState as hasStoredMissionState,
    restoreMissionState as restoreStoredMissionState,
    saveMissionState as saveStoredMissionState,
    type MissionStorageState,
  } from './mission-storage';

  type MissionUiState =
    | 'ready'
    | 'starting'
    | 'active'
    | 'responding'
    | 'evaluating'
    | 'complete'
    | 'error';
  type MissionExperience = 'choice' | 'written' | 'spoken';

  const CATEGORY_LABELS: Record<string, string> = {
    greetings_basics: 'Greetings & Basics',
    food_dining: 'Food & Dining',
    transport: 'Transport',
    hotel_accommodation: 'Hotel & Accommodation',
    shopping: 'Shopping',
    bars_nightlife: 'Bars & Nightlife',
    emergencies_health: 'Emergencies & Health',
  };

  let { data } = $props<{ data: PageData }>();

  let uiState = $state<MissionUiState>('ready');
  let missionExperience = $state<MissionExperience>('choice');

  let mode = $state<MissionMode>('practice');
  let userMissionId = $state<string>('');
  let turns = $state<MissionTurn[]>([]);
  let currentTurnIndex = $state(0);
  let sceneDescription = $state('');
  let characterName = $state('');
  let characterEmoji = $state('');
  let totalTurns = $state(5);
  let correctCount = $state(0);
  let naturalCount = $state(0);
  let hintsEnabled = $state(true);
  let userInput = $state('');
  let completionData = $state<MissionCompleteResponse | null>(null);
  let awaitingCompletion = $state(false);

  let errorMessage = $state('');
  let selectedChoiceIndex = $state<number | null>(null);

  let showContinuePrompt = $state(false);
  let threadContainer = $state<HTMLDivElement | null>(null);
  let missionChoiceHeading = $state<HTMLHeadingElement | null>(null);
  let writtenMissionHeading = $state<HTMLHeadingElement | null>(null);

  async function scrollToLatestTurn(): Promise<void> {
    if (uiState !== 'active') return;
    await tick();
    const latestTurnElement = threadContainer?.lastElementChild;
    if (!(latestTurnElement instanceof HTMLElement)) return;
    latestTurnElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const missionStorageKey = $derived(createMissionStorageKey(data.mission.id, data.selectedUserId));

  function getCurrentMissionState(): MissionStorageState {
    return {
      mode,
      userMissionId,
      turns,
      currentTurnIndex,
      sceneDescription,
      characterName,
      characterEmoji,
      totalTurns,
      correctCount,
      naturalCount,
      hintsEnabled,
      awaitingCompletion,
    };
  }

  function saveMissionState(): void {
    saveStoredMissionState(missionStorageKey, getCurrentMissionState());
  }

  function restoreMissionState(): boolean {
    const saved = restoreStoredMissionState(missionStorageKey);
    if (!saved) return false;

    mode = saved.mode;
    userMissionId = saved.userMissionId;
    turns = saved.turns;
    currentTurnIndex = saved.currentTurnIndex;
    sceneDescription = saved.sceneDescription;
    characterName = saved.characterName;
    characterEmoji = saved.characterEmoji;
    totalTurns = saved.totalTurns;
    correctCount = saved.correctCount;
    naturalCount = saved.naturalCount;
    hintsEnabled = saved.hintsEnabled;
    awaitingCompletion = saved.awaitingCompletion;
    return true;
  }

  function hasSavedMissionState(): boolean {
    return hasStoredMissionState(missionStorageKey);
  }

  function clearMissionStorage(): void {
    clearStoredMissionStorage(missionStorageKey);
  }

  function continueMission(): void {
    const restored = restoreMissionState();
    if (!restored) {
      showContinuePrompt = false;
      return;
    }
    uiState = 'active';
    showContinuePrompt = false;
  }

  function startFreshMission(): void {
    clearMissionStorage();
    showContinuePrompt = false;
    resetMissionState();
    hintsEnabled = true;
  }

  const canStart = $derived(data.unlocked && uiState === 'ready');
  const currentTurn = $derived(turns[currentTurnIndex] ?? null);
  const showResponseControls = $derived(
    shouldShowMissionResponseControls({ awaitingCompletion, uiState }),
  );

  $effect(() => {
    if (hasSavedMissionState() && uiState === 'ready' && data.unlocked) {
      showContinuePrompt = true;
    }
  });

  function resetMissionState(): void {
    userMissionId = '';
    turns = [];
    currentTurnIndex = 0;
    sceneDescription = '';
    characterName = '';
    characterEmoji = '';
    totalTurns = 5;
    correctCount = 0;
    naturalCount = 0;
    userInput = '';
    completionData = null;
    selectedChoiceIndex = null;
    awaitingCompletion = false;
  }

  function resetCompletionState(): void {
    completionData = null;
    awaitingCompletion = false;
    if (uiState === 'complete') {
      uiState = 'ready';
    }
  }

  beforeNavigate((navigation) => {
    if (navigation.to?.route?.id === '/missions/[id]') return;
    resetCompletionState();
  });

  onDestroy(() => {
    resetCompletionState();
  });

  function toggleMode(): void {
    if (uiState !== 'ready') return;
    mode = mode === 'practice' ? 'immersion' : 'practice';
  }

  async function chooseWrittenMission(): Promise<void> {
    missionExperience = 'written';
    await tick();
    writtenMissionHeading?.focus();
  }

  function chooseSpokenMission(): void {
    missionExperience = 'spoken';
  }

  async function returnToMissionChoice(): Promise<void> {
    missionExperience = 'choice';
    await tick();
    missionChoiceHeading?.focus();
  }

  async function startMission(): Promise<void> {
    if (!canStart) return;

    uiState = 'starting';
    errorMessage = '';
    resetMissionState();

    try {
      const res = await fetch(`/api/missions/${data.mission.id}/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: data.selectedUserId, mode }),
      });

      const payload = (await res.json()) as MissionStartResponse & { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? 'Failed to start mission.');
      }

      userMissionId = payload.userMissionId;
      turns = [payload.turn];
      sceneDescription = payload.sceneDescription;
      characterName = payload.characterName;
      characterEmoji = payload.characterEmoji;
      totalTurns = payload.totalTurns;
      currentTurnIndex = 0;
      uiState = 'active';
      saveMissionState();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to start mission.';
      uiState = 'error';
    }
  }

  async function handlePracticeSelect(index: number): Promise<void> {
    if (uiState !== 'active' || mode !== 'practice') return;

    const turn = currentTurn;
    if (!turn || !turn.choices || !turn.choices[index]) return;

    selectedChoiceIndex = index;
    const selected = turn.choices[index] as MissionChoice;
    userInput = selected.japanese;

    await submitResponse(index, selected.japanese, 'responding');
  }

  async function handleImmersionSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (uiState !== 'active' || mode !== 'immersion') return;
    const response = userInput.trim();
    if (!response) return;

    await submitResponse(undefined, response, 'evaluating');
  }

  async function submitResponse(
    selectedChoiceIndexParam: number | undefined,
    responseText: string,
    nextState: 'responding' | 'evaluating',
  ): Promise<void> {
    const turn = currentTurn;
    if (!turn) return;

    uiState = nextState;

    try {
      const res = await fetch(`/api/missions/${data.mission.id}/respond`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: data.selectedUserId,
          userMissionId,
          response: responseText,
          turnNumber: turn.turnNumber,
          selectedChoiceIndex: selectedChoiceIndexParam,
        }),
      });

      const payload = (await res.json()) as MissionRespondResponse & { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? 'Failed to send response.');
      }

      const updatedTurn: MissionTurn = {
        ...turn,
        userResponse: {
          japanese: responseText,
        },
        feedback: payload.feedback,
      };

      turns = turns.map((t, index) => (index === currentTurnIndex ? updatedTurn : t));

      if (payload.feedback.correct) {
        correctCount += 1;
        if (mode === 'immersion') {
          naturalCount += 1;
        }
      }

      if (payload.isComplete) {
        awaitingCompletion = true;
        userInput = '';
        selectedChoiceIndex = null;
        uiState = 'active';
        await scrollToLatestTurn();
        saveMissionState();
        return;
      }

      if (payload.nextTurn) {
        turns = [...turns, payload.nextTurn];
        currentTurnIndex += 1;
      }

      userInput = '';
      selectedChoiceIndex = null;
      uiState = 'active';
      await scrollToLatestTurn();
      saveMissionState();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to process response.';
      uiState = 'error';
    }
  }

  async function completeMission(): Promise<void> {
    if (!canCompleteMission({ awaitingCompletion, uiState, userMissionId })) return;
    uiState = 'responding';

    try {
      const res = await fetch(`/api/missions/${data.mission.id}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: data.selectedUserId,
          userMissionId,
          naturalPhrasings: naturalCount,
        }),
      });

      const payload = (await res.json()) as MissionCompleteResponse & { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? 'Failed to complete mission.');
      }

      completionData = payload;
      uiState = 'complete';
      clearMissionStorage();
    } catch (error) {
      uiState = 'active';
      errorMessage = error instanceof Error ? error.message : 'Failed to complete mission.';
      uiState = 'error';
    }
  }
</script>

<main class="mission-page page-transition">
  {#if uiState !== 'complete'}
    <header class="card mission-header">
      <h1>{data.mission.badgeEmoji} {data.mission.title}</h1>
      <p class="meta">
        Category: {CATEGORY_LABELS[data.mission.category] ?? 'General'} · Scenario difficulty:
        {data.mission.difficulty.charAt(0).toUpperCase() + data.mission.difficulty.slice(1)}
      </p>
      {#if missionExperience === 'written' || !data.spokenMission}
        <MissionModeBanner {mode} onToggle={toggleMode} canToggle={uiState === 'ready'} />
      {/if}
    </header>
  {/if}

  {#if data.spokenMission && missionExperience === 'choice'}
    <section class="card mission-choice" aria-labelledby="mission-choice-heading">
      <div class="choice-heading">
        <p class="choice-kicker">Choose how to practice</p>
        <h2 id="mission-choice-heading" tabindex="-1" bind:this={missionChoiceHeading}>
          One situation, two real ways to prepare.
        </h2>
        <p>Written and spoken work stay separate, so you can choose the evidence you want today.</p>
      </div>

      <div class="mission-type-grid">
        <button class="mission-type-card" type="button" onclick={chooseWrittenMission}>
          <span class="type-icon written-icon" aria-hidden="true">文</span>
          <span class="type-copy">
            <span class="type-label">Written Mission</span>
            <strong>Practice or immerse in writing</strong>
            <small
              >Keep the current hints, free-type flow, XP, badges, replay, and resume behavior.</small
            >
          </span>
          <span class="type-status">
            {data.writtenProgress.completedImmersion
              ? 'Immersion complete'
              : data.writtenProgress.completedPractice
                ? 'Practice complete'
                : 'Ready'}
          </span>
        </button>

        <button class="mission-type-card spoken" type="button" onclick={chooseSpokenMission}>
          <span class="type-icon spoken-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"
              ><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" /><path
                d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v4M9 21h6"
              /></svg
            >
          </span>
          <span class="type-copy">
            <span class="type-label">Spoken Mission</span>
            <strong>Complete the Can-do by voice</strong>
            <small
              >Order, respond, and repair in three short push-to-talk turns. Accent is not scored.</small
            >
          </span>
          <SpokenMissionChoiceStatus
            bestEvidence={data.spokenMission.bestEvidence}
            resumable={data.spokenMission.resumable}
            definitionUpdated={data.spokenMission.definitionUpdated}
          />
        </button>
      </div>

      <a class="back-link" href="/missions">← Back to Travel Missions</a>
    </section>
  {:else if data.spokenMission && missionExperience === 'spoken'}
    <SpokenMission
      missionId={data.mission.id}
      userId={data.selectedUserId}
      briefing={data.spokenMission.briefing}
      bestEvidence={data.spokenMission.bestEvidence}
      resumable={data.spokenMission.resumable}
      definitionUpdated={data.spokenMission.definitionUpdated}
      onChooseWritten={chooseWrittenMission}
    />
  {:else if showContinuePrompt}
    <section class="card ready-card">
      {#if data.spokenMission}
        <h2 class="written-heading" tabindex="-1" bind:this={writtenMissionHeading}>
          Written Mission
        </h2>
        <button class="choice-back" type="button" onclick={returnToMissionChoice}>
          ← Choose mission type
        </button>
      {/if}
      <p>You have an ongoing mission session. Would you like to continue?</p>
      <div class="continue-actions">
        <button class="btn btn-primary" onclick={continueMission}>Continue mission</button>
        <button class="btn btn-secondary" onclick={startFreshMission}>Start over</button>
      </div>
    </section>
  {:else if uiState === 'ready'}
    <section class="card ready-card">
      {#if data.spokenMission}
        <h2 class="written-heading" tabindex="-1" bind:this={writtenMissionHeading}>
          Written Mission
        </h2>
      {/if}
      {#if data.spokenMission}
        <button class="choice-back" type="button" onclick={returnToMissionChoice}>
          ← Choose mission type
        </button>
      {/if}
      <p class="mission-desc">
        Ready to practice your Japanese? Start the mission to begin your conversation.
      </p>

      {#if mode === 'immersion'}
        <div class="hints-toggle-row">
          <span class="hints-label">Hints</span>
          <button
            type="button"
            class="hints-toggle"
            role="switch"
            aria-checked={hintsEnabled}
            onclick={() => (hintsEnabled = !hintsEnabled)}
          >
            <span class="hints-toggle-track" data-enabled={hintsEnabled}>
              <span class="hints-toggle-thumb" data-enabled={hintsEnabled}></span>
            </span>
            <span class="hints-toggle-text">{hintsEnabled ? 'On' : 'Off'}</span>
          </button>
        </div>
      {/if}

      {#if !data.unlocked}
        <p class="locked-message">
          This mission is locked. Complete {data.mission.unlockSessionsRequired} learn sessions in
          {CATEGORY_LABELS[data.mission.category] ?? 'this category'} to unlock.
        </p>
      {/if}

      <button type="button" class="btn-primary" disabled={!canStart} onclick={startMission}>
        Start Mission
      </button>
    </section>
  {:else if uiState === 'starting'}
    <section class="card status-card" aria-live="polite" aria-busy="true">
      <div class="loading-visual">
        <svg class="enso" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="enso-stroke" cx="50" cy="50" r="38" />
        </svg>
        <span class="enso-kanji" aria-hidden="true">話</span>
      </div>
      <p class="loading-text">Preparing your mission...</p>
      <p class="sr-only">Preparing your mission, please wait.</p>
    </section>
  {:else if uiState === 'active' || uiState === 'responding' || uiState === 'evaluating'}
    <section class="card chat-card">
      {#if sceneDescription}
        <article class="scene-card">
          <p>{sceneDescription}</p>
        </article>
      {/if}

      <p class="progress">Turn {currentTurnIndex + 1} / {totalTurns}</p>

      <div class="thread" bind:this={threadContainer}>
        {#each turns as turn, index (turn.turnNumber)}
          <div class="turn-anchor">
            <MissionChatTurn
              {turn}
              {characterName}
              {characterEmoji}
              isCurrentTurn={index === currentTurnIndex}
              turnIndex={index}
            />
          </div>
        {/each}
      </div>

      {#if awaitingCompletion && uiState === 'active'}
        <div class="finish-mission">
          <p class="finish-message">
            Great work — review your final feedback, then finish your mission.
          </p>
          <button
            type="button"
            class="btn-primary finish-button"
            onclick={completeMission}
            disabled={!canCompleteMission({ awaitingCompletion, uiState, userMissionId })}
          >
            Complete Mission
          </button>
        </div>
      {:else if currentTurn && mode === 'practice' && currentTurn.choices && showResponseControls}
        <MissionChoices
          choices={currentTurn.choices}
          onselect={handlePracticeSelect}
          disabled={uiState !== 'active'}
          selectedIndex={selectedChoiceIndex}
        />
      {:else if currentTurn && mode === 'immersion' && showResponseControls}
        <form class="immersion-form" onsubmit={handleImmersionSubmit}>
          <label for="mission-input">Your response</label>
          <input
            id="mission-input"
            type="text"
            bind:value={userInput}
            placeholder="Type your response in Japanese..."
            disabled={uiState !== 'active'}
          />

          {#if hintsEnabled && currentTurn.hint}
            <p class="hint">{currentTurn.hint}</p>
          {/if}

          <button
            type="submit"
            class="btn-primary"
            disabled={uiState !== 'active' || !userInput.trim()}
          >
            Send →
          </button>
        </form>
      {/if}

      {#if uiState === 'responding'}
        <p class="status-note" aria-live="polite">Checking response…</p>
      {:else if uiState === 'evaluating'}
        <p class="status-note" aria-live="polite">Evaluating response…</p>
      {/if}
    </section>
  {:else if uiState === 'complete' && completionData}
    <MissionCompletion
      data={completionData}
      mission={data.mission}
      {mode}
      onTryAgain={() => {
        clearMissionStorage();
        resetMissionState();
        uiState = 'ready';
        mode = 'practice';
        hintsEnabled = true;
      }}
      onTryImmersion={() => {
        clearMissionStorage();
        resetMissionState();
        uiState = 'ready';
        mode = 'immersion';
        hintsEnabled = true;
      }}
    />
  {:else if uiState === 'error'}
    <section class="card error-card" aria-live="polite">
      <p>{errorMessage || 'Something went wrong.'}</p>
      <div class="actions">
        <button type="button" class="btn-secondary" onclick={() => (uiState = 'ready')}>Back</button
        >
        <button type="button" class="btn-primary" onclick={startMission}>Try again</button>
      </div>
    </section>
  {/if}
</main>

<style>
  .mission-page {
    display: grid;
    gap: var(--space-4);
  }

  .mission-header {
    display: grid;
    gap: var(--space-2);
  }

  .mission-header h1,
  .mission-header p {
    margin: 0;
  }

  .mission-choice {
    display: grid;
    gap: var(--space-6);
    padding: clamp(var(--space-5), 5vw, var(--space-8));
    min-width: 0;
  }

  .written-heading {
    margin: 0;
    font-size: var(--text-2xl);
    font-weight: var(--weight-light);
  }

  .choice-heading {
    max-width: 40rem;
    display: grid;
    gap: var(--space-2);
  }

  .choice-heading h2,
  .choice-heading p {
    margin: 0;
  }

  .choice-heading h2 {
    font-size: clamp(var(--text-xl), 4vw, var(--text-3xl));
    font-weight: var(--weight-light);
  }

  .choice-heading > p:last-child {
    color: var(--text-bokashi);
  }

  .choice-kicker {
    color: var(--accent-shu);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
  }

  .mission-type-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
    min-width: 0;
  }

  .mission-type-card {
    min-width: 0;
    min-height: 16rem;
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-mid);
    background: var(--bg-shoji);
    color: var(--text-sumi);
    box-shadow: var(--shadow-sm);
    display: grid;
    grid-template-rows: auto 1fr auto;
    justify-items: start;
    align-items: start;
    gap: var(--space-4);
    text-align: left;
    white-space: normal;
  }

  .mission-type-card:hover {
    border-color: var(--accent-shu-soft);
    background: var(--accent-shu-wash);
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  .mission-type-card.spoken {
    border-top: 3px solid var(--accent-shu);
  }

  .type-icon {
    width: 2.75rem;
    height: 2.75rem;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: var(--bg-washi);
    color: var(--text-bokashi);
    font-size: var(--text-lg);
  }

  .spoken-icon {
    background: var(--accent-shu-wash);
    color: var(--accent-shu);
  }

  .spoken-icon svg {
    width: 1.25rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .type-copy {
    min-width: 0;
    display: grid;
    gap: var(--space-2);
  }

  .type-copy strong {
    font-size: var(--text-lg);
  }

  .type-copy small {
    line-height: var(--leading-normal);
  }

  .type-label {
    color: var(--accent-shu);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
  }

  .type-status {
    padding: var(--space-1) var(--space-3);
    border-radius: 999px;
    background: var(--bg-kinu);
    color: var(--text-bokashi);
    font-size: var(--text-xs);
  }

  .back-link,
  .choice-back {
    justify-self: start;
    min-height: 2.75rem;
    padding: var(--space-2) 0;
    display: inline-flex;
    align-items: center;
    font-size: var(--text-sm);
  }

  .choice-back {
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--accent-shu);
  }

  .meta {
    font-size: var(--text-sm);
    color: var(--text-usuzumi);
  }

  .status-card,
  .chat-card,
  .error-card {
    display: grid;
    gap: var(--space-3);
  }

  .ready-card {
    align-content: center;
    display: grid;
    gap: var(--space-3);
    padding: var(--space-6);
  }

  .ready-card .btn-primary {
    justify-self: start;
  }

  .locked-message {
    color: var(--accent-shu);
    background: var(--accent-shu-wash);
    border: 1px solid var(--accent-shu-soft);
    border-radius: var(--radius-md);
    padding: var(--space-3);
  }

  .mission-desc {
    margin: 0;
    color: var(--text-bokashi);
  }

  .hints-toggle-row {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .hints-label {
    font-size: var(--text-sm);
    color: var(--text-bokashi);
    font-weight: var(--weight-medium);
  }

  .hints-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    border: none;
    background: transparent;
    color: var(--text-bokashi);
    cursor: pointer;
    padding: 0;
    font-size: var(--text-sm);
  }

  .hints-toggle-track {
    width: 36px;
    height: 20px;
    border-radius: 999px;
    background: var(--bg-kinu);
    border: 1px solid var(--border-light);
    padding: 2px;
    display: inline-flex;
    align-items: center;
    transition:
      background-color 180ms ease,
      border-color 180ms ease;
  }

  .hints-toggle-track[data-enabled='true'] {
    background: var(--accent-matcha);
    border-color: var(--accent-matcha);
  }

  .hints-toggle-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--bg-shoji);
    border: 1px solid var(--border-light);
    transform: translateX(0);
    transition:
      transform 180ms ease,
      border-color 180ms ease;
  }

  .hints-toggle-thumb[data-enabled='true'] {
    transform: translateX(16px);
    border-color: var(--accent-matcha);
  }

  .hints-toggle-text {
    min-width: 1.5rem;
    text-align: left;
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
  }

  .scene-card {
    border: 1px solid var(--border-light);
    border-top: 2px solid var(--accent-shu);
    border-radius: var(--radius-lg);
    background: var(--bg-shoji);
    padding: var(--space-4);
  }

  .scene-card p {
    margin: 0;
    color: var(--text-bokashi);
    font-style: italic;
  }

  .progress {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
    letter-spacing: var(--tracking-wide);
  }

  .thread {
    position: relative;
    display: grid;
    gap: var(--space-3);
    padding-left: var(--space-2);
  }

  .thread::before {
    content: '';
    position: absolute;
    left: calc(var(--space-2) + 2px);
    top: var(--space-4);
    bottom: var(--space-4);
    width: 1px;
    background: var(--border-light);
  }

  .immersion-form {
    display: grid;
    gap: var(--space-2);
  }

  .hint {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--accent-matcha-wash);
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }

  .status-note {
    margin: 0;
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
  }

  .finish-mission {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--accent-shu-soft);
    border-radius: var(--radius-md);
    background: var(--accent-shu-wash);
  }

  .finish-message {
    margin: 0;
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }

  .finish-button {
    justify-self: start;
  }

  .actions {
    display: flex;
    gap: var(--space-2);
  }

  .status-card {
    min-height: 16rem;
    align-content: center;
    justify-items: center;
    text-align: center;
    padding: var(--space-8) var(--space-6);
  }

  .loading-visual {
    position: relative;
    width: 120px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .enso {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-120deg);
    animation: enso-rotate 6s linear infinite;
    overflow: visible;
  }

  .enso-stroke {
    fill: none;
    stroke: var(--text-sumi);
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-dasharray: 239;
    stroke-dashoffset: 239;
    animation: enso-draw 4s ease-in-out infinite;
  }

  .enso-kanji {
    position: relative;
    font-size: var(--text-3xl);
    color: var(--accent-shu);
    font-weight: var(--weight-light);
    animation: breathe 4s ease-in-out infinite;
    user-select: none;
  }

  .loading-text {
    margin: 0;
    color: var(--text-bokashi);
    font-size: var(--text-base);
  }

  @keyframes enso-draw {
    0% {
      stroke-dashoffset: 239;
      opacity: 0;
    }
    6% {
      stroke-dashoffset: 224;
      opacity: 0.6;
    }
    50% {
      stroke-dashoffset: 20;
      opacity: 0.6;
    }
    65% {
      stroke-dashoffset: 20;
      opacity: 0.6;
    }
    92% {
      stroke-dashoffset: 20;
      opacity: 0;
    }
    100% {
      stroke-dashoffset: 20;
      opacity: 0;
    }
  }

  @keyframes enso-rotate {
    0% {
      transform: rotate(-120deg);
    }
    100% {
      transform: rotate(240deg);
    }
  }

  @keyframes breathe {
    0%,
    100% {
      opacity: 0.4;
      transform: scale(0.96);
    }
    50% {
      opacity: 0.9;
      transform: scale(1.04);
    }
  }
  .continue-actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  @media (max-width: 37.5rem) {
    .mission-type-grid {
      grid-template-columns: 1fr;
    }

    .mission-type-card {
      min-height: 13rem;
    }
  }
</style>
