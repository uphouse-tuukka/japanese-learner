import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockResolveAuthSecretOverride } = vi.hoisted(() => ({
  mockResolveAuthSecretOverride: vi.fn(),
}));

vi.mock('$lib/server/config', () => ({
  config: {
    siteAccess: {
      basicAuthUser: 'test-user',
      basicAuthPassword: 'test-password',
    },
  },
  resolveAuthSecretOverride: mockResolveAuthSecretOverride,
}));

import { createSessionToken, sessionConfig, validateSessionToken } from '$lib/server/auth';

const NOW = 1_700_000_000_000;
const USERNAME = 'test-user';

function parseSignature(token: string): string {
  const firstSeparator = token.indexOf(':');
  const secondSeparator = token.indexOf(':', firstSeparator + 1);
  return token.slice(secondSeparator + 1);
}

function replaceSignature(token: string, signature: string): string {
  const firstSeparator = token.indexOf(':');
  const secondSeparator = token.indexOf(':', firstSeparator + 1);
  return `${token.slice(0, secondSeparator + 1)}${signature}`;
}

function mutateLastChar(value: string): string {
  const last = value.at(-1);
  if (!last) {
    return `${value}a`;
  }

  const replacement = last === 'a' ? 'b' : 'a';
  return `${value.slice(0, -1)}${replacement}`;
}

beforeEach(() => {
  mockResolveAuthSecretOverride.mockReset();
  mockResolveAuthSecretOverride.mockReturnValue('');
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('session token auth', () => {
  it('validates a valid token', () => {
    const token = createSessionToken(USERNAME);

    expect(validateSessionToken(token)).toEqual({ valid: true, username: USERNAME });
  });

  it('rejects a token with a tampered signature', () => {
    const token = createSessionToken(USERNAME);
    const tamperedToken = replaceSignature(token, mutateLastChar(parseSignature(token)));

    expect(validateSessionToken(tamperedToken)).toEqual({ valid: false });
  });

  it('rejects an expired token', () => {
    vi.setSystemTime(NOW - sessionConfig.maxAgeSeconds * 1000 - 1);
    const token = createSessionToken(USERNAME);

    vi.setSystemTime(NOW);

    expect(validateSessionToken(token)).toEqual({ valid: false });
  });

  it('rejects a token with a future timestamp', () => {
    vi.setSystemTime(NOW + 1);
    const token = createSessionToken(USERNAME);

    vi.setSystemTime(NOW);

    expect(validateSessionToken(token)).toEqual({ valid: false });
  });

  it('returns invalid instead of throwing when signature lengths differ', () => {
    const token = createSessionToken(USERNAME);
    const signature = parseSignature(token);
    const mismatchedSignatures = [signature.slice(0, -1), `${signature}a`];

    for (const mismatchedSignature of mismatchedSignatures) {
      let result: ReturnType<typeof validateSessionToken> | undefined;
      const mismatchedToken = replaceSignature(token, mismatchedSignature);

      expect(() => {
        result = validateSessionToken(mismatchedToken);
      }).not.toThrow();
      expect(result).toEqual({ valid: false });
    }
  });

  it('uses the AUTH_SECRET override for signature behavior', () => {
    mockResolveAuthSecretOverride.mockReturnValue('override-secret-a');
    const tokenSignedWithSecretA = createSessionToken(USERNAME);

    expect(validateSessionToken(tokenSignedWithSecretA)).toEqual({
      valid: true,
      username: USERNAME,
    });

    mockResolveAuthSecretOverride.mockReturnValue('override-secret-b');
    const tokenSignedWithSecretB = createSessionToken(USERNAME);

    expect(tokenSignedWithSecretB).not.toBe(tokenSignedWithSecretA);
    expect(validateSessionToken(tokenSignedWithSecretA)).toEqual({ valid: false });
    expect(validateSessionToken(tokenSignedWithSecretB)).toEqual({
      valid: true,
      username: USERNAME,
    });
  });
});
