import { afterEach, describe, expect, it, vi } from 'vitest';
import { circuitBreaker, CircuitOpenError } from '../src/index.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('circuitBreaker', () => {
  it('passes through calls and results while closed', async () => {
    const call = circuitBreaker((n: number) => Promise.resolve(n * 2));
    await expect(call(21)).resolves.toBe(42);
    expect(call.state).toBe('closed');
  });

  it('opens after failureThreshold consecutive failures', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('down'));
    const call = circuitBreaker(fn, { failureThreshold: 3 });

    for (let i = 0; i < 3; i++) {
      await expect(call()).rejects.toThrow('down');
    }

    expect(call.state).toBe('open');
    expect(call.failures).toBe(3);
  });

  it('rejects fast with CircuitOpenError while open, without calling fn', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('down'));
    const call = circuitBreaker(fn, { failureThreshold: 1 });

    await expect(call()).rejects.toThrow('down'); // trips
    expect(call.state).toBe('open');

    fn.mockClear();
    await expect(call()).rejects.toBeInstanceOf(CircuitOpenError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('a success resets the failure count while closed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValueOnce('ok')
      .mockRejectedValue(new Error('x'));
    const call = circuitBreaker(fn, { failureThreshold: 3 });

    await expect(call()).rejects.toThrow();
    await expect(call()).rejects.toThrow();
    await expect(call()).resolves.toBe('ok'); // resets failures to 0
    expect(call.failures).toBe(0);
    await expect(call()).rejects.toThrow();
    expect(call.state).toBe('closed'); // only 1 failure since reset
  });

  it('half-opens after resetTimeout and closes on a successful trial', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue('recovered');
    const call = circuitBreaker(fn, { failureThreshold: 1, resetTimeout: 10_000 });

    await expect(call()).rejects.toThrow('down');
    expect(call.state).toBe('open');

    vi.advanceTimersByTime(10_000);
    expect(call.state).toBe('half-open'); // reads flip the state

    await expect(call()).resolves.toBe('recovered');
    expect(call.state).toBe('closed');
  });

  it('reopens if the half-open trial fails', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValue(new Error('still down'));
    const call = circuitBreaker(fn, { failureThreshold: 1, resetTimeout: 5000 });

    await expect(call()).rejects.toThrow();
    vi.advanceTimersByTime(5000);
    expect(call.state).toBe('half-open');

    await expect(call()).rejects.toThrow('still down');
    expect(call.state).toBe('open');
  });

  it('requires successThreshold trials to close', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue('ok');
    const call = circuitBreaker(fn, {
      failureThreshold: 1,
      resetTimeout: 1000,
      successThreshold: 2,
    });

    await expect(call()).rejects.toThrow();
    vi.advanceTimersByTime(1000);

    await expect(call()).resolves.toBe('ok');
    expect(call.state).toBe('half-open'); // 1 of 2
    await expect(call()).resolves.toBe('ok');
    expect(call.state).toBe('closed'); // 2 of 2
  });

  it('does not trip on errors rejected by shouldTrip', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('client'));
    const call = circuitBreaker(fn, {
      failureThreshold: 2,
      shouldTrip: (err) => !(err instanceof Error && err.message === 'client'),
    });

    await expect(call()).rejects.toThrow('client');
    await expect(call()).rejects.toThrow('client');
    expect(call.state).toBe('closed');
    expect(call.failures).toBe(0);
  });

  it('reports state transitions via onStateChange', async () => {
    vi.useFakeTimers();
    const transitions: string[] = [];
    const fn = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue('ok');
    const call = circuitBreaker(fn, {
      failureThreshold: 1,
      resetTimeout: 1000,
      onStateChange: (state) => transitions.push(state),
    });

    await expect(call()).rejects.toThrow();
    vi.advanceTimersByTime(1000);
    expect(call.state).toBe('half-open');
    await expect(call()).resolves.toBe('ok');

    expect(transitions).toEqual(['open', 'half-open', 'closed']);
  });

  it('reset() returns the circuit to a clean closed state', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('down'));
    const call = circuitBreaker(fn, { failureThreshold: 1 });

    await expect(call()).rejects.toThrow();
    expect(call.state).toBe('open');

    call.reset();
    expect(call.state).toBe('closed');
    expect(call.failures).toBe(0);
  });
});
