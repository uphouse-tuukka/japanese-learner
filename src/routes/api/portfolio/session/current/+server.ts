import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentSession } from '$lib/server/portfolio-challenge';
import { verifySessionToken } from '$lib/server/signed-token';

export const GET: RequestHandler = async ({ cookies }) => {
  const token = cookies.get('portfolio_session');
  if (!token) {
    return json(
      { ok: false, reason: 'no_session', message: 'No active session.' },
      { status: 400 },
    );
  }

  const verified = verifySessionToken(token);
  if (!verified.valid) {
    const status = verified.reason === 'expired' ? 410 : 400;
    return json(
      { ok: false, reason: verified.reason, message: 'Invalid or expired session token.' },
      { status },
    );
  }

  const cookieId = cookies.get('portfolio_visitor');
  if (!cookieId || cookieId !== verified.payload.visitorId) {
    return json(
      { ok: false, reason: 'invalid_session', message: 'Session does not match visitor.' },
      { status: 400 },
    );
  }

  const result = await getCurrentSession(cookieId);
  if (!result.ok) {
    const status = result.reason === 'expired' ? 410 : 400;
    return json({ ok: false, reason: result.reason, message: result.message }, { status });
  }

  return json({ ok: true, session: result.session });
};
