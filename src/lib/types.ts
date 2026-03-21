export type UserLevel =
  | 'absolute_beginner'
  | 'beginner'
  | 'elementary'
  | 'pre_intermediate'
  | 'intermediate'
  | 'upper_intermediate'
  | 'advanced'
  | 'ready_for_japan';

export const LEVEL_ORDER: UserLevel[] = [
  'absolute_beginner',
  'beginner',
  'elementary',
  'pre_intermediate',
  'intermediate',
  'upper_intermediate',
  'advanced',
  'ready_for_japan',
];

export const LEVEL_LABELS: Record<UserLevel, string> = {
  absolute_beginner: 'Absolute Beginner',
  beginner: 'Beginner',
  elementary: 'Elementary',
  pre_intermediate: 'Pre-Intermediate',
  intermediate: 'Intermediate',
  upper_intermediate: 'Upper Intermediate',
  advanced: 'Advanced',
  ready_for_japan: 'Ready for Japan 🇯🇵',
};

export interface User {
  id: string;
  name: string;
  level: UserLevel;
  japaneseWritingEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
  progressJournal: string | null;
}

export type SessionMode = 'ai' | 'practice';
export type SessionStatus = 'planned' | 'completed' | 'error';

export interface Session {
  id: string;
  userId: string;
  mode: SessionMode;
  status: SessionStatus;
  model: string | null;
  tokenInput: number;
  tokenOutput: number;
  summary: string | null;
  createdAt: string;
  completedAt: string | null;
}

export type ExerciseType =
  | 'multiple_choice'
  | 'translation'
  | 'fill_blank'
  | 'reorder'
  | 'reading'
  | 'listening';

export interface BaseExercise {
  id: string;
  type: ExerciseType;
  title: string;
  japanese: string;
  romaji: string;
  englishContext: string;
  tags: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface MultipleChoiceExercise extends BaseExercise {
  type: 'multiple_choice';
  question: string;
  choices: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface TranslationExercise extends BaseExercise {
  type: 'translation';
  direction: 'en_to_ja' | 'ja_to_en';
  prompt: string;
  expectedAnswer: string;
  expectedRomaji?: string;
  acceptedAnswers: string[];
}

export interface FillBlankExercise extends BaseExercise {
  type: 'fill_blank';
  sentence: string;
  sentenceRomaji: string;
  sentenceEnglish: string;
  blank: string;
  answer: string;
  answerRomaji: string;
}

export interface ReorderExercise extends BaseExercise {
  type: 'reorder';
  prompt: string;
  tokens: string[];
  correctOrder: string[];
}

export interface ReadingExercise extends BaseExercise {
  type: 'reading';
  passage: string;
  passageRomaji: string;
  passageEnglish: string;
  question: string;
  answer: string;
}

export interface ListeningExercise extends BaseExercise {
  type: 'listening';
  prompt: string;
  audioText: string;
  choices: string[];
  correctAnswer: string;
}

export type Exercise =
  | MultipleChoiceExercise
  | TranslationExercise
  | FillBlankExercise
  | ReorderExercise
  | ReadingExercise
  | ListeningExercise;

export interface SessionExercise {
  sessionId: string;
  exerciseId: string;
  orderIndex: number;
  exercise: Exercise;
}

export interface TokenUsage {
  id: string;
  userId: string;
  sessionId: string | null;
  model: string;
  tokensIn: number;
  tokensOut: number;
  tokensTotal: number;
  createdAt: string;
}

export interface KeyPhrase {
  japanese: string;
  romaji: string;
  english: string;
  usage: string;
}

export interface Lesson {
  topic: string;
  explanation: string;
  culturalNote: string;
  keyPhrases: KeyPhrase[];
}

export interface SessionPlan {
  id: string;
  userId: string;
  mode: SessionMode;
  createdAt: string;
  model: string;
  lesson: Lesson;
  exercises: Exercise[];
  tokenUsage: {
    input: number;
    output: number;
  };
  metadata: Record<string, unknown>;
}

export interface SessionSummary {
  sessionId: string;
  userId: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  nextSteps: string[];
  accuracy: number;
  generatedAt: string;
  levelUpRecommendation?: LevelUpRecommendation | null;
}

export interface LevelUpRecommendation {
  recommendedLevel: UserLevel;
  reason: string;
}

export interface SessionMeta {
  summaryText: string;
  topic: string;
  accuracy: number;
  strengths: string[];
  weaknesses: string[];
  nextSteps: string[];
  exerciseTypes: string[];
  keyPhrases: string[];
}

export type ExerciseAnswerPayload = {
  exerciseId: string;
  answerText: string;
  isCorrect: boolean;
};

export type OnAnswer = (payload: ExerciseAnswerPayload) => void | Promise<void>;
