import { describe, expect, it } from 'vitest';
import { PORTFOLIO_MODEL, SESSION_MODEL } from '$lib/server/ai-models';

describe('AI model constants', () => {
  it('preserves the current session model string', () => {
    expect(SESSION_MODEL).toBe('gpt-5.4');
  });

  it('preserves the current portfolio model string', () => {
    expect(PORTFOLIO_MODEL).toBe('gpt-5.4');
  });
});
