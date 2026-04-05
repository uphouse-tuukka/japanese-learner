<script lang="ts">
  import { fade } from 'svelte/transition';
  import SessionRenderer from '$lib/components/SessionRenderer.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import RichJapaneseText from '$lib/components/RichJapaneseText.svelte';
  import InlineAudio from '$lib/components/InlineAudio.svelte';
  import { isSupported, getJapaneseVoice } from '$lib/utils/tts';
  import type { Exercise, ExerciseAnswerPayload, Lesson } from '$lib/types';

  type ViewState =
    | 'intro'
    | 'loading'
    | 'lesson'
    | 'active'
    | 'summarizing'
    | 'done'
    | 'quota'
    | 'error';

  type Scenario = { id: string; label: string; emoji: string };

  type SessionStatePayload = {
    sessionId: string;
    state: 'lesson' | 'active' | 'done';
    scenario: string;
    lesson: Lesson;
    exercises: Exercise[];
    answers: ExerciseAnswerPayload[];
    currentIndex: number;
    expiresAt: string;
    remainingSessionsToday?: number;
  };

  type SummaryStats = {
    accuracy: number;
    totalCorrect: number;
    totalExercises: number;
    scenario: string;
    phrasesLearned: string[];
  };

  type SummaryData = {
    summary: string;
    stats: SummaryStats;
    strengths: string[];
    misses: string[];
    nextSteps: string[];
    celebration: {
      type?: string;
      label: string;
      emoji: string;
    };
  };

  type ApiError = { ok: false; reason?: string; message?: string };

  const SCENARIOS = [
    { id: 'food', label: 'Food & Dining', emoji: '🍜' },
    { id: 'directions', label: 'Asking Directions', emoji: '🗺️' },
    { id: 'hotel', label: 'Hotel Check-in', emoji: '🏨' },
    { id: 'transport', label: 'Getting Around', emoji: '🚃' },
    { id: 'greetings', label: 'Greetings & Basics', emoji: '👋' },
    { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  ] as const satisfies readonly Scenario[];

  const loadingMessages = [
    'Your sensei is preparing today’s lesson…',
    'Brewing green tea for the session… 🍵',
    'Arranging the study materials…',
    'Writing today’s lesson plan…',
    'Almost ready…',
  ];

  const JAPAN_FACTS = [
    'Japan has over 14,000 islands, though only a few hundred are inhabited.',
    'Tokyo has more Michelin-starred restaurants than any other city in the world.',
    'Shinkansen bullet trains are known for average delays measured in seconds, not minutes.',
    'In Japan, convenience stores often offer high-quality fresh meals and local specialties.',
    'You can soak in natural onsen hot springs in many regions, from mountain towns to seaside areas.',
    'Spring cherry blossom forecasts are followed nationwide and influence travel planning.',
    'Nara is famous for free-roaming deer considered messengers in local Shinto tradition.',
    'Japanese depachika food halls in department store basements are popular for gourmet takeout.',
    'Many Japanese cities install decorative manhole covers featuring local history and mascots.',
    'Hokkaido is especially known for powder snow and winter festivals with ice sculptures.',
    'Okinawa has a distinct culture, cuisine, and history compared with mainland Japan.',
    'Traditional yukata are commonly worn at summer festivals and fireworks events.',
    'Kyoto was Japan’s capital for more than 1,000 years.',
    'Some ryokan inns serve multi-course kaiseki meals focused on local seasonal ingredients.',
    'Japanese tea ceremonies emphasize hospitality, mindfulness, and precise ritual.',
  ];

  let viewState = $state<ViewState>('intro');
  let selectedScenario = $state<string | null>(null);
  let lesson = $state<Lesson | null>(null);
  let exercises = $state<Exercise[]>([]);
  let answers = $state<ExerciseAnswerPayload[]>([]);
  let currentIndex = $state(0);
  let sessionId = $state('');
  let remainingSessions = $state(2);
  let errorMessage = $state('');
  let supportsBrowserVoice = $state(false);
  let summaryData = $state<SummaryData | null>(null);
  let loadingMsgIndex = $state(0);
  let loadingMsgVisible = $state(true);
  let currentJapanFactIndex = $state(0);
  let factHasRotated = $state(false);
  let displayScore = $state(0);
  let isAnswerPending = $state(false);
  let hasMounted = false;
  let factShuffleBag: number[] = [];

  const totalExercises = $derived(exercises.length);
  const currentExercise = $derived(exercises[currentIndex] ?? null);
  const progressCurrent = $derived(Math.min(currentIndex + 1, Math.max(exercises.length, 1)));
  const currentJapanFact = $derived(JAPAN_FACTS[currentJapanFactIndex] ?? '');
  const currentScenarioLabel = $derived(
    SCENARIOS.find((scenario) => scenario.id === selectedScenario)?.label ??
      summaryData?.stats.scenario ??
      'Travel',
  );
  const keyPhrasesForStats = $derived(summaryData?.stats.phrasesLearned ?? []);

  async function detectBrowserVoice(): Promise<boolean> {
    if (!isSupported()) return false;
    const voice = await getJapaneseVoice();
    return voice !== null;
  }

  function shuffleArray<T>(arr: T[]): T[] {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function createFactShuffleBag(): number[] {
    return shuffleArray(Array.from({ length: JAPAN_FACTS.length }, (_, index) => index));
  }

  function getNextFactIndexFromBag(): number {
    if (JAPAN_FACTS.length === 0) return 0;
    if (factShuffleBag.length === 0) {
      factShuffleBag = createFactShuffleBag();
    }
    const nextIndex = factShuffleBag.shift();
    return nextIndex ?? 0;
  }

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return 'Something went wrong. Please try again.';
  }

  function getApiMessage(payload: unknown, fallback: string): string {
    if (
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof (payload as { message?: unknown }).message === 'string'
    ) {
      return (payload as { message: string }).message;
    }
    return fallback;
  }

  function normalizeSessionPayload(payload: unknown): SessionStatePayload | null {
    if (!payload || typeof payload !== 'object') return null;
    const candidate = payload as { session?: SessionStatePayload } & Partial<SessionStatePayload>;
    const maybeSession = candidate.session ?? candidate;
    if (
      !maybeSession ||
      typeof maybeSession.sessionId !== 'string' ||
      !Array.isArray(maybeSession.exercises) ||
      !Array.isArray(maybeSession.answers) ||
      typeof maybeSession.currentIndex !== 'number' ||
      typeof maybeSession.expiresAt !== 'string' ||
      !maybeSession.lesson
    ) {
      return null;
    }
    return maybeSession as SessionStatePayload;
  }

  function resetSessionStateForIntro(): void {
    lesson = null;
    exercises = [];
    answers = [];
    currentIndex = 0;
    sessionId = '';
    summaryData = null;
    errorMessage = '';
    isAnswerPending = false;
  }

  function hydrateFromSession(session: SessionStatePayload): void {
    lesson = session.lesson;
    exercises = session.exercises;
    answers = session.answers ?? [];
    currentIndex = Math.max(0, Math.min(session.currentIndex ?? 0, session.exercises.length));
    sessionId = session.sessionId;
    selectedScenario = session.scenario ?? selectedScenario;
    if (typeof session.remainingSessionsToday === 'number') {
      remainingSessions = session.remainingSessionsToday;
    }
  }

  async function restoreSessionIfAvailable(): Promise<void> {
    try {
      const response = await fetch('/api/portfolio/session/current');
      const payload = (await response.json()) as { ok: boolean } & Record<string, unknown>;
      if (!response.ok || !payload.ok) return;
      const session = normalizeSessionPayload(payload);
      if (!session) return;
      if (new Date(session.expiresAt).getTime() <= Date.now()) return;
      hydrateFromSession(session);
      viewState = session.currentIndex > 0 ? 'active' : 'lesson';
    } catch {
      // Non-blocking: intro screen remains usable if restore fails.
    }
  }

  async function startSession(): Promise<void> {
    if (!selectedScenario) return;
    viewState = 'loading';
    errorMessage = '';
    summaryData = null;
    isAnswerPending = false;

    try {
      const response = await fetch('/api/portfolio/session/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scenario: selectedScenario,
          supportsBrowserVoice,
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        remainingSessionsToday?: number;
      } & ApiError;
      if (!response.ok || !payload.ok) {
        if (response.status === 429 || payload.reason === 'quota_exceeded') {
          remainingSessions = 0;
          viewState = 'quota';
          return;
        }
        throw new Error(getApiMessage(payload, 'Could not start session.'));
      }

      const session = normalizeSessionPayload(payload);
      if (!session) {
        throw new Error('Session payload was incomplete.');
      }
      hydrateFromSession(session);
      if (typeof payload.remainingSessionsToday === 'number') {
        remainingSessions = payload.remainingSessionsToday;
      }
      viewState = 'lesson';
    } catch (error) {
      errorMessage = getErrorMessage(error);
      viewState = 'error';
    }
  }

  function beginExercises(): void {
    if (!lesson || exercises.length === 0) {
      errorMessage = 'The lesson is missing exercises. Please start a new session.';
      viewState = 'error';
      return;
    }
    viewState = 'active';
  }

  async function completeCurrentSession(): Promise<void> {
    viewState = 'summarizing';
    try {
      const response = await fetch('/api/portfolio/session/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const payload = (await response.json()) as
        | ({
            ok: true;
            summary?: SummaryData;
            stats?: SummaryStats;
            celebration?: SummaryData['celebration'];
            state?: string;
            remainingSessionsToday?: number;
          } & Record<string, unknown>)
        | ApiError;

      if (!response.ok || !payload.ok) {
        throw new Error(getApiMessage(payload, 'Could not complete session.'));
      }

      const summaryFromResponse =
        (payload as { summary?: SummaryData }).summary ??
        ({
          summary: '',
          stats: (payload as { stats?: SummaryStats }).stats,
          strengths: [],
          misses: [],
          nextSteps: [],
          celebration: (payload as { celebration?: SummaryData['celebration'] }).celebration ?? {
            label: 'Session complete',
            emoji: '🎉',
          },
        } as SummaryData);

      if (!summaryFromResponse?.stats) {
        throw new Error('Summary payload was incomplete.');
      }

      summaryData = summaryFromResponse;
      if (
        typeof (payload as { remainingSessionsToday?: number }).remainingSessionsToday === 'number'
      ) {
        remainingSessions = (payload as { remainingSessionsToday: number }).remainingSessionsToday;
      } else {
        remainingSessions = Math.max(0, remainingSessions - 1);
      }
      viewState = 'done';
    } catch (error) {
      errorMessage = getErrorMessage(error);
      viewState = 'error';
    }
  }

  async function onAnswer(payload: ExerciseAnswerPayload): Promise<void> {
    if (viewState !== 'active' || !sessionId || isAnswerPending) return;
    const answeredIndex = currentIndex;
    const isLastExercise = answeredIndex >= exercises.length - 1;
    isAnswerPending = true;

    try {
      const response = await fetch('/api/portfolio/session/progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          currentIndex: answeredIndex,
          answer: payload,
        }),
      });
      const result = (await response.json()) as { ok: boolean } & Record<string, unknown> &
        ApiError;
      if (!response.ok || !result.ok) {
        throw new Error(getApiMessage(result, 'Could not save exercise answer.'));
      }

      const session = normalizeSessionPayload(result);
      if (session) {
        answers = session.answers ?? answers;
      } else {
        answers = [...answers, payload];
      }

      if (!isLastExercise) {
        currentIndex = Math.min(answeredIndex + 1, Math.max(exercises.length - 1, 0));
        return;
      }

      await completeCurrentSession();
    } catch (error) {
      errorMessage = getErrorMessage(error);
      viewState = 'error';
    } finally {
      isAnswerPending = false;
    }
  }

  function tryAgain(): void {
    resetSessionStateForIntro();
    viewState = 'intro';
  }

  function tryAnotherScenario(): void {
    resetSessionStateForIntro();
    viewState = 'intro';
  }

  $effect(() => {
    if (hasMounted) return;
    hasMounted = true;
    detectBrowserVoice().then((supported) => {
      supportsBrowserVoice = supported;
    });
    restoreSessionIfAvailable();
  });

  $effect(() => {
    if (viewState !== 'loading') return;
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
    if (viewState !== 'loading' && viewState !== 'summarizing') return;
    factShuffleBag = createFactShuffleBag();
    currentJapanFactIndex = getNextFactIndexFromBag();
    factHasRotated = false;
    const intervalId = setInterval(() => {
      factHasRotated = true;
      currentJapanFactIndex = getNextFactIndexFromBag();
    }, 8000);
    return () => clearInterval(intervalId);
  });

  $effect(() => {
    if (viewState !== 'done' || !summaryData) return;
    const target = summaryData.stats.accuracy;
    displayScore = 0;
    let frame = 0;
    const start = performance.now();
    const duration = 1000;
    function animate(now: number): void {
      const progress = Math.min((now - start) / duration, 1);
      displayScore = Math.round(progress * target);
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  });
</script>

<svelte:head>
  <title>Japanese Travel Mini-Session</title>
</svelte:head>

<div class="portfolio-page page-transition">
  <div class="portfolio-content">
    {#if viewState === 'intro'}
      <section class="card intro-card">
        <p class="eyebrow">Portfolio demo</p>
        <h1>Take a 2-minute Japanese travel mini-session</h1>
        <p class="supporting">
          Pick a situation, learn a few useful phrases, then try a short guided practice.
        </p>

        <div class="scenario-grid" role="list" aria-label="Travel scenarios">
          {#each SCENARIOS as scenario}
            <button
              type="button"
              class="scenario-tile"
              class:selected={selectedScenario === scenario.id}
              onclick={() => (selectedScenario = scenario.id)}
            >
              <span class="scenario-emoji">{scenario.emoji}</span>
              <span class="scenario-label">{scenario.label}</span>
            </button>
          {/each}
        </div>

        <div class="intro-actions">
          <button
            type="button"
            class="btn-primary"
            disabled={!selectedScenario}
            onclick={startSession}
          >
            Start session
          </button>
          <p class="trust-note">Anonymous demo. No account, no permanent learner profile.</p>
        </div>
      </section>
    {:else if viewState === 'loading'}
      <section class="card loading-card" aria-live="polite" aria-busy="true">
        <div class="loading-visual">
          <svg class="enso" viewBox="0 0 100 100" aria-hidden="true">
            <circle class="enso-stroke" cx="50" cy="50" r="38" />
          </svg>
          <span class="enso-kanji" aria-hidden="true">学</span>
        </div>
        <p class="loading-text" style:opacity={loadingMsgVisible ? 1 : 0}>
          {loadingMessages[loadingMsgIndex]}
        </p>
        <div class="loading-fact-card">
          <p class="loading-fact-label">Did you know?</p>
          <div class="loading-fact-text-container">
            {#key `loading-${currentJapanFactIndex}`}
              <p
                class="loading-fact-text"
                in:fade={{ duration: factHasRotated ? 400 : 0, delay: factHasRotated ? 180 : 0 }}
                out:fade={{ duration: 180 }}
              >
                {currentJapanFact}
              </p>
            {/key}
          </div>
        </div>
      </section>
    {:else if viewState === 'lesson' && lesson}
      <section class="card lesson-card">
        <p class="lesson-label">Today’s lesson</p>
        <h2>{lesson.topic}</h2>
        <p class="lesson-copy"><RichJapaneseText text={lesson.explanation} /></p>

        <section class="cultural-note">
          <h3>Cultural note</h3>
          <p><RichJapaneseText text={lesson.culturalNote} /></p>
        </section>

        <section>
          <h3 class="section-title">Key phrases</h3>
          <div class="key-phrases">
            {#each lesson.keyPhrases as phrase (phrase.japanese)}
              <article class="key-phrase">
                <p class="jp">
                  {phrase.japanese}
                  <InlineAudio japanese={phrase.japanese} size="md" />
                </p>
                <p class="romaji">{phrase.romaji}</p>
                <p class="english">{phrase.english}</p>
                <p class="usage"><RichJapaneseText text={phrase.usage} /></p>
              </article>
            {/each}
          </div>
        </section>

        <button type="button" class="btn-primary" onclick={beginExercises}
          >I’m ready for questions</button
        >
      </section>
    {:else if viewState === 'active'}
      <section class="card active-card">
        <ProgressBar
          current={progressCurrent}
          total={totalExercises}
          label={`${progressCurrent} / ${totalExercises}`}
        />
        {#if currentExercise}
          <SessionRenderer exercise={currentExercise} {onAnswer} />
        {/if}
      </section>
    {:else if viewState === 'summarizing'}
      <section class="card loading-card" aria-live="polite" aria-busy="true">
        <div class="loading-visual">
          <svg class="enso" viewBox="0 0 100 100" aria-hidden="true">
            <circle class="enso-stroke" cx="50" cy="50" r="38" />
          </svg>
          <span class="enso-kanji" aria-hidden="true">完</span>
        </div>
        <p class="loading-text">Preparing your session summary…</p>
        <div class="loading-fact-card">
          <p class="loading-fact-label">Did you know?</p>
          <div class="loading-fact-text-container">
            {#key `summary-${currentJapanFactIndex}`}
              <p
                class="loading-fact-text"
                in:fade={{ duration: factHasRotated ? 400 : 0, delay: factHasRotated ? 180 : 0 }}
                out:fade={{ duration: 180 }}
              >
                {currentJapanFact}
              </p>
            {/key}
          </div>
        </div>
      </section>
    {:else if viewState === 'done' && summaryData}
      <section class="card summary-card">
        <div class="celebration">
          <span class="celebration-emoji">{summaryData.celebration.emoji}</span>
          <span class="celebration-label">{summaryData.celebration.label}</span>
        </div>

        <div class="accuracy">
          <p class="accuracy-label">Accuracy</p>
          <p class="accuracy-value">{displayScore}%</p>
        </div>

        <p class="summary-text">{summaryData.summary}</p>

        <dl class="stats-grid">
          <div>
            <dt>Correct answers</dt>
            <dd>{summaryData.stats.totalCorrect} / {summaryData.stats.totalExercises}</dd>
          </div>
          <div>
            <dt>Scenario</dt>
            <dd>{currentScenarioLabel}</dd>
          </div>
          <div>
            <dt>Phrases learned</dt>
            <dd>{keyPhrasesForStats.length}</dd>
          </div>
        </dl>

        <section class="feedback-section strengths">
          <h3>Strengths</h3>
          <ul>
            {#each summaryData.strengths as point}
              <li>{point}</li>
            {/each}
          </ul>
        </section>

        <section class="feedback-section misses">
          <h3>Misses</h3>
          <ul>
            {#each summaryData.misses as point}
              <li>{point}</li>
            {/each}
          </ul>
        </section>

        <section class="feedback-section next-steps">
          <h3>Next steps</h3>
          <ul>
            {#each summaryData.nextSteps as step}
              <li>{step}</li>
            {/each}
          </ul>
        </section>

        {#if remainingSessions > 0}
          <button type="button" class="btn-primary" onclick={tryAnotherScenario}
            >Try another scenario</button
          >
        {:else}
          <p class="done-note">You’ve completed today’s demos.</p>
        {/if}
      </section>
    {:else if viewState === 'quota'}
      <section class="card message-card">
        <p>You’ve used today’s demo sessions. Come back tomorrow for another mini-lesson!</p>
      </section>
    {:else}
      <section class="card message-card">
        <p>{errorMessage || 'Something interrupted the mini-session.'}</p>
        <button type="button" class="btn-secondary" onclick={tryAgain}>Try again</button>
      </section>
    {/if}
  </div>
</div>

<style>
  .portfolio-page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-8) var(--space-4) var(--space-12);
    background: var(--bg-shoji);
  }

  .portfolio-content {
    width: 100%;
    max-width: var(--content-width);
  }

  .card {
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--bg-shoji) 92%, white);
    box-shadow: var(--shadow-card);
    padding: var(--space-6);
  }

  .intro-card,
  .lesson-card,
  .summary-card,
  .message-card {
    display: grid;
    gap: var(--space-4);
  }

  .eyebrow,
  .lesson-label {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  h1,
  h2,
  h3,
  p {
    margin: 0;
    color: var(--text-sumi);
  }

  h1 {
    font-size: clamp(var(--text-2xl), 4vw, var(--text-4xl));
    font-weight: var(--weight-light);
    line-height: 1.15;
  }

  h2 {
    font-size: var(--text-2xl);
    font-weight: var(--weight-light);
  }

  h3 {
    font-size: var(--text-lg);
    font-weight: var(--weight-medium);
  }

  .supporting,
  .trust-note,
  .lesson-copy,
  .summary-text,
  .done-note {
    color: var(--text-bokashi);
  }

  .trust-note,
  .done-note {
    font-size: var(--text-sm);
  }

  .intro-actions {
    display: grid;
    gap: var(--space-2);
  }

  .scenario-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
  }

  .scenario-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-3);
    border: 2px solid var(--border-light);
    border-radius: var(--radius-lg);
    background: var(--bg-shoji);
    cursor: pointer;
    transition:
      border-color var(--duration-fast) var(--ease-out),
      background-color var(--duration-fast) var(--ease-out);
    font: inherit;
    color: var(--text-sumi);
  }

  .scenario-tile:hover {
    border-color: var(--accent-shu-soft);
    background: var(--bg-washi);
  }

  .scenario-tile.selected {
    border-color: var(--accent-shu);
    background: var(--accent-shu-wash);
  }

  .scenario-emoji {
    font-size: var(--text-2xl);
  }

  .scenario-label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    border: 1px solid var(--accent-shu-soft);
    border-radius: 999px;
    background: var(--accent-shu-wash);
    color: var(--accent-shu-deep);
    padding: var(--space-3) var(--space-6);
    font: inherit;
    font-weight: var(--weight-medium);
    cursor: pointer;
    transition:
      background-color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
  }

  .btn-primary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent-shu-wash) 75%, white);
    border-color: var(--accent-shu);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-light);
    border-radius: 999px;
    background: transparent;
    color: var(--text-bokashi);
    padding: var(--space-3) var(--space-6);
    font: inherit;
    font-weight: var(--weight-medium);
    cursor: pointer;
    transition: background-color var(--duration-fast) var(--ease-out);
  }

  .btn-secondary:hover {
    background: var(--bg-kinu);
  }

  .cultural-note {
    background: var(--bg-washi);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-light);
    padding: var(--space-4);
    display: grid;
    gap: var(--space-2);
  }

  .section-title {
    margin-bottom: var(--space-3);
  }

  .key-phrases {
    display: grid;
    gap: var(--space-3);
  }

  .key-phrase {
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    display: grid;
    gap: var(--space-1);
  }

  .jp {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xl);
    font-weight: var(--weight-medium);
  }

  .romaji,
  .usage {
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
  }

  .english {
    color: var(--text-bokashi);
  }

  .active-card {
    display: grid;
    gap: var(--space-4);
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
    transition: opacity 0.4s var(--ease-out);
    min-height: 1.6em;
  }

  .loading-fact-card {
    width: 100%;
    max-width: 42rem;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-light);
    background: var(--bg-kinu);
    display: grid;
    gap: var(--space-1);
  }

  .loading-fact-label {
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .loading-fact-text-container {
    display: grid;
  }

  .loading-fact-text {
    grid-area: 1 / 1;
    font-size: var(--text-sm);
    color: var(--text-bokashi);
    line-height: 1.5;
  }

  .celebration {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .celebration-emoji {
    font-size: var(--text-2xl);
  }

  .celebration-label {
    font-size: var(--text-sm);
    color: var(--text-usuzumi);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .accuracy {
    display: grid;
    gap: var(--space-1);
  }

  .accuracy-label {
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
  }

  .accuracy-value {
    font-size: var(--text-4xl);
    color: var(--accent-shu-deep);
    font-weight: var(--weight-light);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
    margin: 0;
  }

  .stats-grid div {
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    background: var(--bg-washi);
    padding: var(--space-3);
    display: grid;
    gap: var(--space-1);
  }

  .stats-grid dt {
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stats-grid dd {
    margin: 0;
    color: var(--text-sumi);
  }

  .feedback-section {
    display: grid;
    gap: var(--space-2);
  }

  .feedback-section ul {
    margin: 0;
    padding-left: var(--space-5);
    display: grid;
    gap: var(--space-1);
  }

  .strengths li::marker {
    color: var(--accent-matcha);
  }

  .misses li::marker {
    color: var(--accent-shu);
  }

  .next-steps li::marker {
    color: var(--text-usuzumi);
  }

  @media (max-width: 48rem) {
    .portfolio-page {
      padding-top: var(--space-6);
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 30rem) {
    .scenario-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
