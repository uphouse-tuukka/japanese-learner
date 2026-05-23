import { describe, expect, it } from 'vitest';
import { shouldSubmitStoppedRecording } from './speaking-recorder-state';

describe('shouldSubmitStoppedRecording', () => {
  it('submits non-empty recordings stopped for checking', () => {
    expect(shouldSubmitStoppedRecording('submit', 1024)).toBe(true);
  });

  it('does not submit cancelled recordings even when audio data exists', () => {
    expect(shouldSubmitStoppedRecording('cancel', 1024)).toBe(false);
  });

  it('does not submit empty recorder output', () => {
    expect(shouldSubmitStoppedRecording('submit', 0)).toBe(false);
  });
});
