import type OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { config } from '$lib/config';
import { SESSION_MODEL } from '$lib/server/ai-models';
import {
  assertString,
  normalizeExercise,
  normalizeLesson,
  normalizeMiniLesson,
  toStringArray,
  validateExerciseSet,
} from '$lib/server/ai-session-normalizers';
import {
  buildSessionPlanPrompt,
  type SessionPlanPromptInput,
} from '$lib/server/ai-session-prompts';
import {
  buildSessionSummaryPrompt,
  buildUpdatedJournalPrompt,
} from '$lib/server/ai-summary-prompts';
import { logInfo, logWarn } from '$lib/server/logger';
import { getOpenAiClient as getCachedOpenAiClient } from '$lib/server/openai-client';
import { LEVEL_ORDER } from '$lib/types';
export { generatePublicChallengePlan } from '$lib/server/ai-public-challenge';
export { TOPIC_CATEGORIES, type TopicCategoryKey } from '$lib/server/ai-session-prompts';
import type { Exercise, SessionPlan, SessionSummary, TokenUsage, UserLevel } from '$lib/types';

function nowIso(): string {
  return new Date().toISOString();
}

const SESSION_SUMMARY_MAX_SENTENCES = 3;
const SESSION_SUMMARY_MAX_WORDS = 60;

function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?。！？]+[.!?。！？]+[”’"')\]]*|[^.!?。！？]+$/gu);
  return matches?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
}

