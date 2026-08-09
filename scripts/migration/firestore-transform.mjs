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
const validStatus = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2
const validDate = (value) => { if (typeof value !== 'string' || !/^\d{8}$/.test(value)) return false; const year = Number(value.slice(0, 4)); const month = Number(value.slice(4, 6)); const day = Number(value.slice(6)); const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day }
const month = (date) => `${date.slice(0, 4)}-${date.slice(4, 6)}`
const isoDate = (date) => `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`
const dateRange = (dates) => dates.length ? { from: dates[0], to: dates[dates.length - 1] } : { from: null, to: null }
const bytes = (text) => new TextEncoder().encode(text)
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function validateInputs(records, sourceIdentity, updatedAt) {
  if (!Array.isArray(records)) fail('records')
  if (typeof sourceIdentity !== 'string' || !identityPattern.test(sourceIdentity)) fail('source-identity')
  if (typeof updatedAt !== 'string' || !updatedAtPattern.test(updatedAt) || Number.isNaN(Date.parse(updatedAt))) fail('updated-at')
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
    const serialized = `${JSON.stringify(schedule, null, 2)}\n`; const encoded = bytes(serialized)
    if (encoded.byteLength > MAX_BYTES) fail('size', groupKey)
    parseScheduleMonth(schedule, { stadium: slug, yearMonth })
    const dates = group.map((record) => record.date)
    objects.push({ key: `data/v1/stadiums/${slug}/availability/${yearMonth}.json`, stadium: slug, yearMonth, sourceCount: group.length, dateRange: dateRange(dates), bytes: encoded.byteLength, sha256: sha256(encoded), contentType: CONTENT_TYPE, cacheControl: CACHE_CONTROL, body: encoded })
  }
  const allDates = validated.map((record) => record.date).sort()
  const manifest = { schemaVersion: 1, sourceIdentity, migrationUpdatedAt: updatedAt, sourceCount: validated.length, dateRange: dateRange(allDates), objects: objects.map(({ body, ...object }) => object) }
  return { objects, manifest, manifestBytes: bytes(`${JSON.stringify(manifest, null, 2)}\n`) }
}

const beneath = (root, candidate) => { const rootPath = resolve(root); const candidatePath = resolve(candidate); const relativePath = relative(rootPath, candidatePath); return relativePath !== '' && relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath) }

export async function writeMigrationRun({ targetDir, objects, manifest, fsImpl = {} }) {
  if (typeof targetDir !== 'string' || !isAbsolute(targetDir)) throw new MigrationWriteError('target')
  const io = { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile, ...fsImpl }; const target = resolve(targetDir)
  try { await io.stat(target); throw new MigrationWriteError('existing-target') } catch (error) { if (error?.code !== 'ENOENT') throw error }
  const parent = dirname(target); await io.mkdir(parent, { recursive: true }); const temp = await io.mkdtemp(join(parent, `.${target.split(sep).pop()}.tmp-`))
  try {
    for (const object of objects) {
      const destination = resolve(temp, object.key); if (!beneath(temp, destination)) throw new MigrationWriteError('path')
      await io.mkdir(dirname(destination), { recursive: true }); await io.writeFile(destination, object.body, { flag: 'wx' })
    }
    const manifestPath = resolve(temp, 'manifest.json'); if (!beneath(temp, manifestPath)) throw new MigrationWriteError('path')
    await io.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' }); await io.rename(temp, target); return target
  } catch (error) { await io.rm(temp, { recursive: true, force: true }); if (error instanceof MigrationWriteError) throw error; throw new MigrationWriteError('artifact') }
}
