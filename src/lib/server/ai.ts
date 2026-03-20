import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { config } from "$lib/config";
import type {
  Exercise,
  ExerciseType,
  KeyPhrase,
  Lesson,
  SessionPlan,
  SessionSummary,
  TokenUsage,
  UserLevel,
} from "$lib/types";

const SESSION_MODEL = "gpt-4.1";

let openaiClient: OpenAI | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function getOpenAiClient(): OpenAI {
  const apiKey = config.openai.apiKey.trim();
  if (!apiKey) {
    throw new Error("[ai] Missing OpenAI API key in config.openai.apiKey");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`[ai] Invalid field "${fieldName}" in model output`);
  }
  return value.trim();
}

function flexString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function requireString(
  row: Record<string, unknown>,
  fieldLabel: string,
  ...keys: string[]
): string {
  const value = flexString(row, ...keys);
  if (!value) {
    throw new Error(
      `[ai] Missing required field "${fieldLabel}" in model output`,
    );
  }
  return value;
}

function toStringArray(
  value: unknown,
  fieldName: string,
  fallback: string[] = [],
): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const normalized = value.map((item) => String(item).trim()).filter(Boolean);
  if (normalized.length === 0 && fallback.length === 0) {
    throw new Error(
      `[ai] Invalid field "${fieldName}". Expected non-empty string array.`,
    );
  }
  return normalized.length > 0 ? normalized : fallback;
}

function isExerciseType(value: unknown): value is ExerciseType {
  return (
    value === "multiple_choice" ||
    value === "translation" ||
    value === "fill_blank" ||
    value === "reorder" ||
    value === "reading" ||
    value === "listening"
  );
}

function normalizeDifficulty(
  value: unknown,
  level: UserLevel,
): 1 | 2 | 3 | 4 | 5 {
  const parsed = Number(value);
  const rounded = Number.isFinite(parsed) ? Math.round(parsed) : 1;
  if (level === "absolute_beginner") {
    return Math.min(2, Math.max(1, rounded)) as 1 | 2;
  }
  if (level === "beginner") {
    return Math.min(3, Math.max(1, rounded)) as 1 | 2 | 3;
  }
  return Math.min(4, Math.max(2, rounded)) as 2 | 3 | 4;
}

function normalizeKeyPhrase(raw: unknown, index: number): KeyPhrase {
  if (!raw || typeof raw !== "object") {
    throw new Error(`[ai] keyPhrases[${index}] is not an object`);
  }
  const row = raw as Record<string, unknown>;
  return {
    japanese: requireString(
      row,
      `keyPhrases[${index}].japanese`,
      "japanese",
      "jp",
      "ja",
      "text",
    ),
    romaji: requireString(
      row,
      `keyPhrases[${index}].romaji`,
      "romaji",
      "romanji",
    ),
    english: requireString(
      row,
      `keyPhrases[${index}].english`,
      "english",
      "en",
      "meaning",
      "translation",
    ),
    usage: flexString(row, "usage", "context", "example", "note"),
  };
}

function normalizeLesson(raw: unknown): Lesson {
  if (!raw || typeof raw !== "object") {
    throw new Error("[ai] Missing lesson object in model output");
  }
  const row = raw as Record<string, unknown>;
  const keyPhrasesRaw = Array.isArray(row.keyPhrases) ? row.keyPhrases : [];
  if (keyPhrasesRaw.length > 8) {
    throw new Error("[ai] lesson.keyPhrases must contain 1-8 entries");
  }
  const keyPhrases = keyPhrasesRaw.slice(0, 5);
  if (keyPhrases.length === 0)
    throw new Error("[ai] lesson.keyPhrases must contain at least 1 entry");
  return {
    topic: requireString(row, "lesson.topic", "topic", "title", "subject"),
    explanation: requireString(
      row,
      "lesson.explanation",
      "explanation",
      "description",
      "content",
      "text",
    ),
    culturalNote: flexString(
      row,
      "culturalNote",
      "cultural_note",
      "culture",
      "note",
    ),
    keyPhrases: keyPhrases.map((phrase, index) =>
      normalizeKeyPhrase(phrase, index),
    ),
  };
}

