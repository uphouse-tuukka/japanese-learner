import { createHmac } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/auth', () => ({
  getAuthSecret: () => 'test-secret-key-for-unit-tests',
}));

import {
  signSessionToken,
  verifySessionToken,
  type SessionTokenPayload,
} from '$lib/server/signed-token';

const TEST_AUTH_SECRET = 'test-secret-key-for-unit-tests';
const TOKEN_SECRET_SALT = 'portfolio-challenge-token-v1';

function makePayload(overrides?: Partial<SessionTokenPayload>): SessionTokenPayload {
  return {
    sessionId: 'test-session-123',
    visitorId: 'test-visitor-456',
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

function mutateLastChar(value: string): string {
  const last = value.at(-1);
  if (!last) {
    return `${value}x`;
  }

  const next = last === 'a' ? 'b' : 'a';
  return `${value.slice(0, -1)}${next}`;
}

function signRawPayload(payload: unknown): string {
  const payloadPart = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const tokenSecret = createHmac('sha256', TOKEN_SECRET_SALT)
    .update(TEST_AUTH_SECRET)
    .digest('hex');
  const signature = createHmac('sha256', tokenSecret).update(payloadPart).digest('hex');
  return `${payloadPart}.${signature}`;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('signSessionToken', () => {
  it('returns a string with two parts separated by a dot', () => {
    const token = signSessionToken(makePayload());
    const parts = token.split('.');

    expect(typeof token).toBe('string');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBeTruthy();
    expect(parts[1]).toBeTruthy();
  });

  it('produces consistent signatures for same payload', () => {
    const payload = makePayload({ expiresAt: 9_999_999_999_999 });

    const tokenA = signSessionToken(payload);
    const tokenB = signSessionToken(payload);

    expect(tokenA).toBe(tokenB);
  });

  it('produces different tokens for different payloads', () => {
    const expiresAt = 9_999_999_999_999;
    const tokenA = signSessionToken(makePayload({ sessionId: 'session-a', expiresAt }));
    const tokenB = signSessionToken(makePayload({ sessionId: 'session-b', expiresAt }));

    expect(tokenA).not.toBe(tokenB);
  });
});

describe('verifySessionToken', () => {
  it('valid token round-trips correctly', () => {
    const payload = makePayload({ expiresAt: Date.now() + 120_000 });
    const token = signSessionToken(payload);

    const result = verifySessionToken(token);

    expect(result).toEqual({ valid: true, payload });
  });

  it('rejects malformed token (no dot)', () => {
    expect(verifySessionToken('garbage')).toEqual({ valid: false, reason: 'malformed' });
  });

  it('rejects malformed token (empty parts)', () => {
    expect(verifySessionToken('.something')).toEqual({ valid: false, reason: 'malformed' });
    expect(verifySessionToken('something.')).toEqual({ valid: false, reason: 'malformed' });
  });

  it('rejects tampered signature', () => {
    const token = signSessionToken(makePayload());
    const [payloadPart, signature] = token.split('.');
    const tamperedToken = `${payloadPart}.${mutateLastChar(signature)}`;

    expect(verifySessionToken(tamperedToken)).toEqual({ valid: false, reason: 'tampered' });
  });

  it('rejects tampered payload', () => {
    const token = signSessionToken(makePayload());
    const [payloadPart, signature] = token.split('.');
    const tamperedToken = `${mutateLastChar(payloadPart)}.${signature}`;

    expect(verifySessionToken(tamperedToken)).toEqual({ valid: false, reason: 'tampered' });
  });

  it('rejects expired token', () => {
    const token = signSessionToken(makePayload({ expiresAt: Date.now() - 1_000 }));

    expect(verifySessionToken(token)).toEqual({ valid: false, reason: 'expired' });
  });

  it('rejects payload with missing fields', () => {
    const token = signRawPayload({
      sessionId: 'missing-visitor-id',
      expiresAt: Date.now() + 60_000,
    });

    expect(verifySessionToken(token)).toEqual({ valid: false, reason: 'invalid_payload' });
  });
});
