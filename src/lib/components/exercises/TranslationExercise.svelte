<script lang="ts">
  import type { OnAnswer, TranslationExercise as TranslationExerciseData } from '$lib/types';

  interface Props {
    exercise: TranslationExerciseData;
    onAnswer: OnAnswer;
  }

  let { exercise, onAnswer }: Props = $props();

  let userInput = $state('');
  let answered = $state(false);
  let isCorrect = $state(false);
  let hintLevel = $state(0); // 0 = no hint, 1 = first char, 2 = first 3 chars
  let startTime = $state(Date.now());
  let announcement = $state('');
  let resultRef: HTMLElement | undefined = $state();
  let reportTimer: ReturnType<typeof setTimeout> | null = null;

  const hintText = $derived(
    hintLevel === 0
      ? ''
      : hintLevel === 1
        ? exercise.expectedAnswer.charAt(0) + '...'
        : exercise.expectedAnswer.slice(0, 3) + '...'
  );

  const allAcceptedAnswers = $derived(
    [...new Set([exercise.expectedAnswer, ...exercise.acceptedAnswers])]
  );

  function showHint(): void {
    if (answered) return;
    if (hintLevel < 2) hintLevel += 1;
  }

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault();

    if (answered || !userInput.trim()) return;

    const trimmed = userInput.trim();
    const lower = trimmed.toLowerCase();

    const allAnswers = [exercise.expectedAnswer, ...exercise.acceptedAnswers];
    if (exercise.expectedRomaji) {
      allAnswers.push(exercise.expectedRomaji);
    }

    const correct = allAnswers.some((answer) => answer.trim().toLowerCase() === lower);

    answered = true;
    isCorrect = correct;

    announcement = correct
      ? 'Correct!'
      : `Incorrect. Expected: ${exercise.expectedAnswer}`;

    setTimeout(() => {
      resultRef?.focus();
    }, 100);

    reportTimer = setTimeout(() => {
      onAnswer({
        exerciseId: exercise.id,
        answerText: trimmed,
        isCorrect: correct
      });
    }, 800);
  }

  $effect(() => {
    exercise.id;

    userInput = '';
    answered = false;
    isCorrect = false;
    hintLevel = 0;
    startTime = Date.now();
    announcement = '';

    if (reportTimer) {
      clearTimeout(reportTimer);
      reportTimer = null;
    }
  });

  $effect(() => {
    return () => {
      if (reportTimer) {
        clearTimeout(reportTimer);
      }
    };
  });
</script>

