import { describe, expect, it } from 'vitest'
import { createHandler } from '../src/handler'
import { S3ScheduleStore } from '../src/s3-store'
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
  it('rejects missing scope, near-match scope, and non-admin groups', async () => {
    for (const claims of [
      { token_use: 'access', sub: 'sub', scope: 'openid', 'cognito:groups': ['admins'] },
      { token_use: 'access', sub: 'sub', scope: 'itsrun/schedule.write-extra', 'cognito:groups': ['admins'] },
      { token_use: 'access', sub: 'sub', scope: 'itsrun/schedule.write', 'cognito:groups': ['operators'] },
    ]) {
      const result = await handlerWith(store())(event('GET', { requestContext: { requestId: 'r', http: { method: 'GET' }, authorizer: { jwt: { claims } } } }))
      expect(result.statusCode).toBe(403)
    }
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
    const unexpected = await handlerWith({ async get() { throw new Error('raw aws detail') }, async put() { throw new Error('unused') } })(event('GET'))
    expect(unexpected.statusCode).toBe(500); expect(unexpected.body).not.toContain('raw aws detail')
  })
  it('sanitizes missing and failed S3 response bodies through the handler', async () => {
    for (const Body of [undefined, { async *[Symbol.asyncIterator]() { throw new Error('technical stream failure') } }]) {
      const logs: Record<string, unknown>[] = []
      const s = new S3ScheduleStore({ async send() { return { Body } } } as never, 'sensitive-bucket')
      const result = await createHandler({ store: s, log: (entry) => logs.push(entry) })(event('GET'))
      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body)).toEqual({ error: { code: 'internal_error', message: 'An internal error occurred.', requestId: 'req-1' } })
      expect(result.headers).toEqual({ 'content-type': 'application/json', 'cache-control': 'no-store' })
      expect(logs).toHaveLength(1)
      expect(JSON.stringify(logs)).not.toMatch(/technical stream failure|sensitive-bucket|data\/v1|stack/i)
    }
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
  it('maps both S3 conflict statuses once and keeps the fake state unchanged', async () => {
    for (const httpStatusCode of [409, 412]) {
      let attempts = 0
      const original = JSON.stringify({ ...good, updatedAt: '2026-01-01T00:00:00.000Z' })
      let saved = original
      const s: ScheduleStore = {
        async get() { return { body: saved, etag: '"old"' } },
        async put() { attempts += 1; throw Object.assign(new Error('conflict'), { $metadata: { httpStatusCode } }) },
      }
      const result = await handlerWith(s)(event('PUT', { headers: { 'content-type': 'application/json', 'if-match': '"old"' } }))
      expect(result.statusCode).toBe(409)
      expect(attempts).toBe(1)
      expect(saved).toBe(original)
      expect(JSON.parse(result.body)).toEqual({ error: { code: 'schedule_conflict', message: 'The schedule was changed by another user.', requestId: 'req-1' } })
    }
  })
  it('sanitizes missing write metadata and missing GET etags', async () => {
    const missingGet: ScheduleStore = { async get() { return { body: JSON.stringify({ ...good, updatedAt: '2026-01-01T00:00:00.000Z' }) } }, async put() { throw new Error('unused') } }
    const getResult = await handlerWith(missingGet)(event('GET'))
    expect(getResult.statusCode).toBe(500)
    const noPutEtag: ScheduleStore = { async get() { return { body: '' } }, async put() { return { versionId: 'v1' } } }
    const noPutVersion: ScheduleStore = { async get() { return { body: '' } }, async put() { return { etag: '"e"' } } }
    for (const s of [noPutEtag, noPutVersion]) expect((await handlerWith(s)(event('PUT', { headers: { 'content-type': 'application/json', 'if-none-match': '*' } }))).statusCode).toBe(500)
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
  it('covers parser, route, media, conditional, and encoded-body client failures', async () => {
    const h = handlerWith(store())
    const invalidBodies: unknown[] = [
      { ...good, days: { '2026-01-01': [1] } },
      { ...good, days: { '2026-01-01': [1, 0, 2, 3] } },
      { ...good, days: { '2026-01-01': [1, '0', 2] } },
      { ...good, days: { '2026-01-01': [1, 0, 2], '2026-02-01': [1, 0, 2] } },
      { ...good, days: { '2026-01-32': [1, 0, 2] } },
    ]
    for (const body of invalidBodies) {
      const result = await h(event('PUT', { body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'if-none-match': '*' } }))
      expect(result.statusCode).toBe(400)
    }
    for (const headers of [
      { 'content-type': 'application/json', 'if-match': 'W/"weak"' },
      { 'content-type': 'application/json', 'if-match': '"a", "b"' },
      { 'content-type': 'application/json', 'if-match': '"ok"', 'if-none-match': '*' },
      { 'content-type': 'application/json', 'if-none-match': 'yes' },
    ]) expect((await h(event('PUT', { headers }))).statusCode).toBe(400)
    expect((await h(event('PUT', { isBase64Encoded: true, headers: { 'content-type': 'application/json', 'if-none-match': '*' } }))).statusCode).toBe(400)
    expect((await h(event('PUT', { headers: { 'content-type': 'application/json; charset=utf-8', 'if-none-match': '*' } }))).statusCode).toBe(200)
    expect((await h(event('PUT', { version: '1.0', headers: { 'content-type': 'application/json', 'if-none-match': '*' } }))).statusCode).toBe(400)
    expect((await h(event('PUT', { pathParameters: undefined, headers: { 'content-type': 'application/json', 'if-none-match': '*' } }))).statusCode).toBe(400)
    for (const body of [
      { ...good, days: { '2026-01-01': [, 0, 2] } },
      { ...good, days: { '2026-01-01': [1, null, 2] } },
      { ...good, days: Object.fromEntries(Array.from({ length: 32 }, (_, index) => [`2026-01-${String(index + 1).padStart(2, '0')}`, [1, 0, 2]])) },
      { ...good, stadium: 'komazawa' },
      { ...good, yearMonth: '2026-02' },
    ]) {
      expect((await h(event('PUT', { body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'if-none-match': '*' } }))).statusCode).toBe(400)
    }
    expect((await h(event('PUT', { routeKey: 'GET /api/v1/stadiums/{stadium}/availability/{yearMonth}', headers: { 'content-type': 'application/json', 'if-none-match': '*' } }))).statusCode).toBe(400)
    expect((await h(event('PUT', { headers: { 'content-type': 'application/json', 'if-match': '' } }))).statusCode).toBe(400)
  })
  it('returns exact sanitized envelopes and one allowlisted audit record', async () => {
    const cases: Array<[number, string, ApiEvent, ScheduleStore]> = [
      [403, 'forbidden', event('GET', { requestContext: { requestId: 'r', http: { method: 'GET' }, authorizer: { jwt: { claims: { token_use: 'id' } } } } }), store()],
      [404, 'schedule_not_found', event('GET'), store()],
      [500, 'internal_error', event('GET'), { async get() { throw new Error('secret aws') }, async put() { throw new Error('unused') } }],
      [415, 'unsupported_media_type', event('PUT', { headers: { 'content-type': 'text/plain', 'if-none-match': '*' } }), store()],
    ]
    for (const [status, code, ev, s] of cases) {
      const logs: Record<string, unknown>[] = []
      const result = await createHandler({ store: s, log: (entry) => logs.push(entry) })(ev)
      expect(result.statusCode).toBe(status)
      expect(result.headers).toEqual({ 'content-type': 'application/json', 'cache-control': 'no-store' })
      expect(JSON.parse(result.body).error).toMatchObject({ code, requestId: ev.requestContext?.requestId ?? 'unknown' })
      expect(logs).toHaveLength(1)
      expect(Object.keys(logs[0] ?? {}).sort()).toEqual(expect.arrayContaining(['requestId', 'route', 'method', 'status', 'durationMs']))
      expect(JSON.stringify(logs)).not.toContain('secret aws')
    }
  })
  it('returns exact 400 and 409 contracts and exact audit keys', async () => {
    const logs: Record<string, unknown>[] = []
    const h = createHandler({ store: store(), log: (entry) => logs.push(entry) })
    const invalid = await h(event('PUT', { headers: { 'content-type': 'application/json', 'if-none-match': 'nope' } }))
    expect(invalid).toEqual({ statusCode: 400, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify({ error: { code: 'invalid_request', message: 'The request is invalid.', requestId: 'req-1' } }) })
    expect(Object.keys(logs[0] ?? {}).sort()).toEqual(['actorSubHash', 'durationMs', 'method', 'requestId', 'route', 'stadium', 'status', 'yearMonth'])
    const conflictStore: ScheduleStore = { async get() { return { body: '' } }, async put() { throw Object.assign(new Error('raw conflict'), { $metadata: { httpStatusCode: 409 } }) } }
    const conflict = await createHandler({ store: conflictStore, log: (entry) => logs.push(entry) })(event('PUT', { headers: { 'content-type': 'application/json', 'if-none-match': '*' } }))
    expect(JSON.parse(conflict.body)).toEqual({ error: { code: 'schedule_conflict', message: 'The schedule was changed by another user.', requestId: 'req-1' } })
    expect(Object.keys(logs[1] ?? {}).sort()).toEqual(['actorSubHash', 'durationMs', 'method', 'requestId', 'route', 'stadium', 'status', 'yearMonth'])
  })
  it('accepts serialized Cognito admin groups but rejects near matches', async () => {
    for (const groups of ['[admins]', ['admins']]) {
      const result = await handlerWith(store(JSON.stringify({ ...good, updatedAt: '2026-01-01T00:00:00.000Z' })))(event('GET', { requestContext: { requestId: 'req-1', http: { method: 'GET' }, authorizer: { jwt: { claims: { token_use: 'access', sub: 'sub', scope: 'itsrun/schedule.write', 'cognito:groups': groups } } } } }))
      expect(result.statusCode).toBe(200)
    }
    const result = await handlerWith(store())(event('GET', { requestContext: { requestId: 'req-1', http: { method: 'GET' }, authorizer: { jwt: { claims: { token_use: 'access', sub: 'sub', scope: 'itsrun/schedule.write', 'cognito:groups': ['admins-extra'] } } } } }))
    expect(result.statusCode).toBe(403)
  })
  it('keeps typed keys isolated from hostile path values', async () => {
    let reads = 0
    const isolated: ScheduleStore = { async get() { reads += 1; return { body: JSON.stringify({ ...good, updatedAt: '2026-01-01T00:00:00.000Z' }), etag: '"e"' } }, async put() { throw new Error('unused') } }
    const result = await handlerWith(isolated)(event('GET', { pathParameters: { stadium: '../web', yearMonth: '2026-01' } }))
    expect(result.statusCode).toBe(400); expect(reads).toBe(0)
  })
})
