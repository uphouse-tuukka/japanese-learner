import OpenAI from 'openai';
import { createHmac } from 'crypto';
import { randomUUID } from 'node:crypto';
import { config } from '$lib/config';
import { getAuthSecret } from '$lib/server/auth';
import {
  cleanupExpiredPortfolioAttempts,
  completePortfolioAttempt,
  countRecentAttemptsByCookie,
  countRecentAttemptsByIp,
  recordPortfolioAttempt,
} from '$lib/server/db';
import { signChallengeToken, verifyChallengeToken } from '$lib/server/signed-token';

const PORTFOLIO_MODEL = 'gpt-5.4';
const MAX_MODEL_CALLS = 3;
const MAX_TOKEN_BUDGET = 5_000;
const TIMEOUT_MS = 45_000;
const ANSWER_WINDOW_MS = 5 * 60 * 1_000;
const MAX_ATTEMPTS_PER_IP_24H = 3;
const MAX_ATTEMPTS_PER_COOKIE_24H = 1;

const TRAVEL_TOPICS = [
  'Greetings & Basics',
  'Food & Dining',
  'Transport',
  'Shopping',
  'Directions',
  'Hotel & Accommodation',
  'Social & Conversation',
  'Sightseeing & Culture',
] as const;

type GeneratedChallenge = {
  challengeId: string;
  question: string;
  choices: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
  difficulty: number;
  prompt: string;
  tokensUsed: { input: number; output: number; total: number };
};

export type PortfolioChallengeQuestion = {
  challengeId: string;
  question: string;
  choices: string[];
  topic: string;
  difficulty: number;
};

export type StartChallengeResult =
  | {
      ok: true;
      challenge: PortfolioChallengeQuestion;
      token: string;
      attemptId: string;
    }
  | {
      ok: false;
      reason: 'quota_exceeded' | 'generation_failed' | 'timeout';
      message: string;
    };

export type SubmitChallengeResult =
  | {
      ok: true;
      correct: boolean;
      correctAnswer: string;
      explanation: string;
      builderView: {
        prompt: string;
        choices: string[];
        correctAnswer: string;
        explanation: string;
        note: string;
      };
    }
  | {
      ok: false;
      reason: 'invalid_token' | 'expired' | 'tampered' | 'already_submitted';
      message: string;
    };

let openaiClient: OpenAI | null = null;

function getOpenAiClient(): OpenAI {
  const apiKey = config.openai.apiKey.trim();
  if (!apiKey) {
    throw new Error('[portfolio-challenge] Missing OpenAI API key in config.openai.apiKey');
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function hashIp(ip: string): string {
  return createHmac('sha256', getAuthSecret()).update(ip).digest('hex');
}

function since24h(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
}

function pickRandomTopic(): string {
  return TRAVEL_TOPICS[Math.floor(Math.random() * TRAVEL_TOPICS.length)];
}

function hasJapanese(value: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(value);
}

function hasRomajiParentheses(value: string): boolean {
  return /\([^()]+\)/.test(value);
}

function validateGeneratedPayload(payload: unknown): {
  question: string;
  choices: string[];
  correctAnswer: string;
  explanation: string;
} {
  if (!payload || typeof payload !== 'object') {
    throw new Error('[portfolio-challenge] Model output is not an object');
  }

  const row = payload as Record<string, unknown>;
  const question = typeof row.question === 'string' ? row.question.trim() : '';
  const explanation = typeof row.explanation === 'string' ? row.explanation.trim() : '';
  const correctAnswer = typeof row.correctAnswer === 'string' ? row.correctAnswer.trim() : '';
  const choices = Array.isArray(row.choices)
    ? row.choices
        .map((choice) => (typeof choice === 'string' ? choice.trim() : ''))
        .filter((choice) => Boolean(choice))
    : [];

  if (!question) {
    throw new Error('[portfolio-challenge] Invalid model output: missing question');
  }
  if (choices.length !== 4) {
    throw new Error(
      '[portfolio-challenge] Invalid model output: choices must contain exactly 4 items',
    );
  }
  if (!correctAnswer || !choices.includes(correctAnswer)) {
    throw new Error(
      '[portfolio-challenge] Invalid model output: correctAnswer must match one choice',
    );
  }
  if (!explanation) {
    throw new Error('[portfolio-challenge] Invalid model output: missing explanation');
  }
  if (hasJapanese(question) && !hasRomajiParentheses(question)) {
    throw new Error(
      '[portfolio-challenge] Invalid model output: question has Japanese without romaji',
    );
  }
  for (const choice of choices) {
    if (hasJapanese(choice) && !hasRomajiParentheses(choice)) {
      throw new Error(
        '[portfolio-challenge] Invalid model output: choice has Japanese without romaji',
      );
    }
  }

  return { question, choices, correctAnswer, explanation };
}

async function generatePortfolioChallenge(signal?: AbortSignal): Promise<GeneratedChallenge> {
  const client = getOpenAiClient();
  const topic = pickRandomTopic();
  const challengeId = randomUUID();

  const systemPrompt = [
    'You are creating ONE portfolio challenge for travel Japanese learners.',
    'Audience: absolute beginner.',
    'Return valid JSON only with keys: question, choices, correctAnswer, explanation, japanese, romaji.',
    `Topic: ${topic}.`,
    'Create exactly 4 multiple-choice options in choices.',
    'The question must be self-contained and include Japanese text inline with romaji in parentheses.',
    'If any choice contains Japanese script, include romaji in parentheses in that same choice.',
    'Keep language practical for real travel situations in Japan.',
    'Do not include markdown or extra keys.',
  ].join(' ');

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_MODEL_CALLS; attempt += 1) {
    try {
      const response = await client.responses.create(
        {
          model: PORTFOLIO_MODEL,
          temperature: 0.7,
          input: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content:
                'Generate one beginner-friendly travel Japanese multiple-choice question now as JSON.',
            },
          ],
          text: {
            format: {
              type: 'json_object',
            },
          },
        },
        { signal },
      );

      const inputTokens = Number(response.usage?.input_tokens ?? 0);
      const outputTokens = Number(response.usage?.output_tokens ?? 0);
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      const totalTokens = totalInputTokens + totalOutputTokens;

      if (totalTokens > MAX_TOKEN_BUDGET) {
        throw new Error('[portfolio-challenge] Model token budget exceeded');
      }

      if (!response.output_text) {
        throw new Error('[portfolio-challenge] OpenAI response missing output_text');
      }

      const parsed = JSON.parse(response.output_text) as unknown;
      const validated = validateGeneratedPayload(parsed);

      return {
        challengeId,
        question: validated.question,
        choices: validated.choices,
        correctAnswer: validated.correctAnswer,
        explanation: validated.explanation,
        topic,
        difficulty: 1,
        prompt: systemPrompt,
        tokensUsed: {
          input: totalInputTokens,
          output: totalOutputTokens,
          total: totalTokens,
        },
      };
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }

      lastError = error as Error;
      console.warn('[portfolio-challenge] Generation attempt failed', {
        attempt,
        topic,
        error: lastError.message,
      });
    }
  }

  throw lastError ?? new Error('[portfolio-challenge] Failed to generate challenge');
}

