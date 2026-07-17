import { mount, unmount } from 'svelte';
import { expect, it } from 'vitest';
import SpokenMissionTurn from './SpokenMissionTurn.svelte';
import {
  createSpokenMissionTurnActions,
  createSpokenMissionTurnProps,
  spokenMissionServerTurn,
  type SpokenMissionTurnFixtureInput,
} from './spoken-mission-turn.test-fixtures';

function findButton(label: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === label,
  );
  expect(button, `Expected a visible "${label}" button`).toBeDefined();
  return button!;
}

function clickButton(label: string): void {
  findButton(label).click();
}

async function withMountedTurn(
  input: SpokenMissionTurnFixtureInput,
  verify: (actions: ReturnType<typeof createSpokenMissionTurnActions>) => void,
): Promise<void> {
  const actions = createSpokenMissionTurnActions();
  const component = mount(SpokenMissionTurn, {
    target: document.body,
    props: createSpokenMissionTurnProps(input, actions),
  });

  try {
    verify(actions);
  } finally {
    await unmount(component);
    document.body.replaceChildren();
  }
}

it('routes visible controls through their focused action contracts', async () => {
  await withMountedTurn({}, (actions) => {
    clickButton('Listen');
    clickButton('Reveal written text');
    clickButton('Reveal English support');
    clickButton('Record response');

    expect(actions.audio.toggleServerLine).toHaveBeenCalledOnce();
    expect(actions.support.revealWritten).toHaveBeenCalledOnce();
    expect(actions.support.revealEnglish).toHaveBeenCalledOnce();
    expect(actions.recorder.start).toHaveBeenCalledOnce();
  });

  await withMountedTurn({ audioStatus: 'playing' }, (actions) => {
    clickButton('Stop audio');
    expect(actions.audio.toggleServerLine).toHaveBeenCalledOnce();
  });

  await withMountedTurn({ recorderStatus: 'recording' }, (actions) => {
    clickButton('Stop and assess');
    clickButton('Cancel');

    expect(actions.recorder.stop).toHaveBeenCalledOnce();
    expect(actions.recorder.cancel).toHaveBeenCalledOnce();
  });

  await withMountedTurn(
    {
      submissionState: 'feedback',
      assessment: {
        transcript: 'ラーメンを一つお願いします。',
        outcome: 'accepted',
        confidence: 'high',
        feedback: 'You ordered one ramen.',
      },
      pendingNextTurn: {
        ...spokenMissionServerTurn,
        turnNumber: 2,
        goalKey: 'respond',
        goalTitle: 'Respond',
      },
    },
    (actions) => {
      clickButton('Continue');
      expect(actions.assessment.continue).toHaveBeenCalledOnce();
    },
  );

  await withMountedTurn(
    {
      submissionState: 'feedback',
      assessment: {
        transcript: 'ラーメンですか。',
        outcome: 'retry',
        confidence: 'high',
        feedback: 'Try ordering one item.',
      },
    },
    (actions) => {
      clickButton('Record again');
      expect(actions.assessment.retryGoal).toHaveBeenCalledOnce();
    },
  );

  await withMountedTurn(
    {
      submissionState: 'error',
      submissionRecovery: 'retry_upload',
      hasPendingAudio: true,
      errorMessage: 'Could not reach the assessment service.',
    },
    (actions) => {
      clickButton('Retry upload');
      clickButton('Use Written Mission');

      expect(actions.recovery.retryUpload).toHaveBeenCalledOnce();
      expect(actions.recovery.chooseWritten).toHaveBeenCalledOnce();
    },
  );

  await withMountedTurn(
    {
      submissionState: 'error',
      submissionRecovery: 'record_again',
      errorMessage: 'Unsupported audio format.',
    },
    (actions) => {
      clickButton('Record again');
      expect(actions.recovery.recordAgain).toHaveBeenCalledOnce();
    },
  );
});

it.each([
  ['assessment processing', { submissionState: 'processing' as const }],
  [
    'accepted feedback',
    {
      submissionState: 'feedback' as const,
      assessment: {
        transcript: 'ラーメンを一つお願いします。',
        outcome: 'accepted' as const,
        confidence: 'high' as const,
        feedback: 'You ordered one ramen.',
      },
      pendingNextTurn: {
        ...spokenMissionServerTurn,
        turnNumber: 2,
        goalKey: 'respond' as const,
        goalTitle: 'Respond',
      },
    },
  ],
])('disables disclosure actions during %s', async (_case, input) => {
  await withMountedTurn(input, (actions) => {
    const writtenButton = findButton('Reveal written text');
    const englishButton = findButton('Reveal English support');

    expect(writtenButton.disabled).toBe(true);
    expect(englishButton.disabled).toBe(true);
    writtenButton.click();
    englishButton.click();
    expect(actions.support.revealWritten).not.toHaveBeenCalled();
    expect(actions.support.revealEnglish).not.toHaveBeenCalled();
  });
});

it.each(['retry', 'could_not_assess'] as const)(
  'keeps disclosure actions available after %s feedback',
  async (outcome) => {
    await withMountedTurn(
      {
        submissionState: 'feedback',
        assessment: {
          transcript: outcome === 'retry' ? 'ラーメンですか。' : null,
          outcome,
          confidence: outcome === 'retry' ? 'high' : null,
          feedback: outcome === 'retry' ? 'Try ordering one item.' : 'No speech was detected.',
        },
      },
      (actions) => {
        expect(findButton('Reveal written text').disabled).toBe(false);
        expect(findButton('Reveal English support').disabled).toBe(false);
        clickButton('Reveal written text');
        clickButton('Reveal English support');
        expect(actions.support.revealWritten).toHaveBeenCalledOnce();
        expect(actions.support.revealEnglish).toHaveBeenCalledOnce();
      },
    );
  },
);
