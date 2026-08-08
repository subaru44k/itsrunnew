import { describe, expect, it } from 'vitest'
import { createHandler } from '../src/handler'
import type { ApiEvent, ScheduleStore } from '../src/types'

const good = {
  schemaVersion: 1, stadium: 'oda', yearMonth: '2026-01',
  days: { '2026-01-01': [1, 0, 2] },
}
const event = (method: string, overrides: Partial<ApiEvent> = {}): ApiEvent => ({
  version: '2.0',
  routeKey: `${method} /api/v1/stadiums/{stadium}/availability/{yearMonth}`,
  pathParameters: { stadium: 'oda', yearMonth: '2026-01' },
  headers: { 'content-type': 'application/json' }, body: method === 'PUT' ? JSON.stringify(good) : undefined,
  requestContext: { requestId: 'req-1', http: { method }, authorizer: { jwt: { claims: { token_use: 'access', sub: 'secret-sub', scope: 'openid itsrun/schedule.write', 'cognito:groups': ['admins'] } } } },
  ...overrides,
})
const store = (initial?: string): ScheduleStore & { calls: Array<{ key: string; body: string; condition: object }> } => {
  let body = initial; const calls: Array<{ key: string; body: string; condition: object }> = []
  return { calls, async get() { if (!body) throw Object.assign(new Error('missing'), { $metadata: { httpStatusCode: 404 } }); return { body, etag: '"old"' } }, async put(key, value, condition) { calls.push({ key, body: value, condition }); body = value; return { etag: '"new"', versionId: 'v1' } } }
}
const handlerWith = (s: ScheduleStore) => createHandler({ store: s, now: () => new Date('2026-01-01T00:00:00.000Z'), log: () => undefined })

