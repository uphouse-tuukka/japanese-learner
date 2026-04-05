import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { progressSession } from '$lib/server/portfolio-challenge';
import { verifySessionToken } from '$lib/server/signed-token';
import type { ExerciseAnswerPayload } from '$lib/types';

export const POST: RequestHandler = async ({ request, cookies }) => {
  let body: { sessionId?: string; currentIndex?: number; answer?: ExerciseAnswerPayload };
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
  if (typeof body.currentIndex !== 'number' || !Number.isInteger(body.currentIndex)) {
    return json(
      { ok: false, reason: 'invalid_request', message: 'currentIndex must be an integer.' },
      { status: 400 },
    );
  }
  if (!body.answer || typeof body.answer !== 'object') {
    return json(
      { ok: false, reason: 'invalid_request', message: 'answer is required.' },
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

  const result = await progressSession(
    body.sessionId.trim(),
    cookieId,
    body.currentIndex,
    body.answer,
  );
  if (!result.ok) {
    const status = result.reason === 'expired' ? 410 : 400;
    return json({ ok: false, reason: result.reason, message: result.message }, { status });
  }

  return json({ ok: true, session: result.session });
};
