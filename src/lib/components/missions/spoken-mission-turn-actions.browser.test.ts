import { mount, unmount } from 'svelte';
import { expect, it } from 'vitest';
import SpokenMissionTurn from './SpokenMissionTurn.svelte';
import {
  createSpokenMissionTurnActions,
  createSpokenMissionTurnProps,
  spokenMissionServerTurn,
  type SpokenMissionTurnFixtureInput,
} from './spoken-mission-turn.test-fixtures';

function clickButton(label: string): void {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === label,
  );
  expect(button, `Expected a visible "${label}" button`).toBeDefined();
  button?.click();
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
    clickButton('Replay Japanese');
    clickButton('Reveal English support');
    clickButton('Record response');

    expect(actions.audio.toggleServerLine).toHaveBeenCalledOnce();
    expect(actions.support.reveal).toHaveBeenCalledOnce();
    expect(actions.recorder.start).toHaveBeenCalledOnce();
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
