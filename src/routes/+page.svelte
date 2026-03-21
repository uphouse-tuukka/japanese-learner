<script lang="ts">
  import UserSelector from '$lib/components/UserSelector.svelte';
  import { LEVEL_LABELS, LEVEL_ORDER } from '$lib/types';
  import type { ActionData, PageData } from './$types';

  let { data, form } = $props<{ data: PageData; form?: ActionData }>();
  let writingEnabled = $state(false);
  let writingTogglePending = $state(false);
  let writingToggleError = $state<string | null>(null);

  const selectedUser = $derived<PageData['selectedUser']>(data.selectedUser);
  const selectedLevelLabel = $derived(selectedUser ? LEVEL_LABELS[selectedUser.level] : '');
  const isReadyForJapan = $derived(selectedUser?.level === 'ready_for_japan');

  $effect(() => {
    writingEnabled = data.selectedUser?.japaneseWritingEnabled ?? false;
    writingTogglePending = false;
    writingToggleError = null;
  });

  async function toggleJapaneseWriting(): Promise<void> {
    if (!selectedUser || writingTogglePending) return;

    const nextEnabled = !writingEnabled;
    writingEnabled = nextEnabled;
    writingToggleError = null;
    writingTogglePending = true;

    try {
      const response = await fetch('/api/user/writing-toggle', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          enabled: nextEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error(`Writing toggle request failed: ${response.status}`);
      }
    } catch (error) {
      console.error('dashboard.writing_toggle_failed', {
        userId: selectedUser.id,
        enabled: nextEnabled,
        error: error instanceof Error ? error.message : String(error),
      });
      writingEnabled = !nextEnabled;
      writingToggleError = 'Could not update writing preference. Please try again.';
    } finally {
      writingTogglePending = false;
    }
  }
</script>

