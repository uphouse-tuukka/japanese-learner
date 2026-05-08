import { randomUUID } from 'node:crypto';

import { LEVEL_RULES } from '$lib/server/ai-session-prompts';
import { logWarn } from '$lib/server/logger';
import type {
  Exercise,
  ExerciseType,
  KeyPhrase,
  Lesson,
  SessionMiniLesson,
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
  const match = trimmed.match(INLINE_ROMAJI_PATTERN);
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

export function normalizePublicChallengeLesson(lesson: Lesson): Lesson {
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

export function normalizePublicChallengeExercise(exercise: Exercise): Exercise {
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

export function assertString(value: unknown, fieldName: string): string {
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

export function toStringArray(
  value: unknown,
  fieldName: string,
  fallback: string[] = [],
): string[] {
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

export function normalizeMiniLesson(raw: unknown): SessionMiniLesson | null {
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

export function normalizeLesson(raw: unknown): Lesson {
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

export function normalizeExercise(raw: unknown, index: number, level: UserLevel): Exercise {
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
      logWarn('ai', 'multiple_choice correctAnswer not in choices; using first choice', {
        exerciseIndex: index,
        type: typeRaw,
        choiceCount: choices.length,
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
    logWarn('ai', 'listening correctAnswer not in choices; using first choice', {
      exerciseIndex: index,
      type: typeRaw,
      choiceCount: listeningChoices.length,
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

export function validateExerciseSet(exercises: Exercise[], level: UserLevel): Exercise[] {
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
