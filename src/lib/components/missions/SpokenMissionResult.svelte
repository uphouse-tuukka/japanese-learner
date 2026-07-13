<script lang="ts">
  import type { SpokenMissionResult } from '$lib/types';

  type Props = {
    result: SpokenMissionResult;
    onTryAgain: () => void;
  };

  let { result, onTryAgain }: Props = $props();
</script>

<section class="spoken-shell" aria-labelledby="result-heading">
  <div class="result-seal" data-evidence={result.evidenceState} aria-hidden="true">話</div>
  <p class="eyebrow">Spoken Mission complete</p>
  <h2 id="result-heading">
    {result.evidenceState === 'independent' ? 'Independent evidence' : 'Supported evidence'}
  </h2>
  <p class="result-can-do">{result.canDo}</p>

  <div class="evidence-list">
    {#each result.goals as goal}
      <article>
        <span>✓ {goal.title}</span>
        <p lang="ja">{goal.transcript}</p>
      </article>
    {/each}
  </div>

  <article class="practice-phrase">
    <span>One phrase to keep fresh</span>
    <p class="japanese">{result.suggestedPhrase.japanese}</p>
    <p class="romaji">{result.suggestedPhrase.romaji}</p>
    <small>{result.suggestedPhrase.english}</small>
  </article>

  <p class="result-note">
    This is task evidence only. It does not award XP, badges, streak credit, or Written Mission
    completion.
  </p>
  <div class="result-actions">
    <a class="btn btn-primary" href="/missions">Back to Travel Missions</a>
    <button class="btn btn-secondary" type="button" onclick={onTryAgain}>Try again</button>
  </div>
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
    text-align: center;
    justify-items: center;
  }
  .spoken-shell p,
  .practice-phrase p,
  .eyebrow {
    margin: 0;
  }
  .eyebrow {
    color: var(--accent-shu);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
  }
  .result-seal {
    width: 5rem;
    height: 5rem;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: var(--accent-matcha-wash);
    border: 2px solid var(--accent-matcha);
    color: var(--accent-matcha);
    font-size: var(--text-3xl);
  }
  .spoken-shell h2 {
    margin: calc(var(--space-3) * -1) 0 0;
    font-size: var(--text-3xl);
  }
  .result-can-do {
    max-width: 38rem;
    color: var(--text-bokashi);
  }
  .evidence-list {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
    text-align: left;
  }
  .evidence-list article {
    min-width: 0;
    padding: var(--space-4);
    border: 1px solid var(--border-light);
    background: var(--bg-shoji);
  }
  .evidence-list span {
    color: var(--accent-matcha);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
  }
  .evidence-list p {
    margin-top: var(--space-2);
    overflow-wrap: anywhere;
  }
  .practice-phrase {
    width: 100%;
    padding: var(--space-5);
    text-align: left;
    border-left: 3px solid var(--accent-shu);
    background: var(--bg-washi);
  }
  .practice-phrase > span {
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
  }
  .japanese {
    margin-top: var(--space-2) !important;
    font-size: clamp(var(--text-xl), 5vw, var(--text-3xl));
    line-height: var(--leading-tight);
  }
  .romaji {
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
  }
  .result-note {
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
  }
  .result-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  @media (max-width: 37.5rem) {
    .evidence-list {
      grid-template-columns: 1fr;
    }
    .result-actions {
      width: 100%;
      align-items: stretch;
    }
    .result-actions :global(.btn) {
      width: 100%;
    }
  }
</style>
