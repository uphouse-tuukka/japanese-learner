<script lang="ts">
  import type { SpokenMissionBriefing, SpokenMissionEvidenceState } from '$lib/types';

  type Props = {
    briefing: SpokenMissionBriefing;
    bestEvidence: SpokenMissionEvidenceState | 'untried';
    resumable: { currentTurn: number } | null;
    errorMessage: string;
    onStart: (startOver: boolean) => void;
    onChooseWritten: () => void;
  };

  let { briefing, bestEvidence, resumable, errorMessage, onStart, onChooseWritten }: Props =
    $props();

  const evidenceLabel = $derived(
    bestEvidence === 'untried'
      ? 'Untried'
      : bestEvidence === 'independent'
        ? 'Independent'
        : 'Supported',
  );
</script>

<section class="spoken-shell" aria-labelledby="spoken-heading">
  <div class="spoken-kicker">
    <span class="mic-seal" aria-hidden="true">
      <svg viewBox="0 0 24 24"
        ><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" /><path
          d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v4M9 21h6"
        /></svg
      >
    </span>
    <span>Spoken Mission</span>
    <span class="evidence-chip" data-evidence={bestEvidence}>{evidenceLabel}</span>
  </div>

  <div class="briefing-lead">
    <p class="eyebrow">Can-do</p>
    <h2 id="spoken-heading">{briefing.canDo}</h2>
    <p>{briefing.situation}</p>
  </div>

  <ol class="goal-list" aria-label="Mission goals">
    {#each briefing.goals as goal, index (goal.key)}
      <li>
        <span class="goal-number">{index + 1}</span>
        <span><strong>{goal.title}</strong><small>{goal.learnerGoal}</small></span>
      </li>
    {/each}
  </ol>

  <div class="briefing-notes">
    <p><strong>About {briefing.approximateMinutes} minutes.</strong> {briefing.assessment}</p>
    <p><strong>Audio privacy.</strong> {briefing.privacy}</p>
  </div>

  {#if errorMessage}
    <p class="message error" role="alert">{errorMessage}</p>
  {/if}

  <div class="briefing-actions">
    {#if resumable}
      <button class="btn btn-primary" type="button" onclick={() => onStart(false)}>
        Resume goal {resumable.currentTurn}
      </button>
      <button class="btn btn-secondary" type="button" onclick={() => onStart(true)}>
        Start over
      </button>
    {:else}
      <button class="btn btn-primary" type="button" onclick={() => onStart(false)}>
        Start Spoken Mission
      </button>
    {/if}
    <button class="btn btn-ghost" type="button" onclick={onChooseWritten}
      >Choose Written Mission</button
    >
  </div>
  <p class="permission-note">Microphone permission is requested only when you press Record.</p>
</section>

<style>
  .spoken-shell {
    min-width: 0;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    background: var(--bg-white);
    box-shadow: var(--shadow-card);
    padding: clamp(var(--space-5), 4vw, var(--space-8));
    display: grid;
    gap: var(--space-5);
    overflow: hidden;
  }
  .spoken-kicker,
  .briefing-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .spoken-kicker {
    color: var(--text-bokashi);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-wide);
  }
  .mic-seal {
    width: 2rem;
    height: 2rem;
    display: grid;
    place-items: center;
    border-radius: 999px;
    color: var(--accent-shu);
    background: var(--accent-shu-wash);
  }
  .mic-seal svg {
    width: 1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .evidence-chip {
    margin-left: auto;
    padding: var(--space-1) var(--space-3);
    border-radius: 999px;
    border: 1px solid var(--border-light);
    background: var(--bg-washi);
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
  }
  .evidence-chip[data-evidence='independent'] {
    border-color: var(--accent-matcha);
    background: var(--accent-matcha-wash);
    color: var(--accent-matcha);
  }
  .briefing-lead {
    max-width: 42rem;
    display: grid;
    gap: var(--space-2);
  }
  .briefing-lead h2,
  .briefing-lead p,
  .eyebrow {
    margin: 0;
  }
  .briefing-lead h2 {
    font-size: clamp(var(--text-xl), 4vw, var(--text-3xl));
    font-weight: var(--weight-light);
  }
  .eyebrow {
    color: var(--accent-shu);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
  }
  .goal-list {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .goal-list li {
    min-width: 0;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--bg-washi);
    border-top: 2px solid var(--accent-shu);
    border-radius: var(--radius-md);
  }
  .goal-list strong,
  .goal-list small {
    display: block;
  }
  .goal-list small {
    margin-top: var(--space-1);
  }
  .goal-number {
    color: var(--accent-shu);
    font-size: var(--text-xl);
    font-weight: var(--weight-light);
  }
  .briefing-notes {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-4);
    border: 1px solid var(--border-light);
    background: var(--bg-shoji);
  }
  .briefing-notes p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-bokashi);
  }
  .permission-note {
    margin: calc(var(--space-2) * -1) 0 0;
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
  }
  .message {
    margin: 0;
    padding: var(--space-3);
    border-radius: var(--radius-md);
  }
  .message.error {
    color: var(--state-error-text);
    background: var(--state-error-wash);
  }
  @media (max-width: 37.5rem) {
    .goal-list {
      grid-template-columns: 1fr;
    }
    .evidence-chip {
      margin-left: 0;
    }
    .briefing-actions {
      align-items: stretch;
    }
    .briefing-actions :global(.btn) {
      width: 100%;
    }
  }
</style>
