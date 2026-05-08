import type { TranslationExercise } from '$lib/types';

export interface DirectionDisplay {
  sourceLabel: string;
  targetLabel: string;
}

export type PromptDisplay =
  | { kind: 'japanese'; japanese: string; romaji: string }
  | { kind: 'english'; prompt: string };

export function buildDirectionDisplay(
  direction: TranslationExercise['direction'],
): DirectionDisplay {
  if (direction === 'ja_to_en') {
    return { sourceLabel: '日本語', targetLabel: 'English' };
  }

  return { sourceLabel: 'English', targetLabel: '日本語' };
}

export function buildHintText(expectedAnswer: string, hintLevel: number): string {
  if (hintLevel === 0) return '';
  if (hintLevel === 1) return expectedAnswer.charAt(0) + '...';
  return expectedAnswer.slice(0, 3) + '...';
}

export function buildAcceptedAnswers(
  exercise: Pick<TranslationExercise, 'expectedAnswer' | 'acceptedAnswers'>,
): string[] {
  return [...new Set([exercise.expectedAnswer, ...exercise.acceptedAnswers])];
}

export function buildPromptDisplay(
  exercise: Pick<TranslationExercise, 'direction' | 'japanese' | 'romaji' | 'prompt'>,
): PromptDisplay {
  if (exercise.direction === 'ja_to_en') {
    return { kind: 'japanese', japanese: exercise.japanese, romaji: exercise.romaji };
  }

  return { kind: 'english', prompt: exercise.prompt };
}
