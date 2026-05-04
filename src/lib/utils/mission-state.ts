export function canCompleteMission(input: {
  awaitingCompletion: boolean;
  uiState: string;
  userMissionId: string;
}): boolean {
  return (
    input.awaitingCompletion && input.uiState === 'active' && input.userMissionId.trim().length > 0
  );
}
