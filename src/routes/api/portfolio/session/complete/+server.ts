import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { completeSession } from '$lib/server/portfolio-challenge';
import { verifySessionToken } from '$lib/server/signed-token';

export const POST: RequestHandler = async ({ request, cookies }) => {
  let body: { sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return json(
      { ok: false, reason: 'invalid_request', message: 'Invalid request body.' },
      { status: 400 },
    );
  }

  if (typeof body.sessionId !== 'string' || !body.sessionId.trim()) {
    return json(
      { ok: false, reason: 'invalid_request', message: 'sessionId is required.' },
      { status: 400 },
    );
  }

  const token = cookies.get('portfolio_session');
  if (!token) {
    return json(
      { ok: false, reason: 'invalid_session', message: 'Missing session token.' },
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

  if (verified.payload.sessionId !== body.sessionId.trim()) {
    return json(
      { ok: false, reason: 'invalid_session', message: 'Session ID mismatch.' },
      { status: 400 },
    );
  }

  const result = await completeSession(body.sessionId.trim(), cookieId);
  if (!result.ok) {
    const status =
      result.reason === 'expired'
        ? 410
        : result.reason === 'summary_failed'
          ? 503
          : result.reason === 'not_ready'
            ? 400
            : 400;
    return json({ ok: false, reason: result.reason, message: result.message }, { status });
  }

  return json({
    ok: true,
    state: 'done',
    summary: result.summary,
    stats: result.stats,
    celebration: result.celebration,
  });
};