function normalizeExercise(
  raw: unknown,
  index: number,
  level: UserLevel,
): Exercise {
  if (!raw || typeof raw !== "object") {
    throw new Error(`[ai] Exercise at index ${index} is not an object`);
  }

  const row = raw as Record<string, unknown>;
  const typeRaw = row.type;
  if (!isExerciseType(typeRaw)) {
    throw new Error(
      `[ai] Exercise at index ${index} has unsupported type: ${String(typeRaw)}`,
    );
  }

  const base = {
    id:
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim()
        : `ai-${randomUUID()}`,
    type: typeRaw,
    title:
      typeof row.title === "string" && row.title.trim()
        ? row.title.trim()
        : `Exercise ${index + 1}`,
    japanese: requireString(row, "japanese", "japanese", "jp", "ja", "text_ja"),
    romaji: requireString(row, "romaji", "romaji", "romanji", "romanization"),
    englishContext: flexString(
      row,
      "englishContext",
      "english_context",
      "english",
      "context",
      "meaning",
    ),
    tags: toStringArray(row.tags, "tags", ["travel", "teaching-session"]),
    difficulty: normalizeDifficulty(row.difficulty, level),
  };

  if (typeRaw === "multiple_choice") {
    const choices = toStringArray(
      row.choices ?? row.options ?? row.answers,
      "choices",
    );
    return {
      ...base,
      type: "multiple_choice",
      question: requireString(
        row,
        "question",
        "question",
        "prompt",
        "title",
        "text",
      ),
      choices,
      correctAnswer: requireString(
        row,
        "correctAnswer",
        "correctAnswer",
        "correct_answer",
        "answer",
        "correct",
      ),
      explanation:
        typeof row.explanation === "string" ? row.explanation : undefined,
    };
  }

  if (typeRaw === "translation") {
    const direction = row.direction === "ja_to_en" ? "ja_to_en" : "en_to_ja";
    const expectedAnswer = requireString(
      row,
      "expectedAnswer",
      "expectedAnswer",
      "expected_answer",
      "answer",
      "correct",
    );
    return {
      ...base,
      type: "translation",
      direction,
      prompt: requireString(
        row,
        "prompt",
        "prompt",
        "text",
        "sentence",
        "question",
      ),
      expectedAnswer,
      expectedRomaji:
        flexString(row, "expectedRomaji", "expected_romaji", "romaji_answer") ||
        undefined,
      acceptedAnswers: toStringArray(
        row.acceptedAnswers ?? row.accepted_answers ?? row.alternatives,
        "acceptedAnswers",
        [expectedAnswer],
      ),
    };
  }

  if (typeRaw === "fill_blank") {
    return {
      ...base,
      type: "fill_blank",
      sentence: requireString(row, "sentence", "sentence", "text", "prompt"),
      sentenceRomaji: requireString(
        row,
        "sentenceRomaji",
        "sentenceRomaji",
        "sentence_romaji",
        "romaji",
      ),
      sentenceEnglish: requireString(
        row,
        "sentenceEnglish",
        "sentenceEnglish",
        "sentence_english",
        "english",
        "translation",
      ),
      blank: requireString(row, "blank", "blank", "gap", "missing"),
      answer: requireString(
        row,
        "answer",
        "answer",
        "correctAnswer",
        "correct_answer",
      ),
      answerRomaji: requireString(
        row,
        "answerRomaji",
        "answerRomaji",
        "answer_romaji",
      ),
    };
  }

  if (typeRaw === "reorder") {
    const tokens = toStringArray(row.tokens, "tokens");
    return {
      ...base,
      type: "reorder",
      prompt: assertString(row.prompt, "prompt"),
      tokens,
      correctOrder: toStringArray(row.correctOrder, "correctOrder", tokens),
    };
  }

  if (typeRaw === "reading") {
    return {
      ...base,
      type: "reading",
      passage: assertString(row.passage, "passage"),
      passageRomaji: assertString(row.passageRomaji, "passageRomaji"),
      passageEnglish: assertString(row.passageEnglish, "passageEnglish"),
      question: assertString(row.question, "question"),
      answer: assertString(row.answer, "answer"),
    };
  }

  return {
    ...base,
    type: "listening",
    prompt: assertString(row.prompt, "prompt"),
    audioText: assertString(row.audioText, "audioText"),
    choices: toStringArray(row.choices, "choices"),
    correctAnswer: assertString(row.correctAnswer, "correctAnswer"),
  };
}

