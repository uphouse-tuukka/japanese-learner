<script lang="ts">
  import type { Exercise, OnAnswer } from '$lib/types';
  import MultipleChoiceExercise from '$lib/components/exercises/MultipleChoiceExercise.svelte';
  import TranslationExercise from '$lib/components/exercises/TranslationExercise.svelte';
  import FillBlankExercise from '$lib/components/exercises/FillBlankExercise.svelte';
  import ReorderExercise from '$lib/components/exercises/ReorderExercise.svelte';
  import ReadingExercise from '$lib/components/exercises/ReadingExercise.svelte';
  import ListeningExercise from '$lib/components/exercises/ListeningExercise.svelte';

  let { exercise, onAnswer }: { exercise: Exercise; onAnswer: OnAnswer } = $props();
</script>

{#key exercise.id}
  {#if exercise.type === 'multiple_choice'}
    <MultipleChoiceExercise {exercise} {onAnswer} />
  {:else if exercise.type === 'translation'}
    <TranslationExercise {exercise} {onAnswer} />
  {:else if exercise.type === 'fill_blank'}
    <FillBlankExercise {exercise} {onAnswer} />
  {:else if exercise.type === 'reorder'}
    <ReorderExercise {exercise} {onAnswer} />
  {:else if exercise.type === 'reading'}
    <ReadingExercise {exercise} {onAnswer} />
  {:else}
    <ListeningExercise {exercise} {onAnswer} />
  {/if}
{/key}
