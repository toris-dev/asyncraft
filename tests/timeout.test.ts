import { describe, expect, it } from 'vitest';
import { sleep, withTimeout, TimeoutError } from '../src/index.js';

describe('withTimeout', () => {
  it('resolves when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000)).resolves.toBe(42);
  });

  it('rejects with TimeoutError when time runs out', async () => {
    const never = new Promise(() => {});
    await expect(withTimeout(never, 20)).rejects.toBeInstanceOf(TimeoutError);
  });

  it('uses the custom message', async () => {
    const never = new Promise(() => {});
    await expect(withTimeout(never, 20, { message: 'too slow!' })).rejects.toThrow('too slow!');
  });

  it('propagates rejection from the inner promise', async () => {
    const boom = new Error('boom');
    await expect(withTimeout(Promise.reject(boom), 1000)).rejects.toBe(boom);
  });

  it('aborts the forwarded signal on timeout', async () => {
    let aborted = false;

    await withTimeout(
      (signal) =>
        new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => {
            aborted = true;
            resolve();
          });
        }),
      20,
    ).catch(() => {});

    expect(aborted).toBe(true);
  });

  it('rejects when the outer signal aborts first', async () => {
    const controller = new AbortController();
    const promise = withTimeout(sleep(10_000), 5_000, { signal: controller.signal });
    const outcome = promise.catch((e: unknown) => e);

    controller.abort();
    const error = (await outcome) as Error;
    expect(error.name).toBe('AbortError');
  });

  it('rejects immediately when the outer signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      withTimeout(Promise.resolve('never seen'), 1000, { signal: controller.signal }),
    ).rejects.toThrow();
  });
});
