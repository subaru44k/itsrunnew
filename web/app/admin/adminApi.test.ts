import { describe, expect, it, vi } from 'vitest'
import { AdminApiError, AdminApiRepository, boundedJson, createEditor } from './adminApi'

const document = { schemaVersion: 1 as const, stadium: 'oda' as const, yearMonth: '2026-08' as const, updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2] as [0, 1, 2] } }
const response = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'content-length': String(JSON.stringify(body).length), ...headers } })
describe('AdminApiRepository', () => {
  it('uses exact same-origin paths and conditional headers', async () => {
    const request = vi.fn().mockImplementation((_: string, init?: RequestInit) => response(200, init?.method === 'PUT' ? { document, etag: '"a"', versionId: 'v' } : { document, etag: '"a"' }))
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

  it('rejects non-exact base paths and invalid path identity before fetch', async () => {
    const request = vi.fn()
    for (const base of ['/api/v1/', '/api/v1?x=1', 'https://preview.example/api/v1', '//preview/api/v1', '/api/v1/../v1']) {
      expect(() => new AdminApiRepository(base, async () => 'token', request)).toThrowError(AdminApiError)
    }
    const repo = new AdminApiRepository('/api/v1', async () => 'token', request)
    await expect(repo.get('unknown' as never, '2026-08')).rejects.toMatchObject({ kind: 'invalid' })
    expect(request).not.toHaveBeenCalled()
  })

  it('validates strong ETags, exact condition unions, and does not invoke fetch as a method', async () => {
    const request = vi.fn().mockResolvedValue(response(200, { document, etag: '"a"', versionId: 'v' }))
    const repo = new AdminApiRepository('/api/v1', async () => 'token', request)
    for (const etag of ['', '*', 'W/"a"', 'a', '"a", "b"', '"a\r\n"']) {
      await expect(repo.put('oda', '2026-08', { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: document.days }, { etag })).rejects.toMatchObject({ kind: 'invalid' })
    }
    await expect(repo.put('oda', '2026-08', { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: document.days }, { etag: '"a"', extra: true } as never)).rejects.toMatchObject({ kind: 'invalid' })
    await expect(repo.put('oda', '2026-08', { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: document.days }, { create: true, extra: true } as never)).rejects.toMatchObject({ kind: 'invalid' })
    await repo.put('oda', '2026-08', { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: document.days }, { etag: '"a"' })
    expect(request).toHaveBeenCalled()
  })

  it('maps statuses without leaking forbidden response text and requires exact content types/envelopes', async () => {
    const kinds = new Map([[400, 'invalid'], [401, 'unauthorized'], [403, 'forbidden'], [404, 'notFound'], [409, 'conflict'], [415, 'unsupported'], [429, 'rateLimited'], [500, 'server']])
    for (const status of [400, 401, 403, 404, 409, 415, 429, 500]) {
      const request = vi.fn().mockResolvedValue(response(status, { secret: 'do-not-expose' }))
      const repo = new AdminApiRepository('/api/v1', async () => 'token', request)
      await expect(repo.put('oda', '2026-08', { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: document.days }, { create: true })).rejects.toMatchObject({ kind: kinds.get(status) })
    }
    const wrongType = vi.fn().mockResolvedValue(new Response(JSON.stringify({ document, etag: '"a"' }), { status: 200, headers: { 'content-type': 'text/plain' } }))
    await expect(new AdminApiRepository('/api/v1', async () => 'token', wrongType).get('oda', '2026-08')).rejects.toMatchObject({ kind: 'invalid' })
    const unknown = vi.fn().mockResolvedValue(response(200, { document, etag: '"a"', extra: 'secret' }))
    await expect(new AdminApiRepository('/api/v1', async () => 'token', unknown).get('oda', '2026-08')).rejects.toMatchObject({ kind: 'invalid' })
  })

  it('hard-bounds stream bytes and releases/cancels on overflow, while accepting exact size', async () => {
    const streamResponse = (bytes: number) => {
      const chunk = new Uint8Array(bytes).fill(32)
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(chunk); controller.close() } }), { status: 200, headers: { 'content-type': 'application/json', 'content-length': '1' } })
    }
    const tooLarge = new AdminApiRepository('/api/v1', async () => 'token', async () => streamResponse(32 * 1024 + 1))
    await expect(tooLarge.get('oda', '2026-08')).rejects.toMatchObject({ kind: 'invalid' })
    const exact = new AdminApiRepository('/api/v1', async () => 'token', async () => streamResponse(32 * 1024))
    await expect(exact.get('oda', '2026-08')).rejects.toMatchObject({ kind: 'invalid' })
  })

  it('cancels and releases an overflowing or errored reader exactly once', async () => {
    const reader = { read: vi.fn(async () => ({ done: false, value: new Uint8Array(32 * 1024 + 1) })), cancel: vi.fn(async () => undefined), releaseLock: vi.fn() }
    const body = { getReader: () => reader }
    await expect(boundedJson({ body } as unknown as Response)).rejects.toBeDefined()
    expect(reader.cancel).toHaveBeenCalledTimes(1); expect(reader.releaseLock).toHaveBeenCalledTimes(1)
    const streamErrorReader = { read: vi.fn(async () => { throw new Error('stream failure') }), cancel: vi.fn(async () => undefined), releaseLock: vi.fn() }
    await expect(boundedJson({ body: { getReader: () => streamErrorReader } } as unknown as Response)).rejects.toBeDefined()
    expect(streamErrorReader.cancel).toHaveBeenCalledTimes(1); expect(streamErrorReader.releaseLock).toHaveBeenCalledTimes(1)
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
