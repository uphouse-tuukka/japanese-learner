import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkAnswerWithAI } from '$lib/server/answer-checker';

interface CheckAnswerRequest {
  expectedAnswer: string;
  acceptedAnswers: string[];
  userAnswer: string;
  exerciseType: string;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const userId = cookies.get('selected_user');
    if (!userId) {
      return json({ ok: false, error: 'Not authenticated.' }, { status: 401 });
    }

    const body = (await request.json()) as CheckAnswerRequest;

    const expectedAnswer = String(body.expectedAnswer ?? '').trim();
    const userAnswer = String(body.userAnswer ?? '').trim();
    const exerciseType = String(body.exerciseType ?? '').trim();
    const acceptedAnswers = Array.isArray(body.acceptedAnswers)
      ? body.acceptedAnswers.map((a: string) => String(a).trim()).filter(Boolean)
      : [];

    if (!expectedAnswer || !userAnswer || !exerciseType) {
      return json({ ok: false, error: 'Missing required fields.' }, { status: 400 });
    }

    const result = await checkAnswerWithAI({
      expectedAnswer,
      acceptedAnswers,
      userAnswer,
      exerciseType,
      userId,
    });

    return json({
      ok: true,
      correct: result.correct,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error('[api/check-answer] failed', { error });
    return json({ ok: false, error: 'Answer check failed.' }, { status: 500 });
  }
};
