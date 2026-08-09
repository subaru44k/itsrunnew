import { parseScheduleMonth } from '@itsrun/core'
import type { ScheduleMonth, StadiumSlug, YearMonth } from '@itsrun/core'

export type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
export type UpdateScheduleMonthRequest = Omit<ScheduleMonth, 'updatedAt'>
export type ApiErrorKind = 'unauthorized' | 'forbidden' | 'notFound' | 'conflict' | 'unsupported' | 'rateLimited' | 'server' | 'network' | 'invalid'
export class AdminApiError extends Error { constructor(readonly kind: ApiErrorKind, message = '管理APIを利用できません。', readonly requestId?: string) { super(message) } }
export interface LoadedSchedule { document: ScheduleMonth; etag: string; versionId?: string }
export interface AdminApiPort { get(stadium: StadiumSlug, yearMonth: YearMonth): Promise<LoadedSchedule | null>; put(stadium: StadiumSlug, yearMonth: YearMonth, body: UpdateScheduleMonthRequest, condition: { etag: string } | { create: true }): Promise<LoadedSchedule> }

const validStadium = new Set<StadiumSlug>(['oda', 'yumenoshima', 'komazawa', 'todoroki'])
const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/
export function parseAdminPath(stadium: string, yearMonth: string): { stadium: StadiumSlug; yearMonth: YearMonth } {
  if (!validStadium.has(stadium as StadiumSlug) || !validMonth.test(yearMonth)) throw new AdminApiError('invalid')
  return { stadium: stadium as StadiumSlug, yearMonth: yearMonth as YearMonth }
}
const MAX_RESPONSE_BYTES = 32 * 1024
const endpoint = (stadium: StadiumSlug, yearMonth: YearMonth) => `/api/v1/stadiums/${stadium}/availability/${yearMonth}`
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
export function validateAdminBasePath(basePath: string): void {
  if (basePath !== '/api/v1') throw new AdminApiError('invalid')
}
export function validateStrongEtag(etag: unknown): asserts etag is string {
  if (typeof etag !== 'string' || !/^"[^"\r\n]+"$/.test(etag)) throw new AdminApiError('invalid')
}
function apiKind(status: number): ApiErrorKind { return ({ 400: 'invalid', 401: 'unauthorized', 403: 'forbidden', 404: 'notFound', 409: 'conflict', 415: 'unsupported', 429: 'rateLimited' } as Record<number, ApiErrorKind>)[status] ?? (status >= 500 ? 'server' : 'invalid') }
export async function boundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('missing response body')
  const reader = response.body.getReader(); const decoder = new TextDecoder('utf-8', { fatal: true }); let bytes = 0; let text = ''; let cancelled = false; let released = false
  const cancelOnce = async () => { if (!cancelled) { cancelled = true; await reader.cancel() } }
  const releaseOnce = () => { if (!released) { released = true; reader.releaseLock() } }
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > MAX_RESPONSE_BYTES) throw new Error('response too large')
      text += decoder.decode(chunk.value, { stream: true })
    }
    text += decoder.decode(); return JSON.parse(text)
  } catch (error) { await cancelOnce().catch(() => undefined); throw error }
  finally { releaseOnce() }
}
async function readResponse(response: Response, expected: { stadium: StadiumSlug; yearMonth: YearMonth }, requireVersion: boolean, allowMissing: boolean): Promise<LoadedSchedule | null> {
  if (response.status === 404 && allowMissing) return null
  if (!response.ok) throw new AdminApiError(apiKind(response.status))
  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new AdminApiError('invalid')
  let payload: unknown
  try { payload = await boundedJson(response) } catch { throw new AdminApiError('invalid') }
  if (!isPlainObject(payload) || !('document' in payload) || !('etag' in payload)) throw new AdminApiError('invalid')
  const expectedKeys = requireVersion ? ['document', 'etag', 'versionId'] : ['document', 'etag']
  if (Object.keys(payload).length !== expectedKeys.length || Object.keys(payload).some((key) => !expectedKeys.includes(key))) throw new AdminApiError('invalid')
  validateStrongEtag(payload.etag)
  if (requireVersion && (typeof payload.versionId !== 'string' || !payload.versionId)) throw new AdminApiError('invalid')
  try { parseScheduleMonth(payload.document, expected) } catch { throw new AdminApiError('invalid') }
  return { document: payload.document as ScheduleMonth, etag: payload.etag, versionId: requireVersion ? payload.versionId as string : undefined }
}
function validateBody(body: UpdateScheduleMonthRequest, expected: { stadium: StadiumSlug; yearMonth: YearMonth }): void {
  if (!isPlainObject(body) || Object.keys(body).length !== 4 || Object.keys(body).some((key) => !['schemaVersion', 'stadium', 'yearMonth', 'days'].includes(key)) || body.stadium !== expected.stadium || body.yearMonth !== expected.yearMonth || 'updatedAt' in body) throw new AdminApiError('invalid')
  try { parseScheduleMonth({ ...body, updatedAt: '2026-01-01T00:00:00.000Z' }, expected) } catch { throw new AdminApiError('invalid') }
  if (new TextEncoder().encode(JSON.stringify(body)).byteLength > MAX_RESPONSE_BYTES) throw new AdminApiError('invalid')
}
export class AdminApiRepository implements AdminApiPort {
  private readonly request: ApiFetch
  constructor(basePath = '/api/v1', private readonly token: () => Promise<string | null>, request: ApiFetch = fetch) {
    validateAdminBasePath(basePath)
    this.request = request === fetch ? request.bind(globalThis) : (input, init) => request(input, init)
  }
  private async call(path: string, init: RequestInit) {
    const accessToken = await this.token(); if (!accessToken) throw new AdminApiError('unauthorized')
    try { return await this.request(path, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) } }) } catch { throw new AdminApiError('network') }
  }
  async get(stadium: StadiumSlug, yearMonth: YearMonth) {
    const safe = parseAdminPath(stadium, yearMonth)
    return readResponse(await this.call(endpoint(safe.stadium, safe.yearMonth), { method: 'GET' }), safe, false, true)
  }
  async put(stadium: StadiumSlug, yearMonth: YearMonth, body: UpdateScheduleMonthRequest, condition: { etag: string } | { create: true }) {
    const safe = parseAdminPath(stadium, yearMonth)
    if (!isPlainObject(condition) || Object.keys(condition).length !== 1) throw new AdminApiError('invalid')
    if ('etag' in condition) validateStrongEtag(condition.etag)
    else if (!('create' in condition) || condition.create !== true) throw new AdminApiError('invalid')
    validateBody(body, safe)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...('etag' in condition ? { 'If-Match': condition.etag } : { 'If-None-Match': '*' }) }
    const result = await readResponse(await this.call(endpoint(safe.stadium, safe.yearMonth), { method: 'PUT', headers, body: JSON.stringify(body) }), safe, true, false)
    if (!result?.versionId) throw new AdminApiError('invalid')
    return result
  }
}

