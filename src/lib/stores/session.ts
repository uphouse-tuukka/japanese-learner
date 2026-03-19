import { toStore } from 'svelte/store';
import type { Exercise, Session, SessionSummary } from '$lib/types';

export type ExerciseAnswer = {
exerciseId: string;
answerText: string;
isCorrect: boolean;
createdAt: string;
};

type SessionState = {
session: Session | null;
exercises: Exercise[];
answers: ExerciseAnswer[];
currentIndex: number;
summary: SessionSummary | null;
};

const stateInternal = $state<SessionState>({
session: null,
exercises: [],
answers: [],
currentIndex: 0,
summary: null
});

export const state = stateInternal;

export const session = toStore(
() => stateInternal.session,
(value) => {
stateInternal.session = value;
}
);

export const exercises = toStore(
() => stateInternal.exercises,
(value) => {
stateInternal.exercises = value;
}
);

export const answers = toStore(
() => stateInternal.answers,
(value) => {
stateInternal.answers = value;
}
);

export const currentIndex = toStore(
() => stateInternal.currentIndex,
(value) => {
stateInternal.currentIndex = value;
}
);

export const summary = toStore(
() => stateInternal.summary,
(value) => {
stateInternal.summary = value;
}
);

export function resetSession(): void {
stateInternal.session = null;
stateInternal.exercises = [];
stateInternal.answers = [];
stateInternal.currentIndex = 0;
stateInternal.summary = null;
}

export function startSession(nextSession: Session, nextExercises: Exercise[]): void {
stateInternal.session = nextSession;
stateInternal.exercises = nextExercises;
stateInternal.answers = [];
stateInternal.currentIndex = 0;
stateInternal.summary = null;
}

export function answerExercise(
index: number,
payload: Omit<ExerciseAnswer, 'createdAt'> & { createdAt?: string }
): void {
const next = [...stateInternal.answers];
next[index] = {
exerciseId: payload.exerciseId,
answerText: payload.answerText,
isCorrect: payload.isCorrect,
createdAt: payload.createdAt ?? new Date().toISOString()
};
stateInternal.answers = next;
}

export function nextExercise(): void {
stateInternal.currentIndex += 1;
}

export function completeSession(nextSummary: SessionSummary): void {
stateInternal.summary = nextSummary;
}
