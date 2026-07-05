import { describe, expect, it } from 'vitest';
import { sleep } from '../src/index.js';

describe('sleep', () => {
  it('resolves after roughly the given duration', async () => {
    const start = Date.now();
    await sleep(30);
    expect(Date.now() - start).toBeGreaterThanOrEqual(25);
  });

  it('rejects when aborted mid-sleep', async () => {
    const controller = new AbortController();
    const outcome = sleep(10_000, { signal: controller.signal }).catch((e: unknown) => e);

    controller.abort();
    const error = (await outcome) as Error;
    expect(error.name).toBe('AbortError');
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('custom reason'));

    await expect(sleep(1000, { signal: controller.signal })).rejects.toThrow('custom reason');
  });
});
