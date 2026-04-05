<script lang="ts">
  type Challenge = {
    challengeId: string;
    question: string;
    choices: string[];
    topic: string;
    difficulty: number;
  };

  type BuilderView = {
    prompt: string;
    choices: string[];
    correctAnswer: string;
    explanation: string;
    note: string;
  };

  type ViewState =
    | { kind: 'intro' }
    | { kind: 'starting' }
    | { kind: 'active'; challenge: Challenge; token: string; attemptId: string }
    | {
        kind: 'submitting';
        challenge: Challenge;
        token: string;
        attemptId: string;
        selected: string;
      }
    | {
        kind: 'result';
        correct: boolean;
        correctAnswer: string;
        explanation: string;
        builderView: BuilderView;
        selectedAnswer: string;
        challenge: Challenge;
      }
    | { kind: 'resting' }
    | { kind: 'error'; message: string };

  let viewState = $state<ViewState>({ kind: 'intro' });
  let selected = $state('');

  const isBusy = $derived(viewState.kind === 'starting' || viewState.kind === 'submitting');
  const liveMessage = $derived.by(() => {
    if (viewState.kind === 'starting') return 'Generating challenge.';
    if (viewState.kind === 'active') return 'Challenge is ready.';
    if (viewState.kind === 'submitting') return 'Checking your answer.';
    if (viewState.kind === 'result')
      return viewState.correct ? 'Result: Correct.' : 'Result: Not quite.';
    if (viewState.kind === 'resting') return 'The live capsule is resting right now.';
    if (viewState.kind === 'error') return viewState.message;
    return '';
  });

  async function handleStart() {
    viewState = { kind: 'starting' };
    selected = '';

    try {
      const res = await fetch('/api/portfolio/challenge/start', { method: 'POST' });
      const data = await res.json();

      if (!data.ok) {
        if (data.reason === 'quota_exceeded') {
          viewState = { kind: 'resting' };
        } else {
          viewState = { kind: 'error', message: data.message || 'Something went wrong.' };
        }
        return;
      }

      viewState = {
        kind: 'active',
        challenge: data.challenge,
        token: data.token,
        attemptId: data.attemptId,
      };
    } catch {
      viewState = { kind: 'error', message: 'Could not connect. Please try again.' };
    }
  }

  function selectChoice(choice: string) {
    if (viewState.kind === 'active') {
      selected = choice;
    }
  }

  async function handleSubmit() {
    if (viewState.kind !== 'active' || !selected) return;

    const { challenge, token, attemptId } = viewState;
    const selectedAnswer = selected;

    viewState = {
      kind: 'submitting',
      challenge,
      token,
      attemptId,
      selected: selectedAnswer,
    };

    try {
      const res = await fetch('/api/portfolio/challenge/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, selectedAnswer, attemptId }),
      });
      const data = await res.json();

      if (!data.ok) {
        viewState = { kind: 'error', message: data.message || 'Submission failed.' };
        return;
      }

      viewState = {
        kind: 'result',
        correct: data.correct,
        correctAnswer: data.correctAnswer,
        explanation: data.explanation,
        builderView: data.builderView,
        selectedAnswer,
        challenge,
      };
    } catch {
      viewState = { kind: 'error', message: 'Could not submit your answer. Please try again.' };
    }
  }
</script>

<svelte:head>
  <title>Japanese Challenge — Portfolio</title>
</svelte:head>

