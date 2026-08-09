import { describe, expect, it, vi } from 'vitest'
import { AdminApiError, AdminApiRepository, createEditor } from './adminApi'

const document = { schemaVersion: 1 as const, stadium: 'oda' as const, yearMonth: '2026-08' as const, updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2] as [0, 1, 2] } }
const response = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'content-length': String(JSON.stringify(body).length), ...headers } })
describe('AdminApiRepository', () => {
  it('uses exact same-origin paths and conditional headers', async () => {
    const request = vi.fn().mockImplementation(() => response(200, { document, etag: '"a"', versionId: 'v' }))
    const repo = new AdminApiRepository('/api/v1', async () => 'token', request)
    await repo.get('oda', '2026-08'); expect(request).toHaveBeenCalledWith('/api/v1/stadiums/oda/availability/2026-08', expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer token' } }))
    await repo.put('oda', '2026-08', { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: document.days }, { etag: '"a"' })
    expect(request.mock.calls[1]![1]).toMatchObject({ method: 'PUT', headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json', 'If-Match': '"a"' } })
    expect(JSON.parse(request.mock.calls[1]![1]!.body as string)).toEqual({ schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: document.days })
  })
  it('uses create condition and maps statuses without exposing response bodies', async () => {
    const request = vi.fn().mockResolvedValueOnce(response(404, { error: { message: 'secret' } })).mockResolvedValueOnce(response(403, { error: { message: 'secret' } }))
    const repo = new AdminApiRepository('/api/v1', async () => 'token', request)
    expect(await repo.get('oda', '2026-08')).toBeNull(); await expect(repo.put('oda', '2026-08', { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: {} }, { create: true })).rejects.toMatchObject({ kind: 'forbidden' })
    expect(request.mock.calls[1]![1]).toMatchObject({ headers: expect.objectContaining({ 'If-None-Match': '*' }) })
  })
  it('bounds malformed and oversized responses', async () => {
    const repo = new AdminApiRepository('/api/v1', async () => 'token', async () => new Response('{}', { status: 200, headers: { 'content-length': '40000' } }))
    await expect(repo.get('oda', '2026-08')).rejects.toMatchObject({ kind: 'invalid' })
    await expect(repo.get('bad' as never, '2026-08')).rejects.toMatchObject({ kind: 'invalid' })
  })
})
describe('editor conflict semantics', () => {
  it('preserves draft and base and fetches latest without retrying', async () => {
    const base = { document, etag: '"a"' }; const latest = { document: { ...document, updatedAt: '2026-01-02T00:00:00.000Z' }, etag: '"b"' }
    const api = { get: vi.fn().mockResolvedValueOnce(base).mockResolvedValueOnce(latest), put: vi.fn().mockRejectedValue(new AdminApiError('conflict')) }
    const editor = createEditor(api); await editor.load('oda', '2026-08'); const draft = { ...document, days: { ...document.days, '2026-08-09': [2, 2, 2] as [2, 2, 2] } }; editor.updateDraft(draft); await editor.save()
    expect(editor.state.kind).toBe('conflict'); if (editor.state.kind === 'conflict') { expect(editor.state.draft.days['2026-08-09']).toEqual([2, 2, 2]); expect(editor.state.base).toEqual(base); expect(editor.state.latest).toEqual(latest) }; expect(api.put).toHaveBeenCalledTimes(1); expect(api.get).toHaveBeenCalledTimes(2)
  })
})
