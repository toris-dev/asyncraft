import { describe, expect, it, vi } from 'vitest';
import {
  anySignal,
  asyncMap,
  circuitBreaker,
  createLimit,
  debounceAsync,
  memoize,
  retry,
  sleep,
  withTimeout,
  CircuitOpenError,
  RetryError,
} from '../src/index.js';

/**
 * Stability suite: resource cleanup, abort semantics, and stress behavior.
 * These tests pin down the package's runtime guarantees documented in the
 * README ("Stability guarantees") — a regression here is a breaking change.
 */
describe('abort reason handling', () => {
  it('rethrows an Error abort reason as-is', async () => {
    const controller = new AbortController();
    const cause = new Error('shutting down');
    controller.abort(cause);

    await expect(sleep(1000, { signal: controller.signal })).rejects.toBe(cause);
  });

  it('wraps a string abort reason in an Error with the same message', async () => {
    const controller = new AbortController();
    controller.abort('user cancelled');

    await expect(sleep(1000, { signal: controller.signal })).rejects.toThrow('user cancelled');
  });

  it('wraps a numeric abort reason', async () => {
    const controller = new AbortController();
    controller.abort(408);

    await expect(sleep(1000, { signal: controller.signal })).rejects.toThrow('408');
  });

  it('falls back to a generic message for plain-object abort reasons', async () => {
    const controller = new AbortController();
    controller.abort({ code: 'X' });

    await expect(sleep(1000, { signal: controller.signal })).rejects.toThrow(
      'The operation was aborted',
    );
  });
});

describe('resource cleanup', () => {
  it('sleep removes its abort listener after resolving normally', async () => {
    const controller = new AbortController();
    const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');

    await sleep(5, { signal: controller.signal });

    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('withTimeout clears its guard timer once the promise settles', async () => {
    vi.useFakeTimers();
    try {
      await withTimeout(Promise.resolve('fast'), 60_000);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('withTimeout removes its outer abort listener after settling', async () => {
    const controller = new AbortController();
    const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');

    await withTimeout(Promise.resolve(1), 1000, { signal: controller.signal });

    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('retry leaves no pending timers after abort during a delay', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new Error('boom'));

    const outcome = retry(fn, {
      retries: 5,
      minDelay: 60_000,
      jitter: false,
      signal: controller.signal,
    }).catch((e: unknown) => e);

    await vi.waitFor(() => {
      expect(fn).toHaveBeenCalledTimes(1);
    });
    controller.abort();
    await outcome;

    // The delay's setTimeout must have been cleared: nothing keeps the
    // event loop alive, so this test finishes in ms rather than 60s.
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('stress', () => {
  it('createLimit handles 500 queued tasks and returns to idle', async () => {
    const limit = createLimit(5);
    let running = 0;
    let peak = 0;

    const results = await Promise.all(
      Array.from({ length: 500 }, (_, i) =>
        limit(async () => {
          running++;
          peak = Math.max(peak, running);
          await Promise.resolve();
          running--;
          return i;
        }),
      ),
    );

    expect(peak).toBeLessThanOrEqual(5);
    expect(results).toEqual(Array.from({ length: 500 }, (_, i) => i));
    expect(limit.activeCount).toBe(0);
    expect(limit.pendingCount).toBe(0);
  });

  it('asyncMap processes 1000 items with bounded concurrency', async () => {
    const items = Array.from({ length: 1000 }, (_, i) => i);
    const results = await asyncMap(items, (n) => Promise.resolve(n * 2), { concurrency: 10 });
    expect(results).toEqual(items.map((n) => n * 2));
  });

  it('createLimit keeps limiting correctly when tasks reject', async () => {
    const limit = createLimit(2);
    const outcomes = await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) =>
        limit(() => (i % 3 === 0 ? Promise.reject(new Error(`fail ${i}`)) : Promise.resolve(i))),
      ),
    );

    const rejected = outcomes.filter((o) => o.status === 'rejected').length;
    expect(rejected).toBe(17); // i = 0, 3, 6, ..., 48
    expect(limit.activeCount).toBe(0);
    expect(limit.pendingCount).toBe(0);
  });
});

describe('edge cases', () => {
  it('sleep(0) resolves', async () => {
    await expect(sleep(0)).resolves.toBeUndefined();
  });

  it('asyncMap of an empty iterable resolves to []', async () => {
    await expect(asyncMap([], () => 1, { concurrency: 4 })).resolves.toEqual([]);
    await expect(asyncMap([], () => 1, { settled: true })).resolves.toEqual([]);
  });

  it('withTimeout works with a synchronous-resolving factory', async () => {
    await expect(withTimeout(() => Promise.resolve('sync'), 1000)).resolves.toBe('sync');
  });

  it('RetryError stringifies non-Error causes in its message', async () => {
    const error: unknown = await retry(
      () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'string failure';
      },
      { retries: 1, minDelay: 1, jitter: false },
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RetryError);
    expect((error as RetryError).message).toContain('string failure');
    expect((error as RetryError).cause).toBe('string failure');
  });

  it('retry treats a synchronous throw the same as a rejection', async () => {
    let calls = 0;
    const result = await retry(
      () => {
        calls++;
        if (calls < 2) throw new Error('sync throw');
        return 'recovered';
      },
      { minDelay: 1, jitter: false },
    );
    expect(result).toBe('recovered');
    expect(calls).toBe(2);
  });
});

describe('composition & resilience primitives', () => {
  it('memoize single-flights a burst of 100 concurrent calls into one invocation', async () => {
    const fn = vi.fn(async (n: number) => {
      await sleep(15);
      return n * 2;
    });
    const memo = memoize(fn);

    const results = await Promise.all(Array.from({ length: 100 }, () => memo(21)));
    expect(results.every((r) => r === 42)).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('circuitBreaker in front of retry stops retries once the dependency is down', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('dependency down'));
    const breaker = circuitBreaker(fn, { failureThreshold: 3 });

    // retry drives the breaker; after 3 failures the breaker opens and
    // subsequent attempts reject fast without calling fn again.
    await retry(() => breaker(), {
      retries: 10,
      minDelay: 1,
      jitter: false,
      shouldRetry: (err) => !(err instanceof CircuitOpenError),
    }).catch(() => undefined);

    expect(breaker.state).toBe('open');
    expect(fn).toHaveBeenCalledTimes(3); // not 11 — the breaker saved 8 calls
  });

  it('debounceAsync clears its timer on cancel (no dangling invocation)', async () => {
    const fn = vi.fn((n: number) => Promise.resolve(n));
    const debounced = debounceAsync(fn, { wait: 30 });

    const p = debounced(1);
    debounced.cancel();
    await expect(p).rejects.toThrow();

    await sleep(50); // well past the debounce window
    expect(fn).not.toHaveBeenCalled();
    expect(debounced.pending).toBe(false);
  });

  it('anySignal forwards an abort from a timeoutSignal-style source and cleans up', async () => {
    const outer = new AbortController();
    const inner = new AbortController();
    const removeSpy = vi.spyOn(inner.signal, 'removeEventListener');

    const combined = anySignal(outer.signal, inner.signal);
    expect(combined.aborted).toBe(false);

    inner.abort(new Error('inner won'));
    expect(combined.aborted).toBe(true);
    expect((combined.reason as Error).message).toBe('inner won');
    expect(removeSpy).toHaveBeenCalled();
  });
});
