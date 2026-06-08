<!--
  PROTOTYPE, locked direction: B4 is the selected session-summary design.
  A, B1, B2, and B3 stay available for comparison via ?variant=A/B1/B2/B3.
-->

<script lang="ts">
  import { dev } from '$app/environment';
  import { page } from '$app/stores';

  type VariantKey = 'A' | 'B1' | 'B4' | 'B2' | 'B3';

  interface VariantMeta {
    key: VariantKey;
    name: string;
    intent: string;
  }

  const LOCKED_VARIANT: VariantKey = 'B4';

  const VARIANTS: readonly VariantMeta[] = [
    {
      key: 'A',
      name: 'Receipt stack',
      intent: 'Closest to the current page, but swaps the report grid for one strong unlock.',
    },
    {
      key: 'B1',
      name: 'Coach note · balanced rail',
      intent:
        'Turns completion into a quiet status rail so ink fills the left side instead of leaving dead air.',
    },
    {
      key: 'B4',
      name: 'Locked design · coach note with A-top rail',
      intent:
        'Production direction: A-style completion top, coach-note reading area, no signal pill, and equal closing buttons.',
    },
    {
      key: 'B2',
      name: 'Coach note · top ledger',
      intent:
        'Moves score, ink, and signal into one slim ledger, then gives the coach note the full reading area.',
    },
    {
      key: 'B3',
      name: 'Coach note · margin note',
      intent:
        'Keeps the tutor-note feeling but moves the accounting into a compact margin rather than a crowded card.',
    },
  ];

  const VARIANT_KEYS = VARIANTS.map((variant) => variant.key);
  const VARIANT_META = Object.fromEntries(
    VARIANTS.map((variant) => [variant.key, variant]),
  ) as Record<VariantKey, VariantMeta>;

  const signal = 'Strong signal: polite openers';
  const score = 92;
  const inkRows = [
    { label: 'Correct answers', value: '24墨' },
    { label: 'Session complete', value: '+10墨' },
    { label: 'Combo bonus', value: '+6墨', highlight: true },
  ];
  const totalInk = '40';

  const unlock = {
    heading: 'Use this shape again',
    deck: 'When you need help from staff, open politely, name the place, then ask where it is.',
    pattern: ['すみません (sumimasen)', 'place', 'はどこですか (wa doko desu ka)'],
    japanese: 'すみません、3番ホームはどこですか。',
    romaji: 'sumimasen, san-ban hōmu wa doko desu ka',
    english: 'Excuse me, where is platform 3?',
    note: 'Works for platforms, exits, toilets, counters, and station gates.',
  };

  const selectedVariant = $derived(normalizeVariant($page.url.searchParams.get('variant')));
  const selectedMeta = $derived(VARIANT_META[selectedVariant]);

  function normalizeVariant(value: string | null): VariantKey {
    if (value === 'B' || value === 'B1') return 'B1';
    if (value === 'B4' || value === 'E' || value === 'locked') return 'B4';
    if (value === 'C' || value === 'B2') return 'B2';
    if (value === 'D' || value === 'B3') return 'B3';
    return LOCKED_VARIANT;
  }

  function getVariantUrl(key: VariantKey): string {
    const url = new URL($page.url);
    url.searchParams.set('variant', key);
    return `${url.pathname}${url.search}`;
  }

  const previousVariant = $derived(getAdjacentVariant(-1));
  const nextVariant = $derived(getAdjacentVariant(1));

  function getAdjacentVariant(direction: -1 | 1): VariantKey {
    const currentIndex = VARIANT_KEYS.indexOf(selectedVariant);
    const nextIndex = (currentIndex + direction + VARIANT_KEYS.length) % VARIANT_KEYS.length;
    return VARIANT_KEYS[nextIndex] ?? 'A';
  }
</script>

<svelte:head>
  <title>Prototype: Session summary unlock</title>
</svelte:head>

