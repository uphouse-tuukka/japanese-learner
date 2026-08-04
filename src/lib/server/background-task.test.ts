import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockLogError } = vi.hoisted(() => ({
  mockLogError: vi.fn(),
}));

vi.mock('$lib/server/logger', () => ({
  logError: mockLogError,
}));

import { runBackgroundTask } from './background-task';

async function flushBackgroundTask(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('runBackgroundTask', () => {
  afterEach(() => {
    mockLogError.mockReset();
  });

  it('registers the guarded task with the supported deferred lifecycle', async () => {
    let finishTask: (() => void) | undefined;
    const task = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishTask = resolve;
        }),
    );
    const deferredTasks: Promise<unknown>[] = [];

    const result = await runBackgroundTask(
      'journal-update',
      task,
      { route: 'api/session/complete' },
      (taskPromise) => deferredTasks.push(taskPromise),
    );

    expect(result).toBeUndefined();
    expect(task).toHaveBeenCalledOnce();
    expect(deferredTasks).toHaveLength(1);

    finishTask?.();
    await deferredTasks[0];
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('awaits the task when no supported deferred lifecycle is available', async () => {
    let finishTask: (() => void) | undefined;
    const task = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishTask = resolve;
        }),
    );
    let returned = false;

    const result = runBackgroundTask('journal-update', task, {
      route: 'api/session/complete',
    }).then(() => {
      returned = true;
    });

    await flushBackgroundTask();
    expect(task).toHaveBeenCalledOnce();
    expect(returned).toBe(false);

    finishTask?.();
    await result;
    expect(returned).toBe(true);
  });

  it('logs rejected background promises once with the task name and metadata', async () => {
    const error = new Error('journal failed');

    await runBackgroundTask('journal-update', () => Promise.reject(error), {
      route: 'api/session/complete',
      sessionId: 'session-1',
    });

    expect(mockLogError).toHaveBeenCalledOnce();
    expect(mockLogError).toHaveBeenCalledWith('background-task', 'journal-update failed', {
      route: 'api/session/complete',
      sessionId: 'session-1',
      error,
    });
  });

  it('logs synchronous task failures once', async () => {
    const error = new Error('sync failure');

    await runBackgroundTask('sync-task', () => {
      throw error;
    });

    expect(mockLogError).toHaveBeenCalledOnce();
    expect(mockLogError).toHaveBeenCalledWith('background-task', 'sync-task failed', { error });
  });
});
