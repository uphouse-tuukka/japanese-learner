<script lang="ts">
import { dev } from '$app/environment';
import type { ExerciseType } from '$lib/types';

let { onGenerateDebug }: { onGenerateDebug: (type: ExerciseType) => void } = $props();

const exerciseTypes: ExerciseType[] = [
  'multiple_choice',
  'translation',
  'fill_blank',
  'reorder',
  'reading',
  'listening'
];

let isOpen = $state(false);
let selectedType = $state<ExerciseType>('multiple_choice');

function toggleOpen(): void {
  isOpen = !isOpen;
}

function selectType(type: ExerciseType): void {
  selectedType = type;
}

function triggerGenerate(): void {
  onGenerateDebug(selectedType);
}
</script>

{#if dev}
  <div class="debug-root">
    <button
      class="debug-toggle"
      type="button"
      aria-expanded={isOpen}
      aria-controls="debug-panel"
      onclick={toggleOpen}
    >
      🔧
    </button>

    {#if isOpen}
      <section id="debug-panel" class="debug-panel" aria-label="Debug panel">
        <h2>Debug Panel</h2>
        <div class="type-grid">
          {#each exerciseTypes as type}
            <button
              class="type-button"
              class:selected={selectedType === type}
              type="button"
              onclick={() => selectType(type)}
            >
              {type}
            </button>
          {/each}
        </div>
        <button class="generate-button" type="button" onclick={triggerGenerate}>
          Generate Debug Session
        </button>
      </section>
    {/if}
  </div>
{/if}

<style>
  .debug-root {
    position: fixed;
    right: var(--space-4);
    bottom: var(--space-4);
    z-index: var(--z-overlay);
    display: grid;
    justify-items: end;
    gap: var(--space-2);
    pointer-events: none;
  }

  .debug-toggle,
  .debug-panel,
  .type-button,
  .generate-button {
    pointer-events: auto;
  }

  .debug-toggle {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--border-mid) 70%, transparent);
    background: color-mix(in srgb, var(--bg-kinu) 82%, transparent);
    backdrop-filter: blur(8px);
    color: var(--text-bokashi);
    font-size: var(--text-base);
    line-height: 1;
    box-shadow: var(--shadow-sm);
    cursor: pointer;
  }

  .debug-panel {
    width: min(20rem, calc(100vw - var(--space-8)));
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid color-mix(in srgb, var(--border-mid) 70%, transparent);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--bg-washi) 86%, transparent);
    backdrop-filter: blur(8px);
    box-shadow: var(--shadow-md);
  }

  .debug-panel h2 {
    margin: 0;
    font-size: var(--text-sm);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--text-bokashi);
  }

  .type-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .type-button {
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--bg-shoji) 85%, transparent);
    color: var(--text-bokashi);
    font-size: var(--text-xs);
    text-transform: lowercase;
    padding: var(--space-2);
    cursor: pointer;
  }

  .type-button.selected {
    border-color: color-mix(in srgb, var(--accent-matcha) 65%, var(--border-mid));
    background: color-mix(in srgb, var(--accent-matcha-wash) 80%, transparent);
    color: var(--text-sumi);
  }

  .generate-button {
    border: 1px solid color-mix(in srgb, var(--accent-shu) 65%, var(--border-mid));
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--accent-shu-wash) 88%, transparent);
    color: var(--accent-shu-deep);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
  }

  @media (max-width: 640px) {
    .debug-root {
      right: var(--space-3);
      bottom: var(--space-3);
    }

    .debug-panel {
      width: min(18rem, calc(100vw - var(--space-6)));
    }
  }
</style>
