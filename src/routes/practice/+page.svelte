<script lang="ts">
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import SessionRenderer from '$lib/components/SessionRenderer.svelte';
  import SessionSummary from '$lib/components/SessionSummary.svelte';
  import DebugPanel from '$lib/components/DebugPanel.svelte';
  import {
    session,
    exercises,
    answers,
    currentIndex,
    summary,
    startSession,
    answerExercise,
    nextExercise,
    completeSession,
    resetSession,
    saveSessionToStorage,
    restoreSessionFromStorage,
    hasSavedSession,
    getSavedSessionAt,
    clearSessionStorage,
  } from '$lib/stores/session.svelte';
  import {
    recordCorrectAnswer,
    recordIncorrectAnswer,
    resetGamification,
    sessionXp,
    setSessionXp,
    saveGamificationToStorage,
    restoreGamificationFromStorage,
    clearGamificationStorage,
  } from '$lib/stores/gamification.svelte';
  import type { Exercise, ExerciseAnswerPayload, ExerciseType, Session } from '$lib/types';
  import type { PageData } from './$types';

  type UiState = 'idle' | 'loading' | 'active' | 'completing' | 'done' | 'error';
  type GenerateResponse = {
    ok: boolean;
    state: 'active';
    session: Session | null;
    exercises: Exercise[];
    error?: string;
  };
  type CompleteResponse = {
    ok: boolean;
    state: 'done';
    summary: import('$lib/types').SessionSummary;
    xp?: import('$lib/types').SessionXpBreakdown;
    error?: string;
  };

  let { data } = $props<{ data: PageData }>();
  let uiState = $state<UiState>('idle');
  let errorMessage = $state('');

  const STORAGE_KEY = 'practice';
  let showContinuePrompt = $state(false);
  let continueSavedAtLabel = $state('');

  function saveState(): void {
    saveSessionToStorage(STORAGE_KEY);
    saveGamificationToStorage(STORAGE_KEY);
  }

  function clearAllStorage(): void {
    clearSessionStorage(STORAGE_KEY);
    clearGamificationStorage(STORAGE_KEY);
  }

  function continuePracticeSession(): void {
    const restored = restoreSessionFromStorage(STORAGE_KEY);
    if (!restored) {
      showContinuePrompt = false;
      continueSavedAtLabel = '';
      return;
    }
    restoreGamificationFromStorage(STORAGE_KEY);
    uiState = 'active';
    showContinuePrompt = false;
    continueSavedAtLabel = '';
  }

  function startFresh(): void {
    clearAllStorage();
    showContinuePrompt = false;
    continueSavedAtLabel = '';
    resetSession();
    resetGamification();
  }

  function formatSavedAt(savedAt: string | null): string {
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

  /* — Loading animation state — */
  const loadingMessages = [
    'Selecting exercises for review\u2026',
    'Prioritizing your weak spots\u2026',
    'Preparing practice questions\u2026',
    'Almost ready\u2026',
  ];
  let loadingMsgIndex = $state(0);
  let loadingMsgVisible = $state(true);

  function getHelsinkiLocalDate(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Helsinki',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  $effect(() => {
    if (uiState !== 'loading') return;
    loadingMsgIndex = 0;
    loadingMsgVisible = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    const intervalId = setInterval(() => {
      loadingMsgVisible = false;
      timeoutId = setTimeout(() => {
        loadingMsgIndex = (loadingMsgIndex + 1) % loadingMessages.length;
        loadingMsgVisible = true;
      }, 400);
    }, 2800);
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  });

  $effect(() => {
    if (hasSavedSession(STORAGE_KEY) && uiState === 'idle') {
      showContinuePrompt = true;
      continueSavedAtLabel = formatSavedAt(getSavedSessionAt(STORAGE_KEY));
    }
  });

  const totalExercises = $derived($exercises.length);
  const currentExercise = $derived($exercises[$currentIndex] ?? null);
  const progressCurrent = $derived(Math.min($currentIndex + 1, Math.max($exercises.length, 1)));

  async function startPracticeSession(body: {
    exerciseCount: number;
    debugExerciseType?: ExerciseType;
  }): Promise<void> {
    uiState = 'loading';
    errorMessage = '';
    clearAllStorage();
    showContinuePrompt = false;
    continueSavedAtLabel = '';
    resetSession();
    resetGamification();

    try {
      const response = await fetch('/api/practice/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: data.selectedUserId, ...body }),
      });
      const payload = (await response.json()) as GenerateResponse;
      if (!response.ok || !payload.ok || !payload.session)
        throw new Error(payload.error ?? 'Failed to generate practice session');
      if (!payload.exercises || payload.exercises.length === 0)
        throw new Error(
          'No practice exercises available. Complete a learning session first to build your review pool.',
        );
      startSession(payload.session, payload.exercises);
      saveState();
      uiState = 'active';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      uiState = 'error';
    }
  }

  function startPractice(): Promise<void> {
    return startPracticeSession({ exerciseCount: 10 });
  }

  function startDebugPractice(type: ExerciseType): Promise<void> {
    return startPracticeSession({ exerciseCount: 6, debugExerciseType: type });
  }

  async function onAnswer(payload: ExerciseAnswerPayload): Promise<void> {
    if (!currentExercise) return;
    answerExercise($currentIndex, payload);
    saveState();
    if (payload.isCorrect) {
      recordCorrectAnswer(10);
    } else {
      recordIncorrectAnswer();
    }
    const isLast = $currentIndex >= $exercises.length - 1;
    if (!isLast) {
      nextExercise();
      return;
    }
    await finalizePractice();
  }

  async function finalizePractice(): Promise<void> {
    if (!$session) {
      errorMessage = 'Session missing. Start again.';
      uiState = 'error';
      return;
    }
    uiState = 'completing';
    try {
      const response = await fetch('/api/practice/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: data.selectedUserId,
          sessionId: $session.id,
          results: $answers,
          localDate: getHelsinkiLocalDate(),
        }),
      });
      const payload = (await response.json()) as CompleteResponse;
      if (!response.ok || !payload.ok)
        throw new Error(payload.error ?? 'Failed to complete practice session');
      if (payload.xp) {
        setSessionXp(payload.xp);
      }
      completeSession(payload.summary);
      clearAllStorage();
      showContinuePrompt = false;
      continueSavedAtLabel = '';
      uiState = 'done';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      uiState = 'error';
    }
  }
