<script lang="ts">
import UserSelector from '$lib/components/UserSelector.svelte';
import type { ActionData, PageData } from './$types';

let { data, form } = $props<{ data: PageData; form?: ActionData }>();

function levelLabel(level: string): string {
  if (level === 'absolute_beginner') return 'Absolute beginner';
  if (level === 'beginner') return 'Beginner';
  if (level === 'lower_intermediate') return 'Lower intermediate';
  return level;
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
          <label><input type="radio" name="level" value="absolute_beginner" checked /> Absolute beginner</label>
          <label><input type="radio" name="level" value="beginner" /> Beginner</label>
          <label><input type="radio" name="level" value="lower_intermediate" /> Lower intermediate</label>
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
          <p class="value">{levelLabel(data.selectedUser.level)}</p>
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
    background: var(--bg-washi);
  }

  .level-group label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    font-size: var(--text-base);
  }

  .level-group input[type="radio"] {
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

  .action-card {
    display: grid;
    gap: var(--space-3);
  }
</style>
