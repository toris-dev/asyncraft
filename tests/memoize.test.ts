import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoize, sleep } from '../src/index.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('memoize', () => {
  it('caches resolved results by argument key', async () => {
    const fn = vi.fn((n: number) => Promise.resolve(n * 2));
    const memo = memoize(fn);

    await expect(memo(2)).resolves.toBe(4);
    await expect(memo(2)).resolves.toBe(4);
    await expect(memo(3)).resolves.toBe(6);
    expect(fn).toHaveBeenCalledTimes(2); // 2 and 3, not 2 twice
  });

  it('de-duplicates concurrent identical calls into one invocation (single-flight)', async () => {
    const fn = vi.fn(async (n: number) => {
      await sleep(20);
      return n;
    });
    const memo = memoize(fn);

    const results = await Promise.all([memo(1), memo(1), memo(1), memo(1)]);
    expect(results).toEqual([1, 1, 1, 1]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('single-flights even with ttl: 0 but does not cache the settled value', async () => {
    const fn = vi.fn(async (n: number) => {
      await sleep(10);
      return n;
    });
    const memo = memoize(fn, { ttl: 0 });

    await Promise.all([memo(5), memo(5)]);
    expect(fn).toHaveBeenCalledTimes(1);

    await memo(5); // previous already settled and expired
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('expires cached values after ttl', async () => {
    vi.useFakeTimers();
    const fn = vi.fn((n: number) => Promise.resolve(n));
    const memo = memoize(fn, { ttl: 1000 });

    await memo(1);
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(999);
    await memo(1);
    expect(fn).toHaveBeenCalledTimes(1); // still cached

    vi.advanceTimersByTime(2);
    await memo(1);
    expect(fn).toHaveBeenCalledTimes(2); // expired, recomputed
  });

  it('does not cache rejections by default', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue('ok');
    const memo = memoize(fn);

    await expect(memo()).rejects.toThrow('boom');
    await expect(memo()).resolves.toBe('ok'); // retried, not replayed
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('caches rejections when cacheRejections is true', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    const memo = memoize(fn, { cacheRejections: true });

    await expect(memo()).rejects.toThrow('boom');
    await expect(memo()).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1); // replayed from cache
  });

  it('uses a custom key function', async () => {
    const fn = vi.fn((user: { id: number; name: string }) => Promise.resolve(user.name));
    const memo = memoize(fn, { key: (user) => String(user.id) });

    await memo({ id: 1, name: 'a' });
    await memo({ id: 1, name: 'b' }); // same id → cached
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('evicts least-recently-used entries beyond maxSize', async () => {
    const fn = vi.fn((n: number) => Promise.resolve(n));
    const memo = memoize(fn, { maxSize: 2 });

    await memo(1); // cache: [1]           calls=1
    await memo(2); // cache: [1, 2]        calls=2
    await memo(1); // hit, refresh → [2, 1] calls=2
    await memo(3); // add, evict LRU 2 → [1, 3] calls=3
    await memo(1); // hit — 1 survived because it was recently used, calls=3
    await memo(2); // miss — 2 was evicted → recompute, calls=4

    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('throws for maxSize below 1', () => {
    expect(() => memoize(() => 1, { maxSize: 0 })).toThrow(TypeError);
  });

  it('clear() and delete() drop cached entries', async () => {
    const fn = vi.fn((n: number) => Promise.resolve(n));
    const memo = memoize(fn);

    await memo(1);
    await memo(2);
    expect(memo.delete(1)).toBe(true);
    expect(memo.delete(1)).toBe(false);
    await memo(1); // recomputed
    expect(fn).toHaveBeenCalledTimes(3);

    memo.clear();
    await memo(2); // recomputed
    expect(fn).toHaveBeenCalledTimes(4);
  });
});
