<script lang="ts">
  import InlineAudio from '$lib/components/InlineAudio.svelte';
  import type { OnAnswer, TranslationExercise as TranslationExerciseData } from '$lib/types';
  import { normalizeForComparison } from '$lib/utils/text';
  import ExerciseFrame from './shared/ExerciseFrame.svelte';
  import ExerciseResultPanel from './shared/ExerciseResultPanel.svelte';
  import ExerciseStatusPanel from './shared/ExerciseStatusPanel.svelte';
  import {
    buildAcceptedAnswers,
    buildDirectionDisplay,
    buildHintText,
    buildPromptDisplay,
  } from './translation-exercise-view-model';

  interface Props {
    exercise: TranslationExerciseData;
    onAnswer: OnAnswer;
  }

  let { exercise, onAnswer }: Props = $props();

  let userInput = $state('');
  let answered = $state(false);
  let isCorrect = $state(false);
  let checking = $state(false);
  let hintLevel = $state(0);
  let announcement = $state('');
  let resultRef: HTMLElement | undefined = $state();
  let submittedAnswer = $state('');
  let submittedCorrect = $state(false);
  let aiVerified = $state(false);

  const directionDisplay = $derived(buildDirectionDisplay(exercise.direction));
  const promptDisplay = $derived(buildPromptDisplay(exercise));
  const hintText = $derived(buildHintText(exercise.expectedAnswer, hintLevel));
  const allAcceptedAnswers = $derived(buildAcceptedAnswers(exercise));

  function showHint(): void {
    if (answered) return;
    if (hintLevel < 2) hintLevel += 1;
  }

  async function checkWithAI(trimmed: string): Promise<boolean> {
    try {
      const res = await fetch('/api/check-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedAnswer: exercise.expectedAnswer,
          acceptedAnswers: exercise.acceptedAnswers,
          userAnswer: trimmed,
          exerciseType: 'translation',
        }),
      });
      const data = await res.json();
      return data.ok === true && data.correct === true;
    } catch {
      return false;
    }
  }

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    if (answered || checking || !userInput.trim()) return;

    const trimmed = userInput.trim();
    const normalizedInput = normalizeForComparison(trimmed);

    const allAnswers = [exercise.expectedAnswer, ...exercise.acceptedAnswers];
    if (exercise.expectedRomaji) {
      allAnswers.push(exercise.expectedRomaji);
    }

    const stringMatchCorrect = allAnswers.some(
      (answer) => normalizeForComparison(answer) === normalizedInput,
    );

    if (stringMatchCorrect) {
      answered = true;
      isCorrect = true;
      submittedAnswer = trimmed;
      submittedCorrect = true;
      aiVerified = false;
      announcement = 'Correct!';
      setTimeout(() => resultRef?.focus(), 100);
      return;
    }

    // String match failed — ask AI before marking incorrect
    checking = true;
    submittedAnswer = trimmed;

    const aiCorrect = await checkWithAI(trimmed);

    checking = false;
    answered = true;
    isCorrect = aiCorrect;
    submittedCorrect = aiCorrect;
    aiVerified = aiCorrect;
    announcement = aiCorrect
      ? 'Correct! (AI verified)'
      : `Incorrect. Expected: ${exercise.expectedAnswer}`;

    setTimeout(() => resultRef?.focus(), 100);
  }

  function continueToNext(): void {
    onAnswer({
      exerciseId: exercise.id,
      answerText: submittedAnswer,
      isCorrect: submittedCorrect,
    });
  }

  $effect(() => {
    exercise.id;

    userInput = '';
    answered = false;
    isCorrect = false;
    checking = false;
    hintLevel = 0;
    announcement = '';
    submittedAnswer = '';
    submittedCorrect = false;
    aiVerified = false;
  });
</script>

