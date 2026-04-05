import { createHmac, timingSafeEqual } from 'crypto';
import { getAuthSecret } from '$lib/server/auth';

const TOKEN_SECRET_SALT = 'portfolio-challenge-token-v1';

export type SessionTokenPayload = {
  sessionId: string;
  visitorId: string;
  expiresAt: number;
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

function isSessionTokenPayload(value: unknown): value is SessionTokenPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.sessionId === 'string' &&
    typeof payload.visitorId === 'string' &&
    typeof payload.expiresAt === 'number' &&
    Number.isFinite(payload.expiresAt)
  );
}

export function signSessionToken(payload: SessionTokenPayload): string {
  const payloadJson = JSON.stringify(payload);
  const payloadPart = Buffer.from(payloadJson, 'utf-8').toString('base64url');
  const signature = createSignature(payloadPart, getTokenSecret());

  return `${payloadPart}.${signature}`;
}

export function verifySessionToken(
  token: string,
): { valid: true; payload: SessionTokenPayload } | { valid: false; reason: string } {
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

  if (!isSessionTokenPayload(parsedPayload)) {
    return { valid: false, reason: 'invalid_payload' };
  }

  if (parsedPayload.expiresAt <= Date.now()) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, payload: parsedPayload };
}
