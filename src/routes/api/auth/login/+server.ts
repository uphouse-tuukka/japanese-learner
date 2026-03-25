import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSessionToken, sessionConfig, verifyCredentials } from '$lib/server/auth';

type LoginRequestBody = {
  username?: string;
  password?: string;
};

type RateLimitEntry = {
  count: number;
  windowStart: number;
};

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const attemptsByIp = new Map<string, RateLimitEntry>();

function cleanupOldAttempts(now: number): void {
  for (const [ip, entry] of attemptsByIp.entries()) {
    if (now - entry.windowStart >= WINDOW_MS) {
      attemptsByIp.delete(ip);
    }
  }
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  cleanupOldAttempts(now);

  const existing = attemptsByIp.get(ip);
  if (!existing) {
    attemptsByIp.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (now - existing.windowStart >= WINDOW_MS) {
    attemptsByIp.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (existing.count >= MAX_ATTEMPTS) {
    return true;
  }

  existing.count += 1;
  attemptsByIp.set(ip, existing);
  return false;
}

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
  const ip = getClientAddress();

  if (isRateLimited(ip)) {
    return json({ ok: false, error: 'Too many login attempts' }, { status: 429 });
  }

  const body = (await request.json()) as LoginRequestBody;
  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!verifyCredentials(username, password)) {
    return json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
  }

  const token = createSessionToken(username);
  cookies.set(sessionConfig.cookieName, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: sessionConfig.maxAgeSeconds,
  });

  return json({ ok: true });
};
