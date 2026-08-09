import { parseScheduleMonth, type AvailabilityStatus, type ScheduleMonth, type StadiumSlug, type YearMonth } from '@itsrun/core'
import type { AdminApiPort, LoadedSchedule, UpdateScheduleMonthRequest } from './adminApi'

export type EditorError = 'unauthorized' | 'forbidden' | 'notFound' | 'conflict' | 'unsupported' | 'rateLimited' | 'server' | 'network' | 'invalid'
export type CellDiff = { date: string; slot: number; base: AvailabilityStatus | null; local: AvailabilityStatus | null; latest: AvailabilityStatus | null }
export type EditorSelection = { stadium: StadiumSlug; yearMonth: YearMonth }
type Common = EditorSelection & { generation: number }
export type EditorState =
  | ({ kind: 'idle' } & Partial<Common>)
  | ({ kind: 'loading' } & Common)
  | ({ kind: 'missing'; base: null; draft: UpdateScheduleMonthRequest; dirty: boolean } & Common)
  | ({ kind: 'ready'; base: LoadedSchedule; draft: UpdateScheduleMonthRequest; dirty: boolean } & Common)
  | ({ kind: 'saving'; base: LoadedSchedule | null; draft: UpdateScheduleMonthRequest; dirty: boolean; condition: { etag: string } | { create: true } } & Common)
  | ({ kind: 'saved'; base: LoadedSchedule; draft: UpdateScheduleMonthRequest; dirty: false } & Common)
  | ({ kind: 'loadFailure'; error: EditorError; message: string } & Common)
  | ({ kind: 'saveFailure'; error: EditorError; message: string; base: LoadedSchedule | null; draft: UpdateScheduleMonthRequest; dirty: boolean; condition: { etag: string } | { create: true } } & Common)
  | ({ kind: 'forbidden'; error: 'forbidden'; message: string } & Common)
  | ({ kind: 'conflict'; base: LoadedSchedule; draft: UpdateScheduleMonthRequest; latest: LoadedSchedule | null; diffs: CellDiff[]; dirty: boolean } & Common)
  | ({ kind: 'comparisonFailure'; error: EditorError; message: string; base: LoadedSchedule; draft: UpdateScheduleMonthRequest; latest: null; dirty: boolean } & Common)

const statuses = new Set<AvailabilityStatus>([0, 1, 2])
const isSelection = (stadium: string, yearMonth: string): stadium is StadiumSlug => ['oda', 'yumenoshima', 'komazawa', 'todoroki'].includes(stadium) && /^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)
const clone = <T>(value: T): T => structuredClone(value)
const errorKind = (error: unknown): EditorError => typeof error === 'object' && error !== null && 'kind' in error && typeof error.kind === 'string' ? error.kind as EditorError : 'network'
const safeMessage = '管理APIを利用できません。'
function daysInMonth(yearMonth: YearMonth): number { const parts = yearMonth.split('-'); const year = Number(parts[0] ?? 0); const month = Number(parts[1] ?? 0); return new Date(Date.UTC(year, month, 0)).getUTCDate() }
function missingDraft(stadium: StadiumSlug, yearMonth: YearMonth): UpdateScheduleMonthRequest {
  const days: UpdateScheduleMonthRequest['days'] = {}
  for (let day = 1; day <= daysInMonth(yearMonth); day += 1) {
    const date = `${yearMonth}-${String(day).padStart(2, '0')}` as keyof typeof days
    days[date] = [0, 0, 0]
  }
  return { schemaVersion: 1, stadium, yearMonth, days }
}
function draftFromDocument(document: ScheduleMonth): UpdateScheduleMonthRequest { return { schemaVersion: 1, stadium: document.stadium, yearMonth: document.yearMonth, days: clone(document.days) } }
function validDraft(draft: UpdateScheduleMonthRequest, selection: EditorSelection): boolean {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft) || Object.keys(draft).length !== 4 || draft.schemaVersion !== 1 || draft.stadium !== selection.stadium || draft.yearMonth !== selection.yearMonth || !draft.days || typeof draft.days !== 'object') return false
  try { parseScheduleMonth({ ...draft, updatedAt: '2026-01-01T00:00:00.000Z' }, selection) } catch { return false }
  return true
}
function dirtyAgainst(base: LoadedSchedule | null, draft: UpdateScheduleMonthRequest): boolean { return base ? JSON.stringify(draft.days) !== JSON.stringify(base.document.days) : Object.values(draft.days).some((row) => row.some((status) => status !== 0)) }
function cellDiffs(base: ScheduleMonth, local: UpdateScheduleMonthRequest, latest: LoadedSchedule | null): CellDiff[] {
  const dates = new Set([...Object.keys(base.days), ...Object.keys(local.days), ...Object.keys(latest?.document.days ?? {})])
  return [...dates].sort().flatMap((date) => Array.from({ length: 3 }, (_, slot) => ({ date, slot, base: base.days[date as keyof typeof base.days]?.[slot] ?? null, local: local.days[date as keyof typeof local.days]?.[slot] ?? null, latest: latest?.document.days[date as keyof typeof latest.document.days]?.[slot] ?? null })).filter((diff) => diff.base !== diff.local || diff.local !== diff.latest || diff.base !== diff.latest))
}

