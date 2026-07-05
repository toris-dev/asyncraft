import { describe, expectTypeOf, it } from 'vitest';
import {
  asyncMap,
  createLimit,
  retry,
  sleep,
  withTimeout,
  RetryError,
  TimeoutError,
  type LimitFunction,
  type SettledResult,
} from '../../src/index.js';

/**
 * Type-contract tests: compiled (not executed) by vitest's typecheck runner.
 * A change that breaks inference or loosens a public type fails the build,
 * so consumers' inferred types are part of the tested API surface.
 */
describe('retry types', () => {
  it('infers the resolved type from sync and async functions', () => {
    expectTypeOf(retry(() => 42)).toEqualTypeOf<Promise<number>>();
    expectTypeOf(retry(async () => 'x')).toEqualTypeOf<Promise<string>>();
  });

  it('passes the attempt number to fn', () => {
    void retry((attempt) => {
      expectTypeOf(attempt).toEqualTypeOf<number>();
      return attempt;
    });
  });

  it('rejects wrong option types', () => {
    // @ts-expect-error retries must be a number
    void retry(() => 1, { retries: '3' });
    // @ts-expect-error unknown option
    void retry(() => 1, { attempts: 3 });
  });
});

describe('withTimeout types', () => {
  it('accepts a promise or a signal-receiving factory', () => {
    expectTypeOf(withTimeout(Promise.resolve(1), 10)).toEqualTypeOf<Promise<number>>();
    expectTypeOf(
      withTimeout((signal) => {
        expectTypeOf(signal).toEqualTypeOf<AbortSignal>();
        return Promise.resolve('a');
      }, 10),
    ).toEqualTypeOf<Promise<string>>();
  });
});

describe('createLimit types', () => {
  it('returns a typed scheduler with readonly counters', () => {
    const limit: LimitFunction = createLimit(2);
    expectTypeOf(limit(() => 1)).toEqualTypeOf<Promise<number>>();
    expectTypeOf(limit(async () => 'x')).toEqualTypeOf<Promise<string>>();
    expectTypeOf(limit.activeCount).toEqualTypeOf<number>();
    expectTypeOf(limit.pendingCount).toEqualTypeOf<number>();

    // @ts-expect-error activeCount is readonly
    limit.activeCount = 5;
    // @ts-expect-error pendingCount is readonly
    limit.pendingCount = 5;
  });
});

describe('asyncMap types', () => {
  it('returns R[] by default', () => {
    expectTypeOf(asyncMap([1, 2], (n) => String(n))).toEqualTypeOf<Promise<string[]>>();
    expectTypeOf(asyncMap([1, 2], async (n) => n * 2, { concurrency: 2 })).toEqualTypeOf<
      Promise<number[]>
    >();
  });

  it('returns SettledResult<R>[] when settled: true', () => {
    expectTypeOf(asyncMap([1, 2], (n) => String(n), { settled: true })).toEqualTypeOf<
      Promise<SettledResult<string>[]>
    >();
  });

  it('narrows SettledResult by status', async () => {
    const results = await asyncMap([1], (n) => n, { settled: true });
    const first = results[0];
    if (first?.status === 'fulfilled') {
      expectTypeOf(first.value).toEqualTypeOf<number>();
    } else if (first?.status === 'rejected') {
      expectTypeOf(first.reason).toEqualTypeOf<unknown>();
    }
  });

  it('accepts any iterable and passes the index', () => {
    void asyncMap(new Set(['a']), (item, index) => {
      expectTypeOf(item).toEqualTypeOf<string>();
      expectTypeOf(index).toEqualTypeOf<number>();
      return item;
    });
  });
});

describe('error types', () => {
  it('exposes typed fields and remains an Error', () => {
    const retryError: Error = new RetryError(new Error('x'), 3);
    const timeoutError: Error = new TimeoutError();
    expectTypeOf(new RetryError('cause', 2).attempts).toEqualTypeOf<number>();
    expectTypeOf(new RetryError('cause', 2).cause).toEqualTypeOf<unknown>();
    void retryError;
    void timeoutError;
  });
});

describe('sleep types', () => {
  it('resolves to void and accepts an optional signal', () => {
    expectTypeOf(sleep(10)).toEqualTypeOf<Promise<void>>();
    expectTypeOf(sleep(10, { signal: new AbortController().signal })).toEqualTypeOf<
      Promise<void>
    >();
  });
});
