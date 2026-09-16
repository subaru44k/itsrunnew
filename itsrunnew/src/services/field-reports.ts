export type FieldReportOutcome = 'available' | 'partial' | 'unavailable';

export interface FieldReport {
  id: string;
  trackId: string;
  date: string;
  outcome: FieldReportOutcome;
  comment: string;
  createdAt: string;
}

export interface FieldReportsResponse {
  reports: FieldReport[];
  count: number;
}

export interface CreateFieldReportInput {
  trackId: string;
  date: string;
  outcome: FieldReportOutcome;
  comment: string;
  clientId: string;
  website: '';
}

export type FieldReportErrorCode =
  | 'invalid_input'
  | 'spam'
  | 'date_changed'
  | 'rate_limited'
  | 'unavailable';

export class FieldReportsError extends Error {
  readonly code: FieldReportErrorCode;
  readonly status: number;

  constructor(code: FieldReportErrorCode, status: number) {
    super(code);
    this.name = 'FieldReportsError';
    this.code = code;
    this.status = status;
  }
}

const configuredApiBase = (import.meta.env.VITE_FIELD_REPORTS_API ?? '').trim().replace(/\/+$/, '');
export const fieldReportsApiBase = configuredApiBase;
export const FIELD_REPORTS_REQUEST_TIMEOUT_MS = 15_000;

const CLIENT_ID_STORAGE_KEY = 'itsrun.field-reports.client-id.v1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let memoryClientId = '';

export function isFieldReportsEnabled() {
  return fieldReportsApiBase.length > 0;
}

function createClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = new Uint8Array(16);
    crypto.getRandomValues(values);
    values[6] = (values[6] & 0x0f) | 0x40;
    values[8] = (values[8] & 0x3f) | 0x80;
    const hex = Array.from(values, value => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function getFieldReportsClientId() {
  if (memoryClientId) return memoryClientId;

  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
      if (stored && UUID_PATTERN.test(stored)) {
        memoryClientId = stored;
        return memoryClientId;
      }
    } catch {
      // A blocked storage API must not prevent a report from being sent.
    }
  }

  memoryClientId = createClientId();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, memoryClientId);
    } catch {
      // Keep the generated identifier in memory when storage is unavailable.
    }
  }
  return memoryClientId;
}

function reportErrorForStatus(status: number, code?: unknown) {
  const knownCode: FieldReportErrorCode = code === 'invalid_input'
    || code === 'spam'
    || code === 'date_changed'
    || code === 'rate_limited'
    || code === 'unavailable'
    ? code
    : status === 429
      ? 'rate_limited'
      : status === 409
        ? 'date_changed'
        : status === 400
          ? 'invalid_input'
          : 'unavailable';
  return new FieldReportsError(knownCode, status);
}

async function responseJson(response: Response) {
  try {
    return await response.json() as unknown;
  } catch {
    return undefined;
  }
}

function isFieldReport(value: unknown): value is FieldReport {
  if (!value || typeof value !== 'object') return false;
  const report = value as Partial<FieldReport>;
  return typeof report.id === 'string'
    && typeof report.trackId === 'string'
    && typeof report.date === 'string'
    && (report.outcome === 'available' || report.outcome === 'partial' || report.outcome === 'unavailable')
    && typeof report.comment === 'string'
    && typeof report.createdAt === 'string';
}

function reportsResponse(value: unknown): FieldReportsResponse {
  if (!value || typeof value !== 'object') throw new FieldReportsError('unavailable', 503);
  const payload = value as { reports?: unknown; count?: unknown };
  if (!Array.isArray(payload.reports) || !payload.reports.every(isFieldReport) || typeof payload.count !== 'number' || !Number.isFinite(payload.count)) {
    throw new FieldReportsError('unavailable', 503);
  }
  return {
    reports: payload.reports.slice(0, 20),
    count: Math.max(0, Math.floor(payload.count)),
  };
}

function reportUrl(path: string) {
  return `${fieldReportsApiBase}${path}`;
}

function requestContext(parentSignal?: AbortSignal) {
  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const abortFromParent = () => controller.abort(parentSignal?.reason);

  if (parentSignal) {
    if (parentSignal.aborted) abortFromParent();
    else parentSignal.addEventListener('abort', abortFromParent, { once: true });
  }
  timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, FIELD_REPORTS_REQUEST_TIMEOUT_MS);

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup() {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      parentSignal?.removeEventListener('abort', abortFromParent);
    },
  };
}

export async function fetchFieldReports(trackId: string, date: string, signal?: AbortSignal): Promise<FieldReportsResponse> {
  if (!isFieldReportsEnabled()) throw new FieldReportsError('unavailable', 503);
  const params = new URLSearchParams({ trackId, date });
  const request = requestContext(signal);
  try {
    const response = await fetch(`${reportUrl('/reports')}?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: request.signal,
    });
    const payload = await responseJson(response);
    if (!response.ok) {
      const code = payload && typeof payload === 'object' ? (payload as { error?: unknown }).error : undefined;
      throw reportErrorForStatus(response.status, code);
    }
    return reportsResponse(payload);
  } catch (error) {
    if (request.timedOut()) throw new FieldReportsError('unavailable', 503);
    throw error;
  } finally {
    request.cleanup();
  }
}

export async function createFieldReport(input: CreateFieldReportInput, signal?: AbortSignal): Promise<FieldReport> {
  if (!isFieldReportsEnabled()) throw new FieldReportsError('unavailable', 503);
  const request = requestContext(signal);
  try {
    const response = await fetch(reportUrl('/reports'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: request.signal,
    });
    const payload = await responseJson(response);
    if (!response.ok) {
      const code = payload && typeof payload === 'object' ? (payload as { error?: unknown }).error : undefined;
      throw reportErrorForStatus(response.status, code);
    }
    const report = payload && typeof payload === 'object' ? (payload as { report?: unknown }).report : undefined;
    if (!isFieldReport(report)) throw new FieldReportsError('unavailable', 503);
    return report;
  } catch (error) {
    if (request.timedOut()) throw new FieldReportsError('unavailable', 503);
    throw error;
  } finally {
    request.cleanup();
  }
}
