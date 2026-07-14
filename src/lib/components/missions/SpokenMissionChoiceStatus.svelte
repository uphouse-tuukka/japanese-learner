<script lang="ts">
  import { getSpokenMissionEvidenceLabel } from '$lib/utils/spoken-mission';
  import type { SpokenMissionEvidenceState, SpokenMissionResumeProgress } from '$lib/types';

  type Props = {
    bestEvidence: SpokenMissionEvidenceState | 'untried';
    resumable: SpokenMissionResumeProgress | null;
  };

  let { bestEvidence, resumable }: Props = $props();

  const evidenceLabel = $derived(getSpokenMissionEvidenceLabel(bestEvidence));
  const accessibleStatus = $derived(
    resumable
      ? `${evidenceLabel} evidence. Resume at goal ${resumable.currentTurn} of 3.`
      : `${evidenceLabel} evidence.`,
  );
</script>

<span class="spoken-choice-status" aria-label={accessibleStatus}>
  <span class="evidence-status" data-evidence={bestEvidence}>{evidenceLabel}</span>
  {#if resumable}
    <span class="resume-progress">Resume goal {resumable.currentTurn}</span>
  {/if}
</span>

<style>
  .spoken-choice-status {
    min-width: 0;
    max-width: 100%;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    color: var(--text-bokashi);
    font-size: var(--text-xs);
  }

  .evidence-status {
    max-width: 100%;
    padding: var(--space-1) var(--space-3);
    border-radius: 999px;
    background: var(--bg-kinu);
    overflow-wrap: anywhere;
  }

  .evidence-status[data-evidence='supported'] {
    background: var(--accent-gold-wash);
    color: var(--text-sumi);
  }

  .evidence-status[data-evidence='independent'] {
    background: var(--accent-matcha-wash);
    color: var(--accent-matcha);
  }

  .resume-progress {
    min-width: 0;
    overflow-wrap: anywhere;
  }
</style>
