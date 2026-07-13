import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetOpenAiClient, mockRecordUsageEvent, mockLogInfo, mockLogWarn, mockClient } =
  vi.hoisted(() => {
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
      mockLogInfo: vi.fn(),
      mockLogWarn: vi.fn(),
    };
  });

vi.mock('$lib/server/openai-client', () => ({
  getOpenAiClient: mockGetOpenAiClient,
}));

vi.mock('$lib/server/token-limiter', () => ({
  recordUsageEvent: mockRecordUsageEvent,
}));

vi.mock('$lib/server/logger', () => ({
  logInfo: mockLogInfo,
  logWarn: mockLogWarn,
}));

vi.mock('$lib/server/config', () => ({
  config: {
    openai: {
      apiKey: 'test-api-key',
    },
  },
}));

import { assessMissionVoiceTurn } from '$lib/server/voice-assessment';

function validMissionInput() {
  return {
    userId: 'user-1',
    audio: new File(['voice-data'], 'answer.webm', { type: 'audio/webm' }),
    goal: 'Order one item politely in Japanese.',
    alternatives: ['ラーメンをください', 'ラーメンをお願いします'],
    rubric: 'Accept a clear request for one ramen. Do not require exact wording.',
  };
}

describe('assessMissionVoiceTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.audio.transcriptions.create.mockResolvedValue({
      text: 'ラーメンをお願いします',
      usage: { input_tokens: 12, output_tokens: 4 },
    });
    mockClient.responses.create.mockResolvedValue({
      output_text: JSON.stringify({
        accepted: true,
        confidence: 'high',
        feedback: 'You made a clear, polite order.',
      }),
      usage: { input_tokens: 100, output_tokens: 20 },
    });
  });

  it('returns accepted when the transcript clearly accomplishes the server-owned goal', async () => {
    await expect(assessMissionVoiceTurn(validMissionInput())).resolves.toEqual({
      outcome: 'accepted',
      transcript: 'ラーメンをお願いします',
      confidence: 'high',
      feedback: 'You made a clear, polite order.',
    });

    expect(mockClient.audio.transcriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'ja' }),
    );
    expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
    expect(mockRecordUsageEvent).toHaveBeenCalledTimes(2);

    const assessmentRequest = mockClient.responses.create.mock.calls[0]?.[0];
    const assessmentPrompt = assessmentRequest.input[1].content as string;
    expect(assessmentPrompt).toContain('Goal: Order one item politely in Japanese.');
    expect(assessmentPrompt).toContain('ラーメンをください');
    expect(assessmentPrompt).toContain(
      'Rubric: Accept a clear request for one ramen. Do not require exact wording.',
    );

    const diagnosticMetadata = mockLogInfo.mock.calls[0]?.[2];
    expect(diagnosticMetadata).toEqual({
      userId: 'user-1',
      mimeType: 'audio/webm',
      byteSize: 10,
      model: 'gpt-4o-mini-transcribe',
    });
    expect(JSON.stringify(diagnosticMetadata)).not.toContain('Order one item');
    expect(JSON.stringify(diagnosticMetadata)).not.toContain('ラーメン');
  });

  it('returns retry when the transcript confidently misses the goal', async () => {
    mockClient.audio.transcriptions.create.mockResolvedValue({ text: 'お水をください' });
    mockClient.responses.create.mockResolvedValue({
      output_text: JSON.stringify({
        accepted: false,
        confidence: 'high',
        feedback: 'Try ordering the requested item.',
      }),
    });

    await expect(assessMissionVoiceTurn(validMissionInput())).resolves.toEqual({
      outcome: 'retry',
      transcript: 'お水をください',
      confidence: 'high',
      feedback: 'Try ordering the requested item.',
    });
  });

  it('returns could not assess when no speech is detected', async () => {
    mockClient.audio.transcriptions.create.mockResolvedValue({ text: '   ' });

    await expect(assessMissionVoiceTurn(validMissionInput())).resolves.toEqual({
      outcome: 'could_not_assess',
      reason: 'missing_speech',
      feedback: 'No speech was detected. Please try recording again.',
    });
    expect(mockClient.responses.create).not.toHaveBeenCalled();
  });

  it('returns could not assess instead of retry for a low-confidence result', async () => {
    mockClient.responses.create.mockResolvedValue({
      output_text: JSON.stringify({
        accepted: false,
        confidence: 'low',
        feedback: 'The result was too ambiguous to assess.',
      }),
    });

    await expect(assessMissionVoiceTurn(validMissionInput())).resolves.toEqual({
      outcome: 'could_not_assess',
      reason: 'low_confidence',
      transcript: 'ラーメンをお願いします',
      feedback: 'The result was too ambiguous to assess.',
    });
  });

  it('returns could not assess when transcription fails', async () => {
    mockClient.audio.transcriptions.create.mockRejectedValue(new Error('provider failed'));

    await expect(assessMissionVoiceTurn(validMissionInput())).resolves.toEqual({
      outcome: 'could_not_assess',
      reason: 'transcription_failed',
      feedback: 'The recording could not be transcribed. Please try again.',
    });
    expect(mockClient.responses.create).not.toHaveBeenCalled();
  });

  it('rejects unsupported audio before any provider call', async () => {
    const input = validMissionInput();
    input.audio = new File(['not-audio'], 'answer.txt', { type: 'text/plain' });

    await expect(assessMissionVoiceTurn(input)).resolves.toEqual({
      outcome: 'could_not_assess',
      reason: 'invalid_audio',
      feedback: 'The recording format could not be assessed. Please record again.',
    });
    expect(mockGetOpenAiClient).not.toHaveBeenCalled();
  });

  it('returns could not assess when semantic assessment fails', async () => {
    mockClient.responses.create.mockRejectedValue(new Error('provider failed'));

    await expect(assessMissionVoiceTurn(validMissionInput())).resolves.toEqual({
      outcome: 'could_not_assess',
      reason: 'assessment_failed',
      transcript: 'ラーメンをお願いします',
      feedback: 'The response could not be assessed reliably. Please try again.',
    });
  });

  it('returns could not assess when semantic assessment fields are malformed', async () => {
    mockClient.responses.create.mockResolvedValue({
      output_text: JSON.stringify({
        accepted: 'true',
        confidence: 'high',
        feedback: 'Malformed provider response.',
      }),
    });

    await expect(assessMissionVoiceTurn(validMissionInput())).resolves.toEqual({
      outcome: 'could_not_assess',
      reason: 'assessment_failed',
      transcript: 'ラーメンをお願いします',
      feedback: 'The response could not be assessed reliably. Please try again.',
    });
  });
});
