import { describe, expect, it, vi } from 'vitest'
import type { AdminApiPort, LoadedSchedule, UpdateScheduleMonthRequest } from './adminApi'
import { AdminApiError } from './adminApi'
import { createEditor, type EditorState } from './adminEditor'

const makeDocument = (yearMonth = '2026-08', stadium = 'oda' as const) => ({
  schemaVersion: 1 as const, stadium, yearMonth: yearMonth as `${number}-${number}`, updatedAt: '2026-01-01T00:00:00.000Z', days: { [`${yearMonth}-01`]: [0, 1, 2] as [0, 1, 2] },
})
const loaded = (yearMonth = '2026-08'): LoadedSchedule => ({ document: makeDocument(yearMonth), etag: '"a"', versionId: 'v1' })
const draftOf = (yearMonth = '2026-08'): UpdateScheduleMonthRequest => ({ schemaVersion: 1, stadium: 'oda', yearMonth: yearMonth as `${number}-${number}`, days: { [`${yearMonth}-01`]: [2, 2, 2] as [2, 2, 2] } })
const fakeApi = (overrides: Partial<AdminApiPort> = {}): AdminApiPort => ({ get: vi.fn(async () => loaded()), put: vi.fn(async () => loaded()), ...overrides })
const kinds = ['unauthorized', 'forbidden', 'notFound', 'unsupported', 'rateLimited', 'server', 'network', 'invalid'] as const

