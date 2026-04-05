import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { randomUUID } from 'node:crypto';
import { startChallenge } from '$lib/server/portfolio-challenge';

export const POST: RequestHandler = async ({ cookies, getClientAddress }) => {
  const existingCookie = cookies.get('portfolio_visitor');
  const ip = getClientAddress();

  const result = await startChallenge(existingCookie, ip);

  if (!result.ok) {
    const status = result.reason === 'quota_exceeded' ? 429 : 503;
    return json({ ok: false, reason: result.reason, message: result.message }, { status });
  }

  // Set visitor cookie if not present
  if (!existingCookie) {
    cookies.set('portfolio_visitor', randomUUID(), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: !dev,
      maxAge: 86400,
    });
  }

  return json({
    ok: true,
    challenge: result.challenge,
    token: result.token,
    attemptId: result.attemptId,
  });
};
