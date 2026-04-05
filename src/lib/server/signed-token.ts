import { createHmac, timingSafeEqual } from 'crypto';
import { getAuthSecret } from '$lib/server/auth';

const TOKEN_SECRET_SALT = 'portfolio-challenge-token-v1';

export type ChallengeTokenPayload = {
  challengeId: string;
  expiresAt: number;
  correctAnswer: string;
  explanation: string;
  builderView: {
    prompt: string;
    choices: string[];
    correctAnswer: string;
    explanation: string;
    note: string;
  };
};

function toBuffer(value: string): Buffer {
  return Buffer.from(value, 'utf-8');
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuffer = toBuffer(a);
  const bBuffer = toBuffer(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

function getTokenSecret(): string {
  return createHmac('sha256', TOKEN_SECRET_SALT).update(getAuthSecret()).digest('hex');
}

function createSignature(payloadPart: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadPart).digest('hex');
}

function isChallengeTokenPayload(value: unknown): value is ChallengeTokenPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const builderView = payload.builderView as Record<string, unknown> | undefined;

  return (
    typeof payload.challengeId === 'string' &&
    typeof payload.expiresAt === 'number' &&
    Number.isFinite(payload.expiresAt) &&
    typeof payload.correctAnswer === 'string' &&
    typeof payload.explanation === 'string' &&
    !!builderView &&
    typeof builderView.prompt === 'string' &&
    Array.isArray(builderView.choices) &&
    builderView.choices.every((choice) => typeof choice === 'string') &&
    typeof builderView.correctAnswer === 'string' &&
    typeof builderView.explanation === 'string' &&
    typeof builderView.note === 'string'
  );
}

export function signChallengeToken(payload: ChallengeTokenPayload): string {
  const payloadJson = JSON.stringify(payload);
  const payloadPart = Buffer.from(payloadJson, 'utf-8').toString('base64url');
  const signature = createSignature(payloadPart, getTokenSecret());

  return `${payloadPart}.${signature}`;
}

export function verifyChallengeToken(
  token: string,
): { valid: true; payload: ChallengeTokenPayload } | { valid: false; reason: string } {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, reason: 'malformed' };
  }

  const [payloadPart, providedSignature] = parts;
  const expectedSignature = createSignature(payloadPart, getTokenSecret());

  if (!timingSafeStringEqual(providedSignature, expectedSignature)) {
    return { valid: false, reason: 'tampered' };
  }

  let parsedPayload: unknown;
  try {
    const payloadJson = Buffer.from(payloadPart, 'base64url').toString('utf-8');
    parsedPayload = JSON.parse(payloadJson);
  } catch {
    return { valid: false, reason: 'invalid_payload' };
  }

  if (!isChallengeTokenPayload(parsedPayload)) {
    return { valid: false, reason: 'invalid_payload' };
  }

  if (parsedPayload.expiresAt <= Date.now()) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, payload: parsedPayload };
}
