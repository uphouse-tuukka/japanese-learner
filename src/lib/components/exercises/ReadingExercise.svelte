<script lang="ts">
  import type { OnAnswer, ReadingExercise } from '$lib/types';
  import InlineAudio from '$lib/components/InlineAudio.svelte';

  let { exercise, onAnswer }: { exercise: ReadingExercise; onAnswer: OnAnswer } = $props();
  let answer = $state('');

  function submit(): void {
    const normalized = answer.trim();
    if (!normalized) return;
    onAnswer({
      exerciseId: exercise.id,
      answerText: normalized,
      isCorrect: normalized.toLowerCase() === exercise.answer.toLowerCase(),
    });
  }
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
    <textarea bind:value={answer} rows="3" placeholder="Type your answer"></textarea>
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
