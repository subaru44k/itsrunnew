import { createHash } from 'node:crypto'
import { isValidYearMonth, parseScheduleMonth, scheduleMonthPath, stadiumForSlug, type StadiumSlug } from '@itsrun/core'
import type { ApiEvent, ApiResponse, HandlerDependencies, ScheduleDocument, WriteCondition } from './types.js'

const jsonHeaders = { 'content-type': 'application/json', 'cache-control': 'no-store' }
const GET_ROUTE = 'GET /api/v1/stadiums/{stadium}/availability/{yearMonth}'
const PUT_ROUTE = 'PUT /api/v1/stadiums/{stadium}/availability/{yearMonth}'
const errorMessages: Record<string, string> = {
  invalid_request: 'The request is invalid.',
  forbidden: 'The user is not authorized for this operation.',
  schedule_not_found: 'Schedule month does not exist.',
  schedule_conflict: 'The schedule was changed by another user.',
  unsupported_media_type: 'Content-Type must be application/json.',
  internal_error: 'An internal error occurred.',
}
const successResponse = (statusCode: number, body: unknown): ApiResponse => ({ statusCode, headers: jsonHeaders, body: JSON.stringify(body) })
const errorResponse = (statusCode: number, code: keyof typeof errorMessages, requestId: string): ApiResponse => ({
  statusCode, headers: jsonHeaders, body: JSON.stringify({ error: { code, message: errorMessages[code], requestId } }),
})
const header = (event: ApiEvent, name: string): { present: boolean; value?: string } => {
  const match = Object.entries(event.headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return match ? { present: true, value: match[1] } : { present: false }
}
const claimsOf = (event: ApiEvent) => event.requestContext?.authorizer?.jwt?.claims ?? {}
const actorHash = (sub: string) => createHash('sha256').update(sub).digest('hex')
const groupsOf = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value !== 'string') return []
  return value.replace(/^\[|\]$/g, '').split(/[ ,]+/).filter(Boolean)
}
const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
const isStrongEtag = (value: string | undefined): value is string => typeof value === 'string' && /^"[^"\\,]+"$/.test(value)

