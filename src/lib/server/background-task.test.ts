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

  it('runs a background task without returning a promise', async () => {
    const task = vi.fn().mockResolvedValue(undefined);

    const result = runBackgroundTask('journal-update', task, { route: 'api/session/complete' });

    expect(result).toBeUndefined();
    expect(task).toHaveBeenCalledOnce();
    await flushBackgroundTask();
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('logs rejected background promises once with the task name and metadata', async () => {
    const error = new Error('journal failed');

    runBackgroundTask('journal-update', () => Promise.reject(error), {
      route: 'api/session/complete',
      sessionId: 'session-1',
    });

    await flushBackgroundTask();

    expect(mockLogError).toHaveBeenCalledOnce();
    expect(mockLogError).toHaveBeenCalledWith('background-task', 'journal-update failed', {
      route: 'api/session/complete',
      sessionId: 'session-1',
      error,
    });
  });

  it('logs synchronous task failures once', async () => {
    const error = new Error('sync failure');

    runBackgroundTask('sync-task', () => {
      throw error;
    });

    await flushBackgroundTask();

    expect(mockLogError).toHaveBeenCalledOnce();
    expect(mockLogError).toHaveBeenCalledWith('background-task', 'sync-task failed', { error });
  });
});
