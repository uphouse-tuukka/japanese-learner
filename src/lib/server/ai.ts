import type OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { config } from '$lib/config';
import { SESSION_MODEL } from '$lib/server/ai-models';
import {
  LEVEL_RULES,
  buildPublicChallengePrompt,
  buildSessionPlanPrompt,
} from '$lib/server/ai-session-prompts';
import { getOpenAiClient as getCachedOpenAiClient } from '$lib/server/openai-client';
import { LEVEL_ORDER } from '$lib/types';
export { TOPIC_CATEGORIES, type TopicCategoryKey } from '$lib/server/ai-session-prompts';
import type {
  Exercise,
  ExerciseType,
  KeyPhrase,
  Lesson,
  SessionMiniLesson,
  SessionPlan,
  SessionSummary,
  TokenUsage,
  UserLevel,
} from '$lib/types';

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const JAPANESE_SCRIPT_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]/u;
const INLINE_ROMAJI_PATTERN = /^(?<japanese>.+?)\s*\((?<romaji>[A-Za-z0-9'.,\-\s]+)\)\s*$/u;
const JAPANESE_CHOICE_WITH_ROMAJI_PATTERN =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f].*\([A-Za-z0-9'.,\-\s]+\)/u;

function containsJapaneseScript(value: string): boolean {
  return JAPANESE_SCRIPT_PATTERN.test(value);
}

function splitInlineRomaji(value: string): { japanese: string; inlineRomaji: string | null } {
  const trimmed = value.trim();
  const match = INLINE_ROMAJI_PATTERN.exec(trimmed);
  if (!match?.groups) {
    return { japanese: trimmed, inlineRomaji: null };
  }
  const japanese = match.groups.japanese?.trim() ?? trimmed;
  const inlineRomaji = match.groups.romaji?.trim() ?? null;
  if (!containsJapaneseScript(japanese) || !inlineRomaji) {
    return { japanese: trimmed, inlineRomaji: null };
  }
  return { japanese, inlineRomaji };
}

function normalizeJapaneseAndRomajiFields(
  japanese: string,
  romaji: string,
): { japanese: string; romaji: string } {
  const parsed = splitInlineRomaji(japanese);
  return {
    japanese: parsed.japanese,
    romaji: romaji.trim() || parsed.inlineRomaji || '',
  };
}

function isJapaneseMeaningStyleMultipleChoiceQuestion(question: string): boolean {
  const trimmedQuestion = question.trim();
  return containsJapaneseScript(trimmedQuestion) && /\b(mean|meaning)\b/iu.test(trimmedQuestion);
}

function isJapaneseChoiceWithRomaji(choice: string): boolean {
  return JAPANESE_CHOICE_WITH_ROMAJI_PATTERN.test(choice.trim());
}

function normalizePublicChallengeLesson(lesson: Lesson): Lesson {
  return {
    ...lesson,
    keyPhrases: lesson.keyPhrases.map((phrase) => {
      const normalized = normalizeJapaneseAndRomajiFields(phrase.japanese, phrase.romaji);
      return {
        ...phrase,
        japanese: normalized.japanese,
        romaji: normalized.romaji,
      };
    }),
  };
}

function normalizePublicChallengeExercise(exercise: Exercise): Exercise {
  const normalized = normalizeJapaneseAndRomajiFields(exercise.japanese, exercise.romaji);
  if (exercise.type !== 'multiple_choice') {
    return {
      ...exercise,
      japanese: normalized.japanese,
      romaji: normalized.romaji,
    };
  }

  let choices = exercise.choices;
  const isMeaningStyleQuestion = isJapaneseMeaningStyleMultipleChoiceQuestion(exercise.question);

  if (isMeaningStyleQuestion) {
    const englishOnlyChoices = choices.filter((choice) => !containsJapaneseScript(choice));
    if (englishOnlyChoices.length < 2) {
      throw new Error(
        '[ai] Public challenge multiple_choice meaning question must use English-only choices',
      );
    }
    choices = englishOnlyChoices;
  } else {
    const japaneseChoices = choices.filter((choice) => isJapaneseChoiceWithRomaji(choice));
    if (japaneseChoices.length < 2) {
      throw new Error(
        '[ai] Public challenge multiple_choice scenario question must use Japanese choices with romaji',
      );
    }
    choices = japaneseChoices;
  }

  const correctAnswer = choices.includes(exercise.correctAnswer)
    ? exercise.correctAnswer
    : choices[0];
  return {
    ...exercise,
    japanese: normalized.japanese,
    romaji: normalized.romaji,
    choices,
    correctAnswer,
  };
}

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

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`[ai] Invalid field "${fieldName}" in model output`);
  }
  return value.trim();
}

function flexString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function requireString(
  row: Record<string, unknown>,
  fieldLabel: string,
  ...keys: string[]
): string {
  const value = flexString(row, ...keys);
  if (!value) {
    throw new Error(`[ai] Missing required field "${fieldLabel}" in model output`);
  }
  return value;
}

function toStringArray(value: unknown, fieldName: string, fallback: string[] = []): string[] {
  const normalizeItem = (item: unknown): string => {
    if (item == null) {
      return '';
    }
    if (typeof item === 'string') {
      return item.trim();
    }
    if (typeof item === 'number' || typeof item === 'boolean' || typeof item === 'bigint') {
      return String(item).trim();
    }
    if (typeof item === 'symbol') {
      return (item.description ?? '').trim();
    }
    if (typeof item === 'object') {
      const row = item as Record<string, unknown>;
      const semanticText =
        (typeof row.text === 'string' && row.text) ||
        (typeof row.value === 'string' && row.value) ||
        (typeof row.label === 'string' && row.label) ||
        (typeof row.message === 'string' && row.message) ||
        '';
      if (semanticText.trim()) {
        return semanticText.trim();
      }
      try {
        const serialized = JSON.stringify(item);
        if (!serialized || serialized === '{}' || serialized === '[]') {
          return '';
        }
        return serialized.trim();
      } catch {
        return '';
      }
    }
    return '';
  };

  const source = Array.isArray(value) ? value : value == null ? [] : [value];
  const normalized = source
    .flatMap((item) => (Array.isArray(item) ? item : [item]))
    .map((item) => normalizeItem(item))
    .filter(Boolean);

  if (normalized.length > 0) {
    return normalized;
  }

  if (fallback.length === 0) {
    return [];
  }
  return fallback.map((item) => normalizeItem(item)).filter(Boolean);
}

function normalizeMiniLessonKind(value: unknown): SessionMiniLesson['kind'] {
  if (typeof value !== 'string' || !value.trim()) {
    return 'related_phrase';
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (normalized === 'related_phrase') return 'related_phrase';
  if (normalized === 'likely_reply' || normalized === 'likely_response') return 'likely_reply';
  if (normalized === 'nuance_upgrade') return 'nuance_upgrade';
  if (normalized === 'follow_up' || normalized === 'followup') return 'follow_up';
  return 'related_phrase';
}

function normalizeMiniLesson(raw: unknown): SessionMiniLesson | null {
  const candidate = Array.isArray(raw)
    ? (raw.find((item) => item && typeof item === 'object') ?? raw[0])
    : raw;
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const row = candidate as Record<string, unknown>;
  const japaneseRaw = flexString(row, 'japanese', 'phrase', 'text', 'ja', 'jp');
  const romajiRaw = flexString(row, 'romaji', 'romanji', 'romanization');
  const englishRaw = flexString(row, 'english', 'meaning', 'translation', 'en');
  const noteRaw = flexString(row, 'note', 'usage', 'context', 'why', 'description');

  if (!japaneseRaw || !englishRaw || !noteRaw) {
    return null;
  }

  const normalized = normalizeJapaneseAndRomajiFields(japaneseRaw, romajiRaw);
  if (!normalized.japanese || !normalized.romaji) {
    return null;
  }

  return {
    kind: normalizeMiniLessonKind(row.kind ?? row.type),
    japanese: normalized.japanese,
    romaji: normalized.romaji,
    english: englishRaw,
    note: noteRaw,
  };
}

function isExerciseType(value: unknown): value is ExerciseType {
  return (
    value === 'multiple_choice' ||
    value === 'translation' ||
    value === 'fill_blank' ||
    value === 'reorder' ||
    value === 'reading' ||
    value === 'listening'
  );
}

function normalizeDifficulty(value: unknown, level: UserLevel): 1 | 2 | 3 | 4 | 5 {
  const parsed = Number(value);
  const rounded = Number.isFinite(parsed) ? Math.round(parsed) : 1;
  const rules = LEVEL_RULES[level];
  return Math.min(rules.maxDifficulty, Math.max(rules.minDifficulty, rounded)) as 1 | 2 | 3 | 4 | 5;
}

function normalizeKeyPhrase(raw: unknown, index: number): KeyPhrase {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`[ai] keyPhrases[${index}] is not an object`);
  }
  const row = raw as Record<string, unknown>;
  return {
    japanese: requireString(row, `keyPhrases[${index}].japanese`, 'japanese', 'jp', 'ja', 'text'),
    romaji: requireString(row, `keyPhrases[${index}].romaji`, 'romaji', 'romanji'),
    english: requireString(
      row,
      `keyPhrases[${index}].english`,
      'english',
      'en',
      'meaning',
      'translation',
    ),
    usage: flexString(row, 'usage', 'context', 'example', 'note'),
  };
}

