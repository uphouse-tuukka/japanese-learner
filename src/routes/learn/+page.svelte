<script lang="ts">
  import { fade } from 'svelte/transition';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import SessionRenderer from '$lib/components/SessionRenderer.svelte';
  import SessionSummary from '$lib/components/SessionSummary.svelte';
  import DebugPanel from '$lib/components/DebugPanel.svelte';
  import RichJapaneseText from '$lib/components/RichJapaneseText.svelte';
  import InlineAudio from '$lib/components/InlineAudio.svelte';
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
  } from '$lib/stores/session.svelte';
  import {
    maxCombo,
    recordCorrectAnswer,
    recordIncorrectAnswer,
    resetGamification,
    sessionXp,
    setSessionXp,
  } from '$lib/stores/gamification.svelte';
  import type { Exercise, ExerciseAnswerPayload, ExerciseType, Lesson, Session } from '$lib/types';
  import type { PageData } from './$types';

  type UiState =
    | 'idle'
    | 'loading'
    | 'lesson'
    | 'active'
    | 'completing'
    | 'done'
    | 'budget_exhausted'
    | 'error';

  type GenerateResponse = {
    ok: boolean;
    state: 'active' | 'budget_exhausted';
    session: Session | null;
    lesson: Lesson | null;
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
  let lesson = $state<Lesson | null>(null);

  /* — Loading animation state — */
  const loadingMessages = [
    'Your sensei is preparing today\u2019s lesson\u2026',
    'Brewing green tea for the session\u2026 \uD83C\uDF75',
    'Arranging the study materials\u2026',
    'Writing today\u2019s lesson plan\u2026',
    'Almost ready\u2026',
  ];
  let loadingMsgIndex = $state(0);
  let loadingMsgVisible = $state(true);
  const JAPAN_FACTS = [
    'Japan has over 14,000 islands, though only a few hundred are inhabited.',
    'Tokyo has more Michelin-starred restaurants than any other city in the world.',
    'Many train stations in Japan use unique departure melodies to help riders identify platforms.',
    'Kyoto was Japan’s capital for more than 1,000 years.',
    'In Japan, convenience stores often offer high-quality fresh meals and local specialties.',
    'Shinkansen bullet trains are known for average delays measured in seconds, not minutes.',
    'You can soak in natural onsen hot springs in many regions, from mountain towns to seaside areas.',
    'Japan has designated scenic routes where roadside stations (michi-no-eki) feature regional foods.',
    'Some Japanese castles are reconstructions, but several, like Himeji, still preserve original structures.',
    'Spring cherry blossom forecasts are followed nationwide and influence travel planning.',
    'Autumn foliage viewing, called koyo, is a major seasonal travel tradition in Japan.',
    'Many shrines and temples hold seasonal festivals called matsuri with local food stalls and performances.',
    'Japanese gardens are designed to reflect seasons, balance, and borrowed scenery from surrounding nature.',
    'Mt. Fuji climbing season is typically limited to summer months for safety reasons.',
    'In many Japanese homes, shoes are removed at the entrance and replaced with indoor slippers.',
    'Tatami rooms use woven straw mats whose dimensions traditionally influenced room sizing.',
    'Regional train passes can make rural travel in Japan much more affordable for visitors.',
    'Japan’s vending machines sell far more than drinks, including regional items in some locations.',
    'Nara is famous for free-roaming deer considered messengers in local Shinto tradition.',
    'Some ryokan inns serve multi-course kaiseki meals focused on local seasonal ingredients.',
    'Capsule hotels were designed to provide compact, efficient lodging in urban areas.',
    'Japanese depachika food halls in department store basements are popular for gourmet takeout.',
    'Many Japanese cities install decorative manhole covers featuring local history and mascots.',
    'Hokkaido is especially known for powder snow and winter festivals with ice sculptures.',
    'Okinawa has a distinct culture, cuisine, and history compared with mainland Japan.',
    'Temple goshuin stamp books are popular keepsakes for travelers visiting sacred sites.',
    'Japan’s rainy season varies by region and usually arrives before the hottest summer weeks.',
    'Japanese tea ceremonies emphasize hospitality, mindfulness, and precise ritual.',
    'In many neighborhoods, small local shrines are tucked between homes and shops.',
    'Some coastal towns in Japan are known for morning fish markets open before sunrise.',
    'Seasonal limited-edition snacks and drinks are a recurring part of Japanese pop culture.',
    'Many museums in Japan provide multilingual guides and audio support for travelers.',
    'Traditional yukata are commonly worn at summer festivals and fireworks events.',
    'Japan has one of the world’s oldest continuously operating hotel traditions, especially in ryokan culture.',
  ];
  let currentJapanFactIndex = $state(0);
  let factShuffleBag: number[] = [];
  let factHasRotated = $state(false);

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

  const currentJapanFact = $derived(JAPAN_FACTS[currentJapanFactIndex] ?? '');

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
    if (uiState !== 'loading' && uiState !== 'completing') return;
    factShuffleBag = createFactShuffleBag();
    currentJapanFactIndex = getNextFactIndexFromBag();
    factHasRotated = false;
    const intervalId = setInterval(() => {
      factHasRotated = true;
      currentJapanFactIndex = getNextFactIndexFromBag();
    }, 8000);
    return () => {
      clearInterval(intervalId);
    };
  });

  $effect(() => {
    if (!data.budget.allowed && uiState === 'idle') {
      uiState = 'budget_exhausted';
    }
  });

  const totalExercises = $derived($exercises.length);
  const currentExercise = $derived($exercises[$currentIndex] ?? null);
  const progressCurrent = $derived(Math.min($currentIndex + 1, Math.max($exercises.length, 1)));

  function shuffleArray<T>(arr: T[]): T[] {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function getHelsinkiLocalDate(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Helsinki',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  async function startLearning(): Promise<void> {
    uiState = 'loading';
    errorMessage = '';
    lesson = null;
    resetSession();
    resetGamification();

    try {
      const response = await fetch('/api/session/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: data.selectedUserId,
          exerciseCount: 8,
          japaneseWritingEnabled: data.selectedUser?.japaneseWritingEnabled ?? false,
        }),
      });

      const payload = (await response.json()) as GenerateResponse;
      if (payload.state === 'budget_exhausted') {
        uiState = 'budget_exhausted';
        return;
      }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? 'Failed to generate session');
      }
      if (!payload.session || !payload.lesson) {
        throw new Error('Failed to generate session');
      }

      lesson = payload.lesson;
      startSession(payload.session, shuffleArray(payload.exercises));
      uiState = 'lesson';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      uiState = 'error';
    }
  }

  async function startDebugPractice(type: ExerciseType): Promise<void> {
    uiState = 'loading';
    errorMessage = '';
    lesson = null;
    resetSession();
    resetGamification();

    try {
      const response = await fetch('/api/practice/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: data.selectedUserId,
          exerciseCount: 6,
          debugExerciseType: type,
        }),
      });

      const payload = (await response.json()) as GenerateResponse;
      if (!response.ok || !payload.ok || !payload.session) {
        throw new Error(payload.error ?? 'Failed to generate debug session');
      }

      startSession(payload.session, payload.exercises);
      uiState = 'active';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      uiState = 'error';
    }
  }

  function beginExercises(): void {
    if (!lesson) {
      errorMessage = 'Lesson data missing. Please generate a new session.';
      uiState = 'error';
      return;
    }
    uiState = 'active';
  }

  async function onAnswer(payload: ExerciseAnswerPayload): Promise<void> {
    if (!currentExercise) return;
    answerExercise($currentIndex, payload);
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
    await finalizeSession();
  }

  async function finalizeSession(): Promise<void> {
    if (!$session) {
      errorMessage = 'Session missing. Start again.';
      uiState = 'error';
      return;
    }
    uiState = 'completing';
    try {
      const response = await fetch('/api/session/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: data.selectedUserId,
          sessionId: $session.id,
          results: $answers.filter((a): a is NonNullable<typeof a> => a != null),
          maxCombo: $maxCombo,
          localDate: getHelsinkiLocalDate(),
        }),
      });
      const payload = (await response.json()) as CompleteResponse;
      if (!response.ok || !payload.ok)
        throw new Error(payload.error ?? 'Failed to complete session');
      if (payload.xp) {
        setSessionXp(payload.xp);
      }
      completeSession(payload.summary);
      uiState = 'done';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      uiState = 'error';
    }
  }
