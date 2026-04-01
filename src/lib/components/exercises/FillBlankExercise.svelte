<script lang="ts">
  import type { FillBlankExercise, OnAnswer } from '$lib/types';
  import InlineAudio from '$lib/components/InlineAudio.svelte';
  import { normalizeForComparison } from '$lib/utils/text';

  let { exercise, onAnswer }: { exercise: FillBlankExercise; onAnswer: OnAnswer } = $props();
  let answer = $state('');
  let answered = $state(false);
  let isCorrect = $state(false);
  let submittedAnswer = $state('');
  let checking = $state(false);
  let aiVerified = $state(false);

  async function checkWithAI(trimmed: string): Promise<boolean> {
    try {
      const res = await fetch('/api/check-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedAnswer: exercise.answer,
          acceptedAnswers: [exercise.answerRomaji].filter(Boolean),
          userAnswer: trimmed,
          exerciseType: 'fill_blank',
        }),
      });
      const data = await res.json();
      return data.ok === true && data.correct === true;
    } catch {
      return false;
    }
  }

  async function submit(): Promise<void> {
    if (answered || checking) return;
    const normalized = answer.trim();
    if (!normalized) return;

    const normalizedInput = normalizeForComparison(normalized);
    const normalizedPrimaryAnswer = normalizeForComparison(exercise.answer);
    const normalizedRomajiAnswer = normalizeForComparison(exercise.answerRomaji);

    const stringMatchCorrect =
      normalizedInput === normalizedPrimaryAnswer || normalizedInput === normalizedRomajiAnswer;

    if (stringMatchCorrect) {
      submittedAnswer = normalized;
      isCorrect = true;
      answered = true;
      aiVerified = false;
      return;
    }

    checking = true;
    submittedAnswer = normalized;

    const aiCorrect = await checkWithAI(normalized);

    checking = false;
    isCorrect = aiCorrect;
    answered = true;
    aiVerified = aiCorrect;
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
    checking = false;
    aiVerified = false;
  });
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
    <input bind:value={answer} placeholder="Fill the blank" disabled={answered || checking} />

    {#if checking}
      <div class="checking-indicator">
        <span class="checking-dot"></span>
        <span>Checking your answer…</span>
      </div>
    {/if}

    {#if answered}
      <div class="result-panel">
        {#if isCorrect}
          <p class="result-correct">
            Correct! {#if aiVerified}<span class="ai-badge">AI verified</span>{/if}
            <span class="ink-reward">+10 墨</span>
          </p>
        {:else}
          <p class="result-incorrect">Not quite</p>
          <p>The correct answer: {exercise.answer}</p>
          {#if exercise.answerRomaji}
            <p class="romaji">({exercise.answerRomaji})</p>
          {/if}
        {/if}
      </div>
    {/if}

    <button
      class="btn btn-primary"
      type="button"
      onclick={answered ? continueToNext : submit}
      disabled={checking}
    >
      {#if checking}Checking…{:else}{answered ? 'Continue' : 'Submit answer'}{/if}
    </button>
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

  .result-panel {
    background: var(--bg-washi);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
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

  .checking-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background: var(--bg-kinu);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--text-bokashi);
  }

  .checking-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-shu);
    animation: pulse 1s ease-in-out infinite;
  }

  .ai-badge {
    font-size: var(--text-xs);
    background: var(--accent-matcha-wash);
    color: var(--state-success);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    margin-left: var(--space-1);
    font-weight: var(--weight-regular, 400);
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
  }
</style>
