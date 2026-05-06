type ComboResult = {
  isCorrect: boolean;
};

export function calculateMaxCombo(results: ComboResult[]): number {
  let currentCombo = 0;
  let maxCombo = 0;

  for (const result of results) {
    if (result.isCorrect) {
      currentCombo += 1;
      maxCombo = Math.max(maxCombo, currentCombo);
      continue;
    }

    currentCombo = 0;
  }

  return maxCombo;
}
