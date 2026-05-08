import { logError } from '$lib/server/logger';

export function runBackgroundTask(
  name: string,
  task: () => Promise<void>,
  meta?: Record<string, unknown>,
): void {
  const logFailure = (error: unknown) => {
    logError('background-task', `${name} failed`, { ...(meta ?? {}), error });
  };

  try {
    void task().catch(logFailure);
  } catch (error) {
    logFailure(error);
  }
}
