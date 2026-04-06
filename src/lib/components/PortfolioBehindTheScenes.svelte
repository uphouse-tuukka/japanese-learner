<script lang="ts">
  import { tick } from 'svelte';

  let isOpen = $state(false);
  let revealElement = $state<HTMLDivElement | null>(null);

  async function toggle(): Promise<void> {
    const opening = !isOpen;
    isOpen = opening;

    if (!opening) {
      return;
    }

    await tick();
    if (!revealElement) {
      return;
    }

    const revealBounds = revealElement.getBoundingClientRect();
    const isBelowFold = revealBounds.top > window.innerHeight;
    const extendsBelowViewport = revealBounds.bottom > window.innerHeight;

    if (!isBelowFold && !extendsBelowViewport) {
      return;
    }

    revealElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
</script>

<aside class="behind-the-scenes" aria-label="How this demo works">
  <button
    type="button"
    class="toggle-button"
    aria-expanded={isOpen}
    aria-controls="bts-reveal"
    onclick={toggle}
  >
    <span class="toggle-label">How this works</span>
    <span class="toggle-chevron" class:open={isOpen} aria-hidden="true">‹</span>
  </button>

  {#if isOpen}
    <div
      id="bts-reveal"
      class="reveal"
      role="region"
      aria-label="Behind the scenes explanation"
      bind:this={revealElement}
    >
      <section class="section">
        <h3 class="section-heading">What just happened</h3>
        <p class="section-body">
          You completed a real AI-generated Japanese lesson. The travel scenario you chose shaped
          the vocabulary, phrases, and exercises — all generated fresh by the same system that
          powers the full application.
        </p>
      </section>

      <div class="flow-diagram" aria-label="Demo flow: scenario to summary">
        <ol class="flow-steps">
          <li class="flow-step">
            <span class="step-icon" aria-hidden="true">場</span>
            <span class="step-label">Scenario</span>
          </li>
          <li class="flow-step">
            <span class="step-icon" aria-hidden="true">筆</span>
            <span class="step-label">AI lesson plan</span>
          </li>
          <li class="flow-step">
            <span class="step-icon" aria-hidden="true">言</span>
            <span class="step-label">Key phrases</span>
          </li>
          <li class="flow-step">
            <span class="step-icon" aria-hidden="true">練</span>
            <span class="step-label">Exercises</span>
          </li>
          <li class="flow-step">
            <span class="step-icon" aria-hidden="true">完</span>
            <span class="step-label">Summary</span>
          </li>
        </ol>
      </div>

      <section class="section">
        <h3 class="section-heading">How the demo works</h3>
        <ul class="detail-list">
          <li>You chose a travel scenario from six real-world situations.</li>
          <li>
            An AI tutor generated a contextual lesson with practical phrases and four practice
            exercises, tailored to that scenario.
          </li>
          <li>Each exercise used the same components and grading logic as the full application.</li>
          <li>
            After completing all exercises, an AI-generated summary assessed your strengths and
            areas to revisit.
          </li>
        </ul>
      </section>

      <hr class="divider" />

      <section class="section">
        <h3 class="section-heading">In the full application</h3>
        <ul class="detail-list full-app">
          <li>
            <strong>Adaptive learning</strong> — the tutor remembers what you've practiced and where you
            struggled, shaping each new session around your actual progress.
          </li>
          <li>
            <strong>Category rotation</strong> — exercises rotate across translation, reading, listening,
            fill-in-the-blank, and reordering to build balanced skills over time.
          </li>
          <li>
            <strong>Progression</strong> — ink points, milestones, and level advancement track your growth
            across sessions.
          </li>
          <li>
            <strong>Conversational missions</strong> — guided dialogues let you practice real travel conversations
            with an AI partner.
          </li>
        </ul>
      </section>
    </div>
  {/if}
</aside>

<style>
  .behind-the-scenes {
    margin-top: var(--space-6);
  }

  .toggle-button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-1);
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-usuzumi);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-wide);
    cursor: pointer;
    transition:
      color var(--duration-normal) var(--ease-out),
      background-color var(--duration-normal) var(--ease-out);
    line-height: 1;
    min-height: auto;
  }

  .toggle-button:hover {
    color: var(--text-bokashi);
    background: var(--bg-washi);
  }

  .toggle-button:focus-visible {
    outline: 2px solid var(--accent-shu);
    outline-offset: 2px;
  }

  .toggle-chevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: var(--text-xs);
    transform: rotate(-90deg);
    transition: transform var(--duration-normal) var(--ease-out);
    line-height: 1;
    width: 1em;
  }

  .toggle-chevron.open {
    transform: rotate(90deg);
  }

  .reveal {
    margin-top: var(--space-4);
    padding: var(--space-5) var(--space-6);
    background: var(--bg-washi);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    animation: revealIn var(--duration-slow) var(--ease-out);
    display: grid;
    gap: var(--space-5);
  }

  .section {
    display: grid;
    gap: var(--space-3);
  }

  .section-heading {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    color: var(--text-usuzumi);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .section-body {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-bokashi);
    line-height: var(--leading-normal);
  }

  .flow-diagram {
    --flow-icon-size: 2rem;
    --flow-step-width: 7rem;
    --flow-step-gap: 1.5rem;
    padding: var(--space-4) var(--space-2);
    background: var(--bg-kinu);
    border-radius: var(--radius-md);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .flow-steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    gap: var(--flow-step-gap);
    min-width: max-content;
  }

  .flow-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    position: relative;
    inline-size: var(--flow-step-width);
    flex: 0 0 var(--flow-step-width);
    text-align: center;
  }

  .flow-step:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 1rem;
    left: calc(50% + (var(--flow-icon-size) / 2));
    width: calc(var(--flow-step-width) + var(--flow-step-gap) - var(--flow-icon-size));
    height: 1px;
    background: var(--border-mid);
  }

  .step-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    font-size: var(--text-sm);
    color: var(--text-bokashi);
    background: var(--bg-shoji);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    line-height: 1;
  }

  .step-label {
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
    white-space: nowrap;
    text-align: center;
  }

  .detail-list {
    margin: 0;
    padding: 0 0 0 var(--space-5);
    display: grid;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-bokashi);
    line-height: var(--leading-normal);
  }

  .detail-list li::marker {
    color: var(--border-mid);
  }

  .detail-list.full-app li::marker {
    color: var(--accent-matcha-soft);
  }

  .detail-list strong {
    font-weight: var(--weight-medium);
    color: var(--text-sumi);
  }

  .divider {
    border: none;
    border-top: 1px solid var(--border-light);
    margin: 0;
  }

  @keyframes revealIn {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 37.5rem) {
    .reveal {
      padding: var(--space-4);
    }

    .flow-diagram {
      --flow-step-width: 6rem;
    }
  }
</style>
