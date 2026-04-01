<script lang="ts">
  import type { MissionChoice } from '$lib/types';

  let { choices, onselect, disabled, selectedIndex } = $props<{
    choices: MissionChoice[];
    onselect: (index: number) => void;
    disabled: boolean;
    selectedIndex: number | null;
  }>();

  function getCardClass(choice: MissionChoice, index: number): string {
    if (selectedIndex === null) return '';
    if (choice.isCorrect) return 'correct';
    if (selectedIndex === index && !choice.isCorrect) return 'incorrect';
    if (selectedIndex === index) return 'selected';
    return '';
  }
</script>

<div class="choices" role="group" aria-label="Mission response choices">
  {#each choices as choice, index (index)}
    <button
      type="button"
      class={`choice-card ${selectedIndex === index ? 'selected' : ''} ${getCardClass(choice, index)}`}
      onclick={() => onselect(index)}
      {disabled}
      aria-pressed={selectedIndex === index}
    >
      <p class="jp">{choice.japanese}</p>
      <p class="romaji">{choice.romaji}</p>
      <p class="en">{choice.english}</p>
    </button>
  {/each}
</div>

<style>
  .choices {
    display: grid;
    gap: var(--space-2);
  }

  .choice-card {
    width: 100%;
    text-align: left;
    display: grid;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--border-light);
    border-left: 3px solid var(--border-light);
    border-radius: var(--radius-lg);
    background: var(--bg-shoji);
    color: var(--text-sumi);
    transition:
      border-color var(--duration-fast) var(--ease-out),
      background-color var(--duration-fast) var(--ease-out);
  }

  .choice-card:hover:not(:disabled) {
    border-color: var(--accent-shu-soft);
    border-left-color: var(--accent-shu);
    background: var(--accent-shu-wash);
  }

  .choice-card.selected {
    border-color: var(--accent-shu);
    border-left-color: var(--accent-shu);
    background: var(--accent-shu-wash);
  }

  .choice-card.correct {
    border-color: var(--accent-matcha);
    border-left-color: var(--accent-matcha);
    background: var(--accent-matcha-wash);
  }

  .choice-card.incorrect {
    border-color: var(--accent-shu);
    border-left-color: var(--accent-shu);
    background: var(--accent-shu-wash);
  }

  .jp,
  .romaji,
  .en {
    margin: 0;
  }

  .jp {
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }

  .romaji {
    font-size: var(--text-sm);
    color: var(--text-bokashi);
  }

  .en {
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
  }
</style>
