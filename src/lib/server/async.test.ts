import { describe, expect, it } from 'vitest';
import { withAbort } from './async';

describe('withAbort', () => {
  it('resolves when the promise resolves before the signal aborts', async () => {
    const controller = new AbortController();

    await expect(withAbort(Promise.resolve('done'), controller.signal)).resolves.toBe('done');
  });

  it('rejects with a timeout error when the signal aborts first', async () => {
    const controller = new AbortController();
    const result = withAbort(new Promise<string>(() => undefined), controller.signal);

    controller.abort('timeout');

    await expect(result).rejects.toThrow('timeout');
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort('timeout');

    await expect(withAbort(Promise.resolve('done'), controller.signal)).rejects.toThrow('timeout');
  });
});