function normalizeLesson(raw: unknown): Lesson {
  if (!raw || typeof raw !== 'object') {
    throw new Error('[ai] Missing lesson object in model output');
  }
  const row = raw as Record<string, unknown>;
  const keyPhrasesRaw = Array.isArray(row.keyPhrases) ? row.keyPhrases : [];
  if (keyPhrasesRaw.length > 8) {
    throw new Error('[ai] lesson.keyPhrases must contain 1-8 entries');
  }
  const keyPhrases = keyPhrasesRaw.slice(0, 5);
  if (keyPhrases.length === 0)
    throw new Error('[ai] lesson.keyPhrases must contain at least 1 entry');
  return {
    topic: requireString(row, 'lesson.topic', 'topic', 'title', 'subject'),
    category:
      typeof row.category === 'string' && row.category.trim() ? row.category.trim() : undefined,
    explanation: requireString(
      row,
      'lesson.explanation',
      'explanation',
      'description',
      'content',
      'text',
    ),
    culturalNote: flexString(row, 'culturalNote', 'cultural_note', 'culture', 'note'),
    keyPhrases: keyPhrases.map((phrase, index) => normalizeKeyPhrase(phrase, index)),
  };
}

const EXERCISE_TYPE_TITLES: Record<string, string> = {
  multiple_choice: 'Multiple Choice',
  translation: 'Translation',
  fill_blank: 'Fill in the Blank',
  reorder: 'Word Order',
  reading: 'Reading Comprehension',
  listening: 'Listening Exercise',
};

