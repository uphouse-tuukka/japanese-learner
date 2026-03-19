<script lang="ts">
type UserLevel = 'absolute_beginner' | 'beginner' | 'lower_intermediate';

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
  title = 'Choose learner profile'
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
  { value: 'lower_intermediate', label: 'Lower intermediate' }
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
    gap: 1rem;
    padding: 1.25rem;
    border-radius: 1rem;
    background: var(--surface-1, #ffffff);
    border: 1px solid var(--border-subtle, #d9d9de);
    box-shadow: 0 8px 24px rgb(15 23 42 / 0.07);
  }

  .selector-header h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .selector-header p {
    margin: 0.35rem 0 0;
    color: var(--text-muted, #5f6570);
    font-size: 0.9rem;
  }

  .selector-form,
  .create-form {
    display: grid;
    gap: 0.6rem;
  }

  h3 {
    margin: 0;
    font-size: 1rem;
  }

  label {
    font-size: 0.88rem;
    color: var(--text-muted, #5f6570);
  }

  input,
  select,
  button {
    font: inherit;
  }

  input,
  select {
    padding: 0.6rem 0.75rem;
    border-radius: 0.65rem;
    border: 1px solid var(--border-subtle, #cfd6e0);
  }

  button {
    padding: 0.62rem 0.9rem;
    border: none;
    border-radius: 0.7rem;
    cursor: pointer;
    background: var(--accent, #2f5be7);
    color: white;
    font-weight: 600;
  }

  button[disabled] {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .alert {
    margin: 0;
    padding: 0.55rem 0.65rem;
    border-radius: 0.6rem;
    font-size: 0.9rem;
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
    font-size: 0.84rem;
    color: var(--text-muted, #5f6570);
  }
</style>
