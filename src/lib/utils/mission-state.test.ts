import { describe, expect, it } from 'vitest';
import { canCompleteMission } from '$lib/utils/mission-state';

describe('canCompleteMission', () => {
  it('returns true when the final practice step is waiting for completion submission', () => {
    expect(
      canCompleteMission({
        awaitingCompletion: true,
        uiState: 'active',
        userMissionId: 'usermission-123',
      }),
    ).toBe(true);
  });

  it('returns false when completion has not been unlocked yet', () => {
    expect(
      canCompleteMission({
        awaitingCompletion: false,
        uiState: 'active',
        userMissionId: 'usermission-123',
      }),
    ).toBe(false);
  });
});
