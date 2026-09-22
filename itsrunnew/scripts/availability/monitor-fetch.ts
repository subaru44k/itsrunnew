const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const DEFAULT_RETRY_AFTER_CAP_MS = 5_000;

/**
 * Options for the monitoring-only fetch wrapper.
 *
 * The wrapper is intended for collectAvailabilityRange, whose POST requests
 * are read-only calendar lookups; do not reuse it for mutating POST calls.
 * It retries at most once and never retries a request method outside GET,
 * HEAD, and that collector POST shape.
 */
export interface MonitorFetchOptions {
  /** Timeout applied independently to every attempt. Defaults to 30 seconds. */
  timeoutMs?: number;
  /** Delay before a retry when Retry-After is absent or invalid. */
  retryDelayMs?: number;
  /** Maximum delay accepted from Retry-After. Defaults to 5 seconds. */
  retryAfterCapMs?: number;
}

interface AttemptSignal {
  signal: AbortSignal;
  externalAborted: boolean;
  externalReason?: unknown;
  cleanup: () => void;
}

interface RetryDelayResult {
  ignoredTimeout: boolean;
}

function finiteNonNegative(value: number | undefined, fallback: number) {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function abortReason(signal: AbortSignal) {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}

function reasonName(reason: unknown) {
  return reason && typeof reason === 'object' && 'name' in reason
    ? (reason as { name?: unknown }).name
    : undefined;
}

function isTimeoutReason(reason: unknown) {
  return reasonName(reason) === 'TimeoutError';
}

function isAbortReason(reason: unknown) {
  return reasonName(reason) === 'AbortError';
}

function timeoutError() {
  return new DOMException('The operation timed out.', 'TimeoutError');
}

function createAttemptSignal(externalSignal: AbortSignal | null | undefined, timeoutMs: number, ignoreExternalTimeout: boolean): AttemptSignal {
  const controller = new AbortController();
  let externalAborted = false;
  let externalReason: unknown;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const onExternalAbort = () => {
    const reason = abortReason(externalSignal!);
    if (ignoreExternalTimeout && isTimeoutReason(reason)) return;
    externalAborted = true;
    externalReason = reason;
    controller.abort(reason);
  };

  if (externalSignal && externalSignal.aborted) {
    const reason = abortReason(externalSignal);
    if (!isTimeoutReason(reason)) onExternalAbort();
  } else {
    externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  }

  timeoutId = setTimeout(() => {
    controller.abort(timeoutError());
  }, timeoutMs);

  return {
    signal: controller.signal,
    get externalAborted() { return externalAborted; },
    get externalReason() { return externalReason; },
    cleanup: () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    },
  };
}

function retryableMethod(input: RequestInfo | URL, init: RequestInit | undefined) {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  return method === 'GET' || method === 'HEAD' || method === 'POST';
}

function retryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500 && status <= 599;
}

function retryAfterMs(response: Response, fallbackMs: number, capMs: number) {
  const value = response.headers.get('retry-after');
  if (!value) return Math.min(fallbackMs, capMs);

  const seconds = /^\s*\d+(?:\.\d+)?\s*$/.test(value) ? Number(value) : undefined;
  const requestedMs = seconds !== undefined && Number.isFinite(seconds)
    ? seconds * 1_000
    : Date.parse(value) - Date.now();
  if (!Number.isFinite(requestedMs)) return Math.min(fallbackMs, capMs);
  return Math.min(Math.max(requestedMs, 0), capMs);
}

async function releaseResponse(response: Response) {
  try {
    if (response.body) await response.body.cancel();
    else await response.arrayBuffer();
  } catch {
    // A failed response is already unusable; cleanup must not hide its status.
  }
}

async function drainResponse(response: Response) {
  if (!response.body) return;
  await response.clone().arrayBuffer();
}

