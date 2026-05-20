<script lang="ts">
  import type { OnAnswer, ReadingExercise } from '$lib/types';
  import InlineAudio from '$lib/components/InlineAudio.svelte';
  import ExerciseFrame from './shared/ExerciseFrame.svelte';
  import ExerciseResultPanel from './shared/ExerciseResultPanel.svelte';

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

<ExerciseFrame title={exercise.title}>
  <div class="reading-prompt">
    <div class="reading-passage">
      <p class="text-japanese reading-passage__text">
        {exercise.passage}
        <InlineAudio japanese={exercise.passage} size="md" />
      </p>
      {#if exercise.passageRomaji}
        <p class="romaji">{exercise.passageRomaji}</p>
      {/if}
    </div>
    <p class="reading-question">{exercise.question}</p>
  </div>

  <div class="exercise-control-stack">
    <textarea bind:value={answer} rows="3" placeholder="Type your answer" disabled={answered}
    ></textarea>

    {#if answered}
      <ExerciseResultPanel
        state={isCorrect ? 'correct' : 'incorrect'}
        title={isCorrect ? 'Correct!' : 'Not quite'}
      >
        {#if !isCorrect}
          <p>Expected answer: {exercise.answer}</p>
        {/if}
      </ExerciseResultPanel>
    {/if}

    <div class="exercise-actions exercise-actions--full">
      <button class="btn btn-primary" type="button" onclick={answered ? continueToNext : submit}>
        {answered ? 'Continue' : 'Submit answer'}
      </button>
    </div>
  </div>
</ExerciseFrame>

<style>
  .reading-prompt,
  .reading-passage {
    display: grid;
  }

  .reading-prompt {
    gap: var(--space-3);
  }

  .reading-passage {
    gap: var(--space-1);
  }

  .reading-passage__text,
  .reading-question {
    margin: 0;
  }

  .reading-question {
    color: var(--text-sumi);
    font-weight: var(--weight-medium);
  }

  .romaji {
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
    margin: 0;
  }
</style>
