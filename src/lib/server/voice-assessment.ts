import type OpenAI from 'openai';
import { config } from '$lib/server/config';
import { logInfo, logWarn } from '$lib/server/logger';
import { getOpenAiClient } from '$lib/server/openai-client';
import { recordUsageEvent } from '$lib/server/token-limiter';

const TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';
const ASSESSMENT_MODEL = 'gpt-4.1';
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

type TokenUsageLike = {
  input_tokens?: unknown;
  output_tokens?: unknown;
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  total_tokens?: unknown;
  seconds?: unknown;
  duration?: unknown;
};

export type AssessmentConfidence = 'high' | 'medium' | 'low';

export type VoiceAssessmentCriteria = {
  goal: string;
  alternatives: string[];
  rubric: string;
};

export type JapaneseTranscriptionInput = Omit<VoiceAssessmentCriteria, 'rubric'> & {
  userId: string;
  audio: File;
};

export type JapaneseTranscriptAssessmentInput = VoiceAssessmentCriteria & {
  userId: string;
  transcript: string;
};

export type JapaneseTranscriptAssessment = {
  accepted: boolean;
  confidence: AssessmentConfidence;
  feedback?: string;
};

export type MissionVoiceAssessmentInput = VoiceAssessmentCriteria & {
  userId: string;
  audio: File;
};

export type MissionVoiceAssessmentResult =
  | {
      outcome: 'accepted' | 'retry';
      transcript: string;
      confidence: 'high' | 'medium';
      feedback?: string;
    }
  | {
      outcome: 'could_not_assess';
      reason:
        | 'invalid_audio'
        | 'missing_speech'
        | 'transcription_failed'
        | 'low_confidence'
        | 'assessment_failed';
      transcript?: string;
      feedback: string;
    };

export type VoiceAssessmentErrorCode =
  | 'audio_too_large'
  | 'unsupported_audio_type'
  | 'empty_transcript'
  | 'transcription_failed'
  | 'assessment_failed'
  | 'invalid_assessment_response';

export class VoiceAssessmentError extends Error {
  constructor(
    message: string,
    public readonly code: VoiceAssessmentErrorCode,
  ) {
    super(message);
    this.name = 'VoiceAssessmentError';
  }
}

function getClient(): OpenAI {
  return getOpenAiClient({
    scope: 'voice-assessment',
    apiKey: config.openai.apiKey,
    missingApiKeyMessage: '[voice-assessment] Missing OpenAI API key in config.openai.apiKey',
  });
}

function fileExtension(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match?.[1]?.toLowerCase() ?? '';
}

export function validateVoiceAudio(audio: File): void {
  if (audio.size > MAX_AUDIO_BYTES) {
    throw new VoiceAssessmentError(
      'Audio file is too large. Please record a shorter answer.',
      'audio_too_large',
    );
  }

  const mimeType = audio.type.toLowerCase().split(';', 1)[0]?.trim() ?? '';
  if (
    !SUPPORTED_AUDIO_TYPES.has(mimeType) &&
    !SUPPORTED_AUDIO_EXTENSIONS.has(fileExtension(audio.name))
  ) {
    throw new VoiceAssessmentError(
      'Unsupported audio format. Please try recording again.',
      'unsupported_audio_type',
    );
  }
}

function compactPromptValue(value: string, maxLength = 160): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function compactAlternatives(alternatives: string[]): string[] {
  return alternatives
    .map((alternative) => compactPromptValue(alternative, 80))
    .filter(Boolean)
    .slice(0, 10);
}

