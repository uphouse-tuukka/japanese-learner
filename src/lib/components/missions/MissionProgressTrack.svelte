<script lang="ts">
  import { goto } from '$app/navigation';
  import MissionNode from '$lib/components/missions/MissionNode.svelte';
  import type { MissionWithProgress } from '$lib/types';

  type Props = {
    missions: MissionWithProgress[];
    categoryMastered: boolean;
  };

  let { missions, categoryMastered }: Props = $props();
  let lockMessage = $state('');
  let clearLockMessageTimer: ReturnType<typeof setTimeout> | null = null;

  function handleMissionClick(mission: MissionWithProgress): void {
    if (mission.unlocked) {
      lockMessage = '';
      void goto(`/missions/${mission.id}`);
      return;
    }

    lockMessage = 'Complete Learn sessions in this category to unlock.';

    if (clearLockMessageTimer) {
      clearTimeout(clearLockMessageTimer);
    }

    clearLockMessageTimer = setTimeout(() => {
      lockMessage = '';
    }, 2500);
  }
</script>

<div class="track-shell">
  <div class="track-scroller">
    <div class="track-row" role="list" aria-label="Mission progression track">
      {#each missions as mission, index (mission.id)}
        <div class="track-node" role="listitem">
          <MissionNode {mission} onClick={() => handleMissionClick(mission)} />
        </div>

        {#if index < missions.length - 1}
          {@const nextMission = missions[index + 1]}
          <div
            class="connector"
            class:completed-link={mission.completedImmersion && nextMission.completedImmersion}
            aria-hidden="true"
          ></div>
        {/if}
      {/each}

      <div class="mastery-badge" class:mastered={categoryMastered} aria-label="Category mastery">
        🏆
      </div>
    </div>
  </div>

  {#if lockMessage}
    <p class="lock-message" role="status">{lockMessage}</p>
  {/if}
</div>

<style>
  .track-shell {
    display: grid;
    gap: var(--space-3);
  }

  .track-scroller {
    overflow-x: auto;
    padding-bottom: var(--space-2);
  }

  .track-row {
    display: flex;
    align-items: flex-start;
    min-width: max-content;
    gap: var(--space-2);
  }

  .track-node {
    flex: 0 0 auto;
  }

  .connector {
    width: 2.5rem;
    height: 2px;
    margin-top: 22px;
    border-top: 2px dashed var(--border-mid);
    flex: 0 0 auto;
  }

  .connector.completed-link {
    border-top-style: solid;
    border-top-color: var(--accent-matcha);
  }

  .mastery-badge {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    border: 1px solid var(--border-mid);
    background: var(--bg-kinu);
    color: var(--text-usuzumi);
    display: grid;
    place-items: center;
    margin-top: 6px;
    flex: 0 0 auto;
  }

  .mastery-badge.mastered {
    background: var(--accent-gold-wash);
    border-color: var(--accent-gold);
    color: var(--state-warning);
  }

  .lock-message {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--state-warning);
  }
</style>
