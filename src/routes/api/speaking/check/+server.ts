import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jsonError } from '$lib/server/api';
import { readSelectedUserId } from '$lib/server/selected-user';
import { SpeakingCheckError, checkSpeakingAnswer } from '$lib/server/speaking-checker';
import type { SpeakingResponseKind } from '$lib/server/speaking-checker';
import { checkBudget } from '$lib/server/token-limiter';

const METADATA_LIMITS = {
  prompt: 500,
  expectedAnswer: 200,
  expectedRomaji: 200,
  acceptedAnswer: 200,
  acceptedAnswersCount: 10,
  rubric: 1000,
};

type MetadataResult<T> = { ok: true; value: T } | { ok: false; error: string };

function isMultipart(request: Request): boolean {
  return (request.headers.get('content-type') ?? '').toLowerCase().includes('multipart/form-data');
}

function readRequiredString(
  formData: FormData,
  fieldName: string,
  maxLength: number,
): MetadataResult<string> {
  const raw = formData.get(fieldName);
  if (typeof raw !== 'string') {
    return { ok: false, error: `Missing ${fieldName}.` };
  }

  const value = raw.trim();
  if (!value || value.length > maxLength) {
    return { ok: false, error: `Invalid ${fieldName}.` };
  }

  return { ok: true, value };
}

function readResponseKind(formData: FormData): MetadataResult<SpeakingResponseKind> {
  const raw = formData.get('responseKind');
  if (raw !== 'situational_response' && raw !== 'translation_en_to_ja') {
    return { ok: false, error: 'Invalid responseKind.' };
  }

  return { ok: true, value: raw };
}

function parseAcceptedAnswers(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((value) => String(value).trim()).filter(Boolean);
    }
  } catch {
    // Fall back to newline-separated answers.
  }

  return trimmed
    .split(/\r?\n/)
    .map((answer) => answer.trim())
    .filter(Boolean);
}

function readAcceptedAnswers(formData: FormData): MetadataResult<string[]> {
  const raw = formData.get('acceptedAnswers');
  const acceptedAnswers = typeof raw === 'string' ? parseAcceptedAnswers(raw) : [];

  if (acceptedAnswers.length > METADATA_LIMITS.acceptedAnswersCount) {
    return { ok: false, error: 'Invalid acceptedAnswers.' };
  }

  if (acceptedAnswers.some((answer) => answer.length > METADATA_LIMITS.acceptedAnswer)) {
    return { ok: false, error: 'Invalid acceptedAnswers.' };
  }

  return { ok: true, value: acceptedAnswers };
}

function isAudioFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File;
}

function safeClientError(error: SpeakingCheckError): { message: string; status: number } {
  if (error.code === 'audio_too_large') {
    return { message: 'Audio file is too large. Please record a shorter answer.', status: 400 };
  }
  if (error.code === 'unsupported_audio_type') {
    return { message: 'Unsupported audio format. Please try again.', status: 400 };
  }
  if (error.code === 'empty_transcript') {
    return { message: 'No speech was detected. Please try again.', status: 400 };
  }

  return { message: 'Invalid speaking check request.', status: 400 };
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  const selectedUser = readSelectedUserId(cookies);
  if (!selectedUser.ok) {
    return jsonError(selectedUser.error, selectedUser.status);
  }
  if (!selectedUser.userId) {
    return jsonError('Not authenticated.', 401);
  }
  const userId = selectedUser.userId;

  if (!isMultipart(request)) {
    return jsonError('Expected multipart/form-data.', 415);
  }

  const budgetCheck = await checkBudget(userId);
  if (!budgetCheck.allowed) {
    return jsonError('Daily AI budget exhausted. Please try again later.', 429);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('Invalid multipart/form-data.', 400);
  }

  const audio = formData.get('audio');
  if (!isAudioFile(audio)) {
    return jsonError('Missing audio file.', 400);
  }

  const prompt = readRequiredString(formData, 'prompt', METADATA_LIMITS.prompt);
  if (!prompt.ok) return jsonError(prompt.error, 400);

  const responseKind = readResponseKind(formData);
  if (!responseKind.ok) return jsonError(responseKind.error, 400);

  const expectedAnswer = readRequiredString(
    formData,
    'expectedAnswer',
    METADATA_LIMITS.expectedAnswer,
  );
  if (!expectedAnswer.ok) return jsonError(expectedAnswer.error, 400);

  const expectedRomaji = readRequiredString(
    formData,
    'expectedRomaji',
    METADATA_LIMITS.expectedRomaji,
  );
  if (!expectedRomaji.ok) return jsonError(expectedRomaji.error, 400);

  const acceptedAnswers = readAcceptedAnswers(formData);
  if (!acceptedAnswers.ok) return jsonError(acceptedAnswers.error, 400);

  const rubric = readRequiredString(formData, 'rubric', METADATA_LIMITS.rubric);
  if (!rubric.ok) return jsonError(rubric.error, 400);

  try {
    const result = await checkSpeakingAnswer({
      userId,
      audio,
      prompt: prompt.value,
      responseKind: responseKind.value,
      expectedAnswer: expectedAnswer.value,
      expectedRomaji: expectedRomaji.value,
      acceptedAnswers: acceptedAnswers.value,
      rubric: rubric.value,
    });

    return json({
      ok: true,
      transcript: result.transcript,
      correct: result.correct,
      confidence: result.confidence,
      feedback: result.feedback,
    });
  } catch (error) {
    if (error instanceof SpeakingCheckError) {
      const safeError = safeClientError(error);
      return jsonError(safeError.message, safeError.status);
    }

    console.error('[api/speaking/check] failed', { error });
    return jsonError('Speaking check failed.', 500);
  }
};
