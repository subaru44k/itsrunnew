import { createHash } from 'node:crypto'
import { parseScheduleMonth, STADIUMS } from '../../packages/core/src/index.ts'
import { transformFirestoreRecords, validateMigrationArtifacts } from './firestore-transform.mjs'

const reportKeys = ['schemaVersion', 'status', 'counts', 'mismatches']
const countKeys = ['sourceRecordCount', 'transformedDayCount', 'comparedCellCount', 'expectedObjectCount', 'actualObjectCount', 'mismatchCount']
const mismatchKeys = ['kind', 'stadium', 'yearMonth', 'date', 'slot', 'field', 'expected', 'actual']
const fields = new Set(['body', 'bytes', 'cacheControl', 'contentType', 'date', 'dateRange', 'manifest', 'object', 'objects', 'schema', 'sha256', 'sourceCount', 'status', 'target'])
const kinds = new Set(['cell', 'date', 'object', 'integrity', 'source'])
const categoryValues = new Set(['invalid', 'missing', 'extra', 'valid', 'hash', 'range', 'schema', 'body', 'match', 'mismatch'])
const safeStatus = (value) => value === null || (Number.isInteger(value) && value >= 0 && value <= 2)
const safeYearMonth = (value) => value === null || (typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value))
const safeDate = (value) => value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
const safeScalar = (value) => value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0) || (typeof value === 'string' && categoryValues.has(value))
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
const exact = (value, keys) => Object.keys(value).join('\u0000') === keys.join('\u0000')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const nullCoordinate = { stadium: null, yearMonth: null, date: null, slot: null }

function mismatch(kind, coordinate = {}, field = 'target', expected = null, actual = null) {
  return { kind, stadium: coordinate.stadium ?? null, yearMonth: coordinate.yearMonth ?? null, date: coordinate.date ?? null, slot: coordinate.slot ?? null, field, expected, actual }
}

function coordinateFromObject(object) {
  return object && typeof object.stadium === 'string' && STADIUMS[object.stadium] && typeof object.yearMonth === 'string'
    ? { stadium: object.stadium, yearMonth: object.yearMonth }
    : nullCoordinate
}

function canonicalMismatchSort(left, right) {
  return JSON.stringify(left).localeCompare(JSON.stringify(right))
}

function validateReport(report) {
  if (!plain(report) || !exact(report, reportKeys) || !['match', 'mismatch'].includes(report.status) || !plain(report.counts) || !exact(report.counts, countKeys) || !Array.isArray(report.mismatches)) throw new TypeError('invalid comparison report')
  for (const key of countKeys) if (!Number.isInteger(report.counts[key]) || report.counts[key] < 0) throw new TypeError('invalid comparison report')
  if (report.counts.mismatchCount !== report.mismatches.length || report.status === 'match' !== (report.mismatches.length === 0)) throw new TypeError('invalid comparison report')
  for (let index = 0; index < report.mismatches.length; index += 1) {
    const item = report.mismatches[index]
    if (!plain(item) || !exact(item, mismatchKeys) || !kinds.has(item.kind) || (item.stadium !== null && !STADIUMS[item.stadium]) || !safeYearMonth(item.yearMonth) || !safeDate(item.date) || (item.slot !== null && ![0, 1, 2].includes(item.slot)) || !fields.has(item.field) || !safeScalar(item.expected) || !safeScalar(item.actual)) throw new TypeError('invalid comparison report')
    if (index > 0 && canonicalMismatchSort(report.mismatches[index - 1], item) > 0) throw new TypeError('invalid comparison report')
  }
  return report
}

export function serializeComparisonReport(report) {
  validateReport(report)
  return new TextEncoder().encode(`${JSON.stringify(report, null, 2)}\n`)
}

export function comparisonExitCode(report) {
  validateReport(report)
  return report.status === 'match' ? 0 : 1
}

export function humanComparisonReport(report) {
  validateReport(report)
  const { counts } = report
  const lines = [
    `T14C comparison: ${report.status.toUpperCase()}`,
    `Source records: ${counts.sourceRecordCount}`,
    `Transformed days: ${counts.transformedDayCount}`,
    `Compared cells: ${counts.comparedCellCount}`,
    `Expected objects: ${counts.expectedObjectCount}`,
    `Actual objects: ${counts.actualObjectCount}`,
    `Mismatches: ${counts.mismatchCount}`,
  ]
  for (const item of report.mismatches) lines.push(`- ${item.kind} ${item.stadium ?? 'none'} ${item.yearMonth ?? 'none'} ${item.date ?? 'none'} ${item.slot ?? 'none'} ${item.field}`)
  return `${lines.join('\n')}\n`
}

