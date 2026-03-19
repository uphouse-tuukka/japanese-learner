import { env } from '$env/dynamic/private';

type AppConfig = {
siteAccess: {
basicAuthUser: string;
basicAuthPassword: string;
};
turso: {
databaseUrl: string;
authToken: string;
};
openai: {
apiKey: string;
};
limits: {
dailyTokenLimit: number;
monthlyCostLimit: number;
bypassKey: string;
maxUsers: number;
practiceModeEnabled: boolean;
};
};

function toNumber(value: string | undefined, fallback: number): number {
const parsed = Number(value);
return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
if (value === undefined || value === '') return fallback;
return value.toLowerCase() === 'true';
}

export const config: AppConfig = {
siteAccess: {
basicAuthUser: env.BASIC_AUTH_USER ?? '',
basicAuthPassword: env.BASIC_AUTH_PASSWORD ?? ''
},
turso: {
databaseUrl: env.TURSO_DATABASE_URL ?? '',
authToken: env.TURSO_AUTH_TOKEN ?? ''
},
openai: {
apiKey: env.OPENAI_API_KEY ?? ''
},
limits: {
dailyTokenLimit: toNumber(env.DAILY_TOKEN_LIMIT, 50_000),
monthlyCostLimit: toNumber(env.MONTHLY_COST_LIMIT, 20),
bypassKey: env.BYPASS_KEY ?? '',
maxUsers: toNumber(env.MAX_USERS, 5),
practiceModeEnabled: toBoolean(env.PRACTICE_MODE_ENABLED, true)
}
};
