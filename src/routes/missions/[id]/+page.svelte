<script lang="ts">
  import MissionChatTurn from '$lib/components/missions/MissionChatTurn.svelte';
  import MissionChoices from '$lib/components/missions/MissionChoices.svelte';
  import MissionCompletion from '$lib/components/missions/MissionCompletion.svelte';
  import MissionModeBanner from '$lib/components/missions/MissionModeBanner.svelte';
  import type {
    MissionChoice,
    MissionCompleteResponse,
    MissionMode,
    MissionRespondResponse,
    MissionStartResponse,
    MissionTurn,
  } from '$lib/types';
  import type { PageData } from './$types';

  type MissionUiState =
    | 'ready'
    | 'starting'
    | 'active'
    | 'responding'
    | 'evaluating'
    | 'complete'
    | 'error';

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
  let userInput = $state('');
  let completionData = $state<MissionCompleteResponse | null>(null);

  let errorMessage = $state('');
  let selectedChoiceIndex = $state<number | null>(null);

  let showContinuePrompt = $state(false);
  let continueSavedAtLabel = $state('');

  function getMissionStorageKey(): string {
    return `jp-mission:${data.mission.id}`;
  }

  type MissionStorageState = {
    mode: MissionMode;
    userMissionId: string;
    turns: MissionTurn[];
    currentTurnIndex: number;
    sceneDescription: string;
    characterName: string;
    characterEmoji: string;
    totalTurns: number;
    correctCount: number;
    naturalCount: number;
    savedAt: string;
  };

  function saveMissionState(): void {
    try {
      const stateData: MissionStorageState = {
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
        savedAt: new Date().toISOString(),
      };
      sessionStorage.setItem(getMissionStorageKey(), JSON.stringify(stateData));
    } catch {
      /* ignore */
    }
  }

  function clearMissionStorage(): void {
    try {
      sessionStorage.removeItem(getMissionStorageKey());
    } catch {
      /* ignore */
    }
  }

  function continueMission(): void {
    try {
      const raw = sessionStorage.getItem(getMissionStorageKey());
      if (!raw) {
        showContinuePrompt = false;
        continueSavedAtLabel = '';
        return;
      }
      const saved = JSON.parse(raw) as MissionStorageState;
      if (!saved.userMissionId || !saved.turns?.length) {
        showContinuePrompt = false;
        continueSavedAtLabel = '';
        return;
      }
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
      uiState = 'active';
      showContinuePrompt = false;
      continueSavedAtLabel = '';
    } catch {
      showContinuePrompt = false;
      continueSavedAtLabel = '';
    }
  }

  function startFreshMission(): void {
    clearMissionStorage();
    showContinuePrompt = false;
    continueSavedAtLabel = '';
    resetMissionState();
  }

  function formatSavedAt(savedAt: string | undefined): string {
    if (!savedAt) return '';
    const date = new Date(savedAt);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  const canStart = $derived(data.unlocked && uiState === 'ready');
  const currentTurn = $derived(turns[currentTurnIndex] ?? null);

  $effect(() => {
    if (uiState !== 'ready' || !data.unlocked) return;
    try {
      const raw = sessionStorage.getItem(getMissionStorageKey());
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.userMissionId && saved?.turns?.length > 0) {
        showContinuePrompt = true;
        continueSavedAtLabel = formatSavedAt(saved.savedAt);
      }
    } catch {
      /* ignore */
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
  }

  function toggleMode(): void {
    if (uiState !== 'ready') return;
    mode = mode === 'practice' ? 'immersion' : 'practice';
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
        await completeMission();
        return;
      }

      if (payload.nextTurn) {
        turns = [...turns, payload.nextTurn];
        currentTurnIndex += 1;
      }

      userInput = '';
      selectedChoiceIndex = null;
      uiState = 'active';
      saveMissionState();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to process response.';
      uiState = 'error';
    }
  }

  async function completeMission(): Promise<void> {
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
      <MissionModeBanner {mode} onToggle={toggleMode} canToggle={uiState === 'ready'} />
    </header>
  {/if}

  {#if showContinuePrompt}
    <section class="card ready-card">
      <p>
        Continue your previous mission?
        {#if continueSavedAtLabel}Last saved on {continueSavedAtLabel}.{/if}
      </p>
      <div class="continue-actions">
        <button class="btn btn-primary" onclick={continueMission}>Continue mission</button>
        <button class="btn btn-secondary" onclick={startFreshMission}>Start over</button>
      </div>
    </section>
  {:else if uiState === 'ready'}
    <section class="card ready-card">
      <p class="mission-desc">
        Ready to practice your Japanese? Start the mission to begin your conversation.
      </p>

      {#if !data.unlocked}
        <p class="locked-message">
          🔒 This mission is locked. Complete {data.mission.unlockSessionsRequired} learn sessions in
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

      <div class="thread">
        {#each turns as turn, index (turn.turnNumber)}
          <MissionChatTurn
            {turn}
            {characterName}
            {characterEmoji}
            isCurrentTurn={index === currentTurnIndex}
            turnIndex={index}
          />
        {/each}
      </div>

      {#if currentTurn && mode === 'practice' && currentTurn.choices}
        <MissionChoices
          choices={currentTurn.choices}
          onselect={handlePracticeSelect}
          disabled={uiState !== 'active'}
          selectedIndex={selectedChoiceIndex}
        />
      {:else if currentTurn && mode === 'immersion'}
        <form class="immersion-form" onsubmit={handleImmersionSubmit}>
          <label for="mission-input">Your response</label>
          <input
            id="mission-input"
            type="text"
            bind:value={userInput}
            placeholder="Type your response in Japanese..."
            disabled={uiState !== 'active'}
          />

          {#if currentTurn.hint}
            <p class="hint">💡 {currentTurn.hint}</p>
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
    <MissionCompletion data={completionData} mission={data.mission} {mode} />
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

  .meta {
    font-size: var(--text-sm);
    color: var(--text-usuzumi);
  }

  .ready-card,
  .status-card,
  .chat-card,
  .error-card {
    display: grid;
    gap: var(--space-3);
  }

  .ready-card,
  .status-card {
    min-height: 16rem;
    align-content: center;
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

  .actions {
    display: flex;
    gap: var(--space-2);
  }

  .status-card {
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
</style>
