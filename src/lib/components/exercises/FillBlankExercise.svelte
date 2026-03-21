<script lang="ts">
  import type { FillBlankExercise, OnAnswer } from '$lib/types';
  import InlineAudio from '$lib/components/InlineAudio.svelte';
  import { normalizeForComparison } from '$lib/utils/text';

  let { exercise, onAnswer }: { exercise: FillBlankExercise; onAnswer: OnAnswer } = $props();
  let answer = $state('');

  function submit(): void {
    const normalized = answer.trim();
    if (!normalized) return;

    const normalizedInput = normalizeForComparison(normalized);
    const normalizedPrimaryAnswer = normalizeForComparison(exercise.answer);
    const normalizedRomajiAnswer = normalizeForComparison(exercise.answerRomaji);

    onAnswer({
      exerciseId: exercise.id,
      answerText: normalized,
      isCorrect:
        normalizedInput === normalizedPrimaryAnswer || normalizedInput === normalizedRomajiAnswer,
    });
  }
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
    <input bind:value={answer} placeholder="Fill the blank" />
    <button class="btn btn-primary" type="button" onclick={submit}>Submit answer</button>
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
</style>
