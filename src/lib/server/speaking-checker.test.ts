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

import { checkSpeakingAnswer } from '$lib/server/speaking-checker';

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

  it('keeps an invalid grading response recoverable for existing speaking exercises', async () => {
    mockClient.responses.create.mockResolvedValue({
      output_text: 'not valid JSON',
      usage: { input_tokens: 100, output_tokens: 20 },
    });

    await expect(checkSpeakingAnswer(validInput())).resolves.toEqual({
      transcript: '水をください',
      correct: false,
      confidence: 'low',
      feedback: 'I could not grade that reliably. Please try again.',
    });
  });
});
