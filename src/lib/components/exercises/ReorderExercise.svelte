<script lang="ts">
  import type { OnAnswer, ReorderExercise } from '$lib/types';
  import InlineAudio from '$lib/components/InlineAudio.svelte';
  import ExerciseFrame from './shared/ExerciseFrame.svelte';
  import ExerciseResultPanel from './shared/ExerciseResultPanel.svelte';

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

<ExerciseFrame title={exercise.title}>
  <p>{exercise.prompt}</p>
  <p>
    Tokens: {exercise.tokens.join(' | ')}
    <InlineAudio japanese={exercise.japanese} size="md" />
  </p>

  <div class="exercise-control-stack">
    <input bind:value={answer} placeholder="Type correct order with spaces" disabled={answered} />

    {#if answered}
      <ExerciseResultPanel
        state={isCorrect ? 'correct' : 'incorrect'}
        title={isCorrect ? 'Correct!' : 'Not quite'}
      >
        {#if !isCorrect}
          <p>Correct order: {exercise.correctOrder.join(' ')}</p>
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
