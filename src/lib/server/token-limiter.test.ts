import { describe, expect, it, vi } from "vitest";
import type { TokenUsage } from "$lib/types";

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    limits: {
      dailyTokenLimit: 50_000,
      monthlyCostLimit: 20,
      bypassKey: "let-me-in",
    },
  },
}));

vi.mock("$lib/config", () => ({
  config: mockConfig,
}));

vi.mock("$lib/server/db", () => ({
  listTokenUsageForRange: vi.fn(),
  recordTokenUsage: vi.fn(),
}));

import {
  dayWindow,
  monthWindow,
  monthlyTokenLimit,
  resolveBypass,
  sumTokens,
} from "$lib/server/token-limiter";

function usage(tokensTotal: number): TokenUsage {
  return {
    id: `usage-${tokensTotal}`,
    userId: "user-1",
    sessionId: null,
    model: "test-model",
    tokensIn: Math.floor(tokensTotal / 2),
    tokensOut: Math.ceil(tokensTotal / 2),
    tokensTotal,
    createdAt: "2025-01-01T00:00:00.000Z",
  };
}

describe("dayWindow", () => {
  it("returns UTC day start and next day end", () => {
    const now = new Date("2025-05-10T15:45:30.123Z");
    const window = dayWindow(now);

    expect(window).toEqual({
      start: "2025-05-10T00:00:00.000Z",
      end: "2025-05-11T00:00:00.000Z",
    });
  });
});

describe("monthWindow", () => {
  it("returns UTC month start and next month start as end", () => {
    const now = new Date("2025-05-10T15:45:30.123Z");
    const window = monthWindow(now);

    expect(window).toEqual({
      start: "2025-05-01T00:00:00.000Z",
      end: "2025-06-01T00:00:00.000Z",
    });
  });
});

describe("sumTokens", () => {
  it("sums token totals across usage rows", () => {
    expect(sumTokens([usage(10), usage(25), usage(5)])).toBe(40);
  });

  it("returns 0 for empty rows", () => {
    expect(sumTokens([])).toBe(0);
  });
});

describe("resolveBypass", () => {
  it("returns true for exact bypass key match", () => {
    mockConfig.limits.bypassKey = "let-me-in";
    expect(resolveBypass("let-me-in")).toBe(true);
  });

  it("returns false when bypass key differs", () => {
    mockConfig.limits.bypassKey = "let-me-in";
    expect(resolveBypass("wrong-key")).toBe(false);
  });

  it("returns false when configured bypass key is blank after trim", () => {
    mockConfig.limits.bypassKey = "   ";
    expect(resolveBypass("anything")).toBe(false);
  });
});

describe("monthlyTokenLimit", () => {
  it("returns daily limit multiplied by 31", () => {
    mockConfig.limits.dailyTokenLimit = 500;
    expect(monthlyTokenLimit()).toBe(15_500);
  });

  it("returns 0 when daily limit is 0 or negative", () => {
    mockConfig.limits.dailyTokenLimit = 0;
    expect(monthlyTokenLimit()).toBe(0);

    mockConfig.limits.dailyTokenLimit = -10;
    expect(monthlyTokenLimit()).toBe(0);
  });
});
