import type OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { config } from '$lib/config';
import { SESSION_MODEL } from '$lib/server/ai-models';
import {
  assertString,
  normalizeExercise,
  normalizeLesson,
  normalizePublicChallengeExercise,
  normalizePublicChallengeLesson,
  validateExerciseSet,
} from '$lib/server/ai-session-normalizers';
import { buildPublicChallengePrompt } from '$lib/server/ai-session-prompts';
import { logInfo, logWarn } from '$lib/server/logger';
import { getOpenAiClient as getCachedOpenAiClient } from '$lib/server/openai-client';
import type { Exercise, SessionPlan } from '$lib/types';

function nowIso(): string {
  return new Date().toISOString();
}

function getOpenAiClient(): OpenAI {
  return getCachedOpenAiClient({
    scope: 'ai',
    apiKey: config.openai.apiKey,
    missingApiKeyMessage: '[ai] Missing OpenAI API key in config.openai.apiKey',
  });
}

function getUsageFromResponse(response: OpenAI.Responses.Response): {
  model: string;
  input: number;
  output: number;
  total: number;
} {
  const usage = response.usage;
  const input = Number(usage?.input_tokens ?? 0);
  const output = Number(usage?.output_tokens ?? 0);
  const total = Number(usage?.total_tokens ?? input + output);
  return {
    model: SESSION_MODEL,
    input,
    output,
    total,
  };
}

export async function generatePublicChallengePlan(input: {
  scenario: string;
  scenarioLabel: string;
  targetExerciseCount: number;
}): Promise<SessionPlan> {
  logInfo('ai', 'generating public challenge plan', {
    scenario: input.scenario,
    targetExerciseCount: input.targetExerciseCount,
  });

  const client = getOpenAiClient();
  const publicChallengePrompt = buildPublicChallengePrompt(input);
  const { targetExerciseCount } = publicChallengePrompt;

  const response = await client.responses.create({
    model: SESSION_MODEL,
    temperature: 0.3,
    input: publicChallengePrompt.messages,
    text: {
      format: {
        type: 'json_object',
      },
    },
  });

  if (!response.output_text) {
    throw new Error('[ai] OpenAI response missing output_text for public challenge generation');
  }

  const parsed = JSON.parse(response.output_text) as {
    lesson: unknown;
    exercises: unknown[];
    focus: string;
  };

  const lesson = normalizePublicChallengeLesson(normalizeLesson(parsed.lesson));
  const validExercises: Exercise[] = [];
  const rawExercises = Array.isArray(parsed.exercises) ? parsed.exercises : [];
  for (let i = 0; i < rawExercises.length; i += 1) {
    try {
      validExercises.push(
        normalizePublicChallengeExercise(normalizeExercise(rawExercises[i], i, 'beginner')),
      );
    } catch (err) {
      logWarn('ai', 'skipping invalid public challenge exercise', {
        exerciseIndex: i,
        errorType: err instanceof Error ? err.name : typeof err,
      });
    }
  }
  if (validExercises.length === 0) {
    throw new Error('[ai] No valid exercises could be parsed from public challenge output');
  }

  const exercises = validateExerciseSet(validExercises, 'beginner');
  const minExercises = Math.ceil(targetExerciseCount / 2);
  if (exercises.length < minExercises) {
    throw new Error(
      `[ai] expected at least ${minExercises} exercises, received ${exercises.length}`,
    );
  }

  const usage = getUsageFromResponse(response);
  const parsedLesson = parsed.lesson as Record<string, unknown> | null;

  return {
    id: `session-${randomUUID()}`,
    userId: 'portfolio-visitor',
    mode: 'ai',
    createdAt: nowIso(),
    model: SESSION_MODEL,
    lesson,
    exercises,
    tokenUsage: {
      input: usage.input,
      output: usage.output,
    },
    metadata: {
      focus: assertString(parsed.focus, 'focus'),
      category: typeof parsedLesson?.category === 'string' ? parsedLesson.category : input.scenario,
      exerciseCount: exercises.length,
      teachingFlow: 'lesson_then_quiz',
      userLevel: 'beginner',
      scenario: input.scenario,
      scenarioLabel: input.scenarioLabel,
    },
  };
}