{#if !dev}
  <section class="card prototype-disabled">
    <h1>Prototype disabled</h1>
    <p>This throwaway route is only available in local development.</p>
  </section>
{:else}
  <article class={`prototype-page variant-${selectedVariant.toLowerCase()}`}>
    <header class="prototype-intro">
      <p class="prototype-kicker">Locked visual prototype</p>
      <h1>Session summary redesign</h1>
      <p>
        B4 is the locked direction for implementation. The earlier variants stay here for
        comparison, because deleting evidence is how committees happen.
      </p>
    </header>

    <section class="variant-note card" aria-label="Current prototype variant">
      <span class="variant-badge">{selectedVariant}</span>
      <div>
        <div class="variant-title-row">
          <h2>{selectedMeta.name}</h2>
        </div>
        <p>{selectedMeta.intent}</p>
      </div>
      <nav class="prototype-switcher" aria-label="Prototype variant switcher">
        <a
          class="switcher-button"
          aria-label="Previous variant"
          href={getVariantUrl(previousVariant)}>←</a
        >
        <span>{selectedVariant} · {selectedMeta.name}</span>
        <a class="switcher-button" aria-label="Next variant" href={getVariantUrl(nextVariant)}>→</a>
      </nav>
    </section>

    {#if selectedVariant === 'A'}
      <VariantA />
    {:else if selectedVariant === 'B1'}
      <VariantB1 />
    {:else if selectedVariant === 'B4'}
      <VariantB4 />
    {:else if selectedVariant === 'B2'}
      <VariantB2 />
    {:else}
      <VariantB3 />
    {/if}
  </article>
{/if}

{#snippet ScoreMark(compact = false)}
  <div class:compact class="score-mark">
    <div class="ink-bloom" aria-hidden="true"></div>
    <div class="hanko-stamp" aria-hidden="true">合格</div>
    <p class="score-value">{score}%</p>
  </div>
{/snippet}

{#snippet SignalPill()}
  <p class="signal-pill">{signal}</p>
{/snippet}

{#snippet InkCard(compact = false)}
  <section class:compact class="ink-card" aria-label="Ink earned">
    <h3>墨 Ink Earned</h3>
    <p class="ink-total"><span>{totalInk}</span>墨</p>
    <div class="ink-breakdown">
      {#each inkRows as row}
        <div class:highlight={row.highlight} class="ink-row">
          <span>{row.label}</span>
          <span>{row.value}</span>
        </div>
      {/each}
    </div>
  </section>
{/snippet}

{#snippet UnlockCard(mode: 'standard' | 'note' | 'scene' = 'standard')}
  <section class={`unlock-card unlock-${mode}`} aria-label="Today’s unlock">
    {#if mode === 'scene'}
      <div class="scene-label">Station counter</div>
    {/if}
    <div class="unlock-heading-row">
      <h3>{mode === 'scene' ? 'Try this in the wild' : unlock.heading}</h3>
      {#if mode === 'note'}
        <span class="coach-chip">Today’s unlock</span>
      {/if}
    </div>
    <p class="unlock-deck">{unlock.deck}</p>

    {#if mode !== 'scene'}
      <div class="pattern-strip" aria-label="Reusable phrase pattern">
        {#each unlock.pattern as part, index}
          <span>{part}</span>
          {#if index < unlock.pattern.length - 1}
            <b aria-hidden="true">+</b>
          {/if}
        {/each}
      </div>
    {/if}

    <blockquote class="phrase-example">
      <p class="jp">{unlock.japanese}</p>
      <p class="romaji">({unlock.romaji})</p>
      <p class="english">“{unlock.english}”</p>
    </blockquote>

    <p class="unlock-note">{unlock.note}</p>
  </section>
{/snippet}

{#snippet ActionsCard(compact = false)}
  <section class:compact class="actions-card" aria-label="Session actions">
    <div>
      <h3>Ready to close the session?</h3>
      <p>The takeaway is saved in the session summary. No extra exercise here.</p>
    </div>
    <div class="actions">
      <a class="btn btn-secondary" href="/">Return Home</a>
      <a class="btn btn-primary" href="/practice">Try Practice Mode</a>
    </div>
  </section>
{/snippet}

{#snippet VariantA()}
  <section class="summary-shell receipt-stack" aria-label="Variant A: Receipt stack">
    <header class="summary-top centered">
      <h2>Session complete</h2>
      {@render ScoreMark()}
      <p class="recap-copy">Excellent work. You kept polite request openings consistent.</p>
      {@render SignalPill()}
    </header>

    {@render InkCard()}
    {@render UnlockCard('standard')}
    {@render ActionsCard()}
  </section>
{/snippet}

{#snippet VariantB1()}
  <section
    class="summary-shell coach-frame coach-balanced"
    aria-label="Variant B1: Coach note, balanced rail"
  >
    <aside class="coach-status-panel" aria-label="Session result and ink">
      <p class="completion-chip"><span aria-hidden="true">✓</span> Complete</p>

      <div class="score-lockup">
        <strong>{score}%</strong>
        <span>session score</span>
      </div>

      <section class="ink-ledger" aria-label="Ink earned">
        <p class="ink-ledger-label">Ink earned</p>
        <p class="ink-ledger-total"><strong>{totalInk}</strong>墨</p>
        <div class="ink-ledger-rows">
          {#each inkRows as row}
            <div class:highlight={row.highlight} class="ink-row">
              <span>{row.label}</span>
              <span>{row.value}</span>
            </div>
          {/each}
        </div>
      </section>

      {@render SignalPill()}
    </aside>

    <main class="coach-note-panel">
      {@render UnlockCard('note')}
      {@render ActionsCard(true)}
    </main>
  </section>
{/snippet}

{#snippet VariantB4()}
  <section
    class="summary-shell coach-frame coach-a-balanced"
    aria-label="Variant B4: Coach note, A-style completion rail"
  >
    <aside class="coach-a-rail" aria-label="Session result and ink">
      <header class="summary-top centered coach-a-top">
        <h2>Session complete</h2>
        {@render ScoreMark()}
        <p class="recap-copy">Excellent work. You kept polite request openings consistent.</p>
      </header>

      {@render InkCard(true)}
    </aside>

    <main class="coach-note-panel">
      {@render UnlockCard('note')}
      <section class="actions-card compact b4-actions-card" aria-label="Session actions">
        <div>
          <h3>Ready to close the session?</h3>
          <p>The takeaway is saved in the session summary. No extra exercise here.</p>
        </div>
        <div class="actions b4-equal-actions">
          <a class="btn btn-secondary" href="/">Return Home</a>
          <a class="btn btn-primary" href="/practice">Try Practice Mode</a>
        </div>
      </section>
    </main>
  </section>
{/snippet}

{#snippet VariantB2()}
  <section
    class="summary-shell coach-frame coach-top-ledger"
    aria-label="Variant B2: Coach note, top ledger"
  >
    <header class="coach-ledger-strip" aria-label="Compact session result">
      <p class="completion-chip"><span aria-hidden="true">✓</span> Session complete</p>
      <div class="ledger-metric">
        <span>Score</span>
        <strong>{score}%</strong>
      </div>
      <div class="ledger-metric">
        <span>Ink</span>
        <strong>{totalInk}墨</strong>
      </div>
      <div class="ledger-metric ledger-signal">
        <span>Signal</span>
        <strong>Polite openers</strong>
      </div>
    </header>

    <div class="coach-wide-note">
      {@render UnlockCard('note')}

      <section class="close-session-card" aria-label="Close session">
        <p class="side-kicker">Done, not drilled again</p>
        <h3>Take the shape with you.</h3>
        <p>Ink is counted. The summary is saved. No second quiz hiding down here.</p>
        <div class="actions stacked">
          <a class="btn btn-primary" href="/practice">Try Practice Mode</a>
          <a class="btn btn-secondary" href="/">Return Home</a>
        </div>
      </section>
    </div>
  </section>
{/snippet}

{#snippet VariantB3()}
  <section
    class="summary-shell coach-frame coach-margin"
    aria-label="Variant B3: Coach note, margin note"
  >
    <div class="coach-ribbon" aria-label="Compact completion recap">
      <p class="completion-chip"><span aria-hidden="true">✓</span> Complete</p>
      <p><strong>{score}%</strong><span>score</span></p>
      <p><strong>{totalInk}墨</strong><span>earned</span></p>
      <p><strong>1</strong><span>unlock</span></p>
    </div>

    <div class="coach-board">
      <aside class="coach-margin-note" aria-label="Coach margin note">
        <p class="side-kicker">Coach note</p>
        <h3>Do not memorize only this sentence.</h3>
        <p>Keep the reusable move: polite opener → place → where is it?</p>

        <div class="mini-ink-list" aria-label="Ink breakdown">
          {#each inkRows as row}
            <div class:highlight={row.highlight}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          {/each}
        </div>
      </aside>

      {@render UnlockCard('note')}
    </div>

    {@render ActionsCard(true)}
  </section>
{/snippet}

<style>
  .prototype-page {
    display: grid;
    gap: var(--space-5);
    padding-bottom: var(--space-20);
  }

  .prototype-intro {
    display: grid;
    gap: var(--space-2);
    text-align: center;
  }

  .prototype-intro h1,
  .prototype-intro p {
    margin: 0;
  }

  .prototype-intro p:not(.prototype-kicker) {
    color: var(--text-bokashi);
  }

  .prototype-kicker {
    color: var(--accent-shu-deep);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .variant-note {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4);
  }

  .variant-note h2,
  .variant-note p {
    margin: 0;
  }

  .variant-title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .variant-note h2 {
    font-size: var(--text-md);
  }

  .variant-note p {
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }

  .variant-badge {
    display: inline-grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    flex: 0 0 auto;
    border: 2px solid var(--accent-shu);
    border-radius: var(--radius-sm);
    color: var(--accent-shu);
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
    transform: rotate(-4deg);
  }

  .summary-shell {
    background: var(--bg-white);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
  }

  .receipt-stack {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-6);
  }

  .summary-top {
    display: grid;
    gap: var(--space-3);
  }

  .summary-top h2,
  .summary-top p {
    margin: 0;
  }

  .centered {
    justify-items: center;
    text-align: center;
    padding: var(--space-2) 0 var(--space-1);
  }

  .recap-copy {
    color: var(--text-bokashi);
  }

  .signal-pill {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    border: 1px solid var(--border-light);
    border-radius: 999px;
    background: var(--bg-washi);
    color: var(--text-sumi);
    font-size: var(--text-sm);
    padding: var(--space-1) var(--space-3);
  }

  .signal-pill::before {
    content: '';
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 999px;
    background: var(--accent-matcha);
  }

  .score-mark {
    position: relative;
    display: grid;
    place-items: center;
    width: 10rem;
    min-height: 7.5rem;
    margin: var(--space-2) auto;
  }

  .score-mark.compact {
    width: 7rem;
    min-height: 5.5rem;
    margin: 0;
  }

  .score-value {
    position: relative;
    z-index: 2;
    margin: 0;
    color: var(--text-sumi);
    font-size: var(--text-3xl);
    font-weight: var(--weight-bold);
    line-height: 1;
  }

  .compact .score-value {
    font-size: var(--text-2xl);
  }

  .ink-bloom {
    position: absolute;
    width: 9rem;
    height: 9rem;
    border-radius: 50%;
    background: radial-gradient(circle, var(--accent-shu) 0%, transparent 68%);
    opacity: 0.08;
  }

  .compact .ink-bloom {
    width: 6rem;
    height: 6rem;
  }

  .hanko-stamp {
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    z-index: 3;
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border: 3px solid var(--accent-shu);
    border-radius: var(--radius-sm);
    color: var(--accent-shu);
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
    line-height: 1;
    opacity: 0.85;
    transform: rotate(13deg);
  }

  .compact .hanko-stamp {
    top: 0;
    right: -0.2rem;
    width: 2.4rem;
    height: 2.4rem;
    font-size: var(--text-md);
  }

  .ink-card {
    display: grid;
    justify-items: center;
    gap: var(--space-3);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    background: var(--bg-kinu);
    padding: var(--space-4);
    text-align: center;
  }

  .ink-card.compact {
    padding: var(--space-4);
  }

  .ink-card h3 {
    margin: 0;
    color: var(--text-bokashi);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .ink-total {
    margin: 0;
    color: var(--text-bokashi);
  }

  .ink-total span {
    color: var(--text-sumi);
    font-size: var(--text-2xl);
    font-weight: var(--weight-bold);
    line-height: 1;
  }

  .ink-breakdown {
    display: grid;
    gap: var(--space-2);
    width: min(100%, 19rem);
  }

  .ink-row {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }

  .ink-row.highlight {
    color: var(--accent-gold);
    font-weight: var(--weight-medium);
  }

  .unlock-card {
    display: grid;
    gap: var(--space-4);
    border: 1px solid var(--border-mid);
    border-radius: var(--radius-lg);
    background: var(--bg-shoji);
    padding: var(--space-5);
  }

  .unlock-note {
    margin: 0;
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }

  .unlock-heading-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .unlock-heading-row h3,
  .unlock-deck {
    margin: 0;
  }

  .unlock-heading-row h3 {
    font-size: var(--text-xl);
  }

  .unlock-deck {
    max-width: 42rem;
    color: var(--text-bokashi);
  }

  .coach-chip,
  .scene-label {
    border: 1px solid var(--accent-matcha);
    border-radius: 999px;
    color: var(--accent-matcha);
    font-size: var(--text-sm);
    padding: var(--space-1) var(--space-3);
    white-space: nowrap;
  }

  .pattern-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    border-radius: var(--radius-md);
    background: var(--bg-white);
    padding: var(--space-3);
  }

  .pattern-strip span {
    border: 1px solid var(--border-light);
    border-radius: 999px;
    color: var(--text-sumi);
    padding: var(--space-1) var(--space-3);
  }

  .pattern-strip b {
    color: var(--text-usuzumi);
  }

  .phrase-example {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    border-radius: var(--radius-md);
    background: var(--bg-white);
    padding: var(--space-4);
  }

  .phrase-example p {
    margin: 0;
  }

  .phrase-example .jp {
    color: var(--text-sumi);
    font-size: var(--text-xl);
    line-height: var(--leading-loose);
  }

  .phrase-example .romaji {
    color: var(--text-usuzumi);
  }

  .phrase-example .english {
    color: var(--text-bokashi);
  }

  .actions-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    background: var(--bg-washi);
    padding: var(--space-4);
  }

  .actions-card.compact {
    background: var(--bg-white);
  }

  .actions-card h3,
  .actions-card p {
    margin: 0;
  }

  .actions-card h3 {
    font-size: var(--text-md);
  }

  .actions-card p {
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    justify-content: flex-end;
  }

  .coach-frame {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-5);
  }

  .completion-chip {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    border-radius: 999px;
    background: var(--text-sumi);
    color: var(--bg-white);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    line-height: 1;
    padding: var(--space-2) var(--space-3);
  }

  .completion-chip span {
    display: inline-grid;
    place-items: center;
    width: 1.05rem;
    height: 1.05rem;
    border-radius: 999px;
    background: var(--accent-matcha);
    color: var(--bg-white);
    font-size: 0.72rem;
  }

  .coach-balanced,
  .coach-a-balanced {
    grid-template-columns: minmax(15rem, 0.74fr) minmax(0, 1.46fr);
    align-items: stretch;
  }

  .coach-a-balanced {
    grid-template-columns: minmax(17rem, 0.82fr) minmax(0, 1.38fr);
  }

  .coach-a-rail {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--space-4);
  }

  .coach-a-top {
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    background: var(--bg-washi);
    padding: var(--space-4);
  }

  .coach-a-rail .ink-card {
    align-content: center;
    min-height: 100%;
  }

  .coach-status-panel,
  .coach-note-panel {
    display: grid;
    gap: var(--space-4);
  }

  .coach-status-panel {
    align-content: stretch;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-washi) 82%, white),
      var(--bg-kinu)
    );
    padding: var(--space-4);
  }

  .score-lockup {
    display: grid;
    gap: var(--space-1);
    border-bottom: 1px solid var(--border-light);
    padding-bottom: var(--space-3);
  }

  .score-lockup strong {
    color: var(--text-sumi);
    font-size: var(--text-3xl);
    line-height: 1;
  }

  .score-lockup span,
  .ink-ledger-label {
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }

  .ink-ledger {
    display: grid;
    align-content: center;
    gap: var(--space-3);
    min-height: 0;
    border-radius: var(--radius-lg);
    background: var(--bg-white);
    padding: var(--space-4);
  }

  .ink-ledger-label,
  .ink-ledger-total {
    margin: 0;
  }

  .ink-ledger-total {
    color: var(--text-bokashi);
  }

  .ink-ledger-total strong {
    color: var(--text-sumi);
    font-size: var(--text-3xl);
    line-height: 1;
  }

  .ink-ledger-rows {
    display: grid;
    gap: var(--space-2);
  }

  .coach-note-panel {
    grid-template-rows: minmax(0, 1fr) auto;
  }

  .coach-note-panel .unlock-card {
    align-content: center;
    min-height: 100%;
    padding: var(--space-6);
  }

  .coach-top-ledger {
    grid-template-rows: auto minmax(0, 1fr);
  }

  .coach-ledger-strip {
    display: grid;
    grid-template-columns: auto minmax(6rem, 0.55fr) minmax(6rem, 0.55fr) minmax(10rem, 1fr);
    gap: var(--space-3);
    align-items: stretch;
  }

  .ledger-metric {
    display: grid;
    align-content: center;
    gap: var(--space-1);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    background: var(--bg-washi);
    padding: var(--space-3) var(--space-4);
  }

  .ledger-metric span,
  .side-kicker {
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }

  .ledger-metric strong {
    color: var(--text-sumi);
    font-size: var(--text-xl);
    line-height: 1.1;
  }

  .ledger-signal strong {
    color: var(--accent-matcha);
  }

  .coach-wide-note {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(13rem, 0.65fr);
    gap: var(--space-4);
    align-items: stretch;
  }

  .coach-wide-note .unlock-card {
    padding: var(--space-6);
  }

  .close-session-card {
    display: grid;
    align-content: center;
    gap: var(--space-3);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    background: var(--bg-kinu);
    padding: var(--space-5);
  }

  .close-session-card h3,
  .close-session-card p,
  .side-kicker {
    margin: 0;
  }

  .close-session-card p:not(.side-kicker) {
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }

  .actions.stacked {
    display: grid;
    justify-content: stretch;
  }

  .actions.stacked .btn {
    width: 100%;
  }

  .b4-actions-card {
    display: grid;
    gap: var(--space-3);
    justify-items: stretch;
  }

  .b4-equal-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
  }

  .b4-equal-actions .btn {
    justify-content: center;
    min-width: 0;
    width: 100%;
  }

  .coach-margin {
    grid-template-rows: auto minmax(0, 1fr) auto;
  }

  .coach-ribbon {
    display: grid;
    grid-template-columns: auto repeat(3, minmax(5.5rem, 1fr));
    gap: var(--space-3);
    align-items: stretch;
  }

  .coach-ribbon p {
    display: grid;
    align-content: center;
    gap: var(--space-1);
    margin: 0;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    background: var(--bg-washi);
    padding: var(--space-3);
  }

  .coach-ribbon .completion-chip {
    display: inline-flex;
    align-self: stretch;
    border: 0;
    background: var(--text-sumi);
  }

  .coach-ribbon strong {
    color: var(--text-sumi);
    font-size: var(--text-xl);
    line-height: 1;
  }

  .coach-ribbon span:not(.completion-chip span) {
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }

  .coach-board {
    display: grid;
    grid-template-columns: minmax(13rem, 0.58fr) minmax(0, 1.42fr);
    gap: var(--space-4);
    align-items: stretch;
  }

  .coach-margin-note {
    display: grid;
    align-content: center;
    gap: var(--space-3);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    background: var(--bg-kinu);
    padding: var(--space-5);
  }

  .coach-margin-note h3,
  .coach-margin-note p {
    margin: 0;
  }

  .coach-margin-note p:not(.side-kicker) {
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }

  .mini-ink-list {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .mini-ink-list div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    border-top: 1px solid var(--border-light);
    color: var(--text-bokashi);
    font-size: var(--text-sm);
    padding-top: var(--space-2);
  }

  .mini-ink-list div.highlight {
    color: var(--accent-gold);
  }

  .coach-board .unlock-card {
    padding: var(--space-6);
  }

  .prototype-switcher {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: var(--space-3);
    width: fit-content;
    margin-left: auto;
    border: 1px solid var(--text-sumi);
    border-radius: 999px;
    background: var(--text-sumi);
    color: var(--bg-white);
    padding: var(--space-2) var(--space-3);
  }

  .prototype-switcher .switcher-button {
    display: inline-grid;
    place-items: center;
    min-height: 2rem;
    width: 2rem;
    border: 1px solid color-mix(in srgb, var(--bg-white) 30%, transparent);
    border-radius: 999px;
    background: transparent;
    color: var(--bg-white);
    text-decoration: none;
  }

  .prototype-switcher .switcher-button:hover {
    background: color-mix(in srgb, var(--bg-white) 12%, transparent);
    text-decoration: none;
  }

  .prototype-switcher span {
    min-width: 11rem;
    text-align: center;
    font-size: var(--text-sm);
  }

  .prototype-disabled {
    display: grid;
    gap: var(--space-3);
    text-align: center;
  }

  @media (max-width: 48rem) {
    .coach-balanced,
    .coach-a-balanced,
    .coach-wide-note,
    .coach-board,
    .coach-ledger-strip,
    .coach-ribbon,
    .variant-note {
      grid-template-columns: 1fr;
    }

    .variant-note .prototype-switcher {
      margin-left: 0;
    }

    .coach-note-panel,
    .coach-a-rail,
    .coach-top-ledger,
    .coach-margin {
      grid-template-rows: auto;
    }

    .actions-card {
      display: grid;
      justify-items: start;
    }

    .actions {
      justify-content: flex-start;
      width: 100%;
    }
  }

  @media (max-width: 37.5rem) {
    .receipt-stack,
    .coach-frame {
      padding: var(--space-4);
    }

    .actions,
    .actions .btn {
      width: 100%;
    }

    .unlock-heading-row {
      align-items: flex-start;
      flex-direction: column;
    }

    .prototype-switcher {
      width: calc(100% - var(--space-6));
      justify-content: space-between;
    }

    .prototype-switcher span {
      min-width: 0;
    }

    .b4-equal-actions {
      grid-template-columns: 1fr;
      width: 100%;
    }
  }
</style>
