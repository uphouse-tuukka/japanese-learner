import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { config } from '$lib/config';
import { LEVEL_ORDER } from '$lib/types';
import type {
  Exercise,
  ExerciseType,
  KeyPhrase,
  Lesson,
  SessionPlan,
  SessionSummary,
  TokenUsage,
  UserLevel,
} from '$lib/types';

const LEVEL_RULES: Record<
  UserLevel,
  {
    minDifficulty: 1 | 2 | 3;
    maxDifficulty: 2 | 3 | 4 | 5;
    allowedTypes: ExerciseType[];
    translationDirections: Array<'ja_to_en' | 'en_to_ja'>;
  }
> = {
  absolute_beginner: {
    minDifficulty: 1,
    maxDifficulty: 2,
    allowedTypes: ['multiple_choice', 'translation'],
    translationDirections: ['ja_to_en'],
  },
  beginner: {
    minDifficulty: 1,
    maxDifficulty: 3,
    allowedTypes: ['multiple_choice', 'translation', 'listening'],
    translationDirections: ['ja_to_en'],
  },
  elementary: {
    minDifficulty: 1,
    maxDifficulty: 3,
    allowedTypes: ['multiple_choice', 'translation', 'listening', 'fill_blank'],
    translationDirections: ['ja_to_en'],
  },
  pre_intermediate: {
    minDifficulty: 2,
    maxDifficulty: 4,
    allowedTypes: [
      'multiple_choice',
      'translation',
      'listening',
      'fill_blank',
      'reorder',
      'reading',
    ],
    translationDirections: ['ja_to_en', 'en_to_ja'],
  },
  intermediate: {
    minDifficulty: 2,
    maxDifficulty: 5,
    allowedTypes: [
      'multiple_choice',
      'translation',
      'listening',
      'fill_blank',
      'reorder',
      'reading',
    ],
    translationDirections: ['ja_to_en', 'en_to_ja'],
  },
  upper_intermediate: {
    minDifficulty: 3,
    maxDifficulty: 5,
    allowedTypes: [
      'multiple_choice',
      'translation',
      'listening',
      'fill_blank',
      'reorder',
      'reading',
    ],
    translationDirections: ['ja_to_en', 'en_to_ja'],
  },
  advanced: {
    minDifficulty: 3,
    maxDifficulty: 5,
    allowedTypes: [
      'multiple_choice',
      'translation',
      'listening',
      'fill_blank',
      'reorder',
      'reading',
    ],
    translationDirections: ['ja_to_en', 'en_to_ja'],
  },
  ready_for_japan: {
    minDifficulty: 3,
    maxDifficulty: 5,
    allowedTypes: [
      'multiple_choice',
      'translation',
      'listening',
      'fill_blank',
      'reorder',
      'reading',
    ],
    translationDirections: ['ja_to_en', 'en_to_ja'],
  },
};

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const SESSION_MODEL = 'gpt-5.4';

export const TOPIC_CATEGORIES = [
  {
    key: 'greetings_basics',
    label: 'Greetings & Basics',
    examples: 'Self-introductions, thank you, excuse me, counting, basic polite phrases',
  },
  {
    key: 'food_dining',
    label: 'Food & Dining',
    examples: 'Restaurants, ordering food, menu items, dietary needs, paying the bill',
  },
  {
    key: 'transport',
    label: 'Transport',
    examples: 'Trains, buses, taxis, buying tickets, asking for platforms, IC cards',
  },
  {
    key: 'shopping',
    label: 'Shopping',
    examples: 'Convenience stores, souvenirs, prices, sizes, trying on clothes',
  },
  {
    key: 'directions',
    label: 'Directions & Navigation',
    examples: 'Asking the way, landmarks, reading signs, using maps',
  },
  {
    key: 'hotel_accommodation',
    label: 'Hotel & Accommodation',
    examples: 'Check-in/out, room requests, problems, amenities',
  },
  {
    key: 'emergencies_health',
    label: 'Emergencies & Health',
    examples: 'Pharmacy, doctor visits, lost items, police, feeling unwell',
  },
  {
    key: 'social_conversation',
    label: 'Social & Conversation',
    examples: 'Small talk, weather, compliments, hobbies, meeting people',
  },
  {
    key: 'sightseeing_culture',
    label: 'Sightseeing & Culture',
    examples: 'Temples, museums, etiquette, customs, photo requests',
  },
  {
    key: 'bars_nightlife',
    label: 'Bars & Nightlife',
    examples: 'Izakaya ordering, drinks, karaoke, bar etiquette, nomikai culture',
  },
] as const;

