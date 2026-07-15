import { config } from '$lib/server/config';
import type { Mission } from '$lib/types';

type MissionUnlockPolicy = Pick<Mission, 'startUnlocked' | 'unlockSessionsRequired'>;

export function isMissionUnlocked(
  mission: MissionUnlockPolicy,
  categorySessionCount: number,
): boolean {
  return (
    config.missions.unlockAllOverride ||
    mission.startUnlocked ||
    categorySessionCount >= mission.unlockSessionsRequired
  );
}