<section class="translation-exercise" aria-label="Translation exercise">
  <div class="direction-badge">
    {#if exercise.direction === 'ja_to_en'}
      <span>日本語</span>
      <span class="arrow">→</span>
      <span>English</span>
    {:else}
      <span>English</span>
      <span class="arrow">→</span>
      <span>日本語</span>
    {/if}
  </div>

  <p class="exercise-title">{exercise.title}</p>

  <div class="prompt-area">
    {#if exercise.direction === 'ja_to_en'}
      <p class="prompt-japanese">{exercise.japanese}</p>
      <p class="prompt-romaji">{exercise.romaji}</p>
    {:else}
      <p class="prompt-english">{exercise.prompt}</p>
    {/if}
  </div>

  <form class="input-area" onsubmit={handleSubmit}>
    <label for="translation-input" class="input-label">Your translation</label>

    <input
      id="translation-input"
      type="text"
      class="translation-input"
      class:correct={answered && isCorrect}
      class:incorrect={answered && !isCorrect}
      bind:value={userInput}
      placeholder="Type your answer..."
      disabled={answered}
      autocomplete="off"
      autocapitalize="off"
    />

    {#if !answered}
      <div class="button-row">
        <button
          type="button"
          class="hint-btn"
          onclick={showHint}
          disabled={hintLevel >= 2}
        >
          {hintLevel === 0 ? 'Show Hint' : 'More Hint'}
        </button>

        <button
          type="submit"
          class="check-btn"
          disabled={!userInput.trim()}
        >
          Check
        </button>
      </div>
    {/if}
  </form>

  {#if hintLevel > 0 && !answered}
    <div class="hint-area">
      <p class="hint-label">Hint</p>
      <p class="hint-text">{hintText}</p>
    </div>
  {/if}

  {#if answered}
    <section
      class="result-panel"
      bind:this={resultRef}
      tabindex="-1"
      aria-live="polite"
    >
      {#if isCorrect}
        <div class="result-header correct">
          <span class="result-icon">✓</span>
          <span class="result-title">Correct!</span>
        </div>
      {:else}
        <div class="result-header incorrect">
          <span class="result-title">Not quite</span>
        </div>

        <div class="result-answers">
          <p class="result-item">
            <span class="result-label">Your answer</span>
            <span class="user-answer-text">{userInput}</span>
          </p>

          <p class="result-item">
            <span class="result-label">Expected</span>
            <span class="expected-answer-text">{exercise.expectedAnswer}</span>
            {#if exercise.expectedRomaji}
              <span class="expected-romaji">({exercise.expectedRomaji})</span>
            {/if}
          </p>
        </div>
      {/if}

      <div class="accepted-section">
        <p class="accepted-label">All accepted answers</p>
        <div class="accepted-list">
          {#each allAcceptedAnswers as answer}
            <span class="accepted-pill">{answer}</span>
          {/each}
        </div>
      </div>
    </section>
  {/if}

  <p class="sr-only" role="status" aria-live="polite">{announcement}</p>
</section>

<style>
  .translation-exercise {
    padding: var(--space-6);
    max-width: 32rem;
    margin: 0 auto;
  }

  .direction-badge {
    display: inline-flex;
    gap: var(--space-2);
    align-items: center;
    background: var(--bg-kinu);
    border-radius: var(--radius-md);
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-xs);
    color: var(--text-bokashi);
    margin-bottom: var(--space-4);
  }

  .arrow {
    color: var(--text-usuzumi);
  }

  .exercise-title {
    font-size: var(--text-sm);
    color: var(--text-usuzumi);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    margin: 0 0 var(--space-2) 0;
  }

  .prompt-area {
    text-align: center;
    margin-bottom: var(--space-8);
  }

  .prompt-japanese {
    font-size: var(--text-3xl);
    color: var(--text-sumi);
    font-feature-settings: 'palt';
    letter-spacing: var(--tracking-wider);
    margin: 0 0 var(--space-1) 0;
  }

  .prompt-romaji {
    font-size: var(--text-sm);
    color: var(--text-usuzumi);
    margin: 0;
  }

  .prompt-english {
    font-size: var(--text-2xl);
    color: var(--text-sumi);
    margin: 0;
  }

  .input-label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-bokashi);
    margin-bottom: var(--space-2);
    display: block;
  }

  .translation-input {
    width: 100%;
    background: var(--bg-shoji);
    border: 1.5px solid var(--border-light);
    border-radius: var(--radius-lg);
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-lg);
    color: var(--text-sumi);
    font-family: var(--font-sans);
    transition:
      border-color var(--duration-normal) var(--ease-out),
      box-shadow var(--duration-normal) var(--ease-out);
  }

  .translation-input:focus {
    border-color: var(--accent-shu);
    box-shadow: 0 0 0 3px var(--accent-shu-wash);
    outline: none;
  }

  .translation-input.correct {
    border-color: var(--state-success);
    box-shadow: 0 0 0 3px var(--accent-matcha-wash);
  }

  .translation-input.incorrect {
    border-color: var(--state-error);
    box-shadow: 0 0 0 3px var(--accent-shu-wash);
  }

  .translation-input:disabled {
    opacity: 0.8;
    cursor: default;
  }

  .translation-input::placeholder {
    color: var(--text-usuzumi);
  }

  .button-row {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    margin-top: var(--space-4);
  }

  .hint-btn {
    background: transparent;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
    color: var(--text-bokashi);
    cursor: pointer;
    font-family: var(--font-sans);
    transition: all var(--duration-fast) var(--ease-out);
  }

  .hint-btn:hover:not(:disabled) {
    background: var(--bg-washi);
    border-color: var(--border-mid);
  }

  .hint-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .check-btn {
    margin-left: auto;
    background: var(--accent-shu);
    color: var(--bg-shoji);
    border: none;
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-6);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-wide);
    cursor: pointer;
    font-family: var(--font-sans);
    transition: background var(--duration-fast) var(--ease-out);
  }

  .check-btn:hover:not(:disabled) {
    background: var(--accent-shu-deep);
  }

  .check-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .hint-area {
    background: var(--bg-kinu);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
    margin-top: var(--space-3);
    animation: slideDown 200ms var(--ease-out);
  }

  .hint-label {
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    margin: 0 0 var(--space-1) 0;
  }

  .hint-text {
    font-size: var(--text-base);
    color: var(--text-bokashi);
    margin: 0;
  }

  .result-panel {
    background: var(--bg-washi);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    margin-top: var(--space-6);
    animation: resultReveal 300ms var(--ease-out);
    outline: none;
  }

  .result-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .result-header.correct .result-icon {
    font-size: var(--text-2xl);
    color: var(--state-success);
    animation: popIn 400ms var(--ease-out);
  }

  .result-header.correct .result-title {
    font-size: var(--text-lg);
    color: var(--state-success);
    font-weight: var(--weight-medium);
  }

  .result-header.incorrect .result-title {
    font-size: var(--text-lg);
    color: var(--state-error);
    font-weight: var(--weight-medium);
  }

  .result-answers {
    margin-bottom: var(--space-3);
  }

  .result-item {
    margin: 0 0 var(--space-2) 0;
  }

  .result-label {
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    display: block;
    margin-bottom: var(--space-1);
  }

  .user-answer-text {
    text-decoration: line-through;
    color: var(--state-error);
    font-size: var(--text-base);
  }

  .expected-answer-text {
    color: var(--state-success);
    font-weight: var(--weight-medium);
    font-size: var(--text-base);
  }

  .expected-romaji {
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
    margin-left: var(--space-2);
  }

  .accepted-section {
    border-top: 1px solid var(--border-light);
    margin-top: var(--space-4);
    padding-top: var(--space-4);
  }

  .accepted-label {
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    margin: 0 0 var(--space-2) 0;
  }

  .accepted-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .accepted-pill {
    background: var(--bg-kinu);
    border-radius: var(--radius-md);
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-sm);
    color: var(--text-bokashi);
    display: inline-block;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes resultReveal {
    from {
      opacity: 0;
      transform: translateY(8px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes popIn {
    0% {
      transform: scale(0);
      opacity: 0;
    }

    60% {
      transform: scale(1.2);
    }

    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
</style>
