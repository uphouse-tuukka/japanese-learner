import { describe, expect, it } from 'vitest';
import {
  canCompleteMission,
  getMissionCompletionPrimaryAction,
  shouldShowMissionResponseControls,
} from '$lib/utils/mission-state';

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

describe('shouldShowMissionResponseControls', () => {
  it('hides final-turn practice answer choices while mission completion is being submitted', () => {
    expect(
      shouldShowMissionResponseControls({
        awaitingCompletion: true,
        uiState: 'responding',
      }),
    ).toBe(false);
  });

  it('shows response controls only for active missions that are not awaiting completion', () => {
    expect(
      shouldShowMissionResponseControls({
        awaitingCompletion: false,
        uiState: 'active',
      }),
    ).toBe(true);
  });
});

describe('getMissionCompletionPrimaryAction', () => {
  it('keeps practice completion on the same mission so the user can start immersion mode', () => {
    expect(getMissionCompletionPrimaryAction('practice')).toBe('start-immersion');
  });

  it('returns to the mission list after a completed immersion mission', () => {
    expect(getMissionCompletionPrimaryAction('immersion')).toBe('back-to-missions');
  });
});
