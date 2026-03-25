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
    gap: var(--space-4, 1rem);
    padding: var(--space-5, 1.25rem);
    border-radius: var(--radius-lg, 1rem);
    background: #fff;
    border: 1px solid var(--border-light, #d9d9de);
    box-shadow: 0 8px 24px rgb(15 23 42 / 0.07);
  }

  .selector-header h2 {
    margin: 0;
    font-size: var(--text-lg, 1.2rem);
  }

  .selector-header p {
    margin: 0.35rem 0 0;
    color: var(--text-usuzumi, #5f6570);
    font-size: var(--text-sm, 0.9rem);
  }

  .selector-form,
  .create-form {
    display: grid;
    gap: var(--space-3, 0.75rem);
  }

  h3 {
    margin: 0;
    font-size: var(--text-base, 1rem);
  }

  label {
    font-size: var(--text-sm, 0.88rem);
    color: var(--text-usuzumi, #5f6570);
    font-weight: var(--weight-medium, 500);
  }

  input,
  select,
  button {
    font: inherit;
    line-height: 1.5;
  }

  input,
  select {
    padding: 0.625rem 0.875rem;
    border-radius: var(--radius-md, 0.65rem);
    border: 1.5px solid var(--border-light, #cfd6e0);
    background: #fff;
    color: var(--text-sumi, #1a1a1a);
    transition:
      border-color var(--duration-fast, 150ms) var(--ease-out, ease-out),
      box-shadow var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  input:focus,
  select:focus {
    outline: none;
    border-color: var(--accent-shu, #c1440e);
    box-shadow: 0 0 0 3px var(--accent-shu-wash, rgba(193, 68, 14, 0.1));
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
    padding: 0.625rem 1rem;
    border: none;
    border-radius: 999px;
    cursor: pointer;
    background: var(--accent-shu, #c1440e);
    color: var(--bg-shoji, white);
    font-weight: var(--weight-medium, 600);
    transition:
      background var(--duration-fast, 150ms) var(--ease-out, ease-out),
      transform var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  button:hover:not([disabled]) {
    background: var(--accent-shu-deep, #a33b0c);
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
    padding: 0.625rem 0.75rem;
    border-radius: var(--radius-md, 0.6rem);
    font-size: var(--text-sm, 0.9rem);
  }

  .alert.error {
    background: #fee2e2;
    color: #991b1b;
  }

  .alert.success {
    background: #dcfce7;
    color: #166534;
  }

  .limit-text {
    margin: 0;
    font-size: var(--text-xs, 0.84rem);
    color: var(--text-usuzumi, #5f6570);
  }
</style>
