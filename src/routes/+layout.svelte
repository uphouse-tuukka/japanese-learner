<script lang="ts">
  import { page } from '$app/stores';
  import { configureOpenAiTts } from '$lib/utils/tts';
  import '../app.css';

  let { children, data } = $props();

  $effect(() => {
    configureOpenAiTts(data.useOpenAiTts);
  });

  const pathname = $derived($page.url.pathname);
  let username = $state('');
  let password = $state('');
  let loginError = $state('');
  let isSubmitting = $state(false);
  let isLoggingOut = $state(false);

  function isActive(path: string): boolean {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  async function handleLoginSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (isSubmitting) return;

    loginError = '';
    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password) {
      loginError = 'Please enter username and password';
      return;
    }

    isSubmitting = true;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: trimmedUsername,
          password,
        }),
      });

      if (response.status === 429) {
        loginError = 'Too many attempts, please wait';
        return;
      }

      let payload: { ok?: boolean; message?: string } | null = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (payload?.ok) {
        window.location.reload();
        return;
      }

      loginError = payload?.message ?? 'Invalid credentials, please try again';
    } catch {
      loginError = 'Unable to log in right now. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }

  async function handleLogout(): Promise<void> {
    if (isLoggingOut) return;
    isLoggingOut = true;

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    } finally {
      isLoggingOut = false;
    }
  }
</script>

{#if data.authenticated}
  <div class="shell">
    <header class="header">
      <div class="header-inner">
        <a href="/" class="title text-japanese">日本語学習</a>

        <nav class="nav" aria-label="Main navigation">
          <a href="/" class="nav-link" class:active={isActive('/')}>
            <span class="nav-en">Home</span>
            <span class="nav-ja">ホーム</span>
          </a>
          <a href="/learn" class="nav-link" class:active={isActive('/learn')}>
            <span class="nav-en">Learn</span>
            <span class="nav-ja">学ぶ</span>
          </a>
          <a href="/practice" class="nav-link" class:active={isActive('/practice')}>
            <span class="nav-en">Practice</span>
            <span class="nav-ja">練習</span>
          </a>
          <a href="/progress" class="nav-link" class:active={isActive('/progress')}>
            <span class="nav-en">Progress</span>
            <span class="nav-ja">進捗</span>
          </a>
          {#if data.dev}
            <a href="/design" class="nav-link" class:active={isActive('/design')}>
              <span class="nav-en">Design</span>
              <span class="nav-ja">デザイン</span>
            </a>
          {/if}
        </nav>
      </div>
    </header>

    <main class="main">
      <div class="container">
        {@render children()}
      </div>
    </main>

    <footer class="footer">
      <p>毎日少しずつ学びましょう。</p>
      <button class="logout-link" onclick={handleLogout} disabled={isLoggingOut}>
        {isLoggingOut ? 'Logging out…' : 'Log out'}
      </button>
    </footer>
  </div>
{:else}
  <main class="auth-gate">
    <form class="login-card" onsubmit={handleLoginSubmit} aria-label="Login form">
      <p class="welcome">
        Welcome to your personal Japanese AI tutor. This is an invite-only hobby project — please
        enter your credentials to continue.
      </p>

      <label class="field">
        <span class="field-label">Username</span>
        <input
          class="field-input"
          type="text"
          name="username"
          autocomplete="username"
          bind:value={username}
          required
        />
      </label>

      <label class="field">
        <span class="field-label">Password</span>
        <input
          class="field-input"
          type="password"
          name="password"
          autocomplete="current-password"
          bind:value={password}
          required
        />
      </label>

      <button class="submit-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Entering…' : 'Log in'}
      </button>

      {#if loginError}
        <p class="error-message" role="alert">{loginError}</p>
      {/if}
    </form>
  </main>
{/if}

<style>
  .shell {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  .header {
    position: sticky;
    top: 0;
    z-index: var(--z-nav);
    border-bottom: 1px solid var(--border-light);
    background: color-mix(in srgb, var(--bg-shoji) 94%, white);
  }

  .header-inner {
    max-width: var(--content-wide);
    margin: 0 auto;
    padding: var(--space-3) var(--space-4);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .title {
    font-size: var(--text-xl);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-wider);
    color: var(--text-sumi);
    text-decoration: none;
  }

  .nav {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .nav-link {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    color: var(--text-bokashi);
    text-decoration: none;
    line-height: 1.2;
    transition:
      background-color var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out);
  }

  .nav-link:hover {
    background: var(--bg-kinu);
    color: var(--text-sumi);
    text-decoration: none;
  }

  .nav-link.active {
    background: var(--accent-shu-wash);
    color: var(--accent-shu-deep);
  }

  .nav-en {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .nav-ja {
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
  }

  .nav-link.active .nav-ja {
    color: var(--accent-shu-soft);
  }

  .main {
    flex: 1;
  }

  .container {
    max-width: var(--content-width);
    margin: 0 auto;
    padding: var(--space-8) var(--space-4) var(--space-12);
  }

  .footer {
    border-top: 1px solid var(--border-light);
    padding: var(--space-4);
    text-align: center;
    font-size: var(--text-sm);
    color: var(--text-usuzumi);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .logout-link {
    border: 0;
    padding: 0;
    background: none;
    color: var(--text-usuzumi);
    text-decoration: underline;
    text-underline-offset: 0.2em;
    cursor: pointer;
    font: inherit;
    transition: color var(--duration-fast) var(--ease-out);
  }

  .logout-link:hover:not(:disabled) {
    color: var(--accent-shu);
  }

  .logout-link:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .auth-gate {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: var(--space-6) var(--space-4);
  }

  .login-card {
    width: min(100%, 25rem);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--bg-shoji) 92%, white);
    box-shadow: 0 10px 28px color-mix(in srgb, var(--text-sumi) 7%, transparent);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .welcome {
    margin: 0;
    color: var(--text-bokashi);
    font-size: var(--text-sm);
    line-height: 1.6;
  }

  .field {
    display: grid;
    gap: var(--space-2);
  }

  .field-label {
    font-size: var(--text-sm);
    color: var(--text-sumi);
  }

  .field-input {
    width: 100%;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    background: var(--bg-shoji);
    color: var(--text-sumi);
    padding: var(--space-2) var(--space-3);
    font: inherit;
    outline: none;
    transition:
      border-color var(--duration-fast) var(--ease-out),
      box-shadow var(--duration-fast) var(--ease-out);
  }

  .field-input:focus-visible {
    border-color: var(--accent-shu-soft);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-shu) 18%, transparent);
  }

  .submit-button {
    margin-top: var(--space-1);
    border: 1px solid var(--accent-shu-soft);
    border-radius: 999px;
    background: var(--accent-shu-wash);
    color: var(--accent-shu-deep);
    padding: var(--space-2) var(--space-3);
    font: inherit;
    font-weight: var(--weight-medium);
    cursor: pointer;
    transition:
      background-color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out);
  }

  .submit-button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent-shu-wash) 75%, white);
    border-color: var(--accent-shu);
  }

  .submit-button:disabled {
    opacity: 0.65;
    cursor: wait;
  }

  .error-message {
    margin: 0;
    min-height: 1.25em;
    color: var(--accent-shu-deep);
    font-size: var(--text-sm);
  }

  @media (max-width: 700px) {
    .header-inner {
      flex-direction: column;
      align-items: flex-start;
    }

    .login-card {
      padding: var(--space-5);
    }
  }
</style>
