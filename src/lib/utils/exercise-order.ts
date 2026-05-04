import type { Exercise } from '$lib/types';

function shuffleArray<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function normalizeSentence(value: string): string {
  return value.trim();
}

export function orderExercisesForSession(
  exercises: Exercise[],
  random: () => number = Math.random,
): Exercise[] {
  const remaining = shuffleArray(exercises, random);
  if (remaining.length < 2) {
    return remaining;
  }

  const ordered: Exercise[] = [remaining.shift()!];

  while (remaining.length > 0) {
    const previousSentence = normalizeSentence(ordered[ordered.length - 1]!.japanese);
    const nextIndex = remaining.findIndex(
      (exercise) => normalizeSentence(exercise.japanese) !== previousSentence,
    );

    ordered.push(remaining.splice(nextIndex >= 0 ? nextIndex : 0, 1)[0]!);
  }

  return ordered;
}
