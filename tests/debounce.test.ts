import { describe, expect, it, vi } from 'vitest';
import { debounceAsync } from '../src/index.js';

describe('debounceAsync', () => {
  it('collapses rapid calls into one invocation with the latest args', async () => {
    const fn = vi.fn((n: number) => Promise.resolve(n));
    const debounced = debounceAsync(fn, { wait: 20 });

    const p1 = debounced(1);
    const p2 = debounced(2);
    const p3 = debounced(3);

    const results = await Promise.all([p1, p2, p3]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
    expect(results).toEqual([3, 3, 3]); // all callers get the single result
  });

  it('runs again after the quiet period elapses', async () => {
    const fn = vi.fn((n: number) => Promise.resolve(n));
    const debounced = debounceAsync(fn, { wait: 10 });

    await debounced(1);
    await debounced(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('propagates rejection to all pending callers', async () => {
    const boom = new Error('boom');
    const fn = vi.fn(() => Promise.reject(boom));
    const debounced = debounceAsync(fn, { wait: 10 });

    const p1 = debounced();
    const p2 = debounced();

    await expect(p1).rejects.toBe(boom);
    await expect(p2).rejects.toBe(boom);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('exposes a pending flag', async () => {
    const debounced = debounceAsync((n: number) => Promise.resolve(n), { wait: 10 });
    expect(debounced.pending).toBe(false);

    const p = debounced(1);
    expect(debounced.pending).toBe(true);

    await p;
    expect(debounced.pending).toBe(false);
  });

  it('cancel() rejects pending callers and clears the timer', async () => {
    const fn = vi.fn((n: number) => Promise.resolve(n));
    const debounced = debounceAsync(fn, { wait: 20 });

    const p = debounced(1);
    debounced.cancel();

    await expect(p).rejects.toThrow('Debounced call cancelled');
    expect(debounced.pending).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it('cancel() rejects with a custom reason', async () => {
    const debounced = debounceAsync((n: number) => Promise.resolve(n), { wait: 20 });
    const reason = new Error('navigated away');

    const p = debounced(1);
    debounced.cancel(reason);
    await expect(p).rejects.toBe(reason);
  });

  it('cancel() with nothing pending is a no-op', () => {
    const debounced = debounceAsync((n: number) => Promise.resolve(n), { wait: 20 });
    expect(() => {
      debounced.cancel();
    }).not.toThrow();
  });
});
