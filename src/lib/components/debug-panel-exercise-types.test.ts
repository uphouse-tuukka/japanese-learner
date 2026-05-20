import { describe, expect, it } from 'vitest';

import { debugPanelExerciseTypes } from './debug-panel-exercise-types';

describe('debugPanelExerciseTypes', () => {
  it('includes speaking so microphone exercises can be generated from the debug panel', () => {
    expect(debugPanelExerciseTypes).toContain('speaking');
  });
});