function waitForRetry(ms: number, externalSignal: AbortSignal | null | undefined, ignoreExternalTimeout: boolean): Promise<RetryDelayResult> {
  return new Promise((resolve, reject) => {
    let timerId: ReturnType<typeof setTimeout> | undefined;
    let settled = false;

    const cleanup = () => {
      if (timerId !== undefined) clearTimeout(timerId);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    };
    const finish = (result: RetryDelayResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const onExternalAbort = () => {
      const reason = abortReason(externalSignal!);
      if (isTimeoutReason(reason)) {
        if (ignoreExternalTimeout) return;
        finish({ ignoredTimeout: true });
        return;
      }
      if (settled) return;
      settled = true;
      cleanup();
      reject(reason);
    };

    if (externalSignal?.aborted) {
      onExternalAbort();
      if (settled) return;
    } else {
      externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
    }

    timerId = setTimeout(() => finish({ ignoredTimeout: false }), ms);
  });
}

function externalCancellation(externalSignal: AbortSignal | null | undefined) {
  if (!externalSignal?.aborted) return undefined;
  const reason = abortReason(externalSignal);
  return isTimeoutReason(reason) ? undefined : reason;
}

/**
 * Create the bounded retry client used by the availability monitor.
 *
 * Each attempt receives a new timeout signal. The caller's signal is carried
 * through for explicit cancellation, except for TimeoutError signals: those
 * are treated as an exhausted per-attempt deadline so a retry can receive a
 * fresh 30-second deadline. The current collector creates those timeout
 * signals itself; callers should use another abort reason for cancellation.
 */
export function createMonitorFetch(fetchImpl: typeof fetch = fetch, options: MonitorFetchOptions = {}): typeof fetch {
  const timeoutMs = finiteNonNegative(options.timeoutMs, DEFAULT_TIMEOUT_MS);
  const retryDelayMs = finiteNonNegative(options.retryDelayMs, DEFAULT_RETRY_DELAY_MS);
  const retryAfterCapMs = finiteNonNegative(options.retryAfterCapMs, DEFAULT_RETRY_AFTER_CAP_MS);

  const monitorFetch: typeof fetch = async (input, init) => {
    const canRetry = retryableMethod(input, init);
    const externalSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const immediateCancellation = externalCancellation(externalSignal);
    if (immediateCancellation !== undefined) throw immediateCancellation;

    let ignoreExternalTimeout = externalSignal?.aborted && isTimeoutReason(externalSignal.reason) || false;

    for (let attemptNumber = 0; attemptNumber < 2; attemptNumber += 1) {
      const attempt = createAttemptSignal(externalSignal, timeoutMs, ignoreExternalTimeout);
      let response: Response | undefined;
      try {
        response = await fetchImpl(input, { ...init, signal: attempt.signal });
        if (attempt.externalAborted && !isTimeoutReason(attempt.externalReason)) {
          throw attempt.externalReason ?? abortReason(attempt.signal);
        }
        // Keep the per-attempt timeout active through the response body. The
        // collectors consume text/bytes after fetch resolves its headers.
        await drainResponse(response);
      } catch (error) {
        attempt.cleanup();
        if (response) await releaseResponse(response);

        const externalAbort = attempt.externalAborted && !isTimeoutReason(attempt.externalReason);
        const cancellation = externalCancellation(externalSignal);
        const timedOut = isTimeoutReason(attempt.signal.reason)
          || isTimeoutReason(attempt.externalReason)
          || isTimeoutReason(error);
        if (externalAbort || cancellation !== undefined) throw cancellation ?? error;
        if (attemptNumber === 0 && canRetry && (!isAbortReason(error) || timedOut)) {
          ignoreExternalTimeout = true;
          await waitForRetry(retryDelayMs, externalSignal, ignoreExternalTimeout);
          continue;
        }
        // Collectors classify TypeError as a fetch failure, whereas a raw
        // TimeoutError would otherwise be mistaken for a parser/source change.
        if (timedOut) throw new TypeError('Monitoring fetch timed out', { cause: error });
        throw error;
      }

      attempt.cleanup();
      if (!response) throw new Error('Fetch returned no response');
      if (attemptNumber === 0 && canRetry && retryableStatus(response.status)) {
        await releaseResponse(response);
        const delay = await waitForRetry(retryAfterMs(response, retryDelayMs, retryAfterCapMs), externalSignal, ignoreExternalTimeout);
        ignoreExternalTimeout = ignoreExternalTimeout || delay.ignoredTimeout;
        const cancellation = externalCancellation(externalSignal);
        if (cancellation !== undefined) throw cancellation;
        continue;
      }

      return response;
    }

    throw new Error('Monitor fetch exhausted attempts');
  };

  return monitorFetch;
}