export function compareFirestoreArtifacts(sourceRecords, target) {
  const actualObjectCount = Array.isArray(target?.objects) ? target.objects.length : 0
  let expected
  let sourceRecordCount = 0
  let transformedDayCount = 0
  let expectedObjectCount = 0
  const mismatches = []
  if (!Array.isArray(sourceRecords)) mismatches.push(mismatch('source', nullCoordinate, 'sourceCount', 'valid', 'invalid'))
  else if (!target?.manifest || typeof target.manifest !== 'object' || typeof target.manifest.sourceIdentity !== 'string' || typeof target.manifest.migrationUpdatedAt !== 'string') mismatches.push(mismatch('integrity', nullCoordinate, 'manifest', 'valid', 'invalid'))
  else {
    try {
      validateMigrationArtifacts(target)
      expected = transformFirestoreRecords(sourceRecords, { sourceIdentity: target.manifest.sourceIdentity, updatedAt: target.manifest.migrationUpdatedAt })
      sourceRecordCount = sourceRecords.length; expectedObjectCount = expected.objects.length; transformedDayCount = expected.objects.reduce((sum, object) => sum + object.sourceCount, 0)
    } catch {
      mismatches.push(mismatch('integrity', nullCoordinate, 'target', 'valid', 'invalid'))
    }
  }
  if (!expected && mismatches.length === 0) mismatches.push(mismatch('source', nullCoordinate, 'sourceCount', 'valid', 'invalid'))
  if (expected) {
    const actualByKey = new Map(target.objects.map((object) => [object.key, object]))
    const expectedByKey = new Map(expected.objects.map((object) => [object.key, object]))
    for (const object of expected.objects) if (!actualByKey.has(object.key)) mismatches.push(mismatch('object', coordinateFromObject(object), 'object', 'valid', 'missing'))
    for (const object of target.objects) if (!expectedByKey.has(object.key)) mismatches.push(mismatch('object', coordinateFromObject(object), 'object', 'missing', 'extra'))
    for (const expectedObject of expected.objects) {
      const actualObject = actualByKey.get(expectedObject.key); if (!actualObject) continue
      const coordinate = coordinateFromObject(expectedObject)
      for (const field of ['sourceCount', 'dateRange', 'bytes', 'sha256', 'contentType', 'cacheControl']) if (JSON.stringify(expectedObject[field]) !== JSON.stringify(actualObject[field])) mismatches.push(mismatch('object', coordinate, field, 'match', 'mismatch'))
      const expectedSchedule = JSON.parse(new TextDecoder().decode(expectedObject.body)); const actualSchedule = JSON.parse(new TextDecoder().decode(actualObject.body)); const expectedDays = expectedSchedule.days; const actualDays = actualSchedule.days
      for (const date of Object.keys(expectedDays)) {
        const dateCoordinate = { ...coordinate, date }
        if (!Object.prototype.hasOwnProperty.call(actualDays, date)) { mismatches.push(mismatch('date', dateCoordinate, 'date', 'valid', 'missing')); continue }
        for (const slot of [0, 1, 2]) if (expectedDays[date][slot] !== actualDays[date][slot]) mismatches.push(mismatch('cell', { ...dateCoordinate, slot }, 'status', expectedDays[date][slot], actualDays[date][slot]))
      }
      for (const date of Object.keys(actualDays)) if (!Object.prototype.hasOwnProperty.call(expectedDays, date)) mismatches.push(mismatch('date', { ...coordinate, date }, 'date', 'missing', 'extra'))
    }
    for (const field of ['sourceCount', 'dateRange']) if (JSON.stringify(expected.manifest[field]) !== JSON.stringify(target.manifest[field])) mismatches.push(mismatch('integrity', nullCoordinate, field, 'match', 'mismatch'))
  }
  const counts = { sourceRecordCount, transformedDayCount, comparedCellCount: sourceRecordCount * 3, expectedObjectCount, actualObjectCount, mismatchCount: 0 }
  mismatches.sort(canonicalMismatchSort)
  counts.mismatchCount = mismatches.length
  const report = { schemaVersion: 1, status: mismatches.length ? 'mismatch' : 'match', counts, mismatches }
  const machineBytes = serializeComparisonReport(report)
  return { report, machineBytes, machineSha256: sha256(machineBytes), human: humanComparisonReport(report) }
}
