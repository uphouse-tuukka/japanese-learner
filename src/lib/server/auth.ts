import { env } from '$env/dynamic/private';
import { config } from '$lib/config';
import { createHmac, timingSafeEqual } from 'crypto';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const AUTH_SECRET_SALT = 'japanese-learner-auth-secret-v1';

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

function createSignature(username: string, timestamp: string, secret: string): string {
  return createHmac('sha256', secret).update(`${username}:${timestamp}`).digest('hex');
}

export function getAuthSecret(): string {
  const configuredSecret = env.AUTH_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  const password = config.siteAccess.basicAuthPassword;
  return createHmac('sha256', AUTH_SECRET_SALT).update(password).digest('hex');
}

export function createSessionToken(username: string): string {
  const timestamp = Date.now().toString();
  const secret = getAuthSecret();
  const signature = createSignature(username, timestamp, secret);

  return `${username}:${timestamp}:${signature}`;
}

export function validateSessionToken(token: string): { valid: boolean; username?: string } {
  const firstSeparator = token.indexOf(':');
  const secondSeparator = token.indexOf(':', firstSeparator + 1);

  if (firstSeparator <= 0 || secondSeparator <= firstSeparator + 1) {
    return { valid: false };
  }

  const username = token.slice(0, firstSeparator);
  const timestamp = token.slice(firstSeparator + 1, secondSeparator);
  const providedSignature = token.slice(secondSeparator + 1);

  if (!username || !timestamp || !providedSignature) {
    return { valid: false };
  }

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs)) {
    return { valid: false };
  }

  const ageMs = Date.now() - timestampMs;
  if (ageMs < 0 || ageMs > SESSION_MAX_AGE_SECONDS * 1000) {
    return { valid: false };
  }

  const expectedSignature = createSignature(username, timestamp, getAuthSecret());
  if (!timingSafeStringEqual(providedSignature, expectedSignature)) {
    return { valid: false };
  }

  return { valid: true, username };
}

export function verifyCredentials(username: string, password: string): boolean {
  const expectedUser = config.siteAccess.basicAuthUser;
  const expectedPassword = config.siteAccess.basicAuthPassword;

  const userMatches = timingSafeStringEqual(username, expectedUser);
  const passwordMatches = timingSafeStringEqual(password, expectedPassword);

  return userMatches && passwordMatches;
}

export const sessionConfig = {
  cookieName: 'site_auth',
  maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
};
