<script lang="ts">
  import type { MultipleChoiceExercise, OnAnswer } from '$lib/types';
  import InlineAudio from '$lib/components/InlineAudio.svelte';

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
</script>

<section class="card">
  <h2>{exercise.title}</h2>
  <p class="text-japanese text-japanese-lg">
    {exercise.japanese}
    <InlineAudio japanese={exercise.japanese} size="md" />
  </p>
  <p class="romaji">{exercise.romaji}</p>
  <p>{exercise.question}</p>
  <div class="choices">
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
        {choice}
      </button>
    {/each}
  </div>

  {#if answered}
    <div class="result-panel">
      {#if isCorrect}
        <p class="result-correct">Correct!</p>
      {:else}
        <p class="result-incorrect">Not quite</p>
        <p>The correct answer: {exercise.correctAnswer}</p>
      {/if}
      {#if exercise.explanation}
        <p class="explanation">{exercise.explanation}</p>
      {/if}
    </div>
  {/if}

  <button class="btn btn-primary" type="button" onclick={answered ? continueToNext : submit}>
    {answered ? 'Continue' : 'Submit answer'}
  </button>
</section>

<style>
  .choices {
    display: grid;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .selected {
    border-color: var(--accent-shu);
    background: var(--accent-shu-wash);
  }

  .correct {
    border-color: var(--state-success);
    background: var(--accent-matcha-wash, #dcfce7);
    color: var(--state-success);
  }

  .incorrect {
    border-color: var(--state-error);
    background: var(--accent-shu-wash, #fee2e2);
    color: var(--state-error);
  }

  .dimmed {
    opacity: 0.5;
    pointer-events: none;
  }

  .result-panel {
    background: var(--bg-washi);
    border-radius: var(--radius-lg, 0.75rem);
    padding: var(--space-4, 1rem);
    margin-top: var(--space-3);
    animation: resultReveal 300ms var(--ease-out, ease-out);
  }

  .result-correct {
    color: var(--state-success);
    font-weight: var(--weight-medium, 600);
    font-size: var(--text-lg, 1.1rem);
  }

  .result-incorrect {
    color: var(--state-error);
    font-weight: var(--weight-medium, 600);
    font-size: var(--text-lg, 1.1rem);
  }

  .romaji {
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
    margin: 0;
  }

  .explanation {
    margin-top: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-bokashi);
  }

  .btn {
    width: 100%;
    margin-top: var(--space-4);
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
</style>