function buildTranscriptionPrompt(input: JapaneseTranscriptionInput): string {
  const alternatives = compactAlternatives(input.alternatives).slice(0, 5).join('; ');
  return [
    'Japanese learner speaking practice.',
    `Communicative goal: ${compactPromptValue(input.goal)}`,
    alternatives ? `Possible successful responses: ${alternatives}` : '',
    'Use this context only to resolve close or ambiguous Japanese speech from a non-native learner.',
    'Transcribe the actual speech in Japanese. Do not invent or correct the answer if the audio is clearly different.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildAssessmentPrompt(input: JapaneseTranscriptAssessmentInput): string {
  return [
    `Goal: ${input.goal}`,
    input.alternatives.length > 0 ? `Accepted alternatives: ${input.alternatives.join('; ')}` : '',
    `Rubric: ${input.rubric}`,
    `Transcript: ${input.transcript}`,
    '',
    'This is an automatic speech recognition transcript from a non-native learner; it may contain small recognition errors when the spoken answer was close.',
    'Did the learner accomplish the communicative goal?',
    'Decide whether the transcript is semantically correct for that goal.',
    'Grade semantic correctness and communicative intent. Do not grade pronunciation, accent, pitch accent, native-likeness, or exact wording.',
    'Accept minor particle, kana/kanji, spacing, formality, and clipped-politeness differences when the same communicative intent remains.',
    'If the transcript is close to an accepted response and has no contradictory meaning, accept it with medium or low confidence rather than requiring exact wording.',
    'Do not accept a transcript whose core meaning changes: wrong objects, wrong actions, negation errors, or unrelated phrases.',
    'Reply JSON only: {"accepted":true/false,"confidence":"high"/"medium"/"low","feedback":"short learner-facing feedback in English"}',
  ]
    .filter(Boolean)
    .join('\n');
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
    return { tokensIn: inputTokens ?? 0, tokensOut: outputTokens ?? 0 };
  }

  const totalTokens = toTokenCount(usage.total_tokens);
  return totalTokens === null ? null : { tokensIn: totalTokens, tokensOut: 0 };
}

async function recordTokenUsageIfPresent(input: {
  userId: string;
  model: string;
  usage: TokenUsageLike | null | undefined;
}): Promise<void> {
  const tokens = extractTokenUsage(input.usage);
  if (tokens) {
    await recordUsageEvent({
      userId: input.userId,
      model: input.model,
      tokensIn: tokens.tokensIn,
      tokensOut: tokens.tokensOut,
    });
    return;
  }

  const duration = input.usage?.seconds ?? input.usage?.duration;
  if (duration !== undefined) {
    logInfo('voice-assessment', 'duration usage returned without tokens', {
      userId: input.userId,
      model: input.model,
      duration,
    });
  }
}

function isAssessmentConfidence(value: unknown): value is AssessmentConfidence {
  return value === 'high' || value === 'medium' || value === 'low';
}

function parseFeedback(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, 300) : undefined;
}

export async function transcribeJapaneseAudio(input: JapaneseTranscriptionInput): Promise<string> {
  validateVoiceAudio(input.audio);
  const client = getClient();
  logInfo('voice-assessment', 'transcribing Japanese audio', {
    userId: input.userId,
    mimeType: input.audio.type,
    byteSize: input.audio.size,
    model: TRANSCRIPTION_MODEL,
  });

  let response;
  try {
    response = await client.audio.transcriptions.create({
      file: input.audio,
      model: TRANSCRIPTION_MODEL,
      language: 'ja',
      response_format: 'json',
      prompt: buildTranscriptionPrompt(input),
    });
  } catch (error) {
    logWarn('voice-assessment', 'transcription failed', {
      error,
      userId: input.userId,
      mimeType: input.audio.type,
      byteSize: input.audio.size,
      model: TRANSCRIPTION_MODEL,
    });
    throw new VoiceAssessmentError(
      'The recording could not be transcribed. Please try again.',
      'transcription_failed',
    );
  }

  await recordTokenUsageIfPresent({
    userId: input.userId,
    model: TRANSCRIPTION_MODEL,
    usage: response.usage,
  });

  const transcript = typeof response.text === 'string' ? response.text.trim() : '';
  if (!transcript) {
    throw new VoiceAssessmentError(
      'No speech was detected. Please try recording again.',
      'empty_transcript',
    );
  }

  return transcript;
}