describe('schedule API handler', () => {
  it('requires an access token, scope, and admins group without exposing claims', async () => {
    const logs: unknown[] = []; const handler = createHandler({ store: store(), log: (entry) => logs.push(entry) })
    const result = await handler(event('GET', { requestContext: { requestId: 'r', http: { method: 'GET' }, authorizer: { jwt: { claims: { token_use: 'id', sub: 'raw-secret' } } } } }))
    expect(result.statusCode).toBe(403); expect(JSON.parse(result.body)).toEqual({ error: { code: 'forbidden', message: 'The user is not authorized for this operation.', requestId: 'r' } }); expect(result.body).not.toContain('raw-secret'); expect(JSON.stringify(logs)).not.toContain('raw-secret')
  })
  it('gets a validated document and returns no-store plus etag', async () => {
    const s = store(JSON.stringify({ ...good, updatedAt: '2026-01-01T00:00:00.000Z' })); const result = await handlerWith(s)(event('GET'))
    expect(result.statusCode).toBe(200); expect(result.headers['cache-control']).toBe('no-store'); expect(result.body).toContain('"etag":"\\"old\\""')
  })
  it('maps missing and invalid stored data safely', async () => {
    const missing = await handlerWith(store())(event('GET'))
    expect(missing.statusCode).toBe(404); expect(JSON.parse(missing.body)).toEqual({ error: { code: 'schedule_not_found', message: 'Schedule month does not exist.', requestId: 'req-1' } })
    const invalid = await handlerWith(store(JSON.stringify({ nope: true })))(event('GET'))
    expect(invalid.statusCode).toBe(500); expect(JSON.parse(invalid.body).error.code).toBe('internal_error'); expect(invalid.body).not.toContain('invalid_stored_data')
  })
  it('creates with If-None-Match and updates with If-Match', async () => {
    const first = store(); const create = await handlerWith(first)(event('PUT', { headers: { 'content-type': 'application/json', 'if-none-match': '*' } }))
    expect(create.statusCode).toBe(200); expect(first.calls[0]?.condition).toEqual({ kind: 'create' })
    const second = store(); const update = await handlerWith(second)(event('PUT', { headers: { 'content-type': 'application/json', 'if-match': '"old"' } }))
    expect(update.statusCode).toBe(200); expect(second.calls[0]?.condition).toEqual({ kind: 'match', etag: '"old"' }); expect(update.body).toContain('2026-01-01T00:00:00.000Z'); expect(JSON.parse(update.body).requestId).toBeUndefined()
  })
  it('maps S3 precondition conflicts without retrying or exposing SDK errors', async () => {
    const original = JSON.stringify({ ...good, updatedAt: '2026-01-01T00:00:00.000Z' })
    const s: ScheduleStore = { async get() { return { body: original } }, async put() { throw Object.assign(new Error('sensitive aws detail'), { $metadata: { httpStatusCode: 412 } }) } }
    const logs: unknown[] = []; const h = createHandler({ store: s, log: (entry) => logs.push(entry) })
    const result = await h(event('PUT', { headers: { 'content-type': 'application/json', 'if-match': '"old"' } }))
    expect(result.statusCode).toBe(409); expect(result.body).not.toContain('sensitive aws detail'); expect(JSON.stringify(logs)).not.toContain('sensitive aws detail')
  })
  it('emits one bounded audit record with only the allowlisted fields', async () => {
    const logs: Record<string, unknown>[] = []; const s = store(JSON.stringify({ ...good, updatedAt: '2026-01-01T00:00:00.000Z' }))
    const result = await createHandler({ store: s, now: () => new Date('2026-01-01T00:00:00.000Z'), log: (entry) => logs.push(entry) })(event('GET', { headers: { authorization: 'Bearer very-secret-token', 'content-type': 'application/json' } }))
    expect(result.statusCode).toBe(200); expect(logs).toHaveLength(1)
    expect(Object.keys(logs[0] ?? {}).sort()).toEqual(['actorSubHash', 'durationMs', 'method', 'requestId', 'route', 'stadium', 'status', 'yearMonth'])
    expect(JSON.stringify(logs)).not.toMatch(/very-secret-token|secret-sub|bucket|data\/v1|body|document|aws/i)
  })
  it('rejects malformed, unknown, stale, unconditional, and oversized input', async () => {
    const h = handlerWith(store())
    expect((await h(event('PUT', { body: '{', headers: { 'content-type': 'application/json', 'if-none-match': '*' } }))).statusCode).toBe(400)
    expect((await h(event('PUT', { body: JSON.stringify({ ...good, updatedAt: 'client' }), headers: { 'content-type': 'application/json', 'if-none-match': '*' } }))).statusCode).toBe(400)
    expect((await h(event('PUT', { headers: { 'content-type': 'application/json' } }))).statusCode).toBe(400)
    expect((await h(event('PUT', { headers: { 'content-type': 'text/plain', 'if-none-match': '*' } }))).statusCode).toBe(415)
    for (const value of [null, [], 'text', 1]) {
      const result = await h(event('PUT', { body: JSON.stringify(value), headers: { 'content-type': 'application/json', 'if-none-match': '*' } }))
      expect(result.statusCode).toBe(400); expect(JSON.parse(result.body).error.code).toBe('invalid_request')
    }
    for (const value of ['W/"weak"', '*', '"a", "b"', '']) {
      const result = await h(event('PUT', { headers: { 'content-type': 'application/json', 'if-match': value } }))
      expect(result.statusCode).toBe(400)
    }
    const both = await h(event('PUT', { headers: { 'content-type': 'application/json', 'if-match': '', 'if-none-match': '*' } }))
    expect(both.statusCode).toBe(400)
    const invalidSchedule = await h(event('PUT', { body: JSON.stringify({ ...good, days: { '2026-01-01': [-1, 0, 1] } }), headers: { 'content-type': 'application/json', 'if-none-match': '*' } }))
    expect(invalidSchedule.statusCode).toBe(400)
    const routeMismatch = await h(event('GET', { routeKey: 'GET /wrong', requestContext: { requestId: 'r', http: { method: 'GET' }, authorizer: { jwt: { claims: { token_use: 'access', sub: 'sub', scope: 'itsrun/schedule.write', 'cognito:groups': ['admins'] } } } } }))
    expect(routeMismatch.statusCode).toBe(400)
    const tooLarge = await h(event('PUT', { body: JSON.stringify({ ...good, days: { '2026-01-01': [1, 0, 2], extra: 'x'.repeat(33 * 1024) } }), headers: { 'content-type': 'application/json', 'if-none-match': '*' } }))
    expect(tooLarge.statusCode).toBe(400)
  })
})
