function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
  });
}

export async function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    throw new Error('timeout');
  }

  return Promise.race([promise, waitForAbort(signal)]);
}