<main class="challenge-page page-transition">
  <p class="sr-only" aria-live="polite">{liveMessage}</p>

  <section class="challenge-viewport" aria-labelledby="challenge-heading">
    <div class="framing-column">
      <p class="eyebrow">日本語学習</p>
      <h1 id="challenge-heading">
        Feel free to try a short challenge from my Japanese learning app.
      </h1>
      <p class="supporting">
        This is a small slice of a private learning tool I built — one real AI-generated question
        about travel Japanese.
      </p>
      <p class="trust-note">
        This is a one-shot public capsule. The full app stays private, for me and my friends.
      </p>
    </div>

    <section class="capsule-column" aria-label="Live challenge capsule">
      <article class="capsule-card" aria-busy={isBusy}>
        {#if viewState.kind === 'intro'}
          <div class="state-pane">
            <p class="card-intro">One AI-generated question about travel Japanese</p>
            <button type="button" class="btn-primary primary-action" onclick={handleStart}>
              Start challenge
            </button>
            <p class="meta-note">Takes about a minute</p>
          </div>
        {:else if viewState.kind === 'starting'}
          <div class="state-pane">
            <p class="card-intro">One AI-generated question about travel Japanese</p>
            <button type="button" class="btn-primary primary-action" disabled>Generating…</button>
            <p class="loading-note">Preparing a fresh prompt…</p>
          </div>
        {:else if viewState.kind === 'active' || viewState.kind === 'submitting'}
          {@const challenge = viewState.challenge}
          {@const isSubmitting = viewState.kind === 'submitting'}
          {@const lockedChoice = viewState.kind === 'submitting' ? viewState.selected : selected}
          <div class="state-pane">
            <div class="topic-row">
              <span class="topic-chip">{challenge.topic}</span>
            </div>
            <p class="question">{challenge.question}</p>

            <div class="choice-grid" role="list">
              {#each challenge.choices as choice}
                <button
                  type="button"
                  class="choice-button"
                  class:selected={lockedChoice === choice}
                  disabled={isSubmitting}
                  onclick={() => selectChoice(choice)}
                >
                  {choice}
                </button>
              {/each}
            </div>

            <button
              type="button"
              class="btn-primary primary-action"
              onclick={handleSubmit}
              disabled={!lockedChoice || isSubmitting}
            >
              {isSubmitting ? 'Checking…' : 'Submit answer'}
            </button>
          </div>
        {:else if viewState.kind === 'result'}
          <div class="state-pane" role="status" aria-live="polite">
            <div class="result-header">
              <span
                class="status-chip"
                class:correct={viewState.correct}
                class:incorrect={!viewState.correct}
              >
                {viewState.correct ? 'Correct' : 'Not quite'}
              </span>
            </div>
            <p class="explanation">{viewState.explanation}</p>

            <ul class="result-choices">
              {#each viewState.challenge.choices as choice}
                <li
                  class="result-choice"
                  class:is-correct={choice === viewState.correctAnswer}
                  class:is-wrong-selected={choice === viewState.selectedAnswer &&
                    choice !== viewState.correctAnswer}
                >
                  <span>{choice}</span>
                  <span class="choice-tags">
                    {#if choice === viewState.selectedAnswer}
                      <span class="tag">Your answer</span>
                    {/if}
                    {#if choice === viewState.correctAnswer}
                      <span class="tag tag-correct">Correct answer</span>
                    {/if}
                  </span>
                </li>
              {/each}
            </ul>

            <section class="builder-card" aria-label="How this capsule works">
              <h2>How it works</h2>
              <ul>
                <li>Live AI-generated challenge under hard cap</li>
                <li>Deterministic grading for reliability</li>
                <li>This route stores no permanent learner profile</li>
              </ul>
              <p>{viewState.builderView.note}</p>
            </section>
          </div>
        {:else if viewState.kind === 'resting'}
          <div class="state-pane" role="status" aria-live="polite">
            <h2 class="quiet-title">The live capsule is resting right now.</h2>
            <p>Each visitor gets one challenge per day.</p>
            <p class="meta-note">Come back tomorrow to try again.</p>
          </div>
        {:else}
          <div class="state-pane" role="status" aria-live="polite">
            <h2 class="quiet-title">Something interrupted the capsule.</h2>
            <p>{viewState.message}</p>
            <button type="button" class="btn-secondary primary-action" onclick={handleStart}>
              Try again
            </button>
          </div>
        {/if}
      </article>
    </section>
  </section>

  <section class="how-strip" aria-labelledby="how-strip-title">
    <h2 id="how-strip-title">How it works</h2>
    <ol>
      <li>
        <h3>AI generates a real question</h3>
        <p>A fresh travel Japanese prompt is generated in real time.</p>
      </li>
      <li>
        <h3>You answer</h3>
        <p>You pick one option, just like in the private app flow.</p>
      </li>
      <li>
        <h3>Honest result, no tricks</h3>
        <p>You see exactly what was correct and why.</p>
      </li>
    </ol>
  </section>
</main>

<style>
  .challenge-page {
    padding: var(--space-8) var(--space-4) var(--space-12);
    display: grid;
    gap: var(--space-10);
  }

  .challenge-viewport {
    max-width: var(--content-wide);
    margin: 0 auto;
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
    gap: var(--space-10);
    align-items: start;
  }

  .framing-column {
    display: grid;
    gap: var(--space-4);
    align-content: start;
    padding-top: var(--space-2);
  }

  .eyebrow {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-usuzumi);
    letter-spacing: var(--tracking-wider);
  }

  h1 {
    margin: 0;
    font-size: clamp(var(--text-xl), 2.6vw, var(--text-3xl));
    font-weight: var(--weight-light);
    line-height: var(--leading-tight);
    letter-spacing: var(--tracking-tight);
    text-wrap: balance;
  }

  .supporting {
    margin: 0;
    color: var(--text-bokashi);
    max-width: 34ch;
  }

  .trust-note {
    margin: 0;
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
    max-width: 38ch;
  }

  .capsule-column {
    display: grid;
  }

  .capsule-card {
    background: var(--bg-white);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    min-height: 31.5rem;
    padding: var(--space-6);
  }

  .state-pane {
    display: grid;
    gap: var(--space-4);
    align-content: start;
    animation: resultReveal var(--duration-normal) var(--ease-out) both;
  }

  .card-intro {
    margin: 0;
    color: var(--text-bokashi);
  }

  .meta-note,
  .loading-note {
    margin: 0;
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
  }

  .loading-note {
    animation: pulse 1.2s var(--ease-in-out) infinite;
  }

  .primary-action {
    width: 100%;
    min-height: 2.75rem;
  }

  .topic-row {
    display: flex;
    align-items: center;
  }

  .topic-chip {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--border-mid);
    border-radius: 999px;
    background: var(--bg-washi);
    color: var(--text-bokashi);
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-3);
    letter-spacing: var(--tracking-wide);
  }

  .question {
    margin: 0;
    font-size: var(--text-md);
    line-height: var(--leading-normal);
  }

  .choice-grid {
    display: grid;
    gap: var(--space-2);
  }

  .choice-button {
    min-height: 2.75rem;
    border: 1px solid var(--border-mid);
    border-radius: var(--radius-md);
    background: var(--bg-white);
    color: var(--text-sumi);
    text-align: left;
    justify-content: flex-start;
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-base);
    font-weight: var(--weight-regular);
    white-space: normal;
  }

  .choice-button:hover:not(:disabled) {
    border-color: var(--accent-shu-soft);
    background: var(--accent-shu-wash);
  }

  .choice-button.selected {
    border-color: var(--accent-shu);
    background: var(--accent-shu-wash);
  }

  .result-header {
    display: flex;
    align-items: center;
  }

  .status-chip {
    display: inline-flex;
    border-radius: 999px;
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    border: 1px solid var(--border-mid);
    background: var(--bg-washi);
    color: var(--text-bokashi);
  }

  .status-chip.correct {
    border-color: var(--accent-matcha);
    background: var(--accent-matcha-wash);
    color: var(--state-success);
  }

  .status-chip.incorrect {
    border-color: var(--accent-shu);
    background: var(--accent-shu-wash);
    color: var(--state-error);
  }

  .explanation {
    margin: 0;
    color: var(--text-bokashi);
  }

  .result-choices {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }

  .result-choice {
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    background: var(--bg-white);
    padding: var(--space-3) var(--space-4);
    display: grid;
    gap: var(--space-2);
  }

  .result-choice.is-correct {
    border-color: var(--accent-matcha);
    background: var(--accent-matcha-wash);
  }

  .result-choice.is-wrong-selected {
    border-color: var(--accent-shu);
    background: var(--accent-shu-wash);
  }

  .choice-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .tag {
    display: inline-flex;
    border: 1px solid var(--border-mid);
    border-radius: 999px;
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
    color: var(--text-bokashi);
    background: var(--bg-washi);
  }

  .tag-correct {
    border-color: var(--accent-matcha);
    color: var(--state-success);
    background: var(--accent-matcha-wash);
  }

  .builder-card {
    margin-top: var(--space-2);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    background: var(--bg-washi);
    padding: var(--space-4);
    display: grid;
    gap: var(--space-2);
  }

  .builder-card h2 {
    margin: 0;
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }

  .builder-card ul {
    margin: 0;
    padding-left: var(--space-5);
    color: var(--text-bokashi);
    font-size: var(--text-sm);
    display: grid;
    gap: var(--space-1);
  }

  .builder-card p {
    margin: 0;
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
  }

  .quiet-title {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--weight-regular);
  }

  .how-strip {
    max-width: var(--content-wide);
    margin: 0 auto;
    width: 100%;
    border-top: 1px solid var(--border-light);
    padding-top: var(--space-6);
    display: grid;
    gap: var(--space-4);
  }

  .how-strip h2 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--weight-regular);
  }

  .how-strip ol {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .how-strip li {
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    background: var(--bg-white);
    padding: var(--space-4);
    display: grid;
    gap: var(--space-1);
  }

  .how-strip h3 {
    margin: 0;
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }

  .how-strip p {
    margin: 0;
    color: var(--text-bokashi);
    font-size: var(--text-sm);
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

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }

  @media (max-width: 48rem) /* --bp-md */ {
    .challenge-page {
      padding-top: var(--space-6);
      gap: var(--space-8);
    }

    .challenge-viewport {
      grid-template-columns: 1fr;
      gap: var(--space-6);
    }

    .capsule-card {
      min-height: 26.5rem;
      padding: var(--space-5);
    }

    .how-strip ol {
      grid-template-columns: 1fr;
    }
  }
</style>
