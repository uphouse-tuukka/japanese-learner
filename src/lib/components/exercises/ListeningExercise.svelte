<script lang="ts">
  import type { ListeningExercise, OnAnswer } from '$lib/types';
  import { isSpeaking, speak, stop } from '$lib/utils/tts';

  let { exercise, onAnswer }: { exercise: ListeningExercise; onAnswer: OnAnswer } = $props();
  let selected = $state('');
  let speaking = $state(false);
  let loading = $state(false);

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
    if (!selected) return;
    onAnswer({
      exerciseId: exercise.id,
      answerText: selected,
      isCorrect: selected === exercise.correctAnswer,
    });
  }
</script>

<section class="card">
  <h2>{exercise.title}</h2>
  <p>{exercise.prompt}</p>
  <div class="audio-actions">
    <button type="button" class="btn btn-secondary" onclick={playAudio}>
      {loading ? 'Loading…' : speaking ? 'Playing…' : 'Play audio'}
    </button>
    <button type="button" class="btn btn-ghost" onclick={handleStop}>Stop</button>
  </div>
  <div class="choices">
    {#each exercise.choices as choice}
      <button type="button" class:selected={selected === choice} onclick={() => (selected = choice)}
        >{choice}</button
      >
    {/each}
  </div>
  <button class="btn btn-primary" type="button" onclick={submit}>Submit answer</button>
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
</style>
