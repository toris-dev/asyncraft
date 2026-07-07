import { describe, expect, it, vi } from 'vitest';
import { anySignal, timeoutSignal, TimeoutError } from '../src/index.js';

describe('timeoutSignal', () => {
  it('is not aborted before the delay', () => {
    const signal = timeoutSignal(10_000);
    expect(signal.aborted).toBe(false);
  });

  it('aborts with a TimeoutError after the delay', async () => {
    vi.useFakeTimers();
    try {
      const signal = timeoutSignal(1000);
      vi.advanceTimersByTime(1000);
      expect(signal.aborted).toBe(true);
      expect(signal.reason).toBeInstanceOf(TimeoutError);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('anySignal', () => {
  it('aborts when the first source aborts, with its reason', () => {
    const a = new AbortController();
    const b = new AbortController();
    const combined = anySignal(a.signal, b.signal);

    expect(combined.aborted).toBe(false);
    const reason = new Error('a wins');
    a.abort(reason);

    expect(combined.aborted).toBe(true);
    expect(combined.reason).toBe(reason);
  });

  it('is already aborted when a source is pre-aborted', () => {
    const a = new AbortController();
    a.abort(new Error('already'));
    const combined = anySignal(a.signal);
    expect(combined.aborted).toBe(true);
    expect((combined.reason as Error).message).toBe('already');
  });

  it('ignores null and undefined entries', () => {
    const a = new AbortController();
    const combined = anySignal(null, a.signal, undefined);
    expect(combined.aborted).toBe(false);
    a.abort();
    expect(combined.aborted).toBe(true);
  });

  it('returns a never-aborting signal when given no live signals', () => {
    const combined = anySignal(null, undefined);
    expect(combined.aborted).toBe(false);
  });

  it('removes listeners from the other sources after aborting', () => {
    const a = new AbortController();
    const b = new AbortController();
    const removeA = vi.spyOn(a.signal, 'removeEventListener');
    const removeB = vi.spyOn(b.signal, 'removeEventListener');

    const combined = anySignal(a.signal, b.signal);
    a.abort();

    expect(combined.aborted).toBe(true);
    expect(removeA).toHaveBeenCalled();
    expect(removeB).toHaveBeenCalled();
  });
});