<ExerciseFrame title={exercise.title} ariaLabel="Translation exercise">
  {#snippet meta()}
    <div class="direction-badge">
      <span>{directionDisplay.sourceLabel}</span>
      <span class="direction-badge__arrow">→</span>
      <span>{directionDisplay.targetLabel}</span>
    </div>
  {/snippet}

  <div class="prompt-area">
    {#if promptDisplay.kind === 'japanese'}
      <p class="prompt-japanese">
        {promptDisplay.japanese}
        <InlineAudio japanese={exercise.japanese} size="md" />
      </p>
      <p class="prompt-romaji">{promptDisplay.romaji}</p>
    {:else}
      <p class="prompt-english">{promptDisplay.prompt}</p>
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
      disabled={answered || checking}
      autocomplete="off"
      autocapitalize="off"
    />

    {#if !answered && !checking}
      <div class="exercise-actions translation-actions">
        <button type="button" class="btn btn-ghost" onclick={showHint} disabled={hintLevel >= 2}>
          {hintLevel === 0 ? 'Show Hint' : 'More Hint'}
        </button>

        <button type="submit" class="btn btn-primary" disabled={!userInput.trim()}>Check</button>
      </div>
    {/if}

    {#if checking}
      <ExerciseStatusPanel>
        <span class="checking-line">
          <span class="checking-dot"></span>
          <span>Checking your answer…</span>
        </span>
      </ExerciseStatusPanel>
    {/if}
  </form>

  {#if hintLevel > 0 && !answered}
    <ExerciseStatusPanel role="note">
      <p class="hint-label">Hint</p>
      <p class="hint-text">{hintText}</p>
    </ExerciseStatusPanel>
  {/if}

  {#if answered}
    <div class="result-focus-target" bind:this={resultRef} tabindex="-1">
      <ExerciseResultPanel
        state={isCorrect ? 'correct' : 'incorrect'}
        title={isCorrect ? 'Correct!' : 'Not quite'}
        {aiVerified}
      >
        {#if !isCorrect}
          <div class="result-answers">
            <p class="result-item">
              <span class="result-label">Your answer</span>
              <span class="user-answer-text">{submittedAnswer}</span>
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
      </ExerciseResultPanel>
    </div>

    <div class="exercise-actions exercise-actions--full">
      <button type="button" class="btn btn-primary" onclick={continueToNext}>Continue</button>
    </div>
  {/if}

  <p class="sr-only" role="status" aria-live="polite">{announcement}</p>
</ExerciseFrame>

<style>
  .direction-badge {
    display: inline-flex;
    gap: var(--space-2);
    align-items: center;
    background: var(--bg-kinu);
    border-radius: var(--radius-md);
    padding: var(--space-1) var(--space-3);
    color: var(--text-bokashi);
    font-size: var(--text-xs);
    line-height: var(--leading-tight);
  }

  .direction-badge__arrow {
    color: var(--text-usuzumi);
  }

  .prompt-area {
    display: grid;
    gap: var(--space-1);
    text-align: center;
  }

  .prompt-japanese {
    color: var(--text-sumi);
    font-size: var(--text-3xl);
    font-feature-settings: 'palt';
    letter-spacing: var(--tracking-wider);
    margin: 0;
  }

  .prompt-romaji {
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
    margin: 0;
  }

  .prompt-english {
    color: var(--text-sumi);
    font-size: var(--text-2xl);
    margin: 0;
  }

  .input-area {
    display: grid;
    gap: var(--exercise-control-gap);
  }

  .input-label {
    color: var(--text-bokashi);
    display: block;
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .translation-input {
    width: 100%;
    background: var(--bg-shoji);
    border: 1.5px solid var(--border-light);
    border-radius: var(--radius-lg);
    color: var(--text-sumi);
    font-family: var(--font-sans);
    font-size: var(--text-lg);
    padding: var(--space-3) var(--space-4);
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
    cursor: default;
    opacity: 0.8;
  }

  .translation-input::placeholder {
    color: var(--text-usuzumi);
  }

  .translation-actions {
    align-items: center;
    justify-content: space-between;
    margin-top: var(--space-1);
  }

  .checking-line {
    display: inline-flex;
    gap: var(--space-2);
    align-items: center;
  }

  .checking-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-shu);
    animation: pulse 1s ease-in-out infinite;
  }

  .hint-label,
  .accepted-label,
  .result-label {
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-wide);
    margin: 0;
    text-transform: uppercase;
  }

  .hint-text {
    color: var(--text-bokashi);
    font-size: var(--text-base);
    margin: 0;
  }

  .result-focus-target {
    outline: none;
  }

  .result-answers,
  .accepted-section {
    display: grid;
    gap: var(--space-3);
  }

  .result-item {
    display: grid;
    gap: var(--space-1);
    margin: 0;
  }

  .user-answer-text {
    color: var(--state-error);
    font-size: var(--text-base);
    text-decoration: line-through;
  }

  .expected-answer-text {
    color: var(--state-success);
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }

  .expected-romaji {
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
    margin-left: var(--space-2);
  }

  .accepted-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .accepted-pill {
    display: inline-block;
    background: var(--bg-kinu);
    border-radius: var(--radius-md);
    color: var(--text-bokashi);
    font-size: var(--text-sm);
    padding: var(--space-1) var(--space-3);
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.4;
    }

    50% {
      opacity: 1;
    }
  }
</style>
