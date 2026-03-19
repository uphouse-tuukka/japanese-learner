<!--
  Root Layout — 日本語学習
  Clean, calm shell inspired by traditional Japanese architecture:
  a wooden engawa (veranda) framing the content garden.
-->
<script lang="ts">
  import '../app.css';

  let { children } = $props();

  /** Mobile nav toggle */
  let mobileNavOpen = $state(false);

  function closeMobileNav() {
    mobileNavOpen = false;
  }
</script>

<svelte:head>
  <title>日本語学習</title>
</svelte:head>

<div class="app-shell">
  <!-- ═══════════════════════════════════════
       Header
       ═══════════════════════════════════════ -->
  <header class="site-header">
    <div class="header-inner">
      <!-- App title — styled like a hanko (stamp) impression -->
      <a href="/" class="app-title" aria-label="Home — 日本語学習">
        <span class="title-mark" aria-hidden="true">学</span>
        <span class="title-text">日本語学習</span>
      </a>

      <!-- Desktop navigation -->
      <nav class="nav-desktop" aria-label="Main navigation">
        <a href="/" class="nav-link">
          <span class="nav-label-ja" aria-hidden="true">家</span>
          <span class="nav-label">Home</span>
        </a>
        <a href="/learn" class="nav-link">
          <span class="nav-label-ja" aria-hidden="true">学</span>
          <span class="nav-label">Learn</span>
        </a>
        <a href="/practice" class="nav-link">
          <span class="nav-label-ja" aria-hidden="true">練</span>
          <span class="nav-label">Practice</span>
        </a>
        <a href="/history" class="nav-link">
          <span class="nav-label-ja" aria-hidden="true">歴</span>
          <span class="nav-label">History</span>
        </a>
      </nav>

      <!-- Mobile nav toggle -->
      <button
        class="nav-toggle"
        aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileNavOpen}
        aria-controls="mobile-nav"
        onclick={() => (mobileNavOpen = !mobileNavOpen)}
      >
        <span class="nav-toggle-bar" class:open={mobileNavOpen}></span>
      </button>
    </div>
  </header>

  <!-- Mobile navigation drawer -->
  {#if mobileNavOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="nav-overlay"
      onclick={closeMobileNav}
      onkeydown={(e) => e.key === 'Escape' && closeMobileNav()}
    ></div>
    <nav
      id="mobile-nav"
      class="nav-mobile"
      aria-label="Main navigation"
    >
      <a href="/" class="nav-mobile-link" onclick={closeMobileNav}>
        <span class="nav-mobile-ja">家</span>
        Home
      </a>
      <a href="/learn" class="nav-mobile-link" onclick={closeMobileNav}>
        <span class="nav-mobile-ja">学</span>
        Learn
      </a>
      <a href="/practice" class="nav-mobile-link" onclick={closeMobileNav}>
        <span class="nav-mobile-ja">練</span>
        Practice
      </a>
      <a href="/history" class="nav-mobile-link" onclick={closeMobileNav}>
        <span class="nav-mobile-ja">歴</span>
        History
      </a>
    </nav>
  {/if}

  <!-- ═══════════════════════════════════════
       Main Content
       ═══════════════════════════════════════ -->
  <main class="main-content" id="main-content">
    <div class="content-container page-transition">
      {@render children()}
    </div>
  </main>

  <!-- ═══════════════════════════════════════
       Footer
       ═══════════════════════════════════════ -->
  <footer class="site-footer">
    <div class="footer-inner">
      <span class="footer-mark" aria-hidden="true">〻</span>
      <span>日本語学習</span>
    </div>
  </footer>
</div>

<style>
  /* ================================================
     App Shell
     ================================================ */
  .app-shell {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }

  /* ================================================
     Header
     ================================================ */
  .site-header {
    position: sticky;
    top: 0;
    z-index: var(--z-nav);
    background-color: var(--bg-shoji);
    border-bottom: 1px solid var(--border-light);
    /* Subtle frosted effect */
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: var(--content-wide);
    margin: 0 auto;
    padding: 0 var(--space-6);
    height: var(--nav-height);
  }

  /* ---- App Title ---- */
  .app-title {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    text-decoration: none;
    color: var(--text-sumi);
    flex-shrink: 0;
  }

  .app-title:hover {
    text-decoration: none;
    color: var(--text-sumi);
  }

  .title-mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--accent-shu);
    border: 1.5px solid var(--accent-shu);
    border-radius: 2px;
    /* Subtle stamp-like rotation — wabi-sabi imperfection */
    transform: rotate(-2deg);
    line-height: 1;
    flex-shrink: 0;
  }

  .title-text {
    font-size: var(--text-md);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-wider);
  }

  /* ---- Desktop Navigation ---- */
  .nav-desktop {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    font-weight: var(--weight-regular);
    letter-spacing: var(--tracking-wide);
    color: var(--text-bokashi);
    text-decoration: none;
    border-radius: var(--radius-md);
    transition:
      color var(--duration-fast) var(--ease-out),
      background-color var(--duration-fast) var(--ease-out);
    position: relative;
  }

  .nav-link:hover {
    color: var(--text-sumi);
    background-color: var(--bg-washi);
    text-decoration: none;
  }

  /* Kanji label beside each nav item */
  .nav-label-ja {
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
    font-weight: var(--weight-light);
    transition: color var(--duration-fast) var(--ease-out);
  }

  .nav-link:hover .nav-label-ja {
    color: var(--accent-shu);
  }

  /* Active state — via aria-current */
  .nav-link[aria-current='page'] {
    color: var(--text-sumi);
    font-weight: var(--weight-medium);
  }

  .nav-link[aria-current='page'] .nav-label-ja {
    color: var(--accent-shu);
  }

  /* ---- Mobile Nav Toggle (hamburger) ---- */
  .nav-toggle {
    display: none;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    border-radius: var(--radius-md);
    transition: background-color var(--duration-fast) var(--ease-out);
  }

  .nav-toggle:hover {
    background-color: var(--bg-washi);
  }

  .nav-toggle-bar {
    display: block;
    width: 18px;
    height: 2px;
    background-color: var(--text-sumi);
    position: relative;
    transition: background-color var(--duration-normal) var(--ease-in-out);
  }

  .nav-toggle-bar::before,
  .nav-toggle-bar::after {
    content: '';
    position: absolute;
    width: 18px;
    height: 2px;
    background-color: var(--text-sumi);
    left: 0;
    transition: transform var(--duration-normal) var(--ease-in-out);
  }

  .nav-toggle-bar::before {
    top: -6px;
  }

  .nav-toggle-bar::after {
    top: 6px;
  }

  /* Animate to X when open */
  .nav-toggle-bar.open {
    background-color: transparent;
  }

  .nav-toggle-bar.open::before {
    transform: translateY(6px) rotate(45deg);
  }

  .nav-toggle-bar.open::after {
    transform: translateY(-6px) rotate(-45deg);
  }

  /* ---- Mobile Overlay & Drawer ---- */
  .nav-overlay {
    position: fixed;
    inset: 0;
    top: var(--nav-height);
    background-color: rgba(44, 42, 38, 0.15);
    z-index: calc(var(--z-nav) - 1);
    animation: overlay-in var(--duration-normal) var(--ease-out) both;
  }

  @keyframes overlay-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .nav-mobile {
    position: fixed;
    top: var(--nav-height);
    right: 0;
    width: min(16rem, 80vw);
    bottom: 0;
    background-color: var(--bg-shoji);
    border-left: 1px solid var(--border-light);
    z-index: var(--z-nav);
    padding: var(--space-4) 0;
    display: flex;
    flex-direction: column;
    animation: drawer-in var(--duration-normal) var(--ease-out) both;
  }

  @keyframes drawer-in {
    from { transform: translateX(100%); }
    to   { transform: translateX(0); }
  }

  .nav-mobile-link {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-6);
    font-size: var(--text-md);
    font-weight: var(--weight-regular);
    color: var(--text-bokashi);
    text-decoration: none;
    transition:
      color var(--duration-fast) var(--ease-out),
      background-color var(--duration-fast) var(--ease-out);
  }

  .nav-mobile-link:hover {
    color: var(--text-sumi);
    background-color: var(--bg-washi);
    text-decoration: none;
  }

  .nav-mobile-ja {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    font-size: var(--text-sm);
    color: var(--accent-shu);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    flex-shrink: 0;
    font-weight: var(--weight-light);
  }

  /* ================================================
     Main Content
     ================================================ */
  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .content-container {
    width: 100%;
    max-width: var(--content-width);
    margin: 0 auto;
    padding: var(--space-10) var(--space-6) var(--space-16);
    flex: 1;
  }

  /* ================================================
     Footer
     ================================================ */
  .site-footer {
    border-top: 1px solid var(--border-light);
    padding: var(--space-6) var(--space-6);
    margin-top: auto;
  }

  .footer-inner {
    max-width: var(--content-wide);
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
    letter-spacing: var(--tracking-wider);
  }

  .footer-mark {
    font-size: var(--text-sm);
    opacity: 0.5;
  }

  /* ================================================
     Responsive
     ================================================ */

  /* Tablet and below: show mobile nav */
  @media (max-width: 768px) {
    .nav-desktop {
      display: none;
    }

    .nav-toggle {
      display: flex;
    }

    .header-inner {
      padding: 0 var(--space-4);
    }

    .content-container {
      padding: var(--space-6) var(--space-4) var(--space-12);
    }
  }

  /* Small mobile */
  @media (max-width: 480px) {
    .title-text {
      font-size: var(--text-base);
    }

    .content-container {
      padding: var(--space-5) var(--space-3) var(--space-10);
    }
  }
</style>
