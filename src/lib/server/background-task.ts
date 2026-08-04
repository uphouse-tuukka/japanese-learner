import { waitUntil } from '@vercel/functions';
import { logError } from '$lib/server/logger';

type DeferredLifecycle = (promise: Promise<unknown>) => void;

function getDefaultDeferredLifecycle(): DeferredLifecycle | undefined {
  return process.env.VERCEL ? waitUntil : undefined;
}

export async function runBackgroundTask(
  name: string,
  task: () => Promise<void>,
  meta?: Record<string, unknown>,
  defer: DeferredLifecycle | undefined = getDefaultDeferredLifecycle(),
): Promise<void> {
  const logFailure = (error: unknown) => {
    logError('background-task', `${name} failed`, { ...(meta ?? {}), error });
  };

  const guardedTask = Promise.resolve().then(task).catch(logFailure);

  if (defer) {
    try {
      defer(guardedTask);
      return;
    } catch (error) {
      logError('background-task', `${name} defer failed; awaiting task`, {
        ...(meta ?? {}),
        error,
      });
    }
  }

  await guardedTask;
}
