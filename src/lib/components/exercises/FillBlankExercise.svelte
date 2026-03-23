<script lang="ts">
  import type { FillBlankExercise, OnAnswer } from '$lib/types';
  import InlineAudio from '$lib/components/InlineAudio.svelte';
  import { normalizeForComparison } from '$lib/utils/text';

  let { exercise, onAnswer }: { exercise: FillBlankExercise; onAnswer: OnAnswer } = $props();
  let answer = $state('');
  let answered = $state(false);
  let isCorrect = $state(false);
  let submittedAnswer = $state('');

  function submit(): void {
    if (answered) return;
    const normalized = answer.trim();
    if (!normalized) return;

    const normalizedInput = normalizeForComparison(normalized);
    const normalizedPrimaryAnswer = normalizeForComparison(exercise.answer);
    const normalizedRomajiAnswer = normalizeForComparison(exercise.answerRomaji);

    submittedAnswer = normalized;
    isCorrect =
      normalizedInput === normalizedPrimaryAnswer || normalizedInput === normalizedRomajiAnswer;
    answered = true;
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
  });
</script>

<section class="card">
  <h2>{exercise.title}</h2>
  <p class="text-japanese">
    {exercise.sentence}
    <InlineAudio japanese={exercise.sentence} size="md" />
  </p>
  {#if exercise.sentenceRomaji}
    <p class="romaji">{exercise.sentenceRomaji}</p>
  {/if}
  <p>{exercise.sentenceEnglish}</p>
  <div class="answer-area">
    <input bind:value={answer} placeholder="Fill the blank" disabled={answered} />

    {#if answered}
      <div class="result-panel">
        {#if isCorrect}
          <p class="result-correct">Correct! <span class="ink-reward">+10 墨</span></p>
        {:else}
          <p class="result-incorrect">Not quite</p>
          <p>The correct answer: {exercise.answer}</p>
          {#if exercise.answerRomaji}
            <p class="romaji">({exercise.answerRomaji})</p>
          {/if}
        {/if}
      </div>
    {/if}

    <button class="btn btn-primary" type="button" onclick={answered ? continueToNext : submit}>
      {answered ? 'Continue' : 'Submit answer'}
    </button>
  </div>
</section>

<style>
  .answer-area {
    display: grid;
    gap: var(--space-3);
    margin-top: var(--space-3);
  }

  .romaji {
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
    margin: 0;
  }

  .result-panel {
    background: var(--bg-washi);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
  }

  .result-correct {
    color: var(--state-success);
    font-weight: var(--weight-medium);
  }

  .result-incorrect {
    color: var(--state-error);
    font-weight: var(--weight-medium);
  }

  .ink-reward {
    display: inline;
    margin-left: var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--weight-regular, 400);
    color: var(--text-usuzumi);
    opacity: 0.85;
  }
</style>
