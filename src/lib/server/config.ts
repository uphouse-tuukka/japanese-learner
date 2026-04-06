import { config as baseConfig } from '$lib/config';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

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

type PortfolioConfig = {
  quotaDisabled: boolean;
};

type ServerConfig = typeof baseConfig & {
  missions: MissionConfig;
  portfolio: PortfolioConfig;
};

export const config: ServerConfig = {
  ...baseConfig,
  missions: {
    maxTurnsPerMission: 5,
    unlockAllOverride: env.MISSIONS_UNLOCK_ALL === 'true',
    xp: {
      immersionCompletion: 100,
      practiceCompletion: 25,
      correctResponse: 10,
      naturalPhrasing: 15,
    },
  },
  portfolio: {
    quotaDisabled: dev && env.DISABLE_PORTFOLIO_QUOTA === 'true',
  },
};
