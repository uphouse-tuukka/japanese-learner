import type OpenAI from 'openai';
import { config } from '$lib/server/config';
import { getOpenAiClient } from '$lib/server/openai-client';
import { recordUsageEvent } from '$lib/server/token-limiter';

const TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';
const GRADING_MODEL = 'gpt-4.1';
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

const SUPPORTED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/m4a',
  'audio/x-m4a',
]);

const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  'webm',
  'mp4',
  'mpeg',
  'mpga',
  'mp3',
  'm4a',
  'ogg',
  'wav',
  'flac',
]);

export type SpeakingResponseKind = 'situational_response' | 'translation_en_to_ja';

export type SpeakingCheckInput = {
  userId: string;
  audio: File;
  prompt: string;
  responseKind: SpeakingResponseKind;
  expectedAnswer: string;
  expectedRomaji: string;
  acceptedAnswers: string[];
  rubric: string;
};

export type SpeakingCheckResult = {
  transcript: string;
  correct: boolean;
  confidence: 'high' | 'medium' | 'low';
  feedback?: string;
};

export type SpeakingCheckErrorCode =
  | 'audio_too_large'
  | 'unsupported_audio_type'
  | 'empty_transcript'
  | 'invalid_input';

export class SpeakingCheckError extends Error {
  constructor(
    message: string,
    public readonly code: SpeakingCheckErrorCode,
  ) {
    super(message);
    this.name = 'SpeakingCheckError';
  }
}

type TokenUsageLike = {
  input_tokens?: unknown;
  output_tokens?: unknown;
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  total_tokens?: unknown;
  seconds?: unknown;
  duration?: unknown;
};

function getClient(): OpenAI {
  return getOpenAiClient({
    scope: 'speaking-checker',
    apiKey: config.openai.apiKey,
    missingApiKeyMessage: '[speaking-checker] Missing OpenAI API key in config.openai.apiKey',
  });
}

function fileExtension(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match?.[1]?.toLowerCase() ?? '';
}

function hasSupportedAudioType(audio: File): boolean {
  const mimeType = audio.type.toLowerCase().split(';', 1)[0]?.trim() ?? '';
  const extension = fileExtension(audio.name);
  return SUPPORTED_AUDIO_TYPES.has(mimeType) || SUPPORTED_AUDIO_EXTENSIONS.has(extension);
}

function validateAudio(audio: File): void {
  if (audio.size > MAX_AUDIO_BYTES) {
    throw new SpeakingCheckError(
      'Audio file is too large. Please record a shorter answer.',
      'audio_too_large',
    );
  }

  if (!hasSupportedAudioType(audio)) {
    throw new SpeakingCheckError(
      'Unsupported audio format. Please try recording again in the browser.',
      'unsupported_audio_type',
    );
  }
}

function toTokenCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

function extractTokenUsage(usage: TokenUsageLike | null | undefined): {
  tokensIn: number;
  tokensOut: number;
} | null {
  if (!usage) return null;

  const inputTokens = toTokenCount(usage.input_tokens ?? usage.prompt_tokens);
  const outputTokens = toTokenCount(usage.output_tokens ?? usage.completion_tokens);
  if (inputTokens !== null || outputTokens !== null) {
    return {
      tokensIn: inputTokens ?? 0,
      tokensOut: outputTokens ?? 0,
    };
  }

  const totalTokens = toTokenCount(usage.total_tokens);
  if (totalTokens !== null) {
    return {
      tokensIn: totalTokens,
      tokensOut: 0,
    };
  }

  return null;
}

async function recordTokenUsageIfPresent(input: {
  userId: string;
  model: string;
  usage: TokenUsageLike | null | undefined;
}): Promise<void> {
  const tokens = extractTokenUsage(input.usage);
  if (!tokens) {
    const duration = input.usage?.seconds ?? input.usage?.duration;
    if (duration !== undefined) {
      console.warn('[speaking-checker] transcription duration usage returned without tokens', {
        userId: input.userId,
        model: input.model,
        duration,
      });
    }
    return;
  }

  await recordUsageEvent({
    userId: input.userId,
    model: input.model,
    tokensIn: tokens.tokensIn,
    tokensOut: tokens.tokensOut,
  });
}

