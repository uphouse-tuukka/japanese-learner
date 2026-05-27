<script lang="ts">
  import type { MultipleChoiceExercise, OnAnswer } from '$lib/types';
  import { getMultipleChoiceOptionDisplay } from '$lib/utils/exercise-display';
  import ExerciseFrame from './shared/ExerciseFrame.svelte';
  import ExerciseResultPanel from './shared/ExerciseResultPanel.svelte';

  let { exercise, onAnswer }: { exercise: MultipleChoiceExercise; onAnswer: OnAnswer } = $props();
  let selected = $state('');
  let answered = $state(false);
  let isCorrect = $state(false);

  $effect(() => {
    exercise.id;
    selected = '';
    answered = false;
    isCorrect = false;
  });

  function submit(): void {
    if (!selected) return;
    answered = true;
    isCorrect = selected === exercise.correctAnswer;
  }

  function continueToNext(): void {
    onAnswer({
      exerciseId: exercise.id,
      answerText: selected,
      isCorrect,
    });
  }

  function choiceDisplay(choice: string): string {
    return getMultipleChoiceOptionDisplay({ question: exercise.question, choice });
  }
</script>

<ExerciseFrame title={exercise.title}>
  <p>{exercise.question}</p>

  <div class="exercise-choice-grid">
    {#each exercise.choices as choice}
      <button
        type="button"
        class:selected={!answered && selected === choice}
        class:correct={answered && choice === exercise.correctAnswer}
        class:incorrect={answered && selected === choice && choice !== exercise.correctAnswer}
        class:dimmed={answered && choice !== exercise.correctAnswer && choice !== selected}
        onclick={() => (selected = choice)}
        disabled={answered}
      >
        {choiceDisplay(choice)}
      </button>
    {/each}
  </div>

  {#if answered}
    <ExerciseResultPanel
      state={isCorrect ? 'correct' : 'incorrect'}
      title={isCorrect ? 'Correct!' : 'Not quite'}
    >
      {#if !isCorrect}
        <p>The correct answer: {choiceDisplay(exercise.correctAnswer)}</p>
      {/if}
      {#if exercise.explanation}
        <p class="explanation">{exercise.explanation}</p>
      {/if}
    </ExerciseResultPanel>
  {/if}

  <div class="exercise-actions exercise-actions--full">
    <button class="btn btn-primary" type="button" onclick={answered ? continueToNext : submit}>
      {answered ? 'Continue' : 'Submit answer'}
    </button>
  </div>
</ExerciseFrame>

<style>
  .selected {
    border-color: var(--accent-shu);
    background: var(--accent-shu-wash);
  }

  .correct {
    border-color: var(--state-success);
    background: var(--accent-matcha-wash);
    color: var(--state-success);
  }

  .incorrect {
    border-color: var(--state-error);
    background: var(--accent-shu-wash);
    color: var(--state-error);
  }

  .dimmed {
    opacity: 0.5;
    pointer-events: none;
  }

  .explanation {
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }
</style>