function validateExerciseSet(
  exercises: Exercise[],
  level: UserLevel,
): Exercise[] {
  if (exercises.length === 0) {
    throw new Error("[ai] exercises must not be empty");
  }

  if (level === "absolute_beginner") {
    for (const exercise of exercises) {
      if (
        exercise.type !== "multiple_choice" &&
        exercise.type !== "translation"
      ) {
        throw new Error(
          `[ai] Invalid exercise type for absolute beginner: ${exercise.type}`,
        );
      }
      if (exercise.difficulty > 2) {
        throw new Error("[ai] absolute_beginner received difficulty above 2");
      }
      if (
        exercise.type === "translation" &&
        exercise.direction !== "ja_to_en"
      ) {
        throw new Error(
          "[ai] absolute_beginner translation direction must be ja_to_en",
        );
      }
    }
  }

  if (level === "beginner") {
    for (const exercise of exercises) {
      if (
        exercise.type === "fill_blank" ||
        exercise.type === "reorder" ||
        exercise.type === "reading"
      ) {
        throw new Error(
          `[ai] Invalid exercise type for beginner: ${exercise.type}`,
        );
      }
      if (exercise.difficulty > 3) {
        throw new Error("[ai] beginner received difficulty above 3");
      }
    }
  }

  if (level === "lower_intermediate") {
    for (const exercise of exercises) {
      if (exercise.difficulty < 2 || exercise.difficulty > 4) {
        throw new Error(
          "[ai] lower_intermediate difficulty must be between 2 and 4",
        );
      }
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
  if (level === "absolute_beginner") {
    return [
      "User level is absolute_beginner.",
      "All lesson and exercise text must include romaji support.",
      "Teach only very basic travel survival Japanese (greetings, numbers, transport, restaurant basics).",
      "Allowed exercise types: multiple_choice and translation only.",
      "Translation must always be direction ja_to_en. Never require typing Japanese.",
      "Do not generate fill_blank, reorder, reading, or listening.",
      "Difficulty must be only 1-2.",
    ].join(" ");
  }

  if (level === "beginner") {
    return [
      "User level is beginner.",
      "Start introducing hiragana alongside romaji in a gentle way.",
      "Allowed exercise types: multiple_choice, translation, listening.",
      "Translation can be both directions, but en_to_ja answers must accept romaji.",
      "Difficulty must be 1-3.",
    ].join(" ");
  }

  return [
    "User level is lower_intermediate.",
    "All exercise types are allowed.",
    "Difficulty must be 2-4.",
    "Use practical travel context and polite, natural phrasing.",
  ].join(" ");
}

export async function generateSessionPlan(input: {
  userId: string;
  userName: string;
  userLevel: UserLevel;
  exerciseCount?: number;
  sessionHistory?: Array<{
    date: string;
    topic: string;
    accuracy: number;
    strengths: string[];
    weaknesses: string[];
    nextSteps: string[];
    keyPhrases: string[];
  }>;
  recentAccuracy?: number;
  coveredTopics?: string[];
  totalSessionCount?: number;
  performanceInsights?: {
    overallAccuracy: number;
    weakExerciseIds: string[];
    strongExerciseIds: string[];
    recentWrongAnswers: string[];
  };
}): Promise<SessionPlan> {
  const client = getOpenAiClient();
  const targetExerciseCount = Math.min(
    12,
    Math.max(4, Math.round(input.exerciseCount ?? 6)),
  );
  const sessionHistory = (input.sessionHistory ?? []).slice(0, 10);
  const recentTopics = sessionHistory
    .slice(0, 5)
    .map((item) => item.topic.trim())
    .filter(Boolean);

  const response = await client.responses.create({
    model: SESSION_MODEL,
    temperature: 0.3,
    input: [
      {
        role: "system",
        content: [
          "You are a Japanese tutor that adapts each session based on learner history.",
          "Output valid JSON only with top-level keys: lesson, exercises, focus.",
          "Tutor evolution rules:",
          "1) Never repeat a lesson topic from the learner's last 5 sessions.",
          "2) Address recent weaknesses directly in lesson explanation and exercise selection.",
          "3) Follow prior next-steps whenever possible.",
          "4) Progression threshold: if recentAccuracy > 80, increase challenge slightly; if recentAccuracy < 50, reinforce fundamentals.",
          "5) Staged curriculum by totalSessionCount: 0-10 travel survival only; 10-20 include daily life; 20+ broaden to practical social and work-adjacent situations.",
          "6) Personalize by connecting to previously studied phrases and mistakes.",
          "7) Vary exercise types inside one session (within level constraints).",
          "The session must teach one topic first, then quiz only what was taught.",
          "Lesson must include topic, explanation, culturalNote, keyPhrases (3-5 items).",
          "Each key phrase item must include japanese, romaji, english, usage.",
          "Every exercise must include japanese, romaji, englishContext, tags, difficulty, and type-specific fields.",
          "Exercise type schemas:",
          "multiple_choice requires: question (string), choices (array of 4 strings), correctAnswer (string matching one choice).",
          'translation requires: direction ("ja_to_en" or "en_to_ja"), prompt (string to translate), expectedAnswer (correct translation string), acceptedAnswers (array of alternative correct strings).',
          "fill_blank requires: sentence (with ___ for blank), sentenceRomaji, sentenceEnglish, blank (the missing word), answer, answerRomaji.",
          "reorder requires: prompt (string), tokens (array of words to arrange), correctOrder (array in correct sequence).",
          "reading requires: passage, passageRomaji, passageEnglish, question, answer.",
          "listening requires: prompt, audioText, choices (array of strings), correctAnswer.",
          "Exercise type field requirements:",
          ...(input.userLevel === "absolute_beginner"
            ? [
                "- multiple_choice: question, choices (string array of 4 options), correctAnswer (must match one choice), explanation (optional).",
                '- translation: direction ("ja_to_en" only), prompt (the text to translate), expectedAnswer (the correct translation), acceptedAnswers (string array of alternative correct answers).',
                'For absolute_beginner, translation direction must always be "ja_to_en".',
              ]
            : input.userLevel === "beginner"
              ? [
                  "- multiple_choice: question, choices (string array of 4 options), correctAnswer (must match one choice), explanation (optional).",
                  '- translation: direction ("ja_to_en" or "en_to_ja"), prompt (the text to translate), expectedAnswer (the correct translation), acceptedAnswers (string array of alternative correct answers).',
                  "- listening: prompt, audioText, choices (string array), correctAnswer (must match one choice).",
                ]
              : [
                  "- multiple_choice: question, choices (string array of 4 options), correctAnswer (must match one choice), explanation (optional).",
                  '- translation: direction ("ja_to_en" or "en_to_ja"), prompt (the text to translate), expectedAnswer (the correct translation), acceptedAnswers (string array of alternative correct answers).',
                  "- fill_blank: sentence, sentenceRomaji, sentenceEnglish, blank, answer, answerRomaji.",
                  "- reorder: prompt, tokens (string array), correctOrder (string array).",
                  "- reading: passage, passageRomaji, passageEnglish, question, answer.",
                  "- listening: prompt, audioText, choices (string array), correctAnswer (must match one choice).",
                ]),
          'For translation exercises, acceptedAnswers must include at least 3 natural alternative translations. Include common synonyms, informal variants, and shorter forms (e.g. for "Thank you very much" also accept "Thank you", "Thanks a lot").',
          'CRITICAL: All Japanese text everywhere — in exercises, lesson explanations, cultural notes, key phrases, and any other output — must always include romaji in parentheses. Example: こんにちは (konnichiwa). Never output Japanese script without its romaji reading. This is essential because beginners cannot read Japanese script.',
          'Exercise titles must be generic and must not reveal the answer. Use titles like "Translate the phrase", "Choose the meaning", "Fill in the blank" — never include the answer or topic-specific hint in the title.',
          'When generating exercises for a session, ensure variety: cover at least 5 distinct phrases or concepts even if the topic is narrow. Do not repeat the same phrase across more than 2 exercises.',
          'Exercise questions must be clear and direct. Instead of "What is the most natural English greeting for X in this situation?", write "What is the best English translation for X?" or "What does X mean?". Avoid vague phrasing like "in this situation" unless the situation is explicitly described.',
          levelInstructions(input.userLevel),
          "For absolute_beginner, never ask learner to type Japanese script.",
          "Use practical language the learner can immediately use in Japan.",
          `Do not use these recent topics: ${recentTopics.length ? recentTopics.join(", ") : "none"}.`,
          "Keep content coherent around the same lesson topic.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          user: {
            id: input.userId,
            name: input.userName,
            level: input.userLevel,
            sessionHistory,
            recentAccuracy: input.recentAccuracy ?? null,
            coveredTopics: input.coveredTopics ?? [],
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
              topic: "Ordering at a restaurant",
              explanation:
                "When eating out in Japan, you can use a few polite phrases...",
              culturalNote: "In Japan, you don't tip. Service is included.",
              keyPhrases: [
                {
                  japanese: "すみません",
                  romaji: "sumimasen",
                  english: "Excuse me",
                  usage: "Use to politely call the server's attention",
                },
              ],
            },
            exercises: [
              {
                type: "multiple_choice",
                title: "Choose the greeting",
                japanese: "こんにちは",
                romaji: "konnichiwa",
                englishContext: "A common daytime greeting",
                tags: ["greetings"],
                difficulty: 1,
                question: "What does こんにちは (konnichiwa) mean?",
                choices: [
                  "Good morning",
                  "Hello / Good afternoon",
                  "Good evening",
                  "Goodbye",
                ],
                correctAnswer: "Hello / Good afternoon",
              },
              {
                type: "translation",
                title: "Translate the phrase",
                japanese: "ありがとうございます",
                romaji: "arigatou gozaimasu",
                englishContext: "A polite expression of gratitude",
                tags: ["polite_expressions"],
                difficulty: 1,
                direction: "ja_to_en",
                prompt: "ありがとうございます (arigatou gozaimasu)",
                expectedAnswer: "Thank you very much",
                acceptedAnswers: ["Thank you very much", "Thank you"],
              },
            ],
            focus: "restaurant_ordering",
          },
        }),
      },
    ],
    text: {
      format: {
        type: "json_object",
      },
    },
  });

  if (!response.output_text) {
    throw new Error(
      "[ai] OpenAI response missing output_text for session generation",
    );
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
      validExercises.push(
        normalizeExercise(rawExercises[i], i, input.userLevel),
      );
    } catch (err) {
      console.warn(`[ai] Skipping exercise ${i}: ${(err as Error).message}`);
    }
  }
  if (validExercises.length === 0) {
    throw new Error(
      "[ai] No valid exercises could be parsed from model output",
    );
  }
  const exercises = validateExerciseSet(validExercises, input.userLevel);

  const minExercises = Math.ceil(targetExerciseCount / 2);
  if (exercises.length < minExercises) {
    throw new Error(
      `[ai] expected at least ${minExercises} exercises, received ${exercises.length}`,
    );
  }

  const usage = getUsageFromResponse(response);

  const plan: SessionPlan = {
    id: `session-${randomUUID()}`,
    userId: input.userId,
    mode: "ai",
    createdAt: nowIso(),
    model: usage.model,
    lesson,
    exercises,
    tokenUsage: {
      input: usage.input,
      output: usage.output,
    },
    metadata: {
      focus: assertString(parsed.focus, "focus"),
      exerciseCount: exercises.length,
      teachingFlow: "lesson_then_quiz",
      userLevel: input.userLevel,
    },
  };

  console.info("[ai] generated session plan", {
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
  lessonTopic?: string;
  exercises: Exercise[];
  results: Array<{
    exerciseId: string;
    answerText: string;
    isCorrect: boolean;
  }>;
}): Promise<{
  summary: SessionSummary;
  tokenUsage: Pick<
    TokenUsage,
    "model" | "tokensIn" | "tokensOut" | "tokensTotal"
  >;
}> {
  const client = getOpenAiClient();
  const accuracy =
    input.results.length === 0
      ? 0
      : Math.round(
          (input.results.filter((row) => row.isCorrect).length /
            input.results.length) *
            100,
        );

  const exercisesById = new Map<string, Exercise>();
  for (const exercise of input.exercises) {
    exercisesById.set(exercise.id, exercise);
  }

  const detailedResults = input.results.map((result) => {
    const exercise = exercisesById.get(result.exerciseId);
    return {
      exerciseId: result.exerciseId,
      type: exercise?.type ?? "unknown",
      title: exercise?.title ?? "Unknown exercise",
      prompt: exercise?.englishContext ?? "",
      answerText: result.answerText,
      isCorrect: result.isCorrect,
    };
  });

  const response = await client.responses.create({
    model: SESSION_MODEL,
    temperature: 0.2,
    input: [
      {
        role: "system",
        content: [
          "You are a Japanese tutor giving specific, actionable feedback based on actual answers.",
          "Return JSON only with keys: summary, strengths, weaknesses, nextSteps.",
          "CRITICAL RULES for accuracy:",
          "1) Only reference exercises and answers that actually appear in the results data. Never fabricate or assume exercises that were not in the session.",
          "2) 'weaknesses' must only describe mistakes the learner actually made during this session. Do not list topics that were not covered — those belong in nextSteps instead.",
          "3) 'nextSteps' should suggest what to learn next, including topics not yet covered.",
          "4) 'strengths' must reference specific correct answers from the session data.",
          "5) All Japanese text must include romaji in parentheses, e.g. こんにちは (konnichiwa). Never output Japanese without romaji.",
          "Reference exact phrases, exact topics, and concrete mistakes from the completed exercises.",
          "Keep feedback encouraging, practical, and travel-focused.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          sessionId: input.sessionId,
          userId: input.userId,
          userLevel: input.userLevel,
          lessonTopic: input.lessonTopic ?? "travel_japanese",
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
        }),
      },
    ],
    text: {
      format: {
        type: "json_object",
      },
    },
  });

  if (!response.output_text) {
    throw new Error(
      "[ai] OpenAI response missing output_text for summary generation",
    );
  }

  const parsed = JSON.parse(response.output_text) as {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    nextSteps: string[];
  };

  const summary: SessionSummary = {
    sessionId: input.sessionId,
    userId: input.userId,
    summary: assertString(parsed.summary, "summary"),
    strengths: toStringArray(parsed.strengths, "strengths", [
      "You completed the session.",
    ]),
    weaknesses: toStringArray(parsed.weaknesses, "weaknesses", [
      "Review any missed phrases once more.",
    ]),
    nextSteps: toStringArray(parsed.nextSteps, "nextSteps", [
      "Complete one more short session tomorrow.",
    ]),
    accuracy,
    generatedAt: nowIso(),
  };

  const usage = getUsageFromResponse(response);
  console.info("[ai] generated session summary", {
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

export const createSessionPlan = generateSessionPlan;
export const buildSessionPlan = generateSessionPlan;
export const summarizeSession = generateSessionSummary;
export const createSessionSummary = generateSessionSummary;
