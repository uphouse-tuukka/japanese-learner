import type OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { config } from '$lib/config';
import { SESSION_MODEL } from '$lib/server/ai-models';
import {
  assertString,
  normalizeExercise,
  normalizeLesson,
  normalizeMiniLesson,
  normalizePublicChallengeExercise,
  normalizePublicChallengeLesson,
  toStringArray,
  validateExerciseSet,
} from '$lib/server/ai-session-normalizers';
import { buildPublicChallengePrompt, buildSessionPlanPrompt } from '$lib/server/ai-session-prompts';
import { getOpenAiClient as getCachedOpenAiClient } from '$lib/server/openai-client';
import { LEVEL_ORDER } from '$lib/types';
export { TOPIC_CATEGORIES, type TopicCategoryKey } from '$lib/server/ai-session-prompts';
import type {
  Exercise,
  SessionMiniLesson,
  SessionPlan,
  SessionSummary,
  TokenUsage,
  UserLevel,
} from '$lib/types';

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

function getExpectedAnswerDetails(exercise: Exercise | undefined): {
  expectedAnswer: string;
  acceptedAnswers: string[];
} {
  if (!exercise) {
    return {
      expectedAnswer: '',
      acceptedAnswers: [],
    };
  }

  if (exercise.type === 'multiple_choice') {
    return {
      expectedAnswer: exercise.correctAnswer,
      acceptedAnswers: [exercise.correctAnswer],
    };
  }

  if (exercise.type === 'translation') {
    return {
      expectedAnswer: exercise.expectedAnswer,
      acceptedAnswers: exercise.acceptedAnswers,
    };
  }

  if (exercise.type === 'fill_blank') {
    return {
      expectedAnswer: exercise.answer,
      acceptedAnswers: [exercise.answer, exercise.answerRomaji],
    };
  }

  if (exercise.type === 'reorder') {
    const reorderedAnswer = exercise.correctOrder.join(' ');
    return {
      expectedAnswer: reorderedAnswer,
      acceptedAnswers: [reorderedAnswer],
    };
  }

  if (exercise.type === 'reading') {
    return {
      expectedAnswer: exercise.answer,
      acceptedAnswers: [exercise.answer],
    };
  }

  return {
    expectedAnswer: exercise.correctAnswer,
    acceptedAnswers: [exercise.correctAnswer],
  };
}

export async function generateSessionPlan(input: {
  userId: string;
  userName: string;
  userLevel: UserLevel;
  japaneseWritingEnabled?: boolean;
  exerciseCount?: number;
  sessionHistory?: Array<{
    date: string;
    category?: string;
    topic: string;
    accuracy: number;
    strengths: string[];
    weaknesses: string[];
    nextSteps?: string[];
    handoffNotes?: string[];
    culturalNote?: string;
    miniLesson?: SessionMiniLesson | null;
    keyPhrases: string[];
  }>;
  recentAccuracy?: number;
  coveredTopics?: string[];
  categoryRotation?: {
    currentCategory: string | null;
    currentCategoryStreak: number;
    recentCategories: Array<{ category: string; sessionsAgo: number }>;
    neverVisited: string[];
  };
  totalSessionCount?: number;
  performanceInsights?: {
    overallAccuracy: number;
    weakExerciseIds: string[];
    strongExerciseIds: string[];
    recentWrongAnswers: string[];
  };
}): Promise<SessionPlan> {
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
      validExercises.push(normalizeExercise(rawExercises[i], i, input.userLevel));
    } catch (err) {
      console.warn(`[ai] Skipping exercise ${i}: ${(err as Error).message}`);
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

  console.warn('[ai] generated session plan', {
    sessionId: plan.id,
    userId: plan.userId,
    exerciseCount: plan.exercises.length,
    focus: plan.metadata.focus,
    tokensInput: usage.input,
    tokensOutput: usage.output,
  });

  return plan;
}

