import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetOpenAiClient, mockRecordUsageEvent, mockClient } = vi.hoisted(() => {
  const client = {
    audio: {
      transcriptions: {
        create: vi.fn(),
      },
    },
    responses: {
      create: vi.fn(),
    },
  };

  return {
    mockClient: client,
    mockGetOpenAiClient: vi.fn(() => client),
    mockRecordUsageEvent: vi.fn(),
  };
});

vi.mock('$lib/server/openai-client', () => ({
  getOpenAiClient: mockGetOpenAiClient,
}));

vi.mock('$lib/server/token-limiter', () => ({
  recordUsageEvent: mockRecordUsageEvent,
}));

vi.mock('$lib/server/config', () => ({
  config: {
    openai: {
      apiKey: 'test-api-key',
    },
  },
}));

import { SpeakingCheckError, checkSpeakingAnswer } from '$lib/server/speaking-checker';

function validInput(overrides: Partial<Parameters<typeof checkSpeakingAnswer>[0]> = {}) {
  return {
    userId: 'user-1',
    audio: new File(['voice-data'], 'answer.webm', { type: 'audio/webm' }),
    prompt: 'Say that you would like water.',
    responseKind: 'situational_response' as const,
    expectedAnswer: '水をください',
    expectedRomaji: 'mizu o kudasai',
    acceptedAnswers: ['お水をください'],
    rubric: 'Accept a polite request for water in Japanese.',
    ...overrides,
  };
}

describe('checkSpeakingAnswer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.audio.transcriptions.create.mockResolvedValue({
      text: '水をください',
      usage: {
        input_tokens: 12,
        output_tokens: 4,
      },
    });
    mockClient.responses.create.mockResolvedValue({
      output_text: JSON.stringify({
        correct: true,
        confidence: 'high',
        feedback: 'Good natural request.',
      }),
      usage: {
        input_tokens: 100,
        output_tokens: 20,
      },
    });
  });

  it('transcribes valid audio then grades the transcript', async () => {
    const result = await checkSpeakingAnswer(validInput());

    expect(result).toEqual({
      transcript: '水をください',
      correct: true,
      confidence: 'high',
      feedback: 'Good natural request.',
    });
    expect(mockClient.audio.transcriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.any(File),
        model: 'gpt-4o-mini-transcribe',
        language: 'ja',
        response_format: 'json',
        prompt: expect.stringContaining('Japanese learner speaking practice'),
      }),
    );
    expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty transcript before grading', async () => {
    mockClient.audio.transcriptions.create.mockResolvedValue({ text: '   ' });

    await expect(checkSpeakingAnswer(validInput())).rejects.toMatchObject({
      code: 'empty_transcript',
    });
    expect(mockClient.responses.create).not.toHaveBeenCalled();
  });

  it('rejects oversized audio before OpenAI calls', async () => {
    const audio = new File(['x'], 'answer.webm', { type: 'audio/webm' });
    Object.defineProperty(audio, 'size', { value: 5 * 1024 * 1024 + 1 });

    await expect(checkSpeakingAnswer(validInput({ audio }))).rejects.toBeInstanceOf(
      SpeakingCheckError,
    );
    await expect(checkSpeakingAnswer(validInput({ audio }))).rejects.toMatchObject({
      code: 'audio_too_large',
    });
    expect(mockGetOpenAiClient).not.toHaveBeenCalled();
  });

  it('rejects unsupported audio MIME before OpenAI calls', async () => {
    await expect(
      checkSpeakingAnswer(
        validInput({ audio: new File(['voice-data'], 'answer.txt', { type: 'text/plain' }) }),
      ),
    ).rejects.toMatchObject({ code: 'unsupported_audio_type' });
    expect(mockGetOpenAiClient).not.toHaveBeenCalled();
  });

  it('records transcription token usage when the SDK returns tokens', async () => {
    await checkSpeakingAnswer(validInput());

    expect(mockRecordUsageEvent).toHaveBeenCalledWith({
      userId: 'user-1',
      model: 'gpt-4o-mini-transcribe',
      tokensIn: 12,
      tokensOut: 4,
    });
  });

  it('does not invent token usage for duration-only transcription usage', async () => {
    mockClient.audio.transcriptions.create.mockResolvedValue({
      text: '水をください',
      usage: {
        seconds: 2.8,
      },
    });

    await checkSpeakingAnswer(validInput());

    expect(mockRecordUsageEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordUsageEvent).toHaveBeenCalledWith({
      userId: 'user-1',
      model: 'gpt-4.1',
      tokensIn: 100,
      tokensOut: 20,
    });
  });

  it('includes grading context without requiring exact wording', async () => {
    await checkSpeakingAnswer(validInput());

    const request = mockClient.responses.create.mock.calls[0]?.[0];
    const prompt = request.input[1].content as string;
    const systemInstruction = mockClient.responses.create.mock.calls[0]?.[0].input[0]
      .content as string;
    expect(prompt).toContain('Rubric:');
    expect(prompt).toContain('Response kind: situational_response');
    expect(prompt).toContain('semantically correct');
    expect(prompt).toContain('Do not grade pronunciation');
    expect(prompt).toContain('feedback in English');
    expect(prompt).toContain('automatic speech recognition transcript from a non-native learner');
    expect(prompt).toContain(
      'Accept minor particle, kana/kanji, spacing, formality, and clipped-politeness differences',
    );
    expect(prompt).toContain('Do not accept a transcript whose core meaning changes');
    expect(systemInstruction).toContain('feedback field must be in English');
    expect(systemInstruction).toContain('Be encouraging without accepting clearly wrong answers');
  });

  it('limits transcription hints to resolving close learner speech without inventing the answer', async () => {
    await checkSpeakingAnswer(validInput());

    const transcriptionRequest = mockClient.audio.transcriptions.create.mock.calls[0]?.[0];
    const prompt = transcriptionRequest.prompt as string;
    expect(prompt).toContain('Japanese learner speaking practice');
    expect(prompt).toContain('Expected answer: 水をください');
    expect(prompt).toContain('Accepted alternatives: お水をください');
    expect(prompt).toContain('Use this context only to resolve close or ambiguous Japanese speech');
    expect(prompt).toContain(
      'Do not invent or correct the answer if the audio is clearly different',
    );
  });
});
