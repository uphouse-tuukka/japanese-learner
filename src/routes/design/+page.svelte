<script>
  import { fade } from 'svelte/transition';
</script>

<svelte:head>
  <title>Design Companion - Gamification</title>
</svelte:head>

<div class="page-transition" in:fade={{ duration: 300 }}>
  <header class="mb-12">
    <h1 class="text-3xl font-light tracking-wide mb-2" style="color: var(--text-sumi)">
      Gamification Design
    </h1>
    <p class="text-bokashi">Visual companion for brainstorming session.</p>
  </header>

  <section class="mb-12">
    <h2 class="text-xl mb-4 border-b border-light pb-2">Design Tokens</h2>

    <div class="grid grid-cols-2 md-grid-cols-4 gap-4 mb-8">
      <!-- Backgrounds -->
      <div
        class="p-4 rounded-lg border border-light bg-shoji flex flex-col items-center justify-center aspect-square"
      >
        <span class="text-sm font-medium">Shoji</span>
        <span class="text-xs text-usuzumi">#faf8f4</span>
      </div>
      <div
        class="p-4 rounded-lg border border-light bg-washi flex flex-col items-center justify-center aspect-square"
      >
        <span class="text-sm font-medium">Washi</span>
        <span class="text-xs text-usuzumi">#f5f1ea</span>
      </div>
      <div
        class="p-4 rounded-lg border border-light bg-kinu flex flex-col items-center justify-center aspect-square"
      >
        <span class="text-sm font-medium">Kinu</span>
        <span class="text-xs text-usuzumi">#eee9df</span>
      </div>
      <div
        class="p-4 rounded-lg border border-light bg-suna flex flex-col items-center justify-center aspect-square"
      >
        <span class="text-sm font-medium">Suna</span>
        <span class="text-xs text-usuzumi">#e6e0d4</span>
      </div>
    </div>

    <div class="grid grid-cols-2 md-grid-cols-4 gap-4">
      <!-- Accents -->
      <div
        class="p-4 rounded-lg text-white flex flex-col items-center justify-center aspect-square shadow-md"
        style="background-color: var(--accent-shu);"
      >
        <span class="text-sm font-medium">Shu</span>
        <span class="text-xs opacity-80">Vermillion</span>
      </div>
      <div
        class="p-4 rounded-lg text-white flex flex-col items-center justify-center aspect-square shadow-md"
        style="background-color: var(--accent-matcha);"
      >
        <span class="text-sm font-medium">Matcha</span>
        <span class="text-xs opacity-80">Green</span>
      </div>
      <div
        class="p-4 rounded-lg text-white flex flex-col items-center justify-center aspect-square shadow-md"
        style="background-color: var(--text-sumi);"
      >
        <span class="text-sm font-medium">Sumi</span>
        <span class="text-xs opacity-80">Ink</span>
      </div>
      <div
        class="p-4 rounded-lg text-white flex flex-col items-center justify-center aspect-square shadow-md"
        style="background-color: var(--text-bokashi);"
      >
        <span class="text-sm font-medium">Bokashi</span>
        <span class="text-xs opacity-80">Diluted</span>
      </div>
    </div>
  </section>

  <section>
    <h2 class="text-xl mb-4 border-b border-light pb-2">Hero Card Variants</h2>

    <div class="grid md-grid-cols-3 gap-8">
      <!-- Variant A -->
      <div class="flex flex-col gap-4">
        <h3 class="text-sm font-medium text-bokashi uppercase tracking-wide">
          A: Horizontal Split
        </h3>
        <div class="p-6 rounded-lg border border-light bg-white flex flex-col gap-6 shadow-sm">
          <div class="flex flex-row justify-between items-start">
            <div class="flex flex-row items-baseline gap-2">
              <span class="text-3xl font-light" style="color: var(--accent-shu)">3</span>
              <span class="text-sm text-bokashi">day streak</span>
            </div>
            <div class="flex flex-row items-center gap-2 text-sm text-matcha">
              <span>✓</span>
              <span>Goal met</span>
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <button class="btn-primary w-full">Start Session</button>
            <button type="button" class="link-button text-sm text-center text-bokashi">
              Practice weak points →
            </button>
          </div>
        </div>
      </div>

      <!-- Variant B -->
      <div class="flex flex-col gap-4">
        <h3 class="text-sm font-medium text-bokashi uppercase tracking-wide">B: Large Hero</h3>
        <div
          class="p-6 rounded-lg border border-light bg-white flex flex-col items-center gap-6 shadow-sm text-center"
        >
          <div class="flex flex-col items-center">
            <span class="text-5xl font-light mb-2" style="color: var(--accent-shu)">3</span>
            <span class="text-base text-sumi font-medium">day streak</span>
            <div class="flex flex-row items-center gap-2 text-sm text-matcha mt-2">
              <span>✓</span>
              <span>Today's goal complete</span>
            </div>
          </div>

          <div class="flex flex-col gap-3 w-full">
            <button class="btn-primary w-full">Start Today's Session</button>
            <button type="button" class="link-button text-sm text-center text-bokashi">
              Practice weak points →
            </button>
          </div>
        </div>
      </div>

      <!-- Variant C -->
      <div class="flex flex-col gap-4">
        <h3 class="text-sm font-medium text-bokashi uppercase tracking-wide">C: Side Accent</h3>
        <div class="p-6 rounded-lg border border-light bg-white flex flex-col gap-6 shadow-sm">
          <div class="flex flex-row items-center gap-4">
            <div
              class="rounded-full flex items-center justify-center w-16 h-16"
              style="background-color: var(--accent-shu-wash); color: var(--accent-shu)"
            >
              <span class="text-2xl font-medium">3</span>
            </div>
            <div class="flex flex-col">
              <span class="text-base font-medium text-sumi">Day Streak</span>
              <div class="flex flex-row items-center gap-1 text-sm text-matcha">
                <span>✓</span>
                <span>Goal complete</span>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <button class="btn-primary w-full">Start Session</button>
            <button type="button" class="link-button text-sm text-center text-bokashi">
              Practice weak points →
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  /* Local utility classes mapping to global vars */
  .bg-shoji {
    background-color: var(--bg-shoji);
  }
  .bg-washi {
    background-color: var(--bg-washi);
  }
  .bg-kinu {
    background-color: var(--bg-kinu);
  }
  .bg-suna {
    background-color: var(--bg-suna);
  }

  .text-bokashi {
    color: var(--text-bokashi);
  }
  .text-usuzumi {
    color: var(--text-usuzumi);
  }

  .border-light {
    border-color: var(--border-light);
  }

  /* Utility classes */
  .grid {
    display: grid;
  }
  .grid-cols-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .gap-4 {
    gap: var(--space-4);
  }

  .flex {
    display: flex;
  }
  .flex-col {
    flex-direction: column;
  }
  .items-center {
    align-items: center;
  }
  .justify-center {
    justify-content: center;
  }

  .p-4 {
    padding: var(--space-4);
  }
  .pb-2 {
    padding-bottom: var(--space-2);
  }

  .mb-2 {
    margin-bottom: var(--space-2);
  }
  .mb-4 {
    margin-bottom: var(--space-4);
  }
  .mb-8 {
    margin-bottom: var(--space-8);
  }
  .mb-12 {
    margin-bottom: var(--space-12);
  }

  .rounded-lg {
    border-radius: var(--radius-lg);
  }
  .border {
    border-width: 1px;
    border-style: solid;
  }
  .border-b {
    border-bottom-width: 1px;
    border-bottom-style: solid;
  }

  .shadow-md {
    box-shadow: var(--shadow-md);
  }
  .aspect-square {
    aspect-ratio: 1 / 1;
  }

  .text-3xl {
    font-size: var(--text-3xl);
  }
  .text-xl {
    font-size: var(--text-xl);
  }
  .text-sm {
    font-size: var(--text-sm);
  }
  .text-xs {
    font-size: var(--text-xs);
  }

  .font-light {
    font-weight: var(--weight-light);
  }
  .font-medium {
    font-weight: var(--weight-medium);
  }

  .tracking-wide {
    letter-spacing: var(--tracking-wide);
  }

  .opacity-80 {
    opacity: 0.8;
  }

  @media (min-width: 768px) {
    .md-grid-cols-4 {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .md-grid-cols-3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  /* New utilities for hero mockups */
  .bg-white {
    background-color: #ffffff;
  }
  .text-matcha {
    color: var(--accent-matcha);
  }
  .text-sumi {
    color: var(--text-sumi);
  }

  .flex-row {
    flex-direction: row;
  }
  .gap-1 {
    gap: var(--space-1);
  }
  .gap-2 {
    gap: var(--space-2);
  }
  .gap-3 {
    gap: var(--space-3);
  }
  .gap-6 {
    gap: var(--space-6);
  }
  .gap-8 {
    gap: var(--space-8);
  }

  .items-start {
    align-items: flex-start;
  }
  .items-baseline {
    align-items: baseline;
  }
  .justify-between {
    justify-content: space-between;
  }

  .text-center {
    text-align: center;
  }
  .w-full {
    width: 100%;
  }
  .h-16 {
    height: 4rem;
  }
  .w-16 {
    width: 4rem;
  }
  .rounded-full {
    border-radius: 9999px;
  }

  .text-base {
    font-size: var(--text-base);
  }
  .text-2xl {
    font-size: var(--text-2xl);
  }
  .text-5xl {
    font-size: 3rem;
  }

  .shadow-sm {
    box-shadow: var(--shadow-sm);
  }

  .mt-2 {
    margin-top: var(--space-2);
  }
  .uppercase {
    text-transform: uppercase;
  }

  .link-button {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }
</style>
