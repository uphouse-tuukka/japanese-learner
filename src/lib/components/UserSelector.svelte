<script lang="ts">
  type UserLevel = 'absolute_beginner' | 'beginner' | 'pre_intermediate';

  type UserOption = {
    id: string;
    name: string;
    level: UserLevel;
  };

  let {
    users,
    selectedUserId = null,
    maxUsers,
    errorMessage = null,
    successMessage = null,
    showCreateForm = true,
    title = 'Choose learner profile',
  }: {
    users: UserOption[];
    selectedUserId?: string | null;
    maxUsers: number;
    errorMessage?: string | null;
    successMessage?: string | null;
    showCreateForm?: boolean;
    title?: string;
  } = $props();

  const levelOptions: Array<{ value: UserLevel; label: string }> = [
    { value: 'absolute_beginner', label: 'Absolute beginner' },
    { value: 'beginner', label: 'Beginner' },
    { value: 'pre_intermediate', label: 'Lower intermediate' },
  ];

  let selectedId = $state('');
  let canCreateMore = $derived(users.length < maxUsers);

  $effect(() => {
    selectedId = selectedUserId ?? users[0]?.id ?? '';
  });
</script>

<section class="selector-card">
  <header class="selector-header">
    <h2>{title}</h2>
    <p>{users.length}/{maxUsers} profiles used</p>
  </header>

  {#if errorMessage}
    <p class="alert error">{errorMessage}</p>
  {/if}
  {#if successMessage}
    <p class="alert success">{successMessage}</p>
  {/if}

  {#if users.length > 0}
    <form method="POST" action="?/selectUser" class="selector-form">
      <label for="user-id">Active profile</label>
      <select id="user-id" name="userId" bind:value={selectedId} required>
        {#each users as user}
          <option value={user.id}>{user.name} · {user.level.replace('_', ' ')}</option>
        {/each}
      </select>
      <button type="submit">Open dashboard</button>
    </form>
  {/if}

  {#if showCreateForm}
    <form method="POST" action="?/createUser" class="create-form">
      <h3>Create profile</h3>
      <label for="display-name">Display name</label>
      <input
        id="display-name"
        name="name"
        type="text"
        required
        minlength="2"
        maxlength="40"
        placeholder="e.g. Aiko"
        disabled={!canCreateMore}
      />

      <label for="starting-level">Starting level</label>
      <select id="starting-level" name="level" required disabled={!canCreateMore}>
        {#each levelOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>

      <button type="submit" disabled={!canCreateMore}>Create and continue</button>
      {#if !canCreateMore}
        <p class="limit-text">Maximum profiles reached ({maxUsers}).</p>
      {/if}
    </form>
  {/if}
</section>

<style>
  .selector-card {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-5);
    border-radius: var(--radius-lg);
    background: var(--bg-white);
    border: 1px solid var(--border-light);
    box-shadow: var(--shadow-card);
  }

  .selector-header h2 {
    margin: 0;
    font-size: var(--text-lg);
  }

  .selector-header p {
    margin: var(--space-1) 0 0;
    color: var(--text-usuzumi);
    font-size: var(--text-sm);
  }

  .selector-form,
  .create-form {
    display: grid;
    gap: var(--space-3);
  }

  h3 {
    margin: 0;
    font-size: var(--text-base);
  }

  label {
    font-size: var(--text-sm);
    color: var(--text-usuzumi);
    font-weight: var(--weight-medium);
  }

  input,
  select,
  button {
    font: inherit;
    line-height: 1.5;
  }

  input,
  select {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    border: 1.5px solid var(--border-light);
    background: var(--bg-white);
    color: var(--text-sumi);
    transition:
      border-color var(--duration-fast) var(--ease-out),
      box-shadow var(--duration-fast) var(--ease-out);
  }

  input:focus,
  select:focus {
    outline: none;
    border-color: var(--accent-shu);
    box-shadow: 0 0 0 3px var(--accent-shu-wash);
  }

  select {
    appearance: none;
    -webkit-appearance: none;
    padding-right: 2.5rem;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235f6570' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    background-size: 1rem;
    cursor: pointer;
  }

  button {
    padding: var(--space-2) var(--space-4);
    border: none;
    border-radius: 999px;
    cursor: pointer;
    background: var(--accent-shu);
    color: var(--bg-shoji);
    font-weight: var(--weight-medium);
    transition:
      background var(--duration-fast) var(--ease-out),
      transform var(--duration-fast) var(--ease-out);
  }

  button:hover:not([disabled]) {
    background: var(--accent-shu-deep);
  }

  button:active:not([disabled]) {
    transform: scale(0.98);
  }

  button[disabled] {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .alert {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .alert.error {
    background: var(--state-error-wash);
    color: var(--state-error-text);
  }

  .alert.success {
    background: var(--state-success-wash);
    color: var(--state-success-text);
  }

  .limit-text {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
  }
</style>