export type TopicCategoryKey = (typeof TOPIC_CATEGORIES)[number]['key'];

let openaiClient: OpenAI | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function getOpenAiClient(): OpenAI {
  const apiKey = config.openai.apiKey.trim();
  if (!apiKey) {
    throw new Error('[ai] Missing OpenAI API key in config.openai.apiKey');
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
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
    return {
      ...base,
      type: 'multiple_choice',
      question: requireString(row, 'question', 'question', 'prompt', 'title', 'text'),
      choices,
      correctAnswer: requireString(
        row,
        'correctAnswer',
        'correctAnswer',
        'correct_answer',
        'answer',
        'correct',
      ),
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

  return {
    ...base,
    type: 'listening',
    prompt: assertString(row.prompt, 'prompt'),
    audioText: assertString(row.audioText, 'audioText'),
    choices: shuffleArray(toStringArray(row.choices ?? row.options ?? row.answers, 'choices')),
    correctAnswer: assertString(row.correctAnswer, 'correctAnswer'),
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

function levelInstructions(level: UserLevel): string {
  if (level === 'absolute_beginner')
    return [
      'User level is absolute_beginner.',
      'Use only basic travel survival Japanese with clear romaji support.',
      'Allowed exercise types: multiple_choice and translation.',
      'Difficulty range is strictly 1-2.',
      'Translation direction must be ja_to_en only.',
      'Do not require Japanese typing.',
    ].join(' ');

  if (level === 'beginner')
    return [
      'User level is beginner.',
      'Introduce hiragana gently while keeping romaji support.',
      'Allowed exercise types: multiple_choice, translation, listening.',
      'Difficulty range is strictly 1-3.',
      'Translation direction must be ja_to_en only.',
    ].join(' ');

  if (level === 'elementary')
    return [
      'User level is elementary.',
      'Allowed exercise types: multiple_choice, translation, listening, fill_blank.',
      'Difficulty range is strictly 1-3.',
      'Translation can be ja_to_en or en_to_ja.',
    ].join(' ');

  if (level === 'pre_intermediate')
    return [
      'User level is pre_intermediate.',
      'All exercise types are allowed.',
      'Difficulty range is strictly 2-4.',
      'Translation can be ja_to_en or en_to_ja.',
    ].join(' ');

  if (level === 'intermediate')
    return [
      'User level is intermediate.',
      'All exercise types are allowed.',
      'Difficulty range is strictly 2-5.',
      'Translation can be ja_to_en or en_to_ja.',
    ].join(' ');

  if (level === 'upper_intermediate')
    return [
      'User level is upper_intermediate.',
      'All exercise types are allowed.',
      'Difficulty range is strictly 3-5.',
      'Translation can be ja_to_en or en_to_ja.',
    ].join(' ');

  if (level === 'advanced')
    return [
      'User level is advanced.',
      'All exercise types are allowed.',
      'Difficulty range is strictly 3-5.',
      'Translation can be ja_to_en or en_to_ja.',
    ].join(' ');

  return [
    'User level is ready_for_japan.',
    'All exercise types are allowed.',
    'Difficulty range is strictly 3-5.',
    'Translation can be ja_to_en or en_to_ja.',
  ].join(' ');
}

const EXERCISE_FIELD_REQUIREMENTS: Record<ExerciseType, string> = {
  multiple_choice:
    '- multiple_choice: question, choices (string array of 4 options), correctAnswer (must match one choice), explanation (optional). For multiple_choice exercises: the "japanese" and "romaji" fields are metadata only and will NOT be shown to the user. They should contain the key phrase being tested for internal tracking. The "question" field must be completely self-contained — if it references Japanese text, include it inline in the question string. The question field is the ONLY text shown to the user above the choices, so it must be completely self-contained. CRITICAL for multiple_choice: the question must NEVER require looking at japanese/romaji fields to make sense. The question + choices must form a complete, self-contained quiz on their own. For multiple_choice exercises, every choice that contains Japanese must include romaji in parentheses. Example choice: "すみません (sumimasen)". This applies to ALL choices in the array and to correctAnswer. For multiple_choice exercises, the question MUST provide clear context and be self-contained so the learner understands exactly what is being tested. Use one of these patterns: (a) ask what a Japanese phrase means, e.g. "What does [phrase] mean?"; (b) present a real-life scenario and ask which phrase fits, e.g. "You are at a restaurant and want to get the waiter\'s attention. What would you say?"; (c) ask the learner to identify the correct translation/usage, e.g. "Which phrase means [English meaning]?". NEVER write a vague question like "Which phrase is most appropriate?" without a scenario. IMPORTANT: The \'japanese\' and \'romaji\' fields are metadata only and are NOT displayed to the user. The \'question\' field is the ONLY text shown above the choices, so it must be completely self-contained. If the question references a Japanese phrase (e.g. \'What does すみません (sumimasen) mean?\'), include it directly in the question string.',
  translation:
    '- translation: direction ("ja_to_en" or "en_to_ja"), prompt (the text to translate), expectedAnswer (the correct translation), acceptedAnswers (string array of alternative correct answers).',
  fill_blank:
    '- fill_blank: sentence, sentenceRomaji, sentenceEnglish, blank, answer, answerRomaji.',
  reorder: '- reorder: prompt, tokens (string array), correctOrder (string array).',
  reading: '- reading: passage, passageRomaji, passageEnglish, question, answer.',
  listening:
    '- listening: prompt, audioText, choices (string array), correctAnswer (must match one choice). For listening exercises, prompt must be short English-only instruction, e.g. "Listen and choose the correct meaning". Do NOT include Japanese text or romaji in prompt.',
};

function exerciseFieldRequirements(level: UserLevel): string[] {
  const requirements = LEVEL_RULES[level].allowedTypes.map(
    (type) => EXERCISE_FIELD_REQUIREMENTS[type],
  );
  if (level === 'absolute_beginner') {
    return [
      ...requirements,
      'For absolute_beginner, translation direction must always be "ja_to_en".',
    ];
  }
  if (level === 'beginner') {
    return [...requirements, 'For beginner, translation direction must always be "ja_to_en".'];
  }
  return requirements;
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
    nextSteps: string[];
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
  const japaneseWritingEnabled = input.japaneseWritingEnabled === true;
  const allowWritingExercises =
    japaneseWritingEnabled &&
    (input.userLevel === 'elementary' ||
      input.userLevel === 'pre_intermediate' ||
      input.userLevel === 'intermediate' ||
      input.userLevel === 'upper_intermediate' ||
      input.userLevel === 'advanced' ||
      input.userLevel === 'ready_for_japan');
  const targetExerciseCount = Math.min(12, Math.max(4, Math.round(input.exerciseCount ?? 6)));
  const sessionHistory = (input.sessionHistory ?? []).slice(0, 10);
  const categoryList = TOPIC_CATEGORIES.map((c) => `${c.key}: ${c.label} (${c.examples})`).join(
    '; ',
  );
  const categoryRotation = input.categoryRotation;
  const categoryContext = categoryRotation
    ? [
        'TOPIC CATEGORY ROTATION:',
        `Available categories: ${categoryList}.`,
        `Current category streak: ${categoryRotation.currentCategory ? `"${categoryRotation.currentCategory}" × ${categoryRotation.currentCategoryStreak} session(s)` : 'none (first session)'}. `,
        categoryRotation.currentCategoryStreak >= 3
          ? `MUST switch to a different category — 3 sessions reached.`
          : categoryRotation.currentCategoryStreak >= 2
            ? `You may continue this category one more time or switch — your choice based on learner progress.`
            : `Continue this category to build depth, or switch if the learner seems ready.`,
        categoryRotation.recentCategories.length > 0
          ? `Recently visited (do NOT return to these yet): ${categoryRotation.recentCategories.map((c) => c.category).join(', ')}.`
          : '',
        categoryRotation.neverVisited.length > 0
          ? `Never visited yet (good candidates): ${categoryRotation.neverVisited.join(', ')}.`
          : '',
        'For early sessions, prefer starting with greetings_basics, then food_dining, transport, shopping as a natural learning flow.',
      ]
        .filter(Boolean)
        .join(' ')
    : '';

  const priorNotes = (input.sessionHistory ?? [])
    .slice(0, 3)
    .map((s) => {
      const parts: string[] = [];
      if (s.weaknesses?.length) parts.push(`weak: ${s.weaknesses.join(', ')}`);
      if (s.nextSteps?.length) parts.push(`next: ${s.nextSteps.join(', ')}`);
      return parts.length ? `[${s.topic}] ${parts.join('; ')}` : null;
    })
    .filter(Boolean);

  const priorNotesBlock =
    priorNotes.length > 0
      ? `PRIOR SESSION NOTES (from summary AI — address these):\n${priorNotes.join('\n')}`
      : '';

  const response = await client.responses.create({
    model: SESSION_MODEL,
    temperature: 0.3,
    input: [
      {
        role: 'system',
        content: [
          'You are a Japanese tutor that adapts each session based on learner history.',
          'Output valid JSON only with top-level keys: lesson, exercises, focus.',
          `Current user level: ${input.userLevel}. Apply levelInstructions() as hard constraints for allowed exercise types, difficulty range, and translation directions.`,
          '',
          categoryContext,
          '',
          priorNotesBlock,
          '',
          '1) Teaching flow:',
          '- Pick a specific topic WITHIN the chosen category. Teach it first, then quiz only what was taught.',
          '- Address prior session weaknesses and next-steps when relevant to the chosen topic.',
          '- If recentAccuracy > 80, increase challenge slightly; if < 50, reinforce fundamentals.',
          '- Personalize by connecting to previously studied phrases.',
          '',
          '2) Required output structure:',
          '- lesson must include: category (one of the category keys above), topic, explanation, culturalNote, keyPhrases (3-5 items).',
          '- each key phrase: japanese, romaji, english, usage.',
          '- every exercise must include: type, title, tags, difficulty, japanese, romaji, englishContext, plus type-specific fields.',
          'Exercise type-specific required fields:',
          ...exerciseFieldRequirements(input.userLevel),
          '',
          '3) Translation robustness:',
          'For every translation exercise, acceptedAnswers must include AT LEAST 3 valid English variants. Prioritize communicative intent: if a native speaker would understand the meaning correctly, include it as accepted.',
          '',
          '4) CRITICAL ROMAJI RULE: Every Japanese string anywhere in the output must include romaji in parentheses. Example: こんにちは (konnichiwa). Never output Japanese script without romaji.',
          '',
          '5) Exercise quality:',
          '- Vary exercise types within level constraints.',
          '- Cover at least 5 distinct phrases per session; do not reuse the same phrase in more than 2 exercises.',
          '- Do NOT generate two exercises that test the same phrase in the same way. If ありがとうございます (arigatou gozaimasu) appears in one multiple_choice exercise, do not create another multiple_choice that tests the same concept for that phrase.',
          '- For multiple_choice exercises: the "japanese" and "romaji" fields are metadata only and will NOT be shown to learners. They should store the key phrase for internal tracking.',
          '- For multiple_choice exercises: the "question" field is the ONLY text shown above choices and MUST provide clear context and be self-contained. Use one of these patterns: (a) "What does [phrase] mean?"; (b) a real-life scenario asking what to say; (c) "Which phrase means [English meaning]?". If referencing Japanese text, include it directly in the question string. NEVER use a vague question like "Which phrase is most appropriate?" without a scenario.',
          '- CRITICAL for multiple_choice: the question must NEVER require looking at "japanese"/"romaji" to make sense. The question + choices must form a complete quiz on their own.',
          '- CRITICAL: The "title" field is ignored and overridden. Do NOT include the answer or any hint to the answer in the "question" field. The question must test the learner WITHOUT revealing what the correct answer is.',
          levelInstructions(input.userLevel),
          ...(allowWritingExercises
            ? [
                'Japanese writing input is enabled for this learner. You may include writing-style prompts when useful.',
              ]
            : [
                'Japanese writing input is disabled. All expected learner input must be in romaji or English only.',
              ]),
          'Use practical language the learner can immediately use in Japan.',
          'Keep content coherent around the chosen topic.',
        ]
          .filter(Boolean)
          .join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          user: {
            id: input.userId,
            name: input.userName,
            level: input.userLevel,
            sessionHistory,
            recentAccuracy: input.recentAccuracy ?? null,
            totalSessionCount: input.totalSessionCount ?? 0,
            performanceInsights: input.performanceInsights ?? {
              overallAccuracy: 0,
              weakExerciseIds: [],
              strongExerciseIds: [],
              recentWrongAnswers: [],
            },
          },
          targetExerciseCount,
          requiredOutputExample: {
            lesson: {
              topic: 'Ordering at a restaurant',
              category: 'food_dining',
              explanation: 'When eating out in Japan, you can use a few polite phrases...',
              culturalNote: "In Japan, you don't tip. Service is included.",
              keyPhrases: [
                {
                  japanese: 'すみません',
                  romaji: 'sumimasen',
                  english: 'Excuse me',
                  usage: "Use to politely call the server's attention",
                },
              ],
            },
            exercises: [
              {
                type: 'multiple_choice',
                title: 'Choose the greeting',
                japanese: 'こんにちは',
                romaji: 'konnichiwa',
                englishContext: 'A common daytime greeting',
                tags: ['greetings'],
                difficulty: 1,
                question: 'What does こんにちは (konnichiwa) mean?',
                choices: ['Good morning', 'Good evening', 'Hello / Good afternoon', 'Goodbye'],
                correctAnswer: 'Hello / Good afternoon',
              },
              {
                type: 'translation',
                title: 'Translate the phrase',
                japanese: 'ありがとうございます',
                romaji: 'arigatou gozaimasu',
                englishContext: 'A polite expression of gratitude',
                tags: ['polite_expressions'],
                difficulty: 1,
                direction: 'ja_to_en',
                prompt: 'ありがとうございます (arigatou gozaimasu)',
                expectedAnswer: 'Thank you very much',
                acceptedAnswers: ['Thank you very much', 'Thank you'],
              },
            ],
            focus: 'restaurant_ordering',
          },
        }),
      },
    ],
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
          'You are a Japanese tutor providing a concise handoff note for the next session.',
          'Write ALL summary text in English. The summary, patterns_strong, patterns_weak, and next_focus fields must be in English. Japanese example words/phrases can be referenced inline, but surrounding analysis text must be English.',
          'Return JSON only with keys: summary, patterns_strong, patterns_weak, next_focus, levelUpRecommendation.',
          '',
          'RULES:',
          '1) Only reference exercises that appear in the provided session data. Never fabricate.',
          '2) patterns_strong: Identify PATTERNS and skills the learner demonstrates consistently — compare with prior sessions/journal when evidence exists. Do NOT list individual correct answers. Focus on what skills are ready to build upon.',
          '3) patterns_weak: Identify conceptual gaps and confusion patterns (particle errors, verb form mistakes, similar-word confusion). Do NOT list individual wrong answers. If accuracy is 100%, mention 1-2 growth areas (nuance, range).',
          '4) next_focus: Written as friendly collaborative statements the LEARNER sees (e.g., "Next time we\'ll focus on…", "Let\'s add these to your vocabulary…"). These also feed back to the session generator, so be specific about topics/grammar. Do NOT suggest external activities like flashcards or real-life practice.',
          '5) All Japanese must include romaji in parentheses. Example: こんにちは (konnichiwa).',
          input.suppressPromotion
            ? '6) levelUpRecommendation: MUST be null. A promotion was recently recommended — do NOT suggest another promotion this session.'
            : '6) levelUpRecommendation: null or {recommendedLevel, reason}. Recommend promotion only with consistent mastery (>=80% recent accuracy + strong evidence across multiple sessions). Never promote ready_for_japan. Do NOT recommend promotion in consecutive sessions.',
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
  console.warn('[ai] raw session summary output_text', {
    sessionId: input.sessionId,
    outputText: response.output_text,
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
    nextSteps: toStringArray(
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
      ['Complete one more short session tomorrow.'],
    ),
    accuracy,
    generatedAt: nowIso(),
    levelUpRecommendation,
  };

  const usage = getUsageFromResponse(response);
  console.warn('[ai] generated session summary', {
    sessionId: input.sessionId,
    tokensInput: usage.input,
    tokensOutput: usage.output,
  });

  return {
    summary,
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