export function createHandler(deps: HandlerDependencies) {
  const now = deps.now ?? (() => new Date())
  const log = deps.log ?? ((entry) => console.log(JSON.stringify(entry)))
  return async function handler(event: ApiEvent): Promise<ApiResponse> {
    const started = Date.now()
    const requestId = event.requestContext?.requestId ?? 'unknown'
    const method = event.requestContext?.http?.method ?? ''
    const route = event.routeKey === GET_ROUTE || event.routeKey === PUT_ROUTE ? event.routeKey : ''
    const claims = claimsOf(event)
    const rawSub = claims.sub
    let status = 500
    let logStadium: string | undefined
    let logYearMonth: string | undefined
    let versionId: string | undefined
    let actorSubHash: string | undefined
    try {
      if (claims.token_use !== 'access' || typeof rawSub !== 'string' || typeof claims.scope !== 'string' || !claims.scope.split(/\s+/).includes('itsrun/schedule.write') || !groupsOf(claims['cognito:groups']).includes('admins')) {
        status = 403
        return errorResponse(status, 'forbidden', requestId)
      }
      actorSubHash = actorHash(rawSub)
      if (event.version !== '2.0' || (event.routeKey !== GET_ROUTE && event.routeKey !== PUT_ROUTE) || event.requestContext?.http?.method !== event.routeKey?.split(' ', 1)[0]) {
        status = 400
        return errorResponse(status, 'invalid_request', requestId)
      }
      const stadium = event.pathParameters?.stadium
      const yearMonth = event.pathParameters?.yearMonth
      if (typeof stadium !== 'string' || !stadiumForSlug(stadium) || typeof yearMonth !== 'string' || !isValidYearMonth(yearMonth)) {
        status = 400
        return errorResponse(status, 'invalid_request', requestId)
      }
      logStadium = stadium; logYearMonth = yearMonth
      const validStadium = stadium as StadiumSlug
      const key = scheduleMonthPath(validStadium, yearMonth)
      if (method === 'GET') {
        let stored: Awaited<ReturnType<typeof deps.store.get>>
        try { stored = await deps.store.get(key) } catch (error) {
          if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) {
            status = 404
            return errorResponse(status, 'schedule_not_found', requestId)
          }
          throw error
        }
        if (!stored.etag) throw new Error('missing_etag')
        let document: ScheduleDocument
        try { document = parseScheduleMonth(JSON.parse(stored.body), { stadium: validStadium, yearMonth }) } catch { throw new Error('invalid_stored_data') }
        status = 200
        return successResponse(status, { document, etag: stored.etag })
      }
      const contentType = header(event, 'content-type').value?.split(';', 1)[0].trim().toLowerCase()
      if (contentType !== 'application/json') {
        status = 415
        return errorResponse(status, 'unsupported_media_type', requestId)
      }
      if (event.isBase64Encoded || typeof event.body !== 'string' || new TextEncoder().encode(event.body).byteLength > 32 * 1024) {
        status = 400
        return errorResponse(status, 'invalid_request', requestId)
      }
      let parsed: Record<string, unknown>
      try {
        const value: unknown = JSON.parse(event.body)
        if (!isPlainRecord(value)) throw new Error('not_object')
        parsed = value
      } catch {
        status = 400
        return errorResponse(status, 'invalid_request', requestId)
      }
      const allowedKeys = ['schemaVersion', 'stadium', 'yearMonth', 'days']
      if (Object.keys(parsed).some((keyName) => !allowedKeys.includes(keyName)) || parsed.schemaVersion !== 1 || parsed.stadium !== stadium || parsed.yearMonth !== yearMonth || !isPlainRecord(parsed.days)) {
        status = 400
        return errorResponse(status, 'invalid_request', requestId)
      }
      let document: ScheduleDocument
      try { document = parseScheduleMonth({ ...parsed, updatedAt: now().toISOString() }, { stadium: validStadium, yearMonth }) } catch {
        status = 400
        return errorResponse(status, 'invalid_request', requestId)
      }
      const ifMatch = header(event, 'if-match')
      const ifNoneMatch = header(event, 'if-none-match')
      if (ifMatch.present && ifNoneMatch.present) {
        status = 400
        return errorResponse(status, 'invalid_request', requestId)
      }
      let condition: WriteCondition
      if (ifMatch.present) {
        if (!isStrongEtag(ifMatch.value)) {
          status = 400
          return errorResponse(status, 'invalid_request', requestId)
        }
        condition = { kind: 'match', etag: ifMatch.value }
      } else if (ifNoneMatch.present && ifNoneMatch.value === '*') {
        condition = { kind: 'create' }
      } else {
        status = 400
        return errorResponse(status, 'invalid_request', requestId)
      }
      let result: Awaited<ReturnType<typeof deps.store.put>>
      try { result = await deps.store.put(key, JSON.stringify(document), condition) } catch (error) {
        const code = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        if (code === 409 || code === 412) {
          status = 409
          return errorResponse(status, 'schedule_conflict', requestId)
        }
        throw error
      }
      if (!result.etag || !result.versionId) throw new Error('missing_write_metadata')
      versionId = result.versionId
      status = 200
      return successResponse(status, { document, etag: result.etag, versionId })
    } catch {
      status = 500
      return errorResponse(status, 'internal_error', requestId)
    } finally {
      const entry: Record<string, unknown> = { requestId, route, method, status, durationMs: Date.now() - started }
      if (logStadium !== undefined) entry.stadium = logStadium
      if (logYearMonth !== undefined) entry.yearMonth = logYearMonth
      if (actorSubHash !== undefined) entry.actorSubHash = actorSubHash
      if (versionId !== undefined && status === 200) entry.s3VersionId = versionId
      try { log(entry) } catch { /* logging must not change the API result */ }
    }
  }
}
