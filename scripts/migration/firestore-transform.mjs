import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { parseScheduleMonth, STADIUMS } from '../../packages/core/src/index.ts'

const MAX_BYTES = 32 * 1024
const CONTENT_TYPE = 'application/json'
const CACHE_CONTROL = 'public, max-age=0, s-maxage=60'
const recordKeys = ['slug', 'date', 'status']
const identityPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const updatedAtPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export class TransformValidationError extends Error {
  constructor(category, coordinate = 'transform') {
    super(`Invalid migration input (${category}) at ${coordinate}`)
    this.name = 'TransformValidationError'
    this.category = category
    this.coordinate = coordinate
  }
}

export class MigrationWriteError extends Error {
  constructor(category) { super(`Migration artifact write failed (${category})`); this.name = 'MigrationWriteError'; this.category = category }
}

const fail = (category, coordinate = 'transform') => { throw new TransformValidationError(category, coordinate) }
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
const exact = (value, keys) => { const actual = Object.keys(value).sort(); const expected = [...keys].sort(); return actual.length === expected.length && actual.every((key, index) => key === expected[index]) }
const ordered = (value, keys) => Object.keys(value).join('\u0000') === keys.join('\u0000')
const validStatus = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2
const validDate = (value) => { if (typeof value !== 'string' || !/^\d{8}$/.test(value)) return false; const year = Number(value.slice(0, 4)); const month = Number(value.slice(4, 6)); const day = Number(value.slice(6)); const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day }
const month = (date) => `${date.slice(0, 4)}-${date.slice(4, 6)}`
const isoDate = (date) => `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`
const dateRange = (dates) => dates.length ? { from: dates[0], to: dates[dates.length - 1] } : { from: null, to: null }
const bytes = (text) => new TextEncoder().encode(text)
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const canonicalTimestamp = (value) => typeof value === 'string' && updatedAtPattern.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value
const objectKeys = ['key', 'stadium', 'yearMonth', 'sourceCount', 'dateRange', 'bytes', 'sha256', 'contentType', 'cacheControl']
const manifestKeys = ['schemaVersion', 'sourceIdentity', 'migrationUpdatedAt', 'sourceCount', 'dateRange', 'objects']
const artifactKeys = [...objectKeys, 'body']
const validYearMonth = (value) => typeof value === 'string' && /^(?:\d{4})-(?:0[1-9]|1[0-2])$/.test(value)
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

function validateInputs(records, sourceIdentity, updatedAt) {
  if (!Array.isArray(records)) fail('records')
  if (typeof sourceIdentity !== 'string' || !identityPattern.test(sourceIdentity)) fail('source-identity')
  if (!canonicalTimestamp(updatedAt)) fail('updated-at')
  const seen = new Set(); const validated = []
  records.forEach((record, index) => {
    const coordinate = `record[${index}]`
    if (!plain(record) || !exact(record, recordKeys) || typeof record.slug !== 'string' || !STADIUMS[record.slug] || !validDate(record.date) || !Array.isArray(record.status) || record.status.length !== 3 || ![0, 1, 2].every((slot) => Object.prototype.hasOwnProperty.call(record.status, slot)) || !record.status.every(validStatus)) fail('record', coordinate)
    const key = `${record.slug}/${record.date}`
    if (seen.has(key)) fail('duplicate', coordinate)
    seen.add(key)
    validated.push({ slug: record.slug, date: record.date, status: [...record.status] })
  })
  return validated.sort((left, right) => left.slug.localeCompare(right.slug) || left.date.localeCompare(right.date))
}

