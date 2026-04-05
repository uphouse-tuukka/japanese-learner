import { createHmac } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/auth', () => ({
  getAuthSecret: () => 'test-secret-for-signed-token-tests',
}));

import {
  signChallengeToken,
  verifyChallengeToken,
  type ChallengeTokenPayload,
} from '$lib/server/signed-token';

const TEST_AUTH_SECRET = 'test-secret-for-signed-token-tests';
const TOKEN_SECRET_SALT = 'portfolio-challenge-token-v1';

function makePayload(overrides?: Partial<ChallengeTokenPayload>): ChallengeTokenPayload {
  return {
    challengeId: 'test-challenge-123',
    expiresAt: Date.now() + 60_000,
    correctAnswer: 'すみません (sumimasen)',
    explanation: 'すみません means "excuse me" in Japanese.',
    builderView: {
      prompt: 'Test prompt for portfolio challenge',
      choices: ['choice A', 'choice B', 'choice C', 'choice D'],
      correctAnswer: 'すみません (sumimasen)',
      explanation: 'すみません means "excuse me" in Japanese.',
      note: 'This is a test note.',
    },
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

describe('signChallengeToken', () => {
  it('returns a string with two parts separated by a dot', () => {
    const token = signChallengeToken(makePayload());
    const parts = token.split('.');

    expect(typeof token).toBe('string');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBeTruthy();
    expect(parts[1]).toBeTruthy();
  });

  it('produces consistent signatures for same payload', () => {
    const payload = makePayload({ expiresAt: 9_999_999_999_999 });

    const tokenA = signChallengeToken(payload);
    const tokenB = signChallengeToken(payload);

    expect(tokenA).toBe(tokenB);
  });

  it('produces different tokens for different payloads', () => {
    const expiresAt = 9_999_999_999_999;
    const tokenA = signChallengeToken(makePayload({ challengeId: 'challenge-a', expiresAt }));
    const tokenB = signChallengeToken(makePayload({ challengeId: 'challenge-b', expiresAt }));

    expect(tokenA).not.toBe(tokenB);
  });
});

describe('verifyChallengeToken', () => {
  it('valid token round-trips correctly', () => {
    const payload = makePayload({ expiresAt: Date.now() + 120_000 });
    const token = signChallengeToken(payload);

    const result = verifyChallengeToken(token);

    expect(result).toEqual({ valid: true, payload });
  });

  it('rejects malformed token (no dot)', () => {
    expect(verifyChallengeToken('garbage')).toEqual({ valid: false, reason: 'malformed' });
  });

  it('rejects malformed token (empty parts)', () => {
    expect(verifyChallengeToken('.something')).toEqual({ valid: false, reason: 'malformed' });
    expect(verifyChallengeToken('something.')).toEqual({ valid: false, reason: 'malformed' });
  });

  it('rejects tampered signature', () => {
    const token = signChallengeToken(makePayload());
    const [payloadPart, signature] = token.split('.');
    const tamperedToken = `${payloadPart}.${mutateLastChar(signature)}`;

    expect(verifyChallengeToken(tamperedToken)).toEqual({ valid: false, reason: 'tampered' });
  });

  it('rejects tampered payload', () => {
    const token = signChallengeToken(makePayload());
    const [payloadPart, signature] = token.split('.');
    const tamperedToken = `${mutateLastChar(payloadPart)}.${signature}`;

    expect(verifyChallengeToken(tamperedToken)).toEqual({ valid: false, reason: 'tampered' });
  });

  it('rejects expired token', () => {
    const token = signChallengeToken(makePayload({ expiresAt: Date.now() - 1_000 }));

    expect(verifyChallengeToken(token)).toEqual({ valid: false, reason: 'expired' });
  });

  it('rejects payload with missing fields', () => {
    const token = signRawPayload({
      challengeId: 'missing-builder-view',
      expiresAt: Date.now() + 60_000,
      correctAnswer: 'x',
      explanation: 'x',
    });

    expect(verifyChallengeToken(token)).toEqual({ valid: false, reason: 'invalid_payload' });
  });
});
