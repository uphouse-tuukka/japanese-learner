import OpenAI from 'openai';
import { config } from '$lib/server/config';
import { recordUsageEvent } from '$lib/server/token-limiter';

const CHECKER_MODEL = 'gpt-4.1';

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = config.openai.apiKey.trim();
  if (!apiKey) {
    throw new Error('[answer-checker] Missing OpenAI API key');
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export interface AnswerCheckInput {
  expectedAnswer: string;
  acceptedAnswers: string[];
  userAnswer: string;
  exerciseType: string;
  userId: string;
}

export interface AnswerCheckResult {
  correct: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export async function checkAnswerWithAI(input: AnswerCheckInput): Promise<AnswerCheckResult> {
  const client = getClient();

  const prompt = [
    `Exercise: ${input.exerciseType}`,
    `Expected: ${input.expectedAnswer}`,
    input.acceptedAnswers.length > 0 ? `Also accepted: ${input.acceptedAnswers.join('; ')}` : '',
    `Student wrote: ${input.userAnswer}`,
    '',
    "Is the student's answer semantically correct? Consider meaning, not exact wording.",
    'Reply JSON only: {"correct":true/false,"confidence":"high"/"medium"/"low"}',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await client.responses.create({
    model: CHECKER_MODEL,
    temperature: 0,
    input: [
      {
        role: 'system',
        content:
          'You evaluate Japanese language exercise answers. Be lenient with minor spelling, particle, or formality differences. Reply ONLY with JSON.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    text: {
      format: {
        type: 'json_object',
      },
    },
  });

  const usage = response.usage;
  if (usage) {
    await recordUsageEvent({
      userId: input.userId,
      model: CHECKER_MODEL,
      tokensIn: usage.input_tokens ?? 0,
      tokensOut: usage.output_tokens ?? 0,
    });
  }

  try {
    const outputText = response.output_text;
    const parsed = JSON.parse(outputText);
    return {
      correct: parsed.correct === true,
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'medium',
    };
  } catch {
    console.warn('[answer-checker] Failed to parse AI response, defaulting to incorrect');
    return { correct: false, confidence: 'low' };
  }
}