export function createEditor(api: AdminApiPort) {
  let state: EditorState = { kind: 'idle' }
  let generation = 0
  let saveInFlight = false
  let comparisonGeneration = 0
  const listeners = new Set<(state: EditorState) => void>()
  const emit = () => listeners.forEach((listener) => listener(state))
  const set = (next: EditorState) => { state = next; emit() }
  const selectionOf = (stadium: StadiumSlug, yearMonth: YearMonth): EditorSelection => ({ stadium, yearMonth })
  const current = (): EditorSelection | null => {
    if (!('stadium' in state) || !('yearMonth' in state) || !state.stadium || !state.yearMonth) return null
    return { stadium: state.stadium, yearMonth: state.yearMonth }
  }
  const isDirty = () => 'dirty' in state && state.dirty
  async function load(stadium: StadiumSlug, yearMonth: YearMonth, confirmDiscard?: () => boolean) {
    if (!isSelection(stadium, yearMonth)) return
    if (isDirty() && (!confirmDiscard || !confirmDiscard())) return
    const selected = selectionOf(stadium, yearMonth); const requestGeneration = ++generation
    set({ kind: 'loading', ...selected, generation: requestGeneration })
    try {
      const loaded = await api.get(stadium, yearMonth)
      if (requestGeneration !== generation) return
      if (!loaded) set({ kind: 'missing', ...selected, generation: requestGeneration, base: null, draft: missingDraft(stadium, yearMonth), dirty: false })
      else set({ kind: 'ready', ...selected, generation: requestGeneration, base: clone(loaded), draft: draftFromDocument(loaded.document), dirty: false })
    } catch (error) {
      if (requestGeneration !== generation) return
      const kind = errorKind(error)
      if (kind === 'forbidden') set({ kind: 'forbidden', ...selected, generation: requestGeneration, error: kind, message: safeMessage })
      else set({ kind: 'loadFailure', ...selected, generation: requestGeneration, error: kind, message: safeMessage })
    }
  }
  function updateDraft(draft: UpdateScheduleMonthRequest) {
    const selected = current(); if (!selected || !validDraft(draft, selected)) return
    if (state.kind === 'missing') set({ ...state, draft: clone(draft), dirty: dirtyAgainst(null, draft) })
    else if (state.kind === 'ready' || state.kind === 'conflict' || state.kind === 'comparisonFailure') set({ ...state, draft: clone(draft), dirty: dirtyAgainst('base' in state ? state.base : null, draft) } as EditorState)
  }
  function updateCell(date: string, slot: number, status: number) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 2 || !statuses.has(status as AvailabilityStatus) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !('draft' in state)) return
    const draft = clone(state.draft); const row = draft.days[date as keyof typeof draft.days]; if (!row) return; row[slot] = status as AvailabilityStatus; updateDraft(draft)
  }
  async function save() {
    if (saveInFlight || !('draft' in state) || !('dirty' in state) || !state.dirty || !('stadium' in state)) return
    if (!(state.kind === 'ready' || state.kind === 'missing')) return
    saveInFlight = true; const before = state; const draft = clone(state.draft); const base = 'base' in before ? before.base : null; const condition = base ? { etag: base.etag } : { create: true as const }
    set({ kind: 'saving', stadium: before.stadium, yearMonth: before.yearMonth, generation: before.generation, base, draft, dirty: true, condition })
    try {
      const result = await api.put(draft.stadium, draft.yearMonth, draft, condition)
      if ((state as EditorState).kind === 'saving' && state.generation === before.generation) set({ kind: 'saved', stadium: before.stadium, yearMonth: before.yearMonth, generation: before.generation, base: clone(result), draft: draftFromDocument(result.document), dirty: false })
    } catch (error) {
      const kind = errorKind(error)
      if (kind === 'conflict' && before.kind !== 'missing' && 'base' in before && before.base) {
        try {
          const latest = await api.get(draft.stadium, draft.yearMonth)
          if ((state as EditorState).kind === 'saving' && latest) set({ kind: 'conflict', stadium: before.stadium, yearMonth: before.yearMonth, generation: before.generation, base: clone(before.base), draft, latest: clone(latest), diffs: cellDiffs(before.base.document, draft, latest), dirty: true })
          else if ((state as EditorState).kind === 'saving') set({ kind: 'conflict', stadium: before.stadium, yearMonth: before.yearMonth, generation: before.generation, base: clone(before.base), draft, latest: null, diffs: cellDiffs(before.base.document, draft, null), dirty: true })
        } catch { if ((state as EditorState).kind === 'saving') set({ kind: 'comparisonFailure', stadium: before.stadium, yearMonth: before.yearMonth, generation: before.generation, base: clone(before.base), draft, latest: null, error: 'network', message: safeMessage, dirty: true }) }
      } else if ((state as EditorState).kind === 'saving') set({ kind: 'saveFailure', stadium: before.stadium, yearMonth: before.yearMonth, generation: before.generation, base, draft, dirty: true, condition, error: kind, message: safeMessage })
    } finally { saveInFlight = false }
  }
  async function retryLoad() { const selected = current(); if (selected) await load(selected.stadium, selected.yearMonth) }
  async function retrySave() {
    if (state.kind === 'saveFailure') {
      const failed = state
      if (failed.base) set({ ...failed, kind: 'ready', base: failed.base, draft: clone(failed.draft), dirty: true })
      else set({ ...failed, kind: 'missing', base: null, draft: clone(failed.draft), dirty: true })
    }
    await save()
  }
  async function retryComparison() {
    if (state.kind !== 'comparisonFailure' && !(state.kind === 'conflict' && state.latest === null)) return
    const before = state; const request = ++comparisonGeneration
    try {
      const latest = await api.get(before.stadium, before.yearMonth)
      if (request === comparisonGeneration && state === before && latest) set({ ...before, kind: 'conflict', latest: clone(latest), diffs: cellDiffs(before.base.document, before.draft, latest) })
    } catch { /* preserve sanitized comparison state */ }
  }
  function keepEditing() { if (state.kind !== 'conflict' || !state.latest) return; const latest = state.latest; set({ ...state, kind: 'ready', base: clone(latest), draft: clone(state.draft), dirty: dirtyAgainst(latest, state.draft) }) }
  const rebaseOnLatest = keepEditing
  function replaceLatest(confirm: () => boolean) { if (state.kind !== 'conflict' || !state.latest || !confirm()) return; const latest = state.latest; set({ ...state, kind: 'ready', base: clone(latest), draft: draftFromDocument(latest.document), dirty: false }) }
  function discardLatest(confirm: () => boolean) { replaceLatest(confirm) }
  function subscribe(listener: (next: EditorState) => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
  return { get state() { return state }, subscribe, load, retryLoad, updateDraft, updateCell, save, retrySave, retryComparison, keepEditing, rebaseOnLatest, replaceLatest, discardLatest }
}
