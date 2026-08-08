import { createHash } from 'node:crypto'
import { isValidYearMonth, parseScheduleMonth, scheduleMonthPath, stadiumForSlug, type StadiumSlug } from '@itsrun/core'
import type { ApiEvent, ApiResponse, HandlerDependencies, ScheduleDocument } from './types.js'

const jsonHeaders = { 'content-type': 'application/json', 'cache-control': 'no-store' }
const response = (statusCode: number, body: unknown, requestId: string): ApiResponse => ({ statusCode, headers: jsonHeaders, body: JSON.stringify({ ...((body && typeof body === 'object') ? body : { error: body }), requestId }) })
const errorResponse = (statusCode: number, code: string, requestId: string) => response(statusCode, { error: { code, message: code } }, requestId)
const header = (event: ApiEvent, name: string) => Object.entries(event.headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1]
const claimsOf = (event: ApiEvent) => event.requestContext?.authorizer?.jwt?.claims ?? {}
const actorHash = (sub: unknown) => typeof sub === 'string' ? createHash('sha256').update(sub).digest('hex') : undefined
const groupsOf = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : typeof value === 'string' ? value.split(' ') : []
const allowedKeys = ['schemaVersion', 'stadium', 'yearMonth', 'days']

export function createHandler(deps: HandlerDependencies) {
  const now = deps.now ?? (() => new Date())
  const log = deps.log ?? ((entry) => console.log(JSON.stringify(entry)))
  return async function handler(event: ApiEvent): Promise<ApiResponse> {
    const started = Date.now(); const requestId = event.requestContext?.requestId ?? 'unknown'; const method = event.requestContext?.http?.method ?? ''
    const stadium = event.pathParameters?.stadium; const yearMonth = event.pathParameters?.yearMonth; const claims = claimsOf(event)
    const common = { requestId, route: event.routeKey ?? '', method, stadium, yearMonth, actorSubHash: actorHash(claims.sub) }
    let status = 500; let versionId: string | undefined
    try {
      if (claims.token_use !== 'access' || typeof claims.sub !== 'string' || !claims.scope?.toString().split(' ').includes('itsrun/schedule.write') || !groupsOf(claims['cognito:groups']).includes('admins')) return (status = 403, errorResponse(status, 'forbidden', requestId))
      if (typeof stadium !== 'string' || !stadiumForSlug(stadium) || typeof yearMonth !== 'string' || !isValidYearMonth(yearMonth)) return (status = 400, errorResponse(status, 'invalid_path', requestId))
      const validStadium = stadium as StadiumSlug
      const key = scheduleMonthPath(validStadium, yearMonth)
      if (method === 'GET') {
        let stored
        try { stored = await deps.store.get(key) } catch (error) { if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return (status = 404, errorResponse(status, 'not_found', requestId)); throw error }
        let document: ScheduleDocument
        try { document = parseScheduleMonth(JSON.parse(stored.body), { stadium: validStadium, yearMonth }) } catch { return (status = 500, errorResponse(status, 'invalid_stored_data', requestId)) }
        status = 200; return response(status, { document, etag: stored.etag }, requestId)
      }
      if (method !== 'PUT') return (status = 405, errorResponse(status, 'method_not_allowed', requestId))
      const contentType = header(event, 'content-type')?.split(';', 1)[0].trim().toLowerCase(); if (contentType !== 'application/json') return (status = 415, errorResponse(status, 'unsupported_media_type', requestId))
      if (event.isBase64Encoded || typeof event.body !== 'string' || new TextEncoder().encode(event.body).byteLength > 32 * 1024) return (status = 400, errorResponse(status, 'invalid_body', requestId))
      let parsed: Record<string, unknown>
      try { parsed = JSON.parse(event.body) as Record<string, unknown> } catch { return (status = 400, errorResponse(status, 'invalid_body', requestId)) }
      if (Object.keys(parsed).some((key) => !allowedKeys.includes(key)) || parsed.updatedAt !== undefined) return (status = 400, errorResponse(status, 'invalid_body', requestId))
      if (parsed.schemaVersion !== 1 || parsed.stadium !== stadium || parsed.yearMonth !== yearMonth || !parsed.days) return (status = 400, errorResponse(status, 'invalid_body', requestId))
      const document = parseScheduleMonth({ ...parsed, updatedAt: now().toISOString() }, { stadium: validStadium, yearMonth })
      const ifMatch = header(event, 'if-match'); const ifNoneMatch = header(event, 'if-none-match')
      if ((ifMatch ? 1 : 0) + (ifNoneMatch ? 1 : 0) !== 1 || (ifNoneMatch !== undefined && ifNoneMatch !== '*')) return (status = 400, errorResponse(status, 'invalid_precondition', requestId))
      let result
      try { result = await deps.store.put(key, JSON.stringify(document), ifMatch ? { ifMatch } : { ifNoneMatch: '*' }) } catch (error) { const code = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode; if (code === 409 || code === 412) return (status = 409, errorResponse(status, 'schedule_conflict', requestId)); throw error }
      versionId = result.versionId; status = 200; return response(status, { document, etag: result.etag, versionId }, requestId)
    } catch { status = 500; return errorResponse(status, 'internal_error', requestId) }
    finally { log({ ...common, status, ...(versionId ? { s3VersionId: versionId } : {}), durationMs: Date.now() - started }) }
  }
}