describe('pure admin editor state', () => {
  it('creates every calendar day with three statuses for 28/29/30/31-day months', async () => {
    for (const [month, count] of [['2026-02', 28], ['2028-02', 29], ['2026-04', 30], ['2026-08', 31]] as const) {
      const api = fakeApi({ get: vi.fn(async () => null) }); const editor = createEditor(api); await editor.load('oda', month)
      expect(editor.state.kind).toBe('missing'); if (editor.state.kind === 'missing') { expect(Object.keys(editor.state.draft.days)).toHaveLength(count); expect(Object.values(editor.state.draft.days).every((row) => row.length === 3)).toBe(true) }
    }
  })

  it('loads success/missing/failure/forbidden and retries load', async () => {
    const get = vi.fn().mockRejectedValueOnce(new AdminApiError('network')).mockResolvedValueOnce(loaded())
    const editor = createEditor(fakeApi({ get })); await editor.load('oda', '2026-08'); expect(editor.state.kind).toBe('loadFailure'); await editor.retryLoad(); expect(editor.state.kind).toBe('ready')
    const forbidden = createEditor(fakeApi({ get: vi.fn(async () => { throw new AdminApiError('forbidden') }) })); await forbidden.load('oda', '2026-08'); expect(forbidden.state.kind).toBe('forbidden')
  })

  it('ignores stale load completion and keeps selected result', async () => {
    let firstResolve: (value: LoadedSchedule) => void = () => undefined
    const first = new Promise<LoadedSchedule>((resolve) => { firstResolve = resolve }); const get = vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce(loaded('2026-09'))
    const editor = createEditor(fakeApi({ get })); const old = editor.load('oda', '2026-08'); await editor.load('oda', '2026-09'); firstResolve(loaded('2026-08')); await old
    expect(editor.state.kind).toBe('ready'); if (editor.state.kind === 'ready') expect(editor.state.yearMonth).toBe('2026-09')
  })

  it('keeps base immutable, validates cell updates, and tracks dirty', async () => {
    const base = loaded(); const editor = createEditor(fakeApi({ get: vi.fn(async () => base) })); await editor.load('oda', '2026-08'); if (editor.state.kind !== 'ready') throw new Error('expected ready')
    const before = structuredClone(editor.state.base); editor.updateCell('2026-08-01', 0, 2); expect(editor.state.kind).toBe('ready'); if (editor.state.kind === 'ready') { expect(editor.state.dirty).toBe(true); expect(editor.state.base).toEqual(before); expect(editor.state.draft.days['2026-08-01']).toEqual([2, 1, 2]) }
    editor.updateCell('2026-08-01', 9, 2); editor.updateCell('2026-09-01', 0, 2); expect(editor.state.kind).toBe('ready')
  })

  it('uses create/update conditions, prevents clean and double saves, and atomically stores metadata', async () => {
    const put = vi.fn().mockResolvedValue({ ...loaded(), etag: '"b"', versionId: 'v2' }); const api = fakeApi({ put }); const editor = createEditor(api); await editor.load('oda', '2026-08'); await editor.save(); expect(put).not.toHaveBeenCalled(); editor.updateDraft(draftOf()); const one = editor.save(); const two = editor.save(); await Promise.all([one, two]); expect(put).toHaveBeenCalledTimes(1); expect(put.mock.calls[0]![3]).toEqual({ etag: '"a"' }); expect(editor.state.kind).toBe('saved'); if (editor.state.kind === 'saved') expect(editor.state.base.versionId).toBe('v2')
    const missing = createEditor(fakeApi({ get: vi.fn(async () => null), put: vi.fn(async () => loaded()) })); await missing.load('oda', '2026-08'); missing.updateCell('2026-08-01', 0, 1); await missing.save(); expect((missing as unknown as { state: EditorState }).state.kind).toBe('saved')
  })

  it('preserves full saveFailure state and retries only when explicitly requested', async () => {
    for (const kind of kinds) {
      const put = vi.fn().mockRejectedValueOnce(new AdminApiError(kind)).mockResolvedValueOnce(loaded()); const editor = createEditor(fakeApi({ put })); await editor.load('oda', '2026-08'); editor.updateDraft(draftOf()); await editor.save(); expect(editor.state.kind).toBe('saveFailure'); if (editor.state.kind === 'saveFailure') { expect(editor.state.base).not.toBeNull(); expect(editor.state.draft.days['2026-08-01']).toEqual([2, 2, 2]); expect(editor.state.dirty).toBe(true) } await editor.retrySave(); expect(put).toHaveBeenCalledTimes(2)
    }
  })

  it('conflict performs exactly one PUT and one latest GET, with sorted cell diffs', async () => {
    const base = loaded(); const latest = { ...loaded(), etag: '"latest"', document: { ...makeDocument(), days: { '2026-08-01': [1, 1, 1] as [1, 1, 1], '2026-08-02': [2, 2, 2] as [2, 2, 2] } } }; const get = vi.fn().mockResolvedValueOnce(base).mockResolvedValueOnce(latest); const put = vi.fn().mockRejectedValue(new AdminApiError('conflict')); const editor = createEditor(fakeApi({ get, put })); await editor.load('oda', '2026-08'); editor.updateDraft(draftOf()); await editor.save(); expect(put).toHaveBeenCalledTimes(1); expect(get).toHaveBeenCalledTimes(2); expect(editor.state.kind).toBe('conflict'); if (editor.state.kind === 'conflict') { expect(editor.state.base).toEqual(base); expect(editor.state.draft.days['2026-08-01']).toEqual([2, 2, 2]); expect(editor.state.diffs.map((diff) => `${diff.date}:${diff.slot}`)).toEqual([...editor.state.diffs].sort((a, b) => `${a.date}:${a.slot}`.localeCompare(`${b.date}:${b.slot}`)).map((diff) => `${diff.date}:${diff.slot}`)) }
  })

  it('comparison null/failure is separate, retry is GET-only, and keep-editing/replacement require explicit action', async () => {
    const get = vi.fn().mockResolvedValueOnce(loaded()).mockResolvedValueOnce(null).mockResolvedValueOnce(loaded('2026-09')); const put = vi.fn().mockRejectedValue(new AdminApiError('conflict')); const editor = createEditor(fakeApi({ get, put })); await editor.load('oda', '2026-08'); editor.updateDraft(draftOf()); await editor.save(); expect(editor.state.kind).toBe('conflict'); if (editor.state.kind === 'conflict') expect(editor.state.latest).toBeNull(); await editor.retryComparison(); expect(get).toHaveBeenCalledTimes(3)
    const failureGet = vi.fn().mockResolvedValueOnce(loaded()).mockRejectedValueOnce(new Error('raw')); const failure = createEditor(fakeApi({ get: failureGet, put })); await failure.load('oda', '2026-08'); failure.updateDraft(draftOf()); await failure.save(); expect(failure.state.kind).toBe('comparisonFailure')
    const latest = loaded('2026-08'); const conflict = createEditor(fakeApi({ get: vi.fn().mockResolvedValueOnce(loaded()).mockResolvedValueOnce(latest), put: vi.fn().mockRejectedValue(new AdminApiError('conflict')) })); await conflict.load('oda', '2026-08'); conflict.updateDraft(draftOf()); await conflict.save(); if (conflict.state.kind !== 'conflict') throw new Error('expected conflict'); const before = structuredClone(conflict.state); conflict.replaceLatest(() => false); expect(conflict.state).toEqual(before); conflict.keepEditing(); const afterKeep = conflict.state as EditorState; expect(afterKeep.kind).toBe('ready'); if (afterKeep.kind === 'ready') { expect(afterKeep.dirty).toBe(true); conflict.updateDraft(afterKeep.draft); await conflict.save() }
  })

  it('supports deterministic subscriptions and sanitized state errors', async () => {
    const editor = createEditor(fakeApi({ get: vi.fn(async () => { throw new Error('raw secret') }) })); const seen: string[] = []; const listener = (state: EditorState) => { seen.push(state.kind) }; const unsubscribe = editor.subscribe(listener); await editor.load('oda', '2026-08'); unsubscribe(); await editor.retryLoad(); expect(seen).toEqual(['loading', 'loadFailure']); expect(JSON.stringify(editor.state)).not.toContain('raw secret')
  })
})
