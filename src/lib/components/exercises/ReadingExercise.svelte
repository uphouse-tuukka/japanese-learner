<script lang="ts">
  import type { OnAnswer, ReadingExercise } from '$lib/types';
  import InlineAudio from '$lib/components/InlineAudio.svelte';

  let { exercise, onAnswer }: { exercise: ReadingExercise; onAnswer: OnAnswer } = $props();
  let answer = $state('');
  let answered = $state(false);
  let isCorrect = $state(false);
  let submittedAnswer = $state('');

  function submit(): void {
    if (answered) return;
    const normalized = answer.trim();
    if (!normalized) return;

    submittedAnswer = normalized;
    isCorrect = normalized.toLowerCase() === exercise.answer.toLowerCase();
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
    {exercise.passage}
    <InlineAudio japanese={exercise.passage} size="md" />
  </p>
  {#if exercise.passageRomaji}
    <p class="romaji">{exercise.passageRomaji}</p>
  {/if}
  <p>{exercise.question}</p>
  <div class="answer-area">
    <textarea bind:value={answer} rows="3" placeholder="Type your answer" disabled={answered}
    ></textarea>
    {#if answered}
      <div class="result-panel">
        {#if isCorrect}
          <p class="result-correct">Correct!</p>
          <p class="ink-reward">+10 墨</p>
        {:else}
          <p class="result-incorrect">Not quite</p>
          <p>Expected answer: {exercise.answer}</p>
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
    margin-top: var(--space-1);
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
  }
</style>
