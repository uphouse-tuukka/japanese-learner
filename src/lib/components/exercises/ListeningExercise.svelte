<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { ListeningExercise, OnAnswer } from '$lib/types';
  import { isSpeaking, speak, stop } from '$lib/utils/tts';
  import { stripParentheticalRomaji } from '$lib/utils/text';
  import ExerciseFrame from './shared/ExerciseFrame.svelte';
  import ExerciseResultPanel from './shared/ExerciseResultPanel.svelte';

  let { exercise, onAnswer }: { exercise: ListeningExercise; onAnswer: OnAnswer } = $props();
  let selected = $state('');
  let speaking = $state(false);
  let loading = $state(false);
  let played = $state(false);
  let answered = $state(false);
  let isCorrect = $state(false);
  let submittedAnswer = $state('');

  const audioButtonLabel = $derived(
    loading || speaking ? 'Playing audio…' : played ? 'Replay audio' : 'Play audio',
  );
  const audioStatusLabel = $derived(
    loading || speaking
      ? 'Playing now'
      : played
        ? 'Audio played. Replay when you are ready.'
        : 'Ready when you are',
  );

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
      played = true;
    } finally {
      speaking = false;
      loading = false;
    }
  }

  function handleStop(): void {
    stop();
    speaking = false;
    loading = false;
    played = true;
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
    stop();
    selected = '';
    speaking = false;
    loading = false;
    played = false;
    answered = false;
    isCorrect = false;
    submittedAnswer = '';
  });

  onDestroy(() => {
    stop();
  });
</script>

<ExerciseFrame title={exercise.title}>
  <p>Listen and choose the correct meaning.</p>

  <div class="audio-panel" aria-label="Listening audio controls">
    <div class="audio-panel__copy">
      <span class="audio-panel__label">Audio prompt</span>
      <p>{audioStatusLabel}</p>
    </div>

    <div class="exercise-actions audio-actions">
      <button
        class="btn btn-secondary"
        type="button"
        onclick={playAudio}
        disabled={answered || loading || speaking}
      >
        {audioButtonLabel}
      </button>
      <button
        class="btn btn-ghost"
        type="button"
        onclick={handleStop}
        disabled={answered || (!speaking && !loading)}>Stop</button
      >
    </div>
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
  .audio-panel {
    display: grid;
    gap: var(--space-3);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    background: var(--bg-washi);
    padding: var(--space-4);
  }

  .audio-panel__copy {
    display: grid;
    gap: var(--space-1);
  }

  .audio-panel__label {
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
  }

  .audio-panel__copy p {
    color: var(--text-bokashi);
    margin: 0;
  }

  .audio-actions .btn {
    flex: 1 1 9rem;
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
