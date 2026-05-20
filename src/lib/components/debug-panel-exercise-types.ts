import type { ExerciseType } from '$lib/types';

export const debugPanelExerciseTypes = [
  'multiple_choice',
  'translation',
  'fill_blank',
  'reorder',
  'reading',
  'listening',
  'speaking',
] as const satisfies readonly ExerciseType[];
