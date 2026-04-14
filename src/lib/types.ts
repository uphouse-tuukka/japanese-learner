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
  category?: string;
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

export interface SessionMiniLesson {
  kind: 'related_phrase' | 'likely_reply' | 'nuance_upgrade' | 'follow_up';
  japanese: string;
  romaji: string;
  english: string;
  note: string;
}

export interface SessionSummary {
  sessionId: string;
  userId: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  nextSteps?: string[]; // legacy
  accuracy: number;
  generatedAt: string;
  miniLesson?: SessionMiniLesson | null;
  levelUpRecommendation?: LevelUpRecommendation | null;
}

export interface LevelUpRecommendation {
  recommendedLevel: UserLevel;
  reason: string;
}

export interface SessionMeta {
  summaryText: string;
  category?: string;
  topic: string;
  accuracy: number;
  strengths: string[];
  weaknesses: string[];
  nextSteps?: string[]; // legacy
  handoffNotes?: string[];
  exerciseTypes: string[];
  keyPhrases: string[];
  culturalNote?: string;
  miniLesson?: SessionMiniLesson | null;
  hadLevelUpRecommendation?: boolean;
}

export type ExerciseAnswerPayload = {
  exerciseId: string;
  answerText: string;
  isCorrect: boolean;
};

export type OnAnswer = (payload: ExerciseAnswerPayload) => void | Promise<void>;

export type XpReason =
  | 'exercise_correct'
  | 'session_complete'
  | 'perfect_score'
  | 'streak_bonus'
  | 'combo_bonus'
  | 'mission_complete'
  | 'mission_correct_response'
  | 'mission_natural_phrasing';

export interface XpTransaction {
  id: string;
  userId: string;
  sessionId: string | null;
  amount: number;
  reason: XpReason;
  createdAt: string;
}

export interface UserStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  dailyGoalMet: boolean;
  updatedAt: string;
}

export interface Milestone {
  key: string;
  name: string;
  nameJa: string;
  icon?: string;
  description: string;
  xpThreshold: number;
}

export interface UserMilestone {
  id: string;
  userId: string;
  milestoneKey: string;
  xpAtUnlock: number;
  createdAt: string;
}

export interface SessionXpBreakdown {
  exerciseXp: number;
  sessionBonusXp: number;
  perfectBonusXp: number;
  streakBonusXp: number;
  comboBonusXp: number;
  totalXp: number;
  newMilestones: Milestone[];
}

export interface GamificationStats {
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  dailyGoalMet: boolean;
  nextMilestone: Milestone | null;
  xpToNextMilestone: number;
}

// Mission types
export type MissionDifficulty = 'easy' | 'medium' | 'hard';
export type MissionMode = 'practice' | 'immersion';
export type MissionStatus = 'in_progress' | 'completed';

export interface Mission {
  id: string;
  title: string;
  category: string;
  difficulty: MissionDifficulty;
  sequence: number;
  scenarioPrompt: string;
  badgeEmoji: string;
  badgeName: string;
  badgeStatement: string;
  unlockSessionsRequired: number;
  startUnlocked: boolean;
}

export interface MissionWithProgress extends Mission {
  unlocked: boolean;
  completedPractice: boolean;
  completedImmersion: boolean;
  badgeEarned: boolean;
}

export interface UserMission {
  id: string;
  userId: string;
  missionId: string;
  mode: MissionMode;
  status: MissionStatus;
  exchanges: number;
  correctResponses: number;
  score: number;
  xpEarned: number;
  badgeEarned: boolean;
  conversationLog: MissionTurn[];
  completedAt: string | null;
  createdAt: string;
}

export interface MissionTurn {
  turnNumber: number;
  npcDialogue: {
    japanese: string;
    romaji: string;
  };
  userResponse: {
    japanese: string;
    romaji?: string;
  } | null;
  feedback: {
    correct: boolean;
    message: string;
  } | null;
  choices?: MissionChoice[]; // Practice mode only
  hint?: string; // Immersion mode only
}

export interface MissionChoice {
  japanese: string;
  romaji: string;
  english: string;
  isCorrect: boolean;
}

export interface UserBadge {
  id: string;
  userId: string;
  missionId: string;
  badgeEmoji: string;
  badgeName: string;
  badgeStatement: string;
  earnedAt: string;
}

export interface MissionCatalogResponse {
  missions: MissionWithProgress[];
  badges: UserBadge[];
}

export interface MissionStartResponse {
  userMissionId: string;
  turn: MissionTurn;
  sceneDescription: string;
  characterName: string;
  characterEmoji: string;
  totalTurns: number;
}

export interface MissionRespondRequest {
  userId: string;
  userMissionId: string;
  response: string;
  turnNumber: number;
}

export interface MissionRespondResponse {
  feedback: {
    correct: boolean;
    message: string;
  };
  nextTurn: MissionTurn | null; // null if last turn
  isComplete: boolean;
}

export interface MissionCompleteResponse {
  exchanges: number;
  correctResponses: number;
  score: number;
  passed: boolean;
  xpBreakdown: {
    missionCompletion: number;
    correctResponses: number;
    naturalPhrasing: number;
    total: number;
  };
  badgeEarned: UserBadge | null; // null if practice mode
  confidenceStatement: string | null;
}
