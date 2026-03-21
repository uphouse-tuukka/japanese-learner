<script lang="ts">
  import type { OnAnswer, ReorderExercise } from '$lib/types';
  import InlineAudio from '$lib/components/InlineAudio.svelte';

  let { exercise, onAnswer }: { exercise: ReorderExercise; onAnswer: OnAnswer } = $props();
  let answer = $state('');
  let answered = $state(false);
  let isCorrect = $state(false);
  let submittedAnswer = $state('');

  function submit(): void {
    if (answered) return;
    const normalized = answer.trim();
    if (!normalized) return;

    submittedAnswer = normalized;
    isCorrect = normalized === exercise.correctOrder.join(' ');
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
  <p>{exercise.prompt}</p>
  <p>
    Tokens: {exercise.tokens.join(' | ')}
    <InlineAudio japanese={exercise.japanese} size="md" />
  </p>
  <div class="answer-area">
    <input bind:value={answer} placeholder="Type correct order with spaces" disabled={answered} />
    {#if answered}
      <div class="result-panel">
        {#if isCorrect}
          <p class="result-correct">Correct!</p>
          <p class="ink-reward">+10 墨</p>
        {:else}
          <p class="result-incorrect">Not quite</p>
          <p>Correct order: {exercise.correctOrder.join(' ')}</p>
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
