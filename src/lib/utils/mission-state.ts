import type { MissionMode } from '$lib/types';

export type MissionCompletionPrimaryAction = 'start-immersion' | 'back-to-missions';

export function canCompleteMission(input: {
  awaitingCompletion: boolean;
  uiState: string;
  userMissionId: string;
}): boolean {
  return (
    input.awaitingCompletion && input.uiState === 'active' && input.userMissionId.trim().length > 0
  );
}

export function shouldShowMissionResponseControls(input: {
  awaitingCompletion: boolean;
  uiState: string;
}): boolean {
  return !input.awaitingCompletion && input.uiState === 'active';
}

export function getMissionCompletionPrimaryAction(
  mode: MissionMode,
): MissionCompletionPrimaryAction {
  return mode === 'practice' ? 'start-immersion' : 'back-to-missions';
}