export async function generatePublicChallengePlan(input: {
  scenario: string;
  scenarioLabel: string;
  targetExerciseCount: number;
}): Promise<SessionPlan> {
  // eslint-disable-next-line no-console
  console.log('[ai] Generating public challenge plan for scenario:', input.scenario);

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
      console.warn(`[ai] Skipping public challenge exercise ${i}: ${(err as Error).message}`);
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
  const accuracy =
    input.results.length === 0
      ? 0
      : Math.round(
          (input.results.filter((row) => row.isCorrect).length / input.results.length) * 100,
        );

  const exercisesById = new Map<string, Exercise>();
  for (const exercise of input.exercises) {
    exercisesById.set(exercise.id, exercise);
  }

  const detailedResults = input.results.map((result) => {
    const exercise = exercisesById.get(result.exerciseId);
    const expectedAnswerDetails = getExpectedAnswerDetails(exercise);
    return {
      exerciseId: result.exerciseId,
      type: exercise?.type ?? 'unknown',
      title: exercise?.title ?? 'Unknown exercise',
      prompt: exercise?.englishContext ?? '',
      answerText: result.answerText,
      expectedAnswer: expectedAnswerDetails.expectedAnswer,
      acceptedAnswers: expectedAnswerDetails.acceptedAnswers,
      isCorrect: result.isCorrect,
    };
  });

  const recentSessionsCompact = (input.recentSessions ?? []).map((session) => ({
    topic: session.topic,
    accuracy: session.accuracy,
    keyPhrases: (session.keyPhrases ?? []).slice(0, 5),
    exerciseTypes: session.exerciseTypes ?? [],
  }));

  const progressContextBlocks: string[] = [];
  if (typeof input.progressJournal === 'string' && input.progressJournal.trim()) {
    progressContextBlocks.push(
      `LEARNER PROGRESS JOURNAL (cumulative history):\n${input.progressJournal.trim()}\n`,
    );
  }
  if (recentSessionsCompact.length > 0) {
    progressContextBlocks.push(
      `RECENT SESSIONS (last ${recentSessionsCompact.length}):\n${JSON.stringify(recentSessionsCompact)}\n`,
    );
  }

  const currentSessionData = {
    sessionId: input.sessionId,
    userId: input.userId,
    userLevel: input.userLevel,
    japaneseWritingEnabled: input.japaneseWritingEnabled ?? false,
    lessonTopic: input.lessonTopic ?? 'travel_japanese',
    accuracy,
    exercises: input.exercises.map((exercise) => ({
      id: exercise.id,
      type: exercise.type,
      title: exercise.title,
      japanese: exercise.japanese,
      romaji: exercise.romaji,
      englishContext: exercise.englishContext,
      difficulty: exercise.difficulty,
    })),
    results: detailedResults,
  };

  const response = await client.responses.create({
    model: SESSION_MODEL,
    temperature: 0.2,
    input: [
      {
        role: 'system',
        content: [
          'You are a Japanese tutor providing a concise end-of-session learner summary plus internal handoff notes.',
          'Write ALL learner-visible summary text in English. The summary, patterns_strong, patterns_weak, mini_lesson.english, and mini_lesson.note fields must be in English.',
          'Return JSON only with keys: summary, patterns_strong, patterns_weak, mini_lesson, handoff_notes, levelUpRecommendation.',
          '',
          'RULES:',
          '1) Only reference exercises that appear in the provided session data. Never fabricate.',
          '2) patterns_strong: Identify PATTERNS and skills the learner demonstrates consistently — compare with prior sessions/journal when evidence exists. Do NOT list individual correct answers. Focus on what skills are ready to build upon.',
          '3) patterns_weak: Identify conceptual gaps and confusion patterns (particle errors, verb form mistakes, similar-word confusion). Do NOT list individual wrong answers. If accuracy is 100%, mention 1-2 growth areas (nuance, range).',
          '4) mini_lesson: exactly one object with keys kind, japanese, romaji, english, note. kind must be one of: related_phrase, likely_reply, nuance_upgrade, follow_up. Keep it closely related to this completed lesson, concrete, and immediately usable. Do NOT copy a taught key phrase verbatim. Do NOT phrase it as a future promise ("next time we will...").',
          '5) handoff_notes: 0-3 short internal notes for the next session generator. Keep them specific and pattern-oriented. These are internal only and MUST NOT be written as learner-facing "next time" statements.',
          '6) All Japanese in learner-visible output must include matching romaji. Example: japanese="こんにちは", romaji="konnichiwa".',
          input.suppressPromotion
            ? '7) levelUpRecommendation: MUST be null. A promotion was recently recommended — do NOT suggest another promotion this session.'
            : '7) levelUpRecommendation: null or {recommendedLevel, reason}. Recommend promotion only with consistent mastery (>=80% recent accuracy + strong evidence across multiple sessions). Never promote ready_for_japan. Do NOT recommend promotion in consecutive sessions.',
          '',
          "TRANSLATION ACCURACY: The 'isCorrect' field uses string matching which may be imperfect. Answers conveying the same meaning ARE correct. Do not penalize natural phrasings, added politeness, contractions, or word order differences. If an 'incorrect' answer was actually correct, acknowledge it as a strength.",
          'Keep feedback encouraging, concise, and travel-focused.',
        ].join(' '),
      },
      {
        role: 'user',
        content: `${progressContextBlocks.join('\n')}CURRENT SESSION DATA:\n${JSON.stringify(currentSessionData)}`,
      },
    ],
    text: {
      format: {
        type: 'json_object',
      },
    },
  });

  if (!response.output_text) {
    throw new Error('[ai] OpenAI response missing output_text for summary generation');
  }

  console.warn('[ai] raw session summary response', {
    sessionId: input.sessionId,
    responseId: response.id,
    status: response.status,
  });
  const summaryOutputTextPreview =
    response.output_text.length > 100
      ? `${response.output_text.slice(0, 100)}[truncated]`
      : response.output_text;
  console.warn('[ai] raw session summary output_text', {
    sessionId: input.sessionId,
    outputTextPreview: summaryOutputTextPreview,
    outputTextLength: response.output_text.length,
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

  const summaryText = String(
    pickFirst(['summary', 'sessionSummary', 'session_summary', 'overview']) ?? '',
  ).trim();

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
    console.warn('[ai] mini lesson output was present but could not be normalized', {
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

  const usage = getUsageFromResponse(response);
  console.warn('[ai] generated session summary', {
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
  const currentJournalText =
    typeof input.currentJournal === 'string' && input.currentJournal.trim()
      ? input.currentJournal.trim()
      : "This is the user's first session.";

  const response = await client.responses.create({
    model: SESSION_MODEL,
    temperature: 0.2,
    input: [
      {
        role: 'system',
        content: [
          'Maintain a cumulative learner journal for a Japanese learning app. This journal is read by AI models to generate future sessions — optimize for machine readability, not human presentation.',
          'Write ALL journal text in English. Japanese should only appear within Vocabulary bank entries (the Japanese words/phrases themselves and their translations). Category names, topic descriptions, weak spot analysis, trajectory commentary, and progress snapshots must all be in English.',
          'Return plain text only, under 500 words.',
          'Merge the existing journal with the new session data.',
          'Use these exact headings in this order:',
          '**Categories & topics covered** — list each category with its topics (e.g., food_dining: ordering, menu items)',
          '**Vocabulary bank** — key phrases learned, capped at ~30 most recent/important. Drop older mastered items to stay under cap.',
          '**Persistent weak spots** — only patterns that keep recurring across multiple sessions. Remove items the learner has since mastered.',
          '**Progress snapshot** — session count, current level, any streak info',
          '**Learning trajectory** — 1-2 sentences on overall direction and readiness',
          'Use short bullet points under each heading.',
          'Keep content specific, evidence-based, and cumulative.',
          'Sessions completed rule: first session = 1; otherwise increment the count from the existing journal.',
          'Do NOT include romaji — this data is for AI consumption only.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          `EXISTING_JOURNAL:\n${currentJournalText}`,
          'SESSION:',
          JSON.stringify({
            level: input.userLevel,
            category: input.sessionMeta.category ?? 'unknown',
            topic: input.sessionMeta.topic,
            exerciseTypes: input.sessionMeta.exerciseTypes,
            keyPhrases: input.sessionMeta.keyPhrases,
            summary: input.sessionSummary.summary,
            accuracy: input.sessionSummary.accuracy,
            strengths: input.sessionSummary.strengths,
            weaknesses: input.sessionSummary.weaknesses,
            nextSteps: input.sessionSummary.nextSteps,
          }),
        ].join('\n'),
      },
    ],
  });

  if (!response.output_text) {
    throw new Error('[ai] OpenAI response missing output_text for progress journal generation');
  }

  const usage = getUsageFromResponse(response);
  const journal = assertString(response.output_text, 'journal');

  console.warn('[ai] generated updated progress journal', {
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