function buildGradingPrompt(input: SpeakingCheckInput, transcript: string): string {
  return [
    `Prompt: ${input.prompt}`,
    `Response kind: ${input.responseKind}`,
    `Expected Japanese answer: ${input.expectedAnswer}`,
    `Expected romaji: ${input.expectedRomaji}`,
    input.acceptedAnswers.length > 0
      ? `Accepted alternatives: ${input.acceptedAnswers.join('; ')}`
      : '',
    `Rubric: ${input.rubric}`,
    `Transcript: ${transcript}`,
    '',
    'Is the transcript semantically correct for the speaking exercise?',
    'Grade semantic correctness and communicative intent. Do not grade pronunciation, accent, or exact wording.',
    'Reply JSON only: {"correct":true/false,"confidence":"high"/"medium"/"low","feedback":"short learner-facing feedback"}',
  ]
    .filter(Boolean)
    .join('\n');
}

function parseConfidence(value: unknown): 'high' | 'medium' | 'low' {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'medium';
}

function parseFeedback(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, 300) : undefined;
}

async function transcribeAudio(client: OpenAI, input: SpeakingCheckInput): Promise<string> {
  const response = await client.audio.transcriptions.create({
    file: input.audio,
    model: TRANSCRIPTION_MODEL,
    language: 'ja',
    response_format: 'json',
  });

  await recordTokenUsageIfPresent({
    userId: input.userId,
    model: TRANSCRIPTION_MODEL,
    usage: (response as { usage?: TokenUsageLike }).usage,
  });

  const transcript = typeof response.text === 'string' ? response.text.trim() : '';
  if (!transcript) {
    throw new SpeakingCheckError(
      'No speech was detected. Please try recording again closer to the microphone.',
      'empty_transcript',
    );
  }

  return transcript;
}

async function gradeTranscript(
  client: OpenAI,
  input: SpeakingCheckInput,
  transcript: string,
): Promise<Omit<SpeakingCheckResult, 'transcript'>> {
  const response = await client.responses.create({
    model: GRADING_MODEL,
    temperature: 0,
    input: [
      {
        role: 'system',
        content:
          'You evaluate Japanese speaking exercise transcripts. Be fair and concise. Reply ONLY with JSON.',
      },
      {
        role: 'user',
        content: buildGradingPrompt(input, transcript),
      },
    ],
    text: {
      format: {
        type: 'json_object',
      },
    },
  });

  await recordTokenUsageIfPresent({
    userId: input.userId,
    model: GRADING_MODEL,
    usage: response.usage,
  });

  try {
    const parsed = JSON.parse(response.output_text) as Record<string, unknown>;
    return {
      correct: parsed.correct === true,
      confidence: parseConfidence(parsed.confidence),
      feedback: parseFeedback(parsed.feedback),
    };
  } catch {
    console.warn('[speaking-checker] Failed to parse grading response, defaulting to incorrect', {
      userId: input.userId,
      model: GRADING_MODEL,
    });
    return {
      correct: false,
      confidence: 'low',
      feedback: 'I could not grade that reliably. Please try again.',
    };
  }
}

export async function checkSpeakingAnswer(input: SpeakingCheckInput): Promise<SpeakingCheckResult> {
  const userId = input.userId.trim();
  if (!userId) {
    throw new SpeakingCheckError('User id is required.', 'invalid_input');
  }

  validateAudio(input.audio);

  const client = getClient();
  console.warn('[speaking-checker] checking speaking answer', {
    userId,
    mimeType: input.audio.type,
    byteSize: input.audio.size,
    transcriptionModel: TRANSCRIPTION_MODEL,
    gradingModel: GRADING_MODEL,
  });

  const normalizedInput = {
    ...input,
    userId,
    acceptedAnswers: input.acceptedAnswers.map((answer) => answer.trim()).filter(Boolean),
  };

  const transcript = await transcribeAudio(client, normalizedInput);
  const grade = await gradeTranscript(client, normalizedInput, transcript);

  return {
    transcript,
    ...grade,
  };
}
