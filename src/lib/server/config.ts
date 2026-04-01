import { config as baseConfig } from '$lib/config';

type MissionConfig = {
  maxTurnsPerMission: number;
  unlockAllOverride: boolean;
  xp: {
    immersionCompletion: number;
    practiceCompletion: number;
    correctResponse: number;
    naturalPhrasing: number;
  };
};

type ServerConfig = typeof baseConfig & {
  missions: MissionConfig;
};

export const config: ServerConfig = {
  ...baseConfig,
  missions: {
    maxTurnsPerMission: 5,
    unlockAllOverride: process.env.MISSIONS_UNLOCK_ALL === 'true',
    xp: {
      immersionCompletion: 100,
      practiceCompletion: 25,
      correctResponse: 10,
      naturalPhrasing: 15,
    },
  },
};