function mapTokenReason(reason: string): {
  reason: 'invalid_token' | 'tampered' | 'expired';
  message: string;
} {
  if (reason === 'tampered') {
    return { reason: 'tampered', message: 'Challenge token was tampered with.' };
  }
  if (reason === 'expired') {
    return {
      reason: 'expired',
      message: 'Challenge token has expired. Please start a new challenge.',
    };
  }
  return { reason: 'invalid_token', message: 'Invalid challenge token.' };
}

export async function startChallenge(
  cookieId: string | undefined,
  ip: string,
): Promise<StartChallengeResult> {
  void cleanupExpiredPortfolioAttempts().catch(console.error);

  const ipHash = hashIp(ip);
  const since = since24h();

  const ipAttempts = await countRecentAttemptsByIp(ipHash, since);
  if (ipAttempts >= MAX_ATTEMPTS_PER_IP_24H) {
    return {
      ok: false,
      reason: 'quota_exceeded',
      message: 'Too many challenge starts from this IP. Please try again later.',
    };
  }

  if (cookieId) {
    const cookieAttempts = await countRecentAttemptsByCookie(cookieId, since);
    if (cookieAttempts >= MAX_ATTEMPTS_PER_COOKIE_24H) {
      return {
        ok: false,
        reason: 'quota_exceeded',
        message: 'You have already completed this challenge recently. Please try again later.',
      };
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('timeout'), TIMEOUT_MS);

  let generated: GeneratedChallenge;
  try {
    generated = await generatePortfolioChallenge(controller.signal);
  } catch (error) {
    clearTimeout(timeoutId);
    if (controller.signal.aborted) {
      console.warn('[portfolio-challenge] Challenge generation timed out');
      return {
        ok: false,
        reason: 'timeout',
        message: 'Challenge generation timed out. Please try again.',
      };
    }

    console.warn('[portfolio-challenge] Challenge generation failed', {
      error: (error as Error).message,
    });
    return {
      ok: false,
      reason: 'generation_failed',
      message: 'Could not generate a challenge right now. Please try again.',
    };
  } finally {
    clearTimeout(timeoutId);
  }

  const expiresAtMs = Date.now() + ANSWER_WINDOW_MS;
  const token = signChallengeToken({
    challengeId: generated.challengeId,
    expiresAt: expiresAtMs,
    correctAnswer: generated.correctAnswer,
    explanation: generated.explanation,
    builderView: {
      prompt: generated.prompt,
      choices: generated.choices,
      correctAnswer: generated.correctAnswer,
      explanation: generated.explanation,
      note: 'Portfolio challenge capsule generation snapshot.',
    },
  });

  const attempt = await recordPortfolioAttempt({
    cookieId: cookieId ?? `anon-${ipHash.slice(0, 12)}`,
    ipHash,
    expiresAt: new Date(expiresAtMs).toISOString(),
  });

  return {
    ok: true,
    challenge: {
      challengeId: generated.challengeId,
      question: generated.question,
      choices: generated.choices,
      topic: generated.topic,
      difficulty: generated.difficulty,
    },
    token,
    attemptId: attempt.id,
  };
}

export async function submitChallenge(
  token: string,
  selectedAnswer: string,
  attemptId: string,
): Promise<SubmitChallengeResult> {
  const verification = verifyChallengeToken(token);
  if (!verification.valid) {
    const mapped = mapTokenReason(verification.reason);
    return {
      ok: false,
      reason: mapped.reason,
      message: mapped.message,
    };
  }

  const { payload } = verification;
  const correct = selectedAnswer === payload.correctAnswer;
  await completePortfolioAttempt(attemptId);

  return {
    ok: true,
    correct,
    correctAnswer: payload.correctAnswer,
    explanation: payload.explanation,
    builderView: payload.builderView,
  };
}
