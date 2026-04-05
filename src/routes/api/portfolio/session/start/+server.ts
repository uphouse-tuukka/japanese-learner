import { randomUUID } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import { SCENARIOS, startSession, type ScenarioId } from '$lib/server/portfolio-challenge';
import { signSessionToken } from '$lib/server/signed-token';

function isScenarioId(value: string): value is ScenarioId {
  return SCENARIOS.some((scenario) => scenario.id === value);
}

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
  let body: { scenario?: string; supportsBrowserVoice?: boolean };
  try {
    body = await request.json();
  } catch {
    return json(
      { ok: false, reason: 'invalid_request', message: 'Invalid request body.' },
      { status: 400 },
    );
  }

  if (typeof body.scenario !== 'string' || !isScenarioId(body.scenario)) {
    return json(
      { ok: false, reason: 'invalid_scenario', message: 'Invalid scenario.' },
      { status: 400 },
    );
  }

  if (typeof body.supportsBrowserVoice !== 'boolean') {
    return json(
      {
        ok: false,
        reason: 'invalid_request',
        message: 'supportsBrowserVoice must be a boolean.',
      },
      { status: 400 },
    );
  }

  let cookieId = cookies.get('portfolio_visitor');
  if (!cookieId) {
    cookieId = randomUUID();
    cookies.set('portfolio_visitor', cookieId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: !dev,
      maxAge: 86400,
    });
  }

  const result = await startSession(
    cookieId,
    getClientAddress(),
    body.scenario,
    body.supportsBrowserVoice,
  );
  if (!result.ok) {
    const status =
      result.reason === 'quota_exceeded'
        ? 429
        : result.reason === 'invalid_scenario'
          ? 400
          : result.reason === 'generation_failed' || result.reason === 'timeout'
            ? 503
            : 400;
    return json({ ok: false, reason: result.reason, message: result.message }, { status });
  }

  const { session } = result;
  const token = signSessionToken({
    sessionId: session.sessionId,
    visitorId: cookieId,
    expiresAt: new Date(session.expiresAt).getTime(),
  });
  cookies.set('portfolio_session', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: !dev,
    maxAge: 1800,
  });

  return json({
    ok: true,
    state: session.state,
    sessionId: session.sessionId,
    scenario: session.scenario,
    lesson: session.lesson,
    exercises: session.exercises,
    answers: [],
    currentIndex: 0,
    expiresAt: session.expiresAt,
    remainingSessionsToday: session.remainingSessionsToday,
  });
};
