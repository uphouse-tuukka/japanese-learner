<script lang="ts">
  import type { FillBlankExercise, OnAnswer } from '$lib/types';
  import InlineAudio from '$lib/components/InlineAudio.svelte';
  import {
    formatFillBlankContextText,
    formatFillBlankPromptText,
  } from '$lib/utils/exercise-display';
  import { normalizeForComparison } from '$lib/utils/text';
  import ExerciseFrame from './shared/ExerciseFrame.svelte';
  import ExerciseResultPanel from './shared/ExerciseResultPanel.svelte';
  import ExerciseStatusPanel from './shared/ExerciseStatusPanel.svelte';

  let { exercise, onAnswer }: { exercise: FillBlankExercise; onAnswer: OnAnswer } = $props();
  let answer = $state('');
  let answered = $state(false);
  let isCorrect = $state(false);
  let submittedAnswer = $state('');
  let checking = $state(false);
  let aiVerified = $state(false);
  let promptSentence = $derived(
    formatFillBlankPromptText({
      text: exercise.sentence,
      answer: exercise.answer,
      blank: exercise.blank,
    }),
  );
  let promptSentenceRomaji = $derived(
    formatFillBlankPromptText({
      text: exercise.sentenceRomaji,
      answer: exercise.answerRomaji,
      blank: exercise.blank,
    }),
  );
  let promptSentenceEnglish = $derived(
    formatFillBlankContextText({
      text: exercise.sentenceEnglish,
      fallbackText: exercise.englishContext,
    }),
  );

  async function checkWithAI(trimmed: string): Promise<boolean> {
    try {
      const res = await fetch('/api/check-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedAnswer: exercise.answer,
          acceptedAnswers: [exercise.answerRomaji].filter(Boolean),
          userAnswer: trimmed,
          exerciseType: 'fill_blank',
        }),
      });
      const data = await res.json();
      return data.ok === true && data.correct === true;
    } catch {
      return false;
    }
  }

  async function submit(): Promise<void> {
    if (answered || checking) return;
    const normalized = answer.trim();
    if (!normalized) return;

    const normalizedInput = normalizeForComparison(normalized);
    const normalizedPrimaryAnswer = normalizeForComparison(exercise.answer);
    const normalizedRomajiAnswer = normalizeForComparison(exercise.answerRomaji);

    const stringMatchCorrect =
      normalizedInput === normalizedPrimaryAnswer || normalizedInput === normalizedRomajiAnswer;

    if (stringMatchCorrect) {
      submittedAnswer = normalized;
      isCorrect = true;
      answered = true;
      aiVerified = false;
      return;
    }

    checking = true;
    submittedAnswer = normalized;

    const aiCorrect = await checkWithAI(normalized);

    checking = false;
    isCorrect = aiCorrect;
    answered = true;
    aiVerified = aiCorrect;
  }

  function continueToNext(): void {
    onAnswer({
      exerciseId: exercise.id,
      answerText: submittedAnswer,
      isCorrect,
    });
  }

  $effect(() => {
    exercise.id;
    answer = '';
    answered = false;
    isCorrect = false;
    submittedAnswer = '';
    checking = false;
    aiVerified = false;
  });
</script>

<ExerciseFrame title={exercise.title}>
  <p class="text-japanese">
    {promptSentence}
    <InlineAudio japanese={promptSentence} size="md" />
  </p>
  {#if promptSentenceRomaji}
    <p class="romaji">{promptSentenceRomaji}</p>
  {/if}
  <p>{promptSentenceEnglish}</p>

  <div class="exercise-control-stack">
    <input bind:value={answer} placeholder="Fill the blank" disabled={answered || checking} />

    {#if checking}
      <ExerciseStatusPanel tone="neutral">
        <span class="checking-row">
          <span class="checking-dot"></span>
          <span>Checking your answer…</span>
        </span>
      </ExerciseStatusPanel>
    {/if}

    {#if answered}
      <ExerciseResultPanel
        state={isCorrect ? 'correct' : 'incorrect'}
        title={isCorrect ? 'Correct!' : 'Not quite'}
        {aiVerified}
      >
        {#if !isCorrect}
          <p>The correct answer: {exercise.answer}</p>
          {#if exercise.answerRomaji}
            <p class="romaji">({exercise.answerRomaji})</p>
          {/if}
        {/if}
      </ExerciseResultPanel>
    {/if}

    <div class="exercise-actions exercise-actions--full">
      <button
        class="btn btn-primary"
        type="button"
        onclick={answered ? continueToNext : submit}
        disabled={checking}
      >
        {#if checking}Checking…{:else}{answered ? 'Continue' : 'Submit answer'}{/if}
      </button>
    </div>
  </div>
</ExerciseFrame>

<style>
  .romaji {
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
    margin: 0;
  }

  .checking-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .checking-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-shu);
    animation: pulse 1s ease-in-out infinite;
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