type LegacyEditorState =
  | { kind: 'idle' | 'loading' }
  | { kind: 'missing'; draft: UpdateScheduleMonthRequest; base: null }
  | { kind: 'ready'; base: LoadedSchedule; draft: UpdateScheduleMonthRequest; dirty: boolean }
  | { kind: 'saving'; base: LoadedSchedule | null; draft: UpdateScheduleMonthRequest }
  | { kind: 'conflict'; base: LoadedSchedule; draft: UpdateScheduleMonthRequest; latest: LoadedSchedule | null }
  | { kind: 'comparisonError'; base: LoadedSchedule; draft: UpdateScheduleMonthRequest }
  | { kind: 'error'; error: ApiErrorKind }
  | { kind: 'saved'; base: LoadedSchedule; draft: UpdateScheduleMonthRequest; dirty: false }

function emptyDraft(stadium: StadiumSlug, yearMonth: YearMonth): UpdateScheduleMonthRequest {
  const parts = yearMonth.split('-'); const year = Number(parts[0]); const month = Number(parts[1]); const days: UpdateScheduleMonthRequest['days'] = {}
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate()
  for (let day = 1; day <= count; day += 1) { const date = `${yearMonth}-${String(day).padStart(2, '0')}` as `${number}-${number}-${number}`; days[date] = [0, 0, 0] }
  return { schemaVersion: 1, stadium, yearMonth, days }
}
function cloneDraft(document: ScheduleMonth): UpdateScheduleMonthRequest { return { schemaVersion: 1, stadium: document.stadium, yearMonth: document.yearMonth, days: structuredClone(document.days) } }
export function createLegacyEditor(api: AdminApiPort) {
  let state: LegacyEditorState = { kind: 'idle' }; let saveInFlight = false
  const listeners = new Set<(state: LegacyEditorState) => void>(); const emit = () => listeners.forEach((listener) => listener(state))
  const set = (next: LegacyEditorState) => { state = next; emit() }
  return {
    get state() { return state }, subscribe(listener: (state: LegacyEditorState) => void) { listeners.add(listener); return () => listeners.delete(listener) },
    async load(stadium: StadiumSlug, yearMonth: YearMonth) { set({ kind: 'loading' }); try { const loaded = await api.get(stadium, yearMonth); if (!loaded) set({ kind: 'missing', draft: emptyDraft(stadium, yearMonth), base: null }); else set({ kind: 'ready', base: loaded, draft: cloneDraft(loaded.document), dirty: false }) } catch (error) { set({ kind: 'error', error: error instanceof AdminApiError ? error.kind : 'network' }) } },
    updateDraft(draft: UpdateScheduleMonthRequest) { if (state.kind === 'ready' || state.kind === 'missing' || state.kind === 'conflict') { if (state.kind === 'missing') set({ ...state, draft }); else set({ ...state, draft, dirty: true } as LegacyEditorState) } },
    async save() { if (saveInFlight || (state.kind !== 'ready' && state.kind !== 'missing' && state.kind !== 'conflict')) return; saveInFlight = true; const before = state; const draft = before.draft; set({ kind: 'saving', base: before.kind === 'missing' ? null : before.base, draft }); try { const result = await api.put(draft.stadium, draft.yearMonth, draft, before.kind === 'missing' ? { create: true } : { etag: before.base.etag }); set({ kind: 'saved', base: result, draft: cloneDraft(result.document), dirty: false }) } catch (error) { if (error instanceof AdminApiError && error.kind === 'conflict' && before.kind !== 'missing') { try { const latest = await api.get(draft.stadium, draft.yearMonth); set({ kind: 'conflict', base: before.base, draft, latest }) } catch { set({ kind: 'comparisonError', base: before.base, draft }) } } else set({ kind: 'error', error: error instanceof AdminApiError ? error.kind : 'network' }) } finally { saveInFlight = false } },
  }
}

export { createEditor } from './adminEditor'
