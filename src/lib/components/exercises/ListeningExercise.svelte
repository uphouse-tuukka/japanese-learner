<script lang="ts">
  import type { ListeningExercise, OnAnswer } from '$lib/types';
  import { isSpeaking, speak, stop } from '$lib/utils/tts';
  import { stripParentheticalRomaji } from '$lib/utils/text';
  import ExerciseFrame from './shared/ExerciseFrame.svelte';
  import ExerciseResultPanel from './shared/ExerciseResultPanel.svelte';

  let { exercise, onAnswer }: { exercise: ListeningExercise; onAnswer: OnAnswer } = $props();
  let selected = $state('');
  let speaking = $state(false);
  let loading = $state(false);
  let answered = $state(false);
  let isCorrect = $state(false);
  let submittedAnswer = $state('');

  async function playAudio(): Promise<void> {
    loading = true;
    speaking = false;
    const cleanedAudioText = stripParentheticalRomaji(exercise.audioText);
    const playback = speak(cleanedAudioText, { rate: 0.9, pitch: 1, serverVoice: 'nova' });
    try {
      while (!isSpeaking()) {
        const completed = await Promise.race([
          playback.then(() => true),
          new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 50)),
        ]);
        if (completed) break;
      }
      speaking = isSpeaking();
      loading = false;
      await playback;
    } finally {
      speaking = isSpeaking();
      loading = false;
    }
  }

  function handleStop(): void {
    stop();
    speaking = false;
    loading = false;
  }

  function submit(): void {
    if (answered) return;
    if (!selected) return;

    submittedAnswer = selected;
    isCorrect = selected === exercise.correctAnswer;
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
    selected = '';
    speaking = false;
    loading = false;
    answered = false;
    isCorrect = false;
    submittedAnswer = '';
  });
</script>

<ExerciseFrame title={exercise.title}>
  <p>Listen and choose the correct meaning.</p>

  <div class="exercise-actions exercise-actions--full audio-actions">
    <button type="button" class="btn btn-primary" onclick={playAudio} disabled={answered}>
      {loading ? 'Loading…' : speaking ? 'Playing…' : 'Play audio'}
    </button>
    <button type="button" class="btn btn-ghost" onclick={handleStop} disabled={answered}
      >Stop</button
    >
  </div>

  <div class="exercise-choice-grid">
    {#each exercise.choices as choice}
      <button
        type="button"
        class:selected={!answered && selected === choice}
        class:correct={answered && choice === exercise.correctAnswer}
        class:incorrect={answered && selected === choice && choice !== exercise.correctAnswer}
        class:dimmed={answered && choice !== exercise.correctAnswer && choice !== selected}
        onclick={() => (selected = choice)}
        disabled={answered}>{choice}</button
      >
    {/each}
  </div>

  {#if answered}
    <ExerciseResultPanel
      state={isCorrect ? 'correct' : 'incorrect'}
      title={isCorrect ? 'Correct!' : 'Not quite'}
    >
      {#if !isCorrect}
        <p>The correct answer: {exercise.correctAnswer}</p>
      {/if}
      <p><strong>{exercise.japanese}</strong> ({exercise.romaji})</p>
    </ExerciseResultPanel>
  {/if}

  <div class="exercise-actions exercise-actions--full">
    <button class="btn btn-primary" type="button" onclick={answered ? continueToNext : submit}>
      {answered ? 'Continue' : 'Submit answer'}
    </button>
  </div>
</ExerciseFrame>

<style>
  .audio-actions {
    margin-bottom: var(--space-1);
  }

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
</style>
