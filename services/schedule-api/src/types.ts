import type { ScheduleMonth, SchedulePath, StadiumSlug, YearMonth } from '@itsrun/core'

export interface ApiEvent {
  version?: string
  routeKey?: string
  rawPath?: string
  rawQueryString?: string
  headers?: Record<string, string | undefined>
  body?: string | null
  isBase64Encoded?: boolean
  pathParameters?: Record<string, string | undefined> | null
  requestContext?: {
    requestId?: string
    http?: { method?: string; path?: string }
    authorizer?: { jwt?: { claims?: Record<string, unknown> } }
  }
}

export interface ApiResponse { statusCode: number; headers: Record<string, string>; body: string }
export type WriteCondition = { kind: 'match'; etag: string } | { kind: 'create' }
export interface ScheduleStore {
  get(key: SchedulePath): Promise<{ body: string; etag?: string }>
  put(key: SchedulePath, body: string, condition: WriteCondition): Promise<{ etag?: string; versionId?: string }>
}
export interface HandlerDependencies { store: ScheduleStore; now?: () => Date; log?: (entry: Record<string, unknown>) => void }
export type ScheduleDocument = ScheduleMonth
export type { SchedulePath, StadiumSlug, YearMonth }
