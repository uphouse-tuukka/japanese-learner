<script lang="ts">
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();

  function formatDate(dateString: string) {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  }
</script>

<main class="history-page page-transition">
  <section class="card">
    <h1>History</h1>
    <p class="subtitle">Session history for the active learner.</p>
  </section>

  <section class="card table-container">
    {#if data.history.length === 0}
      <div class="empty-state">
        <p>No sessions yet. Time to start practicing!</p>
      </div>
    {:else}
      <table class="history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Mode</th>
            <th>Status</th>
            <th>Accuracy</th>
            <th>Exercises</th>
          </tr>
        </thead>
        <tbody>
          {#each data.history as item}
            <tr class="history-row">
              <td data-label="Date" class="cell-date">{formatDate(item.session.createdAt)}</td>
              <td data-label="Mode">
                <span class="badge mode-{item.session.mode}">{item.session.mode}</span>
              </td>
              <td data-label="Status">
                <span class="status-indicator status-{item.session.status}">
                  <span class="dot"></span>
                  {item.session.status}
                </span>
              </td>
              <td data-label="Accuracy">
                <span
                  class="accuracy-value"
                  class:high={item.accuracy >= 80}
                  class:low={item.accuracy > 0 && item.accuracy < 50}
                >
                  {item.accuracy > 0 ? `${item.accuracy}%` : '-'}
                </span>
              </td>
              <td data-label="Exercises" class="cell-exercises"
                >{item.exerciseCount} practice items</td
              >
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
</main>

<style>
  .history-page {
    display: grid;
    gap: var(--space-6);
    max-width: 1000px;
    margin: 0 auto;
  }

  h1 {
    color: var(--text-sumi);
    margin-bottom: var(--space-2);
    font-weight: var(--weight-bold);
  }

  .subtitle {
    color: var(--text-bokashi);
  }

  .table-container {
    padding: 0;
    overflow: hidden;
    box-shadow: var(--shadow-card);
    background: var(--bg-kinu);
    border-radius: var(--radius-lg);
  }

  .empty-state {
    padding: var(--space-8);
    text-align: center;
    color: var(--text-usuzumi);
    font-style: italic;
  }

  .history-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }

  th {
    padding: var(--space-4) var(--space-6);
    color: var(--text-usuzumi);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: var(--weight-bold);
    border-bottom: 2px solid var(--border-light);
    background: var(--bg-shoji);
  }

  td {
    padding: var(--space-4) var(--space-6);
    color: var(--text-sumi);
    border-bottom: 1px solid var(--border-light);
    vertical-align: middle;
  }

  .history-row {
    transition: background var(--duration-normal) var(--ease-out);
  }

  @media (hover: hover) {
    .history-row:hover {
      background: var(--bg-suna);
    }
  }

  .cell-date {
    color: var(--text-bokashi);
    font-weight: var(--weight-light);
    white-space: nowrap;
  }

  .cell-exercises {
    color: var(--text-bokashi);
  }

  /* Badges & Indicators */
  .badge {
    display: inline-flex;
    align-items: center;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    text-transform: capitalize;
    letter-spacing: 0.02em;
  }

  .mode-ai {
    background: var(--accent-matcha-wash);
    color: var(--accent-matcha);
    border: 1px solid currentColor;
  }

  .mode-practice {
    background: var(--accent-shu-wash);
    color: var(--accent-shu);
    border: 1px solid currentColor;
  }

  .status-indicator {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    text-transform: capitalize;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-usuzumi);
  }

  .status-completed .dot {
    background: var(--state-success);
  }

  .status-completed {
    background-color: #fff;
    color: var(--state-success);
    border: 1px solid var(--state-success);
    padding: var(--space-1) var(--space-3);
    border-radius: 999px;
    font-weight: var(--weight-medium);
    box-shadow: var(--shadow-sm);
  }

  .status-planned .dot {
    background: var(--text-usuzumi);
  }

  .status-planned {
    color: var(--text-usuzumi);
  }

  .accuracy-value {
    font-weight: var(--weight-bold);
    font-variant-numeric: tabular-nums;
  }

  .accuracy-value.high {
    color: var(--state-success);
  }

  .accuracy-value.low {
    color: var(--state-error);
  }

  /* Base Responsive styles */
  @media (max-width: 640px) {
    .table-container {
      background: transparent;
      box-shadow: none;
      border-radius: 0;
    }

    .history-table,
    .history-table tbody {
      display: block;
      width: 100%;
    }

    .history-table thead {
      display: none; /* Hide headers */
    }

    .history-row {
      display: flex;
      flex-direction: column;
      margin-bottom: var(--space-4);
      background: var(--bg-kinu);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      padding: var(--space-2) 0;
      overflow: hidden;
    }

    td {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-2) var(--space-4);
      border-bottom: none;
      text-align: right;
    }

    td::before {
      content: attr(data-label);
      color: var(--text-usuzumi);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: var(--weight-bold);
      text-align: left;
      margin-right: var(--space-4);
    }

    .cell-date {
      border-bottom: 1px solid var(--border-light);
      padding-bottom: var(--space-3);
      margin-bottom: var(--space-1);
      background: var(--bg-shoji);
      color: var(--text-sumi);
      font-weight: var(--weight-bold);
    }

    .cell-date::before {
      display: none; /* Hide 'Date' label on mobile just show the date block */
    }

    .cell-date {
      justify-content: flex-start;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .history-row {
      transition: none;
    }
  }
</style>