</script>

<main class="practice-page page-transition">
  {#if uiState === 'idle'}
    <section class="card">
      <h1>Practice</h1>
      {#if showContinuePrompt}
        <div class="continue-prompt">
          <p>
            Continue your previous practice session?
            {#if continueSavedAtLabel}Last saved on {continueSavedAtLabel}.{/if}
          </p>
          <div class="continue-actions">
            <button class="btn btn-primary" onclick={continuePracticeSession}
              >Continue session</button
            >
            <button class="btn btn-secondary" onclick={startFresh}>Start new session</button>
          </div>
        </div>
      {/if}
      <p>
        Run a focused review session with weighted practice exercises drawn from your past learning
        sessions.
      </p>
      <button class="btn btn-primary" onclick={startPractice}>Start practice</button>
    </section>
  {:else if uiState === 'loading'}
    <section class="card loading-card" aria-live="polite" aria-busy="true">
      <div class="loading-visual">
        <svg class="enso" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="enso-stroke" cx="50" cy="50" r="38" />
        </svg>
        <span class="enso-kanji" aria-hidden="true">練</span>
      </div>
      <p class="loading-text" style:opacity={loadingMsgVisible ? 1 : 0}>
        {loadingMessages[loadingMsgIndex]}
      </p>
      <p class="sr-only">Generating your practice session, please wait.</p>
    </section>
  {:else if uiState === 'active'}
    <section class="card">
      <ProgressBar current={progressCurrent} total={totalExercises} label="Practice progress" />
    </section>
    {#if currentExercise}
      <SessionRenderer exercise={currentExercise} {onAnswer} />
    {/if}
  {:else if uiState === 'completing'}
    <section class="card loading-card" aria-live="polite" aria-busy="true">
      <div class="loading-visual">
        <svg class="enso" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="enso-stroke" cx="50" cy="50" r="38" />
        </svg>
        <span class="enso-kanji" aria-hidden="true">完</span>
      </div>
      <p class="loading-text">Preparing your practice summary…</p>
    </section>
  {:else if uiState === 'done' && $summary}
    <SessionSummary summary={$summary} xpBreakdown={$sessionXp ?? undefined} />
  {:else if uiState === 'error'}
    <section class="card">
      <h1>Practice</h1>
      <p class="error-text">{errorMessage}</p>
      <button
        class="btn btn-primary"
        onclick={() => {
          uiState = 'idle';
        }}>Back to practice</button
      >
    </section>
  {/if}

  <DebugPanel onGenerateDebug={startDebugPractice} />
</main>

<style>
  .practice-page {
    display: grid;
    gap: var(--space-4);
  }

  .error-text {
    color: var(--state-error);
  }

  .loading-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-12) var(--space-6);
    gap: var(--space-6);
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
    overflow: visible;
  }

  .enso-stroke {
    fill: none;
    stroke: var(--text-sumi);
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-dasharray: 239;
    stroke-dashoffset: 239;
    animation: draw-enso 4s ease-in-out infinite;
  }

  @keyframes draw-enso {
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

  .enso-kanji {
    position: relative;
    font-size: var(--text-3xl);
    color: var(--accent-shu);
    font-weight: var(--weight-light);
    animation: kanji-breathe 4s ease-in-out infinite;
    user-select: none;
  }

  @keyframes kanji-breathe {
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

  .loading-text {
    color: var(--text-bokashi);
    font-size: var(--text-base);
    text-align: center;
    transition: opacity 0.4s var(--ease-in-out);
    min-height: 1.6em;
    margin: 0;
  }

  .continue-prompt {
    display: grid;
    gap: var(--space-3);
  }

  .continue-prompt p {
    margin: 0;
    color: var(--text-bokashi);
  }

  .continue-actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
</style>