export async function assessJapaneseTranscript(
  input: JapaneseTranscriptAssessmentInput,
): Promise<JapaneseTranscriptAssessment> {
  const client = getClient();
  let response;
  try {
    response = await client.responses.create({
      model: ASSESSMENT_MODEL,
      temperature: 0,
      input: [
        {
          role: 'system',
          content:
            'You evaluate Japanese learner transcripts against communicative goals. Be fair and concise. Be encouraging without accepting clearly wrong answers. The learner-facing feedback field must be in English. Reply only with JSON.',
        },
        {
          role: 'user',
          content: buildAssessmentPrompt(input),
        },
      ],
      text: { format: { type: 'json_object' } },
    });
  } catch (error) {
    logWarn('voice-assessment', 'semantic assessment failed', {
      error,
      userId: input.userId,
      model: ASSESSMENT_MODEL,
    });
    throw new VoiceAssessmentError(
      'The response could not be assessed reliably. Please try again.',
      'assessment_failed',
    );
  }

  await recordTokenUsageIfPresent({
    userId: input.userId,
    model: ASSESSMENT_MODEL,
    usage: response.usage,
  });

  try {
    const parsed = JSON.parse(response.output_text) as Record<string, unknown>;
    const accepted = typeof parsed.accepted === 'boolean' ? parsed.accepted : parsed.correct;
    if (typeof accepted !== 'boolean' || !isAssessmentConfidence(parsed.confidence)) {
      throw new Error('Invalid semantic assessment fields.');
    }
    return {
      accepted,
      confidence: parsed.confidence,
      feedback: parseFeedback(parsed.feedback),
    };
  } catch (error) {
    logWarn('voice-assessment', 'semantic assessment response was invalid', {
      error,
      userId: input.userId,
      model: ASSESSMENT_MODEL,
    });
    throw new VoiceAssessmentError(
      'The response could not be assessed reliably. Please try again.',
      'invalid_assessment_response',
    );
  }
}

export async function assessMissionVoiceTurn(
  input: MissionVoiceAssessmentInput,
): Promise<MissionVoiceAssessmentResult> {
  let transcript: string;
  try {
    transcript = await transcribeJapaneseAudio(input);
  } catch (error) {
    if (!(error instanceof VoiceAssessmentError)) throw error;
    if (error.code === 'audio_too_large' || error.code === 'unsupported_audio_type') {
      return {
        outcome: 'could_not_assess',
        reason: 'invalid_audio',
        feedback: 'The recording format could not be assessed. Please record again.',
      };
    }
    if (error.code === 'empty_transcript') {
      return {
        outcome: 'could_not_assess',
        reason: 'missing_speech',
        feedback: 'No speech was detected. Please try recording again.',
      };
    }
    return {
      outcome: 'could_not_assess',
      reason: 'transcription_failed',
      feedback: 'The recording could not be transcribed. Please try again.',
    };
  }

  let assessment: JapaneseTranscriptAssessment;
  try {
    assessment = await assessJapaneseTranscript({
      userId: input.userId,
      transcript,
      goal: input.goal,
      alternatives: input.alternatives,
      rubric: input.rubric,
    });
  } catch (error) {
    if (
      !(error instanceof VoiceAssessmentError) ||
      (error.code !== 'assessment_failed' && error.code !== 'invalid_assessment_response')
    ) {
      throw error;
    }
    return {
      outcome: 'could_not_assess',
      reason: 'assessment_failed',
      transcript,
      feedback: 'The response could not be assessed reliably. Please try again.',
    };
  }

  if (assessment.confidence === 'low') {
    return {
      outcome: 'could_not_assess',
      reason: 'low_confidence',
      transcript,
      feedback: assessment.feedback ?? 'The result was too ambiguous to assess. Please try again.',
    };
  }

  return {
    outcome: assessment.accepted ? 'accepted' : 'retry',
    transcript,
    confidence: assessment.confidence,
    feedback: assessment.feedback,
  };
}
