import { STADIUMS } from './stadiums.ts'
import type { AvailabilityStatus, StadiumSlug } from './types.ts'

export interface RawFirestoreDocument {
  path: string
  data: { status: [AvailabilityStatus, AvailabilityStatus, AvailabilityStatus] }
}

export interface RawFirestoreCollection {
  slug: StadiumSlug
  legacyId: string
  documents: RawFirestoreDocument[]
}

export interface RawFirestoreSnapshot {
  schemaVersion: 1
  collections: RawFirestoreCollection[]
}

export interface NormalizedFirestoreRecord {
  slug: StadiumSlug
  date: `${number}${number}${number}${number}${number}${number}${number}${number}`
  status: [AvailabilityStatus, AvailabilityStatus, AvailabilityStatus]
}

export class SnapshotValidationError extends Error {
  readonly category: string
  readonly coordinate: string

  constructor(category: string, coordinate: string) {
    super(`Invalid Firestore snapshot (${category}) at ${coordinate}`)
    this.name = 'SnapshotValidationError'
    this.category = category
    this.coordinate = coordinate
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype
}

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index])
}

const status = (value: unknown): value is AvailabilityStatus =>
  typeof value === 'number' && Number.isInteger(value) && (value === 0 || value === 1 || value === 2)

const validDate = (value: string) => {
  if (!/^\d{8}$/.test(value)) return false
  const year = Number(value.slice(0, 4)); const month = Number(value.slice(4, 6)); const day = Number(value.slice(6, 8))
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

const fail = (category: string, coordinate: string): never => { throw new SnapshotValidationError(category, coordinate) }

export function normalizeFirestoreSnapshot(input: unknown): NormalizedFirestoreRecord[] {
  if (!isPlainObject(input)) fail('top-level', 'snapshot')
  const root = input as Record<string, unknown>
  if (!exactKeys(root, ['schemaVersion', 'collections']) || root.schemaVersion !== 1 || !Array.isArray(root.collections)) fail('top-level', 'snapshot')
  const snapshot = root as { schemaVersion: 1; collections: unknown[] }
  if (snapshot.collections.length !== Object.keys(STADIUMS).length) fail('collection-count', 'snapshot')
  const seenSlugs = new Set<string>(); const seenLegacyIds = new Set<string>(); const seenDates = new Set<string>(); const normalized: NormalizedFirestoreRecord[] = []
  snapshot.collections.forEach((collection: unknown, collectionIndex: number) => {
    const coordinate = `collection[${collectionIndex}]`
    if (!isPlainObject(collection)) fail('descriptor', coordinate)
    const descriptor = collection as Record<string, unknown>
    if (!exactKeys(descriptor, ['slug', 'legacyId', 'documents']) || !Array.isArray(descriptor.documents)) fail('descriptor', coordinate)
    const config = typeof descriptor.slug === 'string' ? STADIUMS[descriptor.slug as StadiumSlug] : undefined
    if (!config) fail('identity', coordinate)
    const resolvedConfig = config as (typeof STADIUMS)[StadiumSlug]
    if (descriptor.legacyId !== resolvedConfig.legacyId) fail('identity', coordinate)
    if (seenSlugs.has(resolvedConfig.slug) || seenLegacyIds.has(resolvedConfig.legacyId)) fail('duplicate-descriptor', coordinate)
    seenSlugs.add(resolvedConfig.slug); seenLegacyIds.add(resolvedConfig.legacyId)
    const documents = descriptor.documents as unknown[]
    documents.forEach((document: unknown, documentIndex: number) => {
      const docCoordinate = `${coordinate}.document[${documentIndex}]`
      if (!isPlainObject(document)) fail('document-shape', docCoordinate)
      const sourceDocument = document as Record<string, unknown>
      if (!exactKeys(sourceDocument, ['path', 'data']) || typeof sourceDocument.path !== 'string' || !isPlainObject(sourceDocument.data)) fail('document-shape', docCoordinate)
      const data = sourceDocument.data as Record<string, unknown>
      if (!exactKeys(data, ['status'])) fail('document-shape', docCoordinate)
      const path = sourceDocument.path as string
      const match = /^availability\/([^/]+)\/date\/(\d{8})$/.exec(path)
      if (match === null) fail('path', docCoordinate)
      const groups = match as RegExpExecArray
      const legacyId = groups[1]!; const date = groups[2]!
      if (legacyId !== resolvedConfig.legacyId) fail('path-identity', docCoordinate)
      if (!validDate(date)) fail('date', docCoordinate)
      const rawStatus = data.status
      if (!Array.isArray(rawStatus) || rawStatus.length !== 3 || ![0, 1, 2].every((index) => Object.prototype.hasOwnProperty.call(rawStatus, index)) || !(rawStatus as unknown[]).every(status)) fail('status', docCoordinate)
      const key = `${resolvedConfig.slug}/${date}`
      if (seenDates.has(key)) fail('duplicate-document', docCoordinate)
      seenDates.add(key)
      const tuple = rawStatus as unknown[]
      normalized.push({ slug: resolvedConfig.slug, date: date as NormalizedFirestoreRecord['date'], status: [...tuple] as NormalizedFirestoreRecord['status'] })
    })
  })
  if (seenSlugs.size !== Object.keys(STADIUMS).length) fail('missing-descriptor', 'snapshot')
  return normalized.sort((left, right) => left.slug.localeCompare(right.slug) || left.date.localeCompare(right.date))
}
