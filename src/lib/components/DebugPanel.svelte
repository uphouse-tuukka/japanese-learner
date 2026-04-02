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
    'listening',
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

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      },
    };
  }
</script>

{#if dev}
  <div class="debug-root" use:portal>
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

    <button
      class="debug-toggle"
      type="button"
      aria-expanded={isOpen}
      aria-controls="debug-panel"
      onclick={toggleOpen}
      aria-label="Toggle debug panel"
    >
      🔧
    </button>
  </div>
{/if}

<style>
  .debug-root {
    position: fixed;
    right: var(--space-4);
    bottom: var(--space-4);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-3);
    pointer-events: none;
  }

  .debug-toggle,
  .debug-panel,
  .type-button,
  .generate-button {
    pointer-events: auto;
  }

  .debug-toggle {
    width: 3rem;
    height: 3rem;
    border-radius: 999px;
    border: 2px solid var(--accent-shu);
    background: var(--bg-shoji);
    color: var(--accent-shu);
    font-size: var(--text-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    box-shadow: var(--shadow-md);
    cursor: pointer;
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  .debug-toggle:hover {
    transform: scale(1.05);
    box-shadow: var(--shadow-lg);
    background: var(--bg-kinu);
  }

  .debug-toggle:active {
    transform: scale(0.95);
  }

  .debug-panel {
    width: min(20rem, calc(100vw - var(--space-8)));
    max-height: calc(100dvh - 8rem);
    overflow-y: auto;
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--border-mid);
    border-radius: var(--radius-lg);
    background: rgba(250, 248, 244, 0.98);
    backdrop-filter: blur(12px);
    box-shadow: 0 4px 20px rgba(44, 42, 38, 0.15);
  }

  .debug-panel h2 {
    margin: 0;
    font-size: var(--text-sm);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--text-bokashi);
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--border-light);
  }

  .type-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .type-button {
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    background: var(--bg-shoji);
    color: var(--text-bokashi);
    font-size: var(--text-xs);
    text-transform: lowercase;
    padding: var(--space-2);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .type-button:hover {
    background: var(--bg-kinu);
    border-color: var(--border-focus);
  }

  .type-button.selected {
    border-color: var(--accent-matcha);
    background: var(--accent-matcha-wash);
    color: var(--text-sumi);
    font-weight: var(--weight-medium);
  }

  .generate-button {
    border: 1px solid var(--accent-shu);
    border-radius: var(--radius-sm);
    background: var(--accent-shu-wash);
    color: var(--accent-shu-deep);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .generate-button:hover {
    background: var(--accent-shu);
    color: #fff;
  }

  @media (max-width: 37.5rem) /* --bp-sm */ {
    .debug-root {
      right: var(--space-3);
      bottom: var(--space-3);
    }

    .debug-panel {
      width: min(18rem, calc(100vw - var(--space-6)));
    }
  }
</style>