export function normalizeSessionSummaryText(rawSummary: string): string {
  const normalized = rawSummary.replace(/\s+/gu, ' ').trim();
  if (!normalized) return normalized;

  const sentenceLimited = splitSentences(normalized)
    .slice(0, SESSION_SUMMARY_MAX_SENTENCES)
    .join(' ');
  const candidate = sentenceLimited || normalized;
  const words = candidate.split(/\s+/u);
  if (words.length <= SESSION_SUMMARY_MAX_WORDS) return candidate;

  const truncatedWords = words.slice(0, SESSION_SUMMARY_MAX_WORDS);
  const finalWord = truncatedWords[truncatedWords.length - 1] ?? '';
  truncatedWords[truncatedWords.length - 1] = finalWord.replace(/[.,;:!?。！？]*$/u, '') + '…';
  return truncatedWords.join(' ');
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

export async function generateSessionPlan(input: SessionPlanPromptInput): Promise<SessionPlan> {
  const client = getOpenAiClient();
  const sessionPrompt = buildSessionPlanPrompt(input);
  const { targetExerciseCount } = sessionPrompt;

  const response = await client.responses.create({
    model: SESSION_MODEL,
    temperature: 0.3,
    input: sessionPrompt.messages,
    text: {
      format: {
        type: 'json_object',
      },
    },
  });

  if (!response.output_text) {
    throw new Error('[ai] OpenAI response missing output_text for session generation');
  }

  const parsed = JSON.parse(response.output_text) as {
    lesson: unknown;
    exercises: unknown[];
    focus: string;
  };

  const lesson = normalizeLesson(parsed.lesson);
  const validExercises: Exercise[] = [];
  const rawExercises = Array.isArray(parsed.exercises) ? parsed.exercises : [];
  for (let i = 0; i < rawExercises.length; i += 1) {
    try {
      const exercise = normalizeExercise(rawExercises[i], i, input.userLevel);
      validateExerciseSet([exercise], input.userLevel);
      validExercises.push(exercise);
    } catch (err) {
      logWarn('ai', 'skipping invalid exercise', {
        exerciseIndex: i,
        userLevel: input.userLevel,
        errorType: err instanceof Error ? err.name : typeof err,
      });
    }
  }
  if (validExercises.length === 0) {
    throw new Error('[ai] No valid exercises could be parsed from model output');
  }
  const exercises = validateExerciseSet(validExercises, input.userLevel);

  const minExercises = Math.ceil(targetExerciseCount / 2);
  if (exercises.length < minExercises) {
    throw new Error(
      `[ai] expected at least ${minExercises} exercises, received ${exercises.length}`,
    );
  }

  const usage = getUsageFromResponse(response);
  const parsedLesson = parsed.lesson as Record<string, unknown> | null;

  const plan: SessionPlan = {
    id: `session-${randomUUID()}`,
    userId: input.userId,
    mode: 'ai',
    createdAt: nowIso(),
    model: usage.model,
    lesson,
    exercises,
    tokenUsage: {
      input: usage.input,
      output: usage.output,
    },
    metadata: {
      focus: assertString(parsed.focus, 'focus'),
      category: typeof parsedLesson?.category === 'string' ? parsedLesson.category : undefined,
      exerciseCount: exercises.length,
      teachingFlow: 'lesson_then_quiz',
      userLevel: input.userLevel,
    },
  };

  logInfo('ai', 'generated session plan', {
    sessionId: plan.id,
    userId: plan.userId,
    exerciseCount: plan.exercises.length,
    category: plan.metadata.category,
    userLevel: plan.metadata.userLevel,
    tokensInput: usage.input,
    tokensOutput: usage.output,
  });

  return plan;
}

export async function generateSessionSummary(input: {
  sessionId: string;
  userId: string;
  userLevel: UserLevel;
  japaneseWritingEnabled?: boolean;
  lessonTopic?: string;
  progressJournal?: string | null;
  suppressPromotion?: boolean;
  recentSessions?: Array<{
    topic: string;
    accuracy: number;
    keyPhrases: string[];
    exerciseTypes: string[];
  }>;
  exercises: Exercise[];
  results: Array<{
    exerciseId: string;
    answerText: string;
    isCorrect: boolean;
  }>;
}): Promise<{
  summary: SessionSummary;
  handoffNotes: string[];
  tokenUsage: Pick<TokenUsage, 'model' | 'tokensIn' | 'tokensOut' | 'tokensTotal'>;
}> {
  const client = getOpenAiClient();
  const sessionSummaryPrompt = buildSessionSummaryPrompt(input);
  const { accuracy } = sessionSummaryPrompt;

  const response = await client.responses.create({
    model: SESSION_MODEL,
    temperature: 0.2,
    input: sessionSummaryPrompt.messages,
    text: {
      format: {
        type: 'json_object',
      },
    },
  });

  if (!response.output_text) {
    throw new Error('[ai] OpenAI response missing output_text for summary generation');
  }

  const usage = getUsageFromResponse(response);
  logInfo('ai', 'received session summary response', {
    sessionId: input.sessionId,
    responseId: response.id,
    status: response.status,
    outputTextLength: response.output_text.length,
    tokensInput: usage.input,
    tokensOutput: usage.output,
  });

  const parsed = JSON.parse(response.output_text) as Record<string, unknown>;
  const pickFirst = (keys: string[]): unknown => {
    for (const key of keys) {
      if (key in parsed) {
        return parsed[key];
      }
    }
    return undefined;
  };

  const summaryText = normalizeSessionSummaryText(
    String(pickFirst(['summary', 'sessionSummary', 'session_summary', 'overview']) ?? ''),
  );

  const currentLevelIndex = LEVEL_ORDER.indexOf(input.userLevel);
  const nextLevel =
    currentLevelIndex >= 0 && currentLevelIndex < LEVEL_ORDER.length - 1
      ? LEVEL_ORDER[currentLevelIndex + 1]
      : null;
  const recommendationRaw = pickFirst([
    'levelUpRecommendation',
    'level_up_recommendation',
    'promotionRecommendation',
    'promotion_recommendation',
  ]);
  let levelUpRecommendation: SessionSummary['levelUpRecommendation'] = null;
  if (
    nextLevel &&
    input.userLevel !== 'ready_for_japan' &&
    recommendationRaw &&
    typeof recommendationRaw === 'object'
  ) {
    const candidate = recommendationRaw as Record<string, unknown>;
    const recommendedLevel = String(
      candidate.recommendedLevel ?? candidate.recommended_level ?? '',
    ).trim();
    const reason = String(candidate.reason ?? '').trim();
    if (recommendedLevel === nextLevel && reason) {
      levelUpRecommendation = {
        recommendedLevel: nextLevel,
        reason,
      };
    }
  }

  const miniLessonRaw = pickFirst([
    'mini_lesson',
    'miniLesson',
    'miniLessonItem',
    'one_more_useful_phrase',
  ]);
  const miniLesson = normalizeMiniLesson(miniLessonRaw);
  if (miniLessonRaw != null && !miniLesson) {
    logWarn('ai', 'mini lesson output was present but could not be normalized', {
      sessionId: input.sessionId,
    });
  }

  const handoffNotesFromModel = toStringArray(
    pickFirst([
      'handoff_notes',
      'handoffNotes',
      'internal_handoff',
      'internal_notes',
      'next_handoff',
    ]),
    'handoffNotes',
  );
  const legacyNextSteps = toStringArray(
    pickFirst([
      'next_focus',
      'nextSteps',
      'nextStep',
      'next_steps',
      'next_step',
      'recommendations',
      'actionItems',
      'action_items',
    ]),
    'nextSteps',
  );
  const handoffNotes = handoffNotesFromModel.length > 0 ? handoffNotesFromModel : legacyNextSteps;

  const summary: SessionSummary = {
    sessionId: input.sessionId,
    userId: input.userId,
    summary: assertString(summaryText, 'summary'),
    strengths: toStringArray(
      pickFirst([
        'patterns_strong',
        'strengths',
        'strength',
        'strongPoints',
        'strong_points',
        'positives',
      ]),
      'strengths',
      ['You completed the session.'],
    ),
    weaknesses: toStringArray(
      pickFirst([
        'patterns_weak',
        'weaknesses',
        'weakness',
        'areasToDeepen',
        'areas_to_deepen',
        'improvementAreas',
        'improvement_areas',
      ]),
      'weaknesses',
      ['Review any missed phrases once more.'],
    ),
    nextSteps: legacyNextSteps.length > 0 ? legacyNextSteps : undefined,
    accuracy,
    generatedAt: nowIso(),
    miniLesson,
    levelUpRecommendation,
  };

  logInfo('ai', 'generated session summary', {
    sessionId: input.sessionId,
    tokensInput: usage.input,
    tokensOutput: usage.output,
    hasMiniLesson: !!miniLesson,
    handoffNotesCount: handoffNotes.length,
  });

  return {
    summary,
    handoffNotes,
    tokenUsage: {
      model: usage.model,
      tokensIn: usage.input,
      tokensOut: usage.output,
      tokensTotal: usage.total,
    },
  };
}

export async function generateUpdatedJournal(input: {
  currentJournal: string | null;
  sessionSummary: SessionSummary;
  sessionMeta: { category?: string; topic: string; exerciseTypes: string[]; keyPhrases: string[] };
  userLevel: UserLevel;
}): Promise<{
  journal: string;
  tokenUsage: Pick<TokenUsage, 'model' | 'tokensIn' | 'tokensOut' | 'tokensTotal'>;
}> {
  const client = getOpenAiClient();
  const updatedJournalPrompt = buildUpdatedJournalPrompt(input);

  const response = await client.responses.create({
    model: SESSION_MODEL,
    temperature: 0.2,
    input: updatedJournalPrompt.messages,
  });

  if (!response.output_text) {
    throw new Error('[ai] OpenAI response missing output_text for progress journal generation');
  }

  const usage = getUsageFromResponse(response);
  const journal = assertString(response.output_text, 'journal');

  logInfo('ai', 'generated updated progress journal', {
    sessionId: input.sessionSummary.sessionId,
    userId: input.sessionSummary.userId,
    tokensInput: usage.input,
    tokensOutput: usage.output,
  });

  return {
    journal,
    tokenUsage: {
      model: usage.model,
      tokensIn: usage.input,
      tokensOut: usage.output,
      tokensTotal: usage.total,
    },
  };
}

export const createSessionPlan = generateSessionPlan;
export const buildSessionPlan = generateSessionPlan;
export const summarizeSession = generateSessionSummary;
export const createSessionSummary = generateSessionSummary;