export function transformFirestoreRecords(records, { sourceIdentity, updatedAt } = {}) {
  const validated = validateInputs(records, sourceIdentity, updatedAt)
  const grouped = new Map()
  for (const record of validated) { const key = `${record.slug}/${month(record.date)}`; const current = grouped.get(key) || []; current.push(record); grouped.set(key, current) }
  const objects = []
  for (const [groupKey, group] of [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const [slug, yearMonth] = groupKey.split('/'); const days = {}
    for (const record of group.sort((left, right) => left.date.localeCompare(right.date))) days[isoDate(record.date)] = [...record.status]
    const schedule = { schemaVersion: 1, stadium: slug, yearMonth, updatedAt, days }
    const encoded = serializeSchedule(schedule)
    parseScheduleMonth(schedule, { stadium: slug, yearMonth })
    const dates = group.map((record) => record.date)
    objects.push({ key: `data/v1/stadiums/${slug}/availability/${yearMonth}.json`, stadium: slug, yearMonth, sourceCount: group.length, dateRange: dateRange(dates), bytes: encoded.byteLength, sha256: sha256(encoded), contentType: CONTENT_TYPE, cacheControl: CACHE_CONTROL, body: encoded })
  }
  const allDates = validated.map((record) => record.date).sort()
  const manifest = { schemaVersion: 1, sourceIdentity, migrationUpdatedAt: updatedAt, sourceCount: validated.length, dateRange: dateRange(allDates), objects: objects.map(({ body, ...object }) => object) }
  return { objects, manifest, manifestBytes: bytes(`${JSON.stringify(manifest, null, 2)}\n`) }
}

export function serializeSchedule(schedule, { maxBytes = MAX_BYTES } = {}) {
  if (!Number.isInteger(maxBytes) || maxBytes < 0) throw new TransformValidationError('size', 'schedule')
  const encoded = bytes(`${JSON.stringify(schedule, null, 2)}\n`)
  if (encoded.byteLength > maxBytes) throw new TransformValidationError('size', 'schedule')
  return encoded
}

const beneath = (root, candidate) => { const rootPath = resolve(root); const candidatePath = resolve(candidate); const relativePath = relative(rootPath, candidatePath); return relativePath !== '' && relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath) }

function validateDateRange(value, coordinate) {
  if (!plain(value) || !exact(value, ['from', 'to']) || !ordered(value, ['from', 'to']) || (value.from !== null && !validDate(value.from)) || (value.to !== null && !validDate(value.to))) throw new MigrationWriteError('preflight')
  if ((value.from === null) !== (value.to === null) || (value.from !== null && value.from > value.to)) throw new MigrationWriteError('preflight')
}