function normalizeExercise(raw: unknown, index: number, level: UserLevel): Exercise {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`[ai] Exercise at index ${index} is not an object`);
  }

  const row = raw as Record<string, unknown>;
  const typeRaw = row.type;
  if (!isExerciseType(typeRaw)) {
    throw new Error(`[ai] Exercise at index ${index} has unsupported type: ${String(typeRaw)}`);
  }

  const base = {
    id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : `ai-${randomUUID()}`,
    type: typeRaw,
    title: EXERCISE_TYPE_TITLES[typeRaw] ?? `Exercise ${index + 1}`,
    japanese: requireString(row, 'japanese', 'japanese', 'jp', 'ja', 'text_ja'),
    romaji: requireString(row, 'romaji', 'romaji', 'romanji', 'romanization'),
    englishContext: flexString(
      row,
      'englishContext',
      'english_context',
      'english',
      'context',
      'meaning',
    ),
    tags: toStringArray(row.tags, 'tags', ['travel', 'teaching-session']),
    difficulty: normalizeDifficulty(row.difficulty, level),
  };

  if (typeRaw === 'multiple_choice') {
    const choices = shuffleArray(
      toStringArray(row.choices ?? row.options ?? row.answers, 'choices'),
    );
    const normalizedCorrectAnswer = requireString(
      row,
      'correctAnswer',
      'correctAnswer',
      'correct_answer',
      'answer',
      'correct',
    );
    const correctAnswer = choices.includes(normalizedCorrectAnswer)
      ? normalizedCorrectAnswer
      : choices[0];
    if (correctAnswer !== normalizedCorrectAnswer) {
      console.warn('[ai] multiple_choice correctAnswer not in choices; using first choice', {
        exerciseIndex: index,
        type: typeRaw,
        providedCorrectAnswer: normalizedCorrectAnswer,
      });
    }
    return {
      ...base,
      type: 'multiple_choice',
      question: requireString(row, 'question', 'question', 'prompt', 'title', 'text'),
      choices,
      correctAnswer,
      explanation: typeof row.explanation === 'string' ? row.explanation : undefined,
    };
  }

  if (typeRaw === 'translation') {
    const direction = row.direction === 'ja_to_en' ? 'ja_to_en' : 'en_to_ja';
    const expectedAnswer = requireString(
      row,
      'expectedAnswer',
      'expectedAnswer',
      'expected_answer',
      'answer',
      'correct',
    );
    return {
      ...base,
      type: 'translation',
      direction,
      prompt: requireString(row, 'prompt', 'prompt', 'text', 'sentence', 'question'),
      expectedAnswer,
      expectedRomaji:
        flexString(row, 'expectedRomaji', 'expected_romaji', 'romaji_answer') || undefined,
      acceptedAnswers: toStringArray(
        row.acceptedAnswers ?? row.accepted_answers ?? row.alternatives,
        'acceptedAnswers',
        [expectedAnswer],
      ),
    };
  }

  if (typeRaw === 'fill_blank') {
    return {
      ...base,
      type: 'fill_blank',
      sentence: requireString(row, 'sentence', 'sentence', 'text', 'prompt'),
      sentenceRomaji: requireString(
        row,
        'sentenceRomaji',
        'sentenceRomaji',
        'sentence_romaji',
        'romaji',
      ),
      sentenceEnglish: requireString(
        row,
        'sentenceEnglish',
        'sentenceEnglish',
        'sentence_english',
        'english',
        'translation',
      ),
      blank: requireString(row, 'blank', 'blank', 'gap', 'missing'),
      answer: requireString(row, 'answer', 'answer', 'correctAnswer', 'correct_answer'),
      answerRomaji: requireString(row, 'answerRomaji', 'answerRomaji', 'answer_romaji'),
    };
  }

  if (typeRaw === 'reorder') {
    const tokens = toStringArray(row.tokens, 'tokens');
    return {
      ...base,
      type: 'reorder',
      prompt: assertString(row.prompt, 'prompt'),
      tokens,
      correctOrder: toStringArray(row.correctOrder, 'correctOrder', tokens),
    };
  }

  if (typeRaw === 'reading') {
    return {
      ...base,
      type: 'reading',
      passage: assertString(row.passage, 'passage'),
      passageRomaji: assertString(row.passageRomaji, 'passageRomaji'),
      passageEnglish: assertString(row.passageEnglish, 'passageEnglish'),
      question: assertString(row.question, 'question'),
      answer: assertString(row.answer, 'answer'),
    };
  }

  const listeningChoices = shuffleArray(
    toStringArray(row.choices ?? row.options ?? row.answers, 'choices'),
  );
  const normalizedListeningCorrectAnswer = assertString(row.correctAnswer, 'correctAnswer');
  const listeningCorrectAnswer = listeningChoices.includes(normalizedListeningCorrectAnswer)
    ? normalizedListeningCorrectAnswer
    : listeningChoices[0];
  if (listeningCorrectAnswer !== normalizedListeningCorrectAnswer) {
    console.warn('[ai] listening correctAnswer not in choices; using first choice', {
      exerciseIndex: index,
      type: typeRaw,
      providedCorrectAnswer: normalizedListeningCorrectAnswer,
    });
  }
  return {
    ...base,
    type: 'listening',
    prompt: assertString(row.prompt, 'prompt'),
    audioText: assertString(row.audioText, 'audioText'),
    choices: listeningChoices,
    correctAnswer: listeningCorrectAnswer,
  };
}

function validateExerciseSet(exercises: Exercise[], level: UserLevel): Exercise[] {
  if (exercises.length === 0) {
    throw new Error('[ai] exercises must not be empty');
  }
  const rules = LEVEL_RULES[level];
  for (const exercise of exercises) {
    if (!rules.allowedTypes.includes(exercise.type)) {
      throw new Error(`[ai] Invalid exercise type for ${level}: ${exercise.type}`);
    }
    if (exercise.difficulty < rules.minDifficulty || exercise.difficulty > rules.maxDifficulty) {
      throw new Error(
        `[ai] ${level} difficulty must be between ${rules.minDifficulty} and ${rules.maxDifficulty}`,
      );
    }
    if (
      exercise.type === 'translation' &&
      !rules.translationDirections.includes(exercise.direction)
    ) {
      throw new Error(
        `[ai] ${level} translation direction must be one of ${rules.translationDirections.join(', ')}`,
      );
    }
  }

  return exercises;
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
