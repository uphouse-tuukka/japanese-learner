import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCheckBudget, mockCheckSpeakingAnswer } = vi.hoisted(() => ({
  mockCheckBudget: vi.fn(),
  mockCheckSpeakingAnswer: vi.fn(),
}));

vi.mock('$lib/server/token-limiter', () => ({
  checkBudget: mockCheckBudget,
}));

vi.mock('$lib/server/speaking-checker', async (importOriginal) => {
  const original = await importOriginal<typeof import('$lib/server/speaking-checker')>();
  return {
    ...original,
    checkSpeakingAnswer: mockCheckSpeakingAnswer,
  };
});

import { POST } from './check/+server';

function buildCookies(selectedUserId: string | null = 'user-1') {
  const cookieValue = selectedUserId ?? undefined;
  return {
    get(name: string) {
      return name === 'selected_user' ? cookieValue : undefined;
    },
  };
}

function validFormData(overrides: Record<string, string | File> = {}): FormData {
  const formData = new FormData();
  formData.set('audio', new File(['voice-data'], 'answer.webm', { type: 'audio/webm' }));
  formData.set('prompt', 'Say that you would like water.');
  formData.set('responseKind', 'situational_response');
  formData.set('expectedAnswer', '水をください');
  formData.set('expectedRomaji', 'mizu o kudasai');
  formData.set('acceptedAnswers', JSON.stringify(['お水をください']));
  formData.set('rubric', 'Accept a polite request for water in Japanese.');

  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }

  return formData;
}

function requestWithBody(body: BodyInit, contentType?: string): Request {
  const headers = contentType ? { 'content-type': contentType } : undefined;
  return new Request('http://localhost/api/speaking/check', {
    method: 'POST',
    headers,
    body,
  });
}

async function post(formData: FormData, selectedUserId: string | null = 'user-1') {
  return POST({
    request: requestWithBody(formData),
    cookies: buildCookies(selectedUserId),
  } as never);
}

describe('POST /api/speaking/check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckBudget.mockResolvedValue({ allowed: true });
    mockCheckSpeakingAnswer.mockResolvedValue({
      transcript: '水をください',
      correct: true,
      confidence: 'high',
      feedback: 'Good natural request.',
    });
  });

  it('requires a selected_user cookie before parsing or calling OpenAI helpers', async () => {
    const response = await post(validFormData(), null);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Not authenticated.' });
    expect(mockCheckBudget).not.toHaveBeenCalled();
    expect(mockCheckSpeakingAnswer).not.toHaveBeenCalled();
  });

  it('rejects non-multipart requests', async () => {
    const response = await POST({
      request: requestWithBody(JSON.stringify({}), 'application/json'),
      cookies: buildCookies(),
    } as never);

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Expected multipart/form-data.',
    });
    expect(mockCheckSpeakingAnswer).not.toHaveBeenCalled();
  });

  it('rejects requests without an audio file', async () => {
    const formData = validFormData();
    formData.delete('audio');

    const response = await post(formData);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Missing audio file.' });
    expect(mockCheckSpeakingAnswer).not.toHaveBeenCalled();
  });

  it('returns 429 when the token budget is exhausted before calling the helper', async () => {
    mockCheckBudget.mockResolvedValue({ allowed: false, reason: 'daily_limit_exceeded' });

    const response = await post(validFormData());

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Daily AI budget exhausted. Please try again later.',
    });
    expect(mockCheckBudget).toHaveBeenCalledWith('user-1');
    expect(mockCheckSpeakingAnswer).not.toHaveBeenCalled();
  });

  it('rejects oversized metadata before calling the helper', async () => {
    const response = await post(validFormData({ prompt: 'x'.repeat(501) }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Invalid prompt.' });
    expect(mockCheckSpeakingAnswer).not.toHaveBeenCalled();
  });

  it('passes parsed metadata to the speaking checker and returns its result', async () => {
    const response = await post(
      validFormData({ acceptedAnswers: 'お水をください\n水お願いします' }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      transcript: '水をください',
      correct: true,
      confidence: 'high',
      feedback: 'Good natural request.',
    });
    expect(mockCheckSpeakingAnswer).toHaveBeenCalledWith({
      userId: 'user-1',
      audio: expect.any(File),
      prompt: 'Say that you would like water.',
      responseKind: 'situational_response',
      expectedAnswer: '水をください',
      expectedRomaji: 'mizu o kudasai',
      acceptedAnswers: ['お水をください', '水お願いします'],
      rubric: 'Accept a polite request for water in Japanese.',
    });
  });

  it('returns a safe 500 when the helper fails unexpectedly', async () => {
    mockCheckSpeakingAnswer.mockRejectedValue(new Error('OpenAI internals should not leak'));

    const response = await post(validFormData());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Speaking check failed.',
    });
  });
});
