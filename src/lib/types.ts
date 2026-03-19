export type UserLevel = 'absolute_beginner' | 'beginner' | 'lower_intermediate';

export interface User {
id: string;
name: string;
level: UserLevel;
createdAt: string;
updatedAt: string;
lastActiveAt: string | null;
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

export interface SessionPlan {
id: string;
userId: string;
mode: SessionMode;
createdAt: string;
model: string | null;
exercises: Exercise[];
tokenUsage: Pick<TokenUsage, 'model' | 'tokensIn' | 'tokensOut' | 'tokensTotal'> | null;
metadata: {
focus: string;
exerciseCount: number;
selectionStrategy: string;
[source: string]: unknown;
};
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
}

export type ExerciseAnswerPayload = {
exerciseId: string;
answerText: string;
isCorrect: boolean;
};

export type OnAnswer = (payload: ExerciseAnswerPayload) => void | Promise<void>;
