import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { submitChallenge } from '$lib/server/portfolio-challenge';

export const POST: RequestHandler = async ({ request }) => {
  let body: { token?: string; selectedAnswer?: string; attemptId?: string };
  try {
    body = await request.json();
  } catch {
    return json(
      { ok: false, reason: 'invalid_request', message: 'Invalid request body.' },
      { status: 400 },
    );
  }

  const { token, selectedAnswer, attemptId } = body;

  if (typeof token !== 'string' || !token.trim()) {
    return json(
      { ok: false, reason: 'invalid_request', message: 'Missing challenge token.' },
      { status: 400 },
    );
  }
  if (typeof selectedAnswer !== 'string' || !selectedAnswer.trim()) {
    return json(
      { ok: false, reason: 'invalid_request', message: 'Missing selected answer.' },
      { status: 400 },
    );
  }
  if (typeof attemptId !== 'string' || !attemptId.trim()) {
    return json(
      { ok: false, reason: 'invalid_request', message: 'Missing attempt ID.' },
      { status: 400 },
    );
  }

  const result = await submitChallenge(token.trim(), selectedAnswer.trim(), attemptId.trim());

  if (!result.ok) {
    const status = result.reason === 'expired' ? 410 : 400;
    return json({ ok: false, reason: result.reason, message: result.message }, { status });
  }

  return json({
    ok: true,
    correct: result.correct,
    correctAnswer: result.correctAnswer,
    explanation: result.explanation,
    builderView: result.builderView,
  });
};
