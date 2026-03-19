import { config } from '$lib/config';
import { listTokenUsageForRange, recordTokenUsage } from '$lib/server/db';
import type { TokenUsage } from '$lib/types';

type BudgetReason = 'ok' | 'bypass' | 'daily_limit_exceeded' | 'monthly_limit_exceeded';

export type BudgetCheckResult = {
allowed: boolean;
reason: BudgetReason;
dailyUsed: number;
dailyLimit: number;
dailyRemaining: number;
monthlyUsed: number;
monthlyLimit: number;
monthlyRemaining: number;
remaining: number;
limit: number;
monthlyCostLimitUsd: number;
};

function requireUserId(userId: string): string {
const normalized = userId.trim();
if (!normalized) {
throw new Error('[token-limiter] userId is required');
}
return normalized;
}

function dayWindow(now: Date): { start: string; end: string } {
const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const end = new Date(start);
end.setUTCDate(end.getUTCDate() + 1);
return { start: start.toISOString(), end: end.toISOString() };
}

function monthWindow(now: Date): { start: string; end: string } {
const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
return { start: start.toISOString(), end: end.toISOString() };
}

function sumTokens(usages: TokenUsage[]): number {
return usages.reduce((sum, usage) => sum + usage.tokensTotal, 0);
}

function resolveBypass(bypassKey?: string): boolean {
const configuredBypassKey = config.limits.bypassKey.trim();
if (!configuredBypassKey) return false;
return typeof bypassKey === 'string' && bypassKey === configuredBypassKey;
}

function monthlyTokenLimit(): number {
const dailyLimit = Math.max(0, config.limits.dailyTokenLimit);
if (dailyLimit === 0) return 0;
return dailyLimit * 31;
}

export async function checkBudget(userId: string, bypassKey?: string): Promise<BudgetCheckResult> {
const normalizedUserId = requireUserId(userId);
const now = new Date();
const bypass = resolveBypass(bypassKey);
const dailyLimit = Math.max(0, config.limits.dailyTokenLimit);
const monthlyLimit = monthlyTokenLimit();
const monthlyCostLimitUsd = Math.max(0, config.limits.monthlyCostLimit);

const [dailyUsageRows, monthlyUsageRows] = await Promise.all([
listTokenUsageForRange(dayWindow(now).start, dayWindow(now).end, normalizedUserId),
listTokenUsageForRange(monthWindow(now).start, monthWindow(now).end)
]);

const dailyUsed = sumTokens(dailyUsageRows);
const monthlyUsed = sumTokens(monthlyUsageRows);
const dailyRemaining = Math.max(0, dailyLimit - dailyUsed);
const monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed);

if (bypass) {
return {
allowed: true,
reason: 'bypass',
dailyUsed,
dailyLimit,
dailyRemaining,
monthlyUsed,
monthlyLimit,
monthlyRemaining,
remaining: dailyRemaining,
limit: dailyLimit,
monthlyCostLimitUsd
};
}

if (dailyLimit > 0 && dailyUsed >= dailyLimit) {
return {
allowed: false,
reason: 'daily_limit_exceeded',
dailyUsed,
dailyLimit,
dailyRemaining,
monthlyUsed,
monthlyLimit,
monthlyRemaining,
remaining: dailyRemaining,
limit: dailyLimit,
monthlyCostLimitUsd
};
}

if (monthlyLimit > 0 && monthlyUsed >= monthlyLimit) {
return {
allowed: false,
reason: 'monthly_limit_exceeded',
dailyUsed,
dailyLimit,
dailyRemaining,
monthlyUsed,
monthlyLimit,
monthlyRemaining,
remaining: dailyRemaining,
limit: dailyLimit,
monthlyCostLimitUsd
};
}

return {
allowed: true,
reason: 'ok',
dailyUsed,
dailyLimit,
dailyRemaining,
monthlyUsed,
monthlyLimit,
monthlyRemaining,
remaining: dailyRemaining,
limit: dailyLimit,
monthlyCostLimitUsd
};
}

export const getBudgetStatus = checkBudget;

export async function canGenerateSession(userId: string, bypassKey?: string): Promise<BudgetCheckResult> {
return checkBudget(userId, bypassKey);
}

export async function recordUsageEvent(input: {
userId: string;
sessionId?: string | null;
model: string;
tokensIn: number;
tokensOut: number;
createdAt?: string;
}): Promise<TokenUsage> {
const userId = requireUserId(input.userId);
const model = input.model.trim();
if (!model) {
throw new Error('[token-limiter] model is required');
}

const usage = await recordTokenUsage({
userId,
sessionId: input.sessionId ?? null,
model,
tokensIn: input.tokensIn,
tokensOut: input.tokensOut,
createdAt: input.createdAt
});

console.info('[token-limiter] recorded usage', {
userId,
sessionId: usage.sessionId,
model,
tokensTotal: usage.tokensTotal
});

return usage;
}

export const recordUsage = recordUsageEvent;

export async function getUsageStats(): Promise<{
monthlyLimit: number;
monthlyUsed: number;
remaining: number;
perUser: Array<{ userId: string; totalTokens: number }>;
}> {
const now = new Date();
const { start, end } = monthWindow(now);
const rows = await listTokenUsageForRange(start, end);
const perUserMap = new Map<string, number>();

for (const row of rows) {
const current = perUserMap.get(row.userId) ?? 0;
perUserMap.set(row.userId, current + row.tokensTotal);
}

const monthlyLimit = monthlyTokenLimit();
const monthlyUsed = sumTokens(rows);
const remaining = Math.max(0, monthlyLimit - monthlyUsed);
const perUser = Array.from(perUserMap.entries())
.map(([userId, totalTokens]) => ({ userId, totalTokens }))
.sort((left, right) => right.totalTokens - left.totalTokens);

return {
monthlyLimit,
monthlyUsed,
remaining,
perUser
};
}