</script>

<main class="learn-page page-transition">
  <section class="card">
    <h1>Learn</h1>
    <p>Start an AI teaching session: learn one practical topic, then answer focused questions.</p>
  </section>

  {#if uiState === 'idle'}
    <section class="card">
      <button class="btn btn-primary" onclick={startLearning}>Start learning</button>
    </section>
  {:else if uiState === 'loading'}
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
      <p class="sr-only">Generating your teaching session, please wait.</p>
    </section>
  {:else if uiState === 'budget_exhausted'}
    <section class="card">
      <p>
        You've reached today's AI practice budget. Please try again tomorrow, and your learning
        session will be ready.
      </p>
    </section>
  {:else if uiState === 'lesson' && lesson}
    <section class="card lesson-card">
      <p class="lesson-label">Today's lesson</p>
      <h2>{lesson.topic}</h2>
      <p><RichJapaneseText text={lesson.explanation} /></p>
      <div class="cultural-note">
        <h3>Cultural note</h3>
        <p><RichJapaneseText text={lesson.culturalNote} /></p>
      </div>
      <div>
        <h3>Key phrases</h3>
        <div class="key-phrases">
          {#each lesson.keyPhrases as phrase}
            <article class="key-phrase">
              <p class="jp">
                {phrase.japanese}
                <InlineAudio japanese={phrase.japanese} size="md" />
              </p>
              <p class="romaji">{phrase.romaji}</p>
              <p class="en">{phrase.english}</p>
              <p class="usage"><RichJapaneseText text={phrase.usage} /></p>
            </article>
          {/each}
        </div>
      </div>
      <button class="btn btn-primary" onclick={beginExercises}>I'm ready for questions</button>
    </section>
  {:else if uiState === 'active'}
    <section class="card">
      <ProgressBar current={progressCurrent} total={totalExercises} label="Session progress" />
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
      <p class="loading-text">Preparing your session summary…</p>
      <div class="loading-fact-card">
        <p class="loading-fact-label">Did you know?</p>
        <div class="loading-fact-text-container">
          {#key `completing-${currentJapanFactIndex}`}
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
      <p class="sr-only">Generating your session summary, please wait.</p>
    </section>
  {:else if uiState === 'done' && $summary}
    <SessionSummary summary={$summary} xpBreakdown={$sessionXp ?? undefined} />
  {:else if uiState === 'error'}
    <section class="card">
      <p>{errorMessage || 'Failed to generate session'}</p>
      <button class="btn btn-secondary" onclick={startLearning}>Try again</button>
    </section>
  {/if}

  <DebugPanel onGenerateDebug={startDebugPractice} />
</main>

<style>
  .learn-page {
    display: grid;
    gap: var(--space-4);
  }

  .lesson-card {
    display: grid;
    gap: var(--space-4);
  }

  .lesson-label {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--text-usuzumi);
    margin: 0;
  }

  .cultural-note {
    padding: var(--space-3);
    background: var(--bg-washi);
    border-radius: var(--radius-md);
  }

  .lesson-card h3 {
    margin: 0 0 var(--space-3) 0;
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
    font-size: var(--text-xl);
    margin: 0;
  }

  .romaji,
  .en,
  .usage {
    margin: 0;
  }

  .romaji {
    color: var(--text-usuzumi);
  }

  .usage {
    font-size: var(--text-sm);
  }

  /* ── Loading animation: Ensō (禅円) ── */
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

  .loading-fact-card {
    width: 100%;
    max-width: 42rem;
    margin-top: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-light);
    background: var(--bg-kinu);
    display: grid;
    gap: var(--space-1);
  }

  .loading-fact-label {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
  }

  .loading-fact-text {
    grid-area: 1 / 1;
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-bokashi);
    line-height: 1.5;
  }

  .loading-fact-text-container {
    display: grid;
  }
</style>
