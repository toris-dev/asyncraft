import { describe, expect, it, vi } from 'vitest';
import { retry, RetryError } from '../src/index.js';

describe('retry', () => {
  it('returns the result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(retry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries until success', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom 1'))
      .mockRejectedValueOnce(new Error('boom 2'))
      .mockResolvedValue('ok');

    await expect(retry(fn, { minDelay: 1, jitter: false })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('passes the attempt number to fn', async () => {
    const attempts: number[] = [];
    await retry(
      (attempt) => {
        attempts.push(attempt);
        if (attempt < 3) throw new Error('nope');
        return 'done';
      },
      { minDelay: 1, jitter: false },
    );
    expect(attempts).toEqual([1, 2, 3]);
  });

  it('throws RetryError with the last error as cause when exhausted', async () => {
    const last = new Error('final failure');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockRejectedValue(last);

    const error: unknown = await retry(fn, { retries: 2, minDelay: 1 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RetryError);
    expect((error as RetryError).cause).toBe(last);
    expect((error as RetryError).attempts).toBe(3);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('rethrows immediately when shouldRetry returns false', async () => {
    const fatal = new Error('fatal');
    const fn = vi.fn().mockRejectedValue(fatal);

    await expect(retry(fn, { retries: 5, minDelay: 1, shouldRetry: () => false })).rejects.toBe(
      fatal,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects retries: 0', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(retry(fn, { retries: 0 })).rejects.toBeInstanceOf(RetryError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('applies exponential backoff delays', async () => {
    const delays: number[] = [];
    const fn = vi.fn().mockRejectedValue(new Error('boom'));

    await retry(fn, {
      retries: 3,
      minDelay: 10,
      factor: 2,
      jitter: false,
      onRetry: (_error, _attempt, delay) => delays.push(delay),
    }).catch(() => {});

    expect(delays).toEqual([10, 20, 40]);
  });

  it('caps delays at maxDelay', async () => {
    const delays: number[] = [];
    const fn = vi.fn().mockRejectedValue(new Error('boom'));

    await retry(fn, {
      retries: 4,
      minDelay: 10,
      maxDelay: 25,
      factor: 2,
      jitter: false,
      onRetry: (_error, _attempt, delay) => delays.push(delay),
    }).catch(() => {});

    expect(delays).toEqual([10, 20, 25, 25]);
  });

  it('stops when the signal aborts mid-delay', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new Error('boom'));

    const promise = retry(fn, {
      retries: 10,
      minDelay: 5_000,
      jitter: false,
      signal: controller.signal,
    });
    const outcome = promise.catch((e: unknown) => e);

    await vi.waitFor(() => {
      expect(fn).toHaveBeenCalledTimes(1);
    });
    controller.abort();

    const error = (await outcome) as Error;
    expect(error.name).toBe('AbortError');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not call fn when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn();

    await expect(retry(fn, { signal: controller.signal })).rejects.toThrow();
    expect(fn).not.toHaveBeenCalled();
  });
});