<section class="home page-transition">
  {#if data.users.length === 0}
    <article class="card block">
      <h1 class="text-japanese">ようこそ！</h1>
      <p>Create your first learner profile to begin.</p>

      {#if form?.error}
        <p class="error-message">{form.error}</p>
      {/if}

      <form method="POST" action="?/createUser" class="create-form">
        <div>
          <label for="name">Name</label>
          <input id="name" name="name" required minlength="1" maxlength="64" />
        </div>

        <fieldset class="level-group">
          <legend>Level</legend>
          {#each LEVEL_ORDER as level, index}
            <label>
              <input type="radio" name="level" value={level} checked={index === 0} />
              {LEVEL_LABELS[level]}
            </label>
          {/each}
        </fieldset>

        <div class="submit-row">
          <button type="submit" class="btn-primary">Create profile</button>
        </div>
      </form>
    </article>
  {:else if !data.selectedUser}
    <article class="card block">
      <h1>Select learner</h1>
      <p>Choose who is studying today.</p>
      <UserSelector users={data.users} selectedUserId={null} maxUsers={data.maxUsers} />
    </article>
  {:else}
    <div class="dashboard">
      <article class="card block">
        <h1>こんにちは、{data.selectedUser.name}さん</h1>
        <p>Welcome back to your Japanese study dashboard.</p>
      </article>

      {#if isReadyForJapan}
        <article class="card ready-badge-card">
          <div class="ready-badge" aria-label="Ready for Japan achievement badge">
            <p class="badge-kana">日本準備完了</p>
            <p class="badge-title">Ready for Japan 🇯🇵</p>
            <p class="badge-subtitle">おめでとうございます！</p>
          </div>
        </article>
      {/if}

      <section class="stats-grid">
        <article class="card stat-card">
          <p class="label">Sessions</p>
          <p class="value">{data.stats.sessions}</p>
        </article>
        <article class="card stat-card">
          <p class="label">Streak</p>
          <p class="value">{data.stats.streak} days</p>
        </article>
        <article class="card stat-card">
          <p class="label">Level</p>
          <p class="value">{selectedLevelLabel}</p>
        </article>
      </section>

      <section class="action-grid">
        <article class="card action-card">
          <h2>Start Today&apos;s Session</h2>
          <p>Generate your AI-guided learning session.</p>
          <a href="/learn" class="btn-primary">Start learning</a>
        </article>

        <article class="card action-card">
          <h2>Practice Mode</h2>
          <p>Unlimited review with no AI token cost.</p>
          <a href="/practice" class="btn-secondary">Open practice</a>
        </article>
      </section>

      <section class="card settings-card">
        <h2>Study settings</h2>
        <p class="settings-description">Choose how your learning sessions are generated.</p>

        <div class="toggle-row">
          <div>
            <p class="toggle-label">Japanese writing exercises</p>
            <p class="toggle-help">Practice writing in hiragana and katakana</p>
          </div>

          <button
            type="button"
            class="writing-switch"
            class:is-on={writingEnabled}
            role="switch"
            aria-checked={writingEnabled}
            aria-busy={writingTogglePending}
            disabled={writingTogglePending}
            onclick={toggleJapaneseWriting}
          >
            <span class="switch-thumb" aria-hidden="true"></span>
            <span class="switch-text">{writingEnabled ? 'On' : 'Off'}</span>
          </button>
        </div>

        {#if writingToggleError}
          <p class="error-message">{writingToggleError}</p>
        {/if}
      </section>
    </div>
  {/if}
</section>

<style>
  .home {
    display: grid;
    gap: var(--space-4);
  }

  .block {
    display: grid;
    gap: var(--space-3);
  }

  .create-form {
    display: grid;
    gap: var(--space-3);
  }

  .level-group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    background: var(--bg-kinu, var(--bg-washi));
  }

  .level-group label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    font-size: var(--text-base);
  }

  .level-group input[type='radio'] {
    margin: 0;
    width: 1rem;
    height: 1rem;
    accent-color: var(--accent-shu);
  }

  .submit-row {
    padding-top: var(--space-2);
    border-top: 1px solid var(--border-light);
  }

  .error-message {
    font-size: var(--text-sm);
    color: var(--state-error);
  }

  .dashboard {
    display: grid;
    gap: var(--space-4);
  }

  .stats-grid,
  .action-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-4);
  }

  .stat-card .label {
    font-size: var(--text-sm);
    color: var(--text-bokashi);
  }

  .stat-card .value {
    font-size: var(--text-xl);
    font-weight: var(--weight-medium);
  }

  .ready-badge-card {
    background:
      radial-gradient(
        circle at 20% 20%,
        color-mix(in srgb, var(--accent-shu) 16%, transparent),
        transparent 50%
      ),
      linear-gradient(
        120deg,
        var(--bg-kinu, #eee9df),
        color-mix(in srgb, var(--bg-shoji, #faf8f4) 82%, #d8b561 18%)
      );
    border: 1px solid color-mix(in srgb, #d8b561 65%, var(--border-light));
  }

  .ready-badge {
    display: grid;
    gap: var(--space-1);
    justify-items: center;
    text-align: center;
    padding: var(--space-2) 0;
    animation: badge-entry 640ms ease-out;
  }

  .badge-kana {
    margin: 0;
    font-family: 'Noto Sans JP', sans-serif;
    color: var(--accent-shu);
    letter-spacing: 0.08em;
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
  }

  .badge-title {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    color: var(--text-sumi);
  }

  .badge-subtitle {
    margin: 0;
    color: var(--text-bokashi);
    font-family: 'Noto Sans JP', sans-serif;
    font-size: var(--text-sm);
  }

  .settings-card {
    display: grid;
    gap: var(--space-3);
    background: var(--bg-kinu, #eee9df);
  }

  .settings-description {
    margin: 0;
    color: var(--text-bokashi);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    background: var(--bg-shoji, #faf8f4);
  }

  .toggle-label {
    margin: 0;
    color: var(--text-sumi);
    font-weight: var(--weight-medium);
  }

  .toggle-help {
    margin: var(--space-1) 0 0;
    color: var(--text-bokashi);
    font-size: var(--text-sm);
  }

  .writing-switch {
    display: inline-flex;
    position: relative;
    align-items: center;
    border: 1px solid var(--border-medium);
    background: var(--bg-kinu, #eee9df);
    border-radius: 999px;
    padding: 0;
    width: 4.5rem;
    height: 2.2rem;
    cursor: pointer;
    color: var(--text-bokashi);
    transition: all 0.2s ease;
  }

  .writing-switch:disabled {
    opacity: 0.7;
    cursor: progress;
  }

  .writing-switch.is-on {
    border-color: color-mix(in srgb, var(--accent-matcha) 80%, #0000);
    background: color-mix(in srgb, var(--accent-matcha) 20%, var(--bg-shoji, #faf8f4));
    color: color-mix(in srgb, var(--accent-matcha) 85%, var(--text-sumi));
  }

  .switch-thumb {
    position: absolute;
    left: 0.25rem;
    top: 50%;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    background: var(--accent-shu);
    box-shadow: 0 1px 4px color-mix(in srgb, var(--accent-shu) 40%, transparent);
    transform: translateY(-50%);
    transition:
      transform 0.2s cubic-bezier(0.2, 0, 0, 1),
      background 0.2s ease;
    z-index: 1;
  }

  .writing-switch.is-on .switch-thumb {
    transform: translate(2.4rem, -50%);
    background: var(--accent-matcha);
  }

  .switch-text {
    width: 100%;
    padding: 0 0.8rem 0 0.8rem;
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    text-align: right;
    user-select: none;
  }

  .writing-switch.is-on .switch-text {
    text-align: left;
  }

  .action-card {
    display: grid;
    gap: var(--space-3);
  }

  @keyframes badge-entry {
    0% {
      opacity: 0;
      transform: translateY(6px) scale(0.98);
    }
    60% {
      opacity: 1;
      transform: translateY(0) scale(1.01);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (max-width: 44rem) {
    .toggle-row {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
