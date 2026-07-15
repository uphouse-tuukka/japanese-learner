import type { SpokenMissionEvidenceState } from '$lib/types';

const EVIDENCE_LABELS: Record<SpokenMissionEvidenceState | 'untried', string> = {
  untried: 'Untried',
  supported: 'Supported',
  independent: 'Independent',
};

export function getSpokenMissionEvidenceLabel(
  evidence: SpokenMissionEvidenceState | 'untried',
): string {
  return EVIDENCE_LABELS[evidence];
}
