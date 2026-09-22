import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMonitorFetch } from './monitor-fetch';

describe('monitor fetch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries a transient network failure once and returns the success response', async () => {
    const success = new Response('ok', { status: 200 });
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(success);
    const monitorFetch = createMonitorFetch(fetchImpl as typeof fetch, { retryDelayMs: 100 });

    const pending = monitorFetch('https://example.test/source');
    await vi.advanceTimersByTimeAsync(100);

    const response = await pending;
    expect(response).toBe(success);
    expect(await response.text()).toBe('ok');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][1]?.signal).not.toBe(fetchImpl.mock.calls[1][1]?.signal);
  });

  it('propagates a persistent network failure after one retry', async () => {
    const failure = new TypeError('network down');
    const fetchImpl = vi.fn().mockRejectedValue(failure);
    const monitorFetch = createMonitorFetch(fetchImpl as typeof fetch, { retryDelayMs: 100 });

    const pending = monitorFetch('https://example.test/source');
    const assertion = expect(pending).rejects.toBe(failure);
    await vi.advanceTimersByTimeAsync(100);

    await assertion;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-retryable 404 response', async () => {
    const notFound = new Response('missing', { status: 404 });
    const fetchImpl = vi.fn().mockResolvedValue(notFound);
    const monitorFetch = createMonitorFetch(fetchImpl as typeof fetch);

    await expect(monitorFetch('https://example.test/source')).resolves.toBe(notFound);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('honors an explicit non-timeout cancellation without retrying', async () => {
    const cancellation = new Error('stop monitoring');
    const caller = new AbortController();
    caller.abort(cancellation);
    const fetchImpl = vi.fn();
    const monitorFetch = createMonitorFetch(fetchImpl as typeof fetch, { retryDelayMs: 100 });

    await expect(monitorFetch('https://example.test/source', { signal: caller.signal })).rejects.toBe(cancellation);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('gives a retry a fresh timeout when the caller timeout is exhausted', async () => {
    const caller = new AbortController();
    const signals: AbortSignal[] = [];
    const fetchImpl = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal;
      signals.push(signal);
      if (signals.length === 1) {
        return new Promise<Response>((_, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        });
      }
      return new Promise<Response>(resolve => {
        setTimeout(() => resolve(new Response('ok')), 25);
      });
    });
    const monitorFetch = createMonitorFetch(fetchImpl as typeof fetch, { timeoutMs: 50, retryDelayMs: 0 });
    setTimeout(() => caller.abort(new DOMException('The operation timed out.', 'TimeoutError')), 50);

    const pending = monitorFetch('https://example.test/source', { signal: caller.signal });
    const assertion = expect(pending).resolves.toHaveProperty('status', 200);
    await vi.advanceTimersByTimeAsync(50);
    await vi.runOnlyPendingTimersAsync();
    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(25);
    await assertion;
  });

  it('keeps the timeout active while a response body is being drained', async () => {
    const signals: AbortSignal[] = [];
    const cancel = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal;
      signals.push(signal);
      if (signals.length === 1) {
        const stalled = {
          status: 200,
          headers: new Headers(),
          body: { cancel },
          clone: () => ({
            arrayBuffer: () => new Promise<ArrayBuffer>((_, reject) => {
              signal.addEventListener('abort', () => reject(signal.reason), { once: true });
            }),
          }),
        } as unknown as Response;
        return Promise.resolve(stalled);
      }
      return Promise.resolve(new Response('ok'));
    });
    const monitorFetch = createMonitorFetch(fetchImpl as typeof fetch, { timeoutMs: 25, retryDelayMs: 0 });
    const pending = monitorFetch('https://example.test/source');
    const assertion = expect(pending).resolves.toHaveProperty('status', 200);

    await vi.advanceTimersByTimeAsync(25);
    await vi.runOnlyPendingTimersAsync();

    await assertion;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('reports exhausted deadlines as fetch failures rather than source changes', async () => {
    const fetchImpl = vi.fn((_: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true });
    }));
    const pending = createMonitorFetch(fetchImpl as typeof fetch, { timeoutMs: 25, retryDelayMs: 1 })('https://example.test/slow');
    const assertion = expect(pending).rejects.toBeInstanceOf(TypeError);
    await vi.advanceTimersByTimeAsync(51);
    await assertion;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('preserves a read-only collector POST across a retry', async () => {
    const failed = new Response('busy', {
      status: 503,
      headers: { 'retry-after': '0' },
    });
    const success = new Response('ok', { status: 200 });
    const fetchImpl = vi.fn().mockResolvedValueOnce(failed).mockResolvedValueOnce(success);
    const body = new URLSearchParams({ h_targetDate: '2026年09月22日' });
    const init: RequestInit = {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-monitor-test': 'preserve-me',
      },
      body,
    };
    const monitorFetch = createMonitorFetch(fetchImpl as typeof fetch, { retryDelayMs: 100 });

    const pending = monitorFetch('https://example.test/calendar', init);
    await vi.advanceTimersByTimeAsync(0);

    await expect(pending).resolves.toBe(success);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const [, attemptInit] of fetchImpl.mock.calls) {
      expect(attemptInit?.method).toBe('POST');
      expect(attemptInit?.body).toBe(body);
      expect(new Headers(attemptInit?.headers).get('content-type')).toBe('application/x-www-form-urlencoded');
      expect(new Headers(attemptInit?.headers).get('x-monitor-test')).toBe('preserve-me');
    }
  });

  it('caps an excessive Retry-After delay', async () => {
    const failed = new Response('throttled', {
      status: 429,
      headers: { 'retry-after': '60' },
    });
    const success = new Response('ok', { status: 200 });
    const fetchImpl = vi.fn().mockResolvedValueOnce(failed).mockResolvedValueOnce(success);
    const monitorFetch = createMonitorFetch(fetchImpl as typeof fetch, {
      retryDelayMs: 100,
      retryAfterCapMs: 5_000,
    });

    const pending = monitorFetch('https://example.test/source');
    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe(success);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('cancels a failed response before retrying', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const failed = {
      status: 500,
      headers: new Headers({ 'retry-after': '0' }),
      body: { cancel },
      clone: () => ({ arrayBuffer: async () => new ArrayBuffer(0) }),
    } as unknown as Response;
    const success = new Response('ok');
    const fetchImpl = vi.fn().mockResolvedValueOnce(failed).mockResolvedValueOnce(success);
    const monitorFetch = createMonitorFetch(fetchImpl as typeof fetch, { retryDelayMs: 100 });

    const pending = monitorFetch('https://example.test/source');
    await vi.advanceTimersByTimeAsync(0);

    await expect(pending).resolves.toBe(success);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
