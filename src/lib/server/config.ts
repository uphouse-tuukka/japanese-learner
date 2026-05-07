import { config as baseConfig } from '$lib/config';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

export const DEFAULT_SESSION_GENERATION_TIMEOUT_MS = 30_000;

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

export function resolveAuthSecretOverride(): string {
  return (env.AUTH_SECRET ?? process.env.AUTH_SECRET)?.trim() ?? '';
}

export function resolveSessionGenerationTimeoutMs(): number {
  const raw = Number(
    process.env.SESSION_GENERATION_TIMEOUT_MS ??
      env.SESSION_GENERATION_TIMEOUT_MS ??
      DEFAULT_SESSION_GENERATION_TIMEOUT_MS,
  );
  if (!Number.isFinite(raw)) {
    return DEFAULT_SESSION_GENERATION_TIMEOUT_MS;
  }
  return Math.max(1, Math.floor(raw));
}

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
