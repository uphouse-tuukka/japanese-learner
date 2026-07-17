<script lang="ts">
  import type { SpokenMissionHistoryEntry } from '$lib/types';

  type Props = {
    history: SpokenMissionHistoryEntry[];
  };

  let { history }: Props = $props();
</script>

<section class="history-shell" aria-labelledby="history-heading">
  <header>
    <p class="eyebrow">Restored conversation</p>
    <h3 id="history-heading">What you have already said</h3>
  </header>

  <ol class="history-list">
    {#each history as entry, index (`${entry.kind === 'skipped' ? entry.skippedAt : entry.assessedAt}-${entry.goalKey}-${index}`)}
      <li>
        <div
          class="history-marker"
          data-outcome={entry.kind === 'skipped' ? 'skipped' : entry.assessment.outcome}
          aria-hidden="true"
        >
          {entry.kind === 'skipped'
            ? '–'
            : entry.assessment.outcome === 'accepted'
              ? '✓'
              : index + 1}
        </div>
        <div class="history-content">
          <div class="history-meta">
            <strong>Goal {entry.turnNumber}: {entry.goalTitle}</strong>
            <span data-outcome={entry.kind === 'skipped' ? 'skipped' : entry.assessment.outcome}>
              {entry.kind === 'skipped'
                ? 'Skipped'
                : entry.assessment.outcome === 'accepted'
                  ? 'Accepted'
                  : entry.assessment.outcome === 'retry'
                    ? 'Tried again'
                    : 'Could not assess'}
            </span>
          </div>
          <div class="exchange" class:with-server-line={entry.writtenSupportRevealed}>
            {#if entry.writtenSupportRevealed}
              <div>
                <small>Restaurant server</small>
                <p lang="ja">{entry.npcDialogue.japanese}</p>
                <p class="romaji">{entry.npcDialogue.romaji}</p>
              </div>
            {/if}
            {#if entry.kind === 'assessment'}
              <div class="learner-line">
                <small>Your transcript</small>
                <p lang="ja">{entry.assessment.transcript ?? 'No speech was detected.'}</p>
              </div>
            {:else}
              <div class="learner-line skipped-line">
                <small>Your action</small>
                <p>Goal skipped after an incorrect response.</p>
              </div>
            {/if}
          </div>
          {#if entry.kind === 'assessment'}
            <p class="feedback">{entry.assessment.feedback}</p>
          {/if}
          {#if entry.supportUsed}
            <small class="support-note">English support was used for this response.</small>
          {/if}
        </div>
      </li>
    {/each}
  </ol>
</section>

<style>
  .history-shell {
    min-width: 0;
    padding: var(--space-5);
    border: 1px solid var(--border-light);
    background: var(--bg-washi);
    display: grid;
    gap: var(--space-4);
  }
  header,
  .history-content,
  .exchange > div {
    display: grid;
    gap: var(--space-1);
  }
  header h3,
  header p,
  .history-content p,
  .history-content small {
    margin: 0;
  }
  .eyebrow {
    color: var(--accent-shu);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
  }
  header h3 {
    font-size: var(--text-lg);
    font-weight: var(--weight-semibold);
  }
  .history-list {
    list-style: none;
    display: grid;
    gap: var(--space-4);
  }
  .history-list li {
    min-width: 0;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--space-3);
  }
  .history-marker {
    width: 1.8rem;
    height: 1.8rem;
    display: grid;
    place-items: center;
    border: 1px solid var(--border-mid);
    border-radius: 999px;
    background: var(--bg-white);
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
  }
  .history-marker[data-outcome='accepted'] {
    border-color: var(--accent-matcha);
    background: var(--accent-matcha-wash);
    color: var(--accent-matcha);
  }
  .history-marker[data-outcome='skipped'] {
    border-color: var(--state-warning);
    color: var(--state-warning);
  }
  .history-content {
    min-width: 0;
    gap: var(--space-3);
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--border-light);
  }
  .history-list li:last-child .history-content {
    padding-bottom: 0;
    border-bottom: 0;
  }
  .history-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .history-meta span {
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
  }
  .history-meta span[data-outcome='accepted'] {
    color: var(--accent-matcha);
  }
  .exchange {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }
  .exchange.with-server-line {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .exchange > div {
    min-width: 0;
    padding: var(--space-3);
    background: var(--bg-shoji);
  }
  .exchange small,
  .support-note {
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
  }
  .exchange p {
    overflow-wrap: anywhere;
  }
  .romaji {
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
  }
  .learner-line {
    border-left: 2px solid var(--accent-shu);
  }
  .feedback {
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }
  .support-note {
    color: var(--state-warning);
  }
  @media (max-width: 37.5rem) {
    .exchange.with-server-line {
      grid-template-columns: 1fr;
    }
  }
</style>
