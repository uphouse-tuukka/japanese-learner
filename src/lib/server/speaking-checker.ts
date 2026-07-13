import {
  assessJapaneseTranscript,
  transcribeJapaneseAudio,
  VoiceAssessmentError,
} from '$lib/server/voice-assessment';

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

function asSpeakingCheckError(error: VoiceAssessmentError): SpeakingCheckError | null {
  if (
    error.code === 'audio_too_large' ||
    error.code === 'unsupported_audio_type' ||
    error.code === 'empty_transcript'
  ) {
    return new SpeakingCheckError(error.message, error.code);
  }
  return null;
}

export async function checkSpeakingAnswer(input: SpeakingCheckInput): Promise<SpeakingCheckResult> {
  const userId = input.userId.trim();
  if (!userId) {
    throw new SpeakingCheckError('User id is required.', 'invalid_input');
  }

  const acceptedAnswers = [input.expectedAnswer, input.expectedRomaji, ...input.acceptedAnswers]
    .map((answer) => answer.trim())
    .filter(Boolean);
  const goal = `${input.prompt}\nResponse kind: ${input.responseKind}`;

  let transcript: string;
  try {
    transcript = await transcribeJapaneseAudio({
      userId,
      audio: input.audio,
      goal,
      alternatives: acceptedAnswers,
    });
  } catch (error) {
    if (error instanceof VoiceAssessmentError) {
      const speakingError = asSpeakingCheckError(error);
      if (speakingError) throw speakingError;
    }
    throw error;
  }

  let assessment;
  try {
    assessment = await assessJapaneseTranscript({
      userId,
      transcript,
      goal,
      alternatives: acceptedAnswers,
      rubric: input.rubric,
    });
  } catch (error) {
    if (error instanceof VoiceAssessmentError && error.code === 'invalid_assessment_response') {
      return {
        transcript,
        correct: false,
        confidence: 'low',
        feedback: 'I could not grade that reliably. Please try again.',
      };
    }
    throw error;
  }

  return {
    transcript,
    correct: assessment.accepted,
    confidence: assessment.confidence,
    feedback: assessment.feedback,
  };
}
