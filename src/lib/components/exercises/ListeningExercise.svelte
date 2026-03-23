<script lang="ts">
  import type { ListeningExercise, OnAnswer } from '$lib/types';
  import { isSpeaking, speak, stop } from '$lib/utils/tts';

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
    const playback = speak(exercise.audioText, { rate: 0.9, pitch: 1, serverVoice: 'nova' });
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

<section class="card">
  <h2>{exercise.title}</h2>
  <p>{exercise.prompt}</p>
  <div class="audio-actions">
    <button type="button" class="btn btn-secondary" onclick={playAudio} disabled={answered}>
      {loading ? 'Loading…' : speaking ? 'Playing…' : 'Play audio'}
    </button>
    <button type="button" class="btn btn-ghost" onclick={handleStop} disabled={answered}
      >Stop</button
    >
  </div>
  <div class="choices">
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
    <div class="result-panel">
      {#if isCorrect}
        <p class="result-correct">Correct! <span class="ink-reward">+10 墨</span></p>
      {:else}
        <p class="result-incorrect">Not quite</p>
        <p>The correct answer: {exercise.correctAnswer}</p>
      {/if}
    </div>
  {/if}

  <button class="btn btn-primary" type="button" onclick={answered ? continueToNext : submit}>
    {answered ? 'Continue' : 'Submit answer'}
  </button>
</section>

<style>
  .audio-actions,
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
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    margin-bottom: var(--space-3);
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
    display: inline;
    margin-left: var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--weight-regular, 400);
    color: var(--text-usuzumi);
    opacity: 0.85;
  }
</style>
