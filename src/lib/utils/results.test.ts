import { describe, expect, it } from 'vitest';
import { calculateMaxCombo } from './results';

describe('calculateMaxCombo', () => {
  it('returns 0 for an empty result list', () => {
    expect(calculateMaxCombo([])).toBe(0);
  });

  it('returns 0 when all results are incorrect', () => {
    expect(calculateMaxCombo([{ isCorrect: false }, { isCorrect: false }])).toBe(0);
  });

  it('returns the result count when all answers are correct', () => {
    expect(calculateMaxCombo([{ isCorrect: true }, { isCorrect: true }, { isCorrect: true }])).toBe(
      3,
    );
  });

  it('returns the longest correct streak in a mixed sequence', () => {
    expect(
      calculateMaxCombo([
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: true },
      ]),
    ).toBe(2);
  });

  it('counts correct streaks at the start and end of the sequence', () => {
    expect(
      calculateMaxCombo([
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
      ]),
    ).toBe(3);
  });
});