function validateArtifactSet({ objects, manifest, manifestBytes }) {
  if (!Array.isArray(objects) || !plain(manifest) || !exact(manifest, manifestKeys) || !ordered(manifest, manifestKeys) || manifest.schemaVersion !== 1 || typeof manifest.sourceIdentity !== 'string' || !identityPattern.test(manifest.sourceIdentity) || !canonicalTimestamp(manifest.migrationUpdatedAt) || !Number.isInteger(manifest.sourceCount) || manifest.sourceCount < 0 || !Array.isArray(manifest.objects)) throw new MigrationWriteError('preflight')
  validateDateRange(manifest.dateRange, 'manifest')
  if (objects.length !== manifest.objects.length) throw new MigrationWriteError('preflight')
  const seen = new Set(); let sourceCount = 0; const ranges = []; let previousKey = ''
  objects.forEach((object, index) => {
    if (!plain(object) || !exact(object, artifactKeys) || !ordered(object, artifactKeys) || !plain(object.dateRange) || !object.body || !(object.body instanceof Uint8Array) || typeof object.key !== 'string' || typeof object.stadium !== 'string' || !STADIUMS[object.stadium] || !validYearMonth(object.yearMonth) || object.key !== `data/v1/stadiums/${object.stadium}/availability/${object.yearMonth}.json` || seen.has(object.key) || !Number.isInteger(object.sourceCount) || object.sourceCount < 1 || !Number.isInteger(object.bytes) || object.bytes < 0 || !/^[a-f0-9]{64}$/.test(object.sha256) || object.contentType !== CONTENT_TYPE || object.cacheControl !== CACHE_CONTROL) throw new MigrationWriteError('preflight')
    if (previousKey && object.key <= previousKey) throw new MigrationWriteError('preflight')
    previousKey = object.key; seen.add(object.key); validateDateRange(object.dateRange, `object[${index}]`)
    let schedule; try { schedule = JSON.parse(new TextDecoder().decode(object.body)) } catch { throw new MigrationWriteError('preflight') }
    if (!plain(schedule) || !ordered(schedule, ['schemaVersion', 'stadium', 'yearMonth', 'updatedAt', 'days']) || !plain(schedule.days)) throw new MigrationWriteError('preflight')
    const dayKeys = Object.keys(schedule.days)
    if (dayKeys.some((day, dayIndex) => !/^\d{4}-\d{2}-\d{2}$/.test(day) || (dayIndex > 0 && day <= dayKeys[dayIndex - 1]))) throw new MigrationWriteError('preflight')
    let canonical; try { parseScheduleMonth(schedule, { stadium: object.stadium, yearMonth: object.yearMonth }); canonical = serializeSchedule(schedule) } catch { throw new MigrationWriteError('preflight') }
    if (!same([...canonical], [...object.body]) || object.bytes !== object.body.byteLength || object.sha256 !== sha256(object.body)) throw new MigrationWriteError('preflight')
    const dates = dayKeys.map((day) => day.replaceAll('-', ''))
    const expectedRange = dateRange(dates)
    if (object.sourceCount !== dates.length || !same(object.dateRange, expectedRange)) throw new MigrationWriteError('preflight')
    const metadata = manifest.objects[index]
    if (!plain(metadata) || !exact(metadata, objectKeys) || !ordered(metadata, objectKeys) || !same(metadata, { ...object, body: undefined })) throw new MigrationWriteError('preflight')
    sourceCount += object.sourceCount; ranges.push(...dates)
  })
  const sortedRanges = ranges.sort(); const expectedManifestRange = dateRange(sortedRanges)
  if (manifest.sourceCount !== sourceCount || !same(manifest.dateRange, expectedManifestRange)) throw new MigrationWriteError('preflight')
  const canonicalManifest = { schemaVersion: 1, sourceIdentity: manifest.sourceIdentity, migrationUpdatedAt: manifest.migrationUpdatedAt, sourceCount: manifest.sourceCount, dateRange: manifest.dateRange, objects: objects.map(({ body, ...object }) => object) }
  const expectedManifestBytes = bytes(`${JSON.stringify(canonicalManifest, null, 2)}\n`)
  if (JSON.stringify(manifest) !== JSON.stringify(canonicalManifest)) throw new MigrationWriteError('preflight')
  if (manifestBytes !== undefined && (!(manifestBytes instanceof Uint8Array) || !same([...manifestBytes], [...expectedManifestBytes]))) throw new MigrationWriteError('preflight')
  return expectedManifestBytes
}

export function validateMigrationArtifacts(artifacts) {
  return validateArtifactSet(artifacts)
}

export async function writeMigrationRun({ targetDir, objects, manifest, manifestBytes, fsImpl = {} }) {
  if (typeof targetDir !== 'string' || !isAbsolute(targetDir)) throw new MigrationWriteError('target')
  const expectedManifestBytes = validateArtifactSet({ objects, manifest, manifestBytes })
  const io = { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile, ...fsImpl }; const target = resolve(targetDir); let temp
  try {
    try { await io.stat(target); throw new MigrationWriteError('existing-target') } catch (error) { if (error?.code !== 'ENOENT') throw error }
    const parent = dirname(target); await io.mkdir(parent, { recursive: true }); temp = await io.mkdtemp(join(parent, `.${target.split(sep).pop()}.tmp-`))
    for (const object of objects) {
      const destination = resolve(temp, object.key); if (!beneath(temp, destination)) throw new MigrationWriteError('path')
      await io.mkdir(dirname(destination), { recursive: true }); await io.writeFile(destination, object.body, { flag: 'wx' })
    }
    const manifestPath = resolve(temp, 'manifest.json'); if (!beneath(temp, manifestPath)) throw new MigrationWriteError('path')
    await io.writeFile(manifestPath, expectedManifestBytes, { flag: 'wx' }); await io.rename(temp, target); return target
  } catch (error) { if (temp) await io.rm(temp, { recursive: true, force: true }); if (error instanceof MigrationWriteError) throw error; throw new MigrationWriteError('artifact') }
}
