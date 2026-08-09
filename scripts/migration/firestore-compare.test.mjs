import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { normalizeFirestoreSnapshot } from '../../packages/core/src/firestoreSnapshot.ts'
import { comparisonExitCode, compareFirestoreArtifacts, humanComparisonReport, serializeComparisonReport } from './firestore-compare.mjs'
import { serializeSchedule, transformFirestoreRecords } from './firestore-transform.mjs'

const raw = JSON.parse(await readFile(new URL('./fixtures/firestore-snapshot.synthetic.json', import.meta.url), 'utf8'))
const records = normalizeFirestoreSnapshot(raw)
const options = { sourceIdentity: 'synthetic-fixture', updatedAt: '2026-08-09T00:00:00.000Z' }
const hash = (body) => createHash('sha256').update(body).digest('hex')
const manifestFor = (objects) => {
  objects = [...objects].sort((left, right) => left.key.localeCompare(right.key))
  const dates = objects.flatMap((object) => object.dateRange.from === null ? [] : [object.dateRange.from, object.dateRange.to]).sort()
  const manifest = { schemaVersion: 1, sourceIdentity: options.sourceIdentity, migrationUpdatedAt: options.updatedAt, sourceCount: objects.reduce((sum, object) => sum + object.sourceCount, 0), dateRange: dates.length ? { from: dates[0], to: dates.at(-1) } : { from: null, to: null }, objects: objects.map(({ body, ...object }) => object) }
  return { objects, manifest, manifestBytes: new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`) }
}
const transformed = transformFirestoreRecords(records, options)
const multi = transformFirestoreRecords([
  { slug: 'oda', date: '20240803', status: [2, 1, 0] },
  { slug: 'oda', date: '20240801', status: [0, 1, 2] },
  { slug: 'oda', date: '20240802', status: [1, 2, 0] },
], options)

describe('T14C deterministic Firestore comparator', () => {
  it('returns the exact zero-diff report and stable machine/human bytes', () => {
    const first = compareFirestoreArtifacts(records, transformed, options); const second = compareFirestoreArtifacts([...records].reverse(), transformed, options)
    expect(first.report).toEqual({ schemaVersion: 1, status: 'match', counts: { sourceRecordCount: 4, transformedDayCount: 4, comparedCellCount: 12, expectedObjectCount: 4, actualObjectCount: 4, mismatchCount: 0 }, mismatches: [] })
    expect(first.machineBytes).toEqual(second.machineBytes); expect(first.human).toBe(humanComparisonReport(first.report)); expect(comparisonExitCode(first.report)).toBe(0)
    expect(first.machineSha256).toBe('30b6c176e3c9ec7501a0d24780604685a99bfc83fba219aacd066962c82aacbf')
  })

  it('reports changed cells, missing dates, and missing objects with sanitized coordinates', () => {
    const schedule = JSON.parse(new TextDecoder().decode(multi.objects[0].body)); schedule.days['2024-08-02'][1] = 0
    const changedBody = serializeSchedule(schedule); const changed = { ...multi.objects[0], body: changedBody, bytes: changedBody.byteLength, sha256: hash(changedBody) }
    const missingDateSchedule = JSON.parse(new TextDecoder().decode(multi.objects[0].body)); delete missingDateSchedule.days['2024-08-02']
    const missingDateBody = serializeSchedule(missingDateSchedule); const missingDate = { ...multi.objects[0], body: missingDateBody, bytes: missingDateBody.byteLength, sha256: hash(missingDateBody), sourceCount: 2, dateRange: { from: '20240801', to: '20240803' } }
    const changedReport = compareFirestoreArtifacts([
      { slug: 'oda', date: '20240803', status: [2, 1, 0] }, { slug: 'oda', date: '20240801', status: [0, 1, 2] }, { slug: 'oda', date: '20240802', status: [1, 2, 0] },
    ], manifestFor([changed]), options).report
    expect(changedReport.mismatches).toContainEqual({ kind: 'cell', stadium: 'oda', yearMonth: '2024-08', date: '2024-08-02', slot: 1, field: 'status', expected: 2, actual: 0 })
    const missingReport = compareFirestoreArtifacts([
      { slug: 'oda', date: '20240803', status: [2, 1, 0] }, { slug: 'oda', date: '20240801', status: [0, 1, 2] }, { slug: 'oda', date: '20240802', status: [1, 2, 0] },
    ], manifestFor([missingDate]), options).report
    expect(missingReport.mismatches.some((item) => item.kind === 'date' && item.date === '2024-08-02' && item.actual === 'missing')).toBe(true)
    const missingObject = manifestFor(transformed.objects.slice(1)); const objectReport = compareFirestoreArtifacts(records, missingObject, options).report
    expect(objectReport.mismatches.some((item) => item.kind === 'object' && item.actual === 'missing')).toBe(true)
  })

  it('reports extra objects and deterministic mismatch ordering', () => {
    const extra = transformFirestoreRecords([{ slug: 'oda', date: '20250101', status: [0, 1, 2] }], options)
    const report = compareFirestoreArtifacts(records, manifestFor([...transformed.objects, extra.objects[0]]), options).report
    expect(report.mismatches.some((item) => item.kind === 'object' && item.actual === 'extra')).toBe(true)
    expect(report.mismatches).toEqual([...report.mismatches].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
  })

  it('uses explicit trusted options and rejects a self-consistent rewritten target', () => {
    const rewritten = transformFirestoreRecords(records, { sourceIdentity: 'rewritten-fixture', updatedAt: '2026-08-10T00:00:00.000Z' })
    const report = compareFirestoreArtifacts(records, rewritten, options)
    expect(report.report.status).toBe('mismatch'); expect(report.report.mismatches.some((item) => item.kind === 'integrity')).toBe(true); expect(comparisonExitCode(report.report)).toBe(1)
  })

  it('preserves valid-source coverage counts when target is missing or invalid', () => {
    for (const target of [undefined, { objects: [] }, { ...transformed, manifestBytes: new TextEncoder().encode('invalid') }]) {
      const report = compareFirestoreArtifacts(records, target, options).report
      expect(report.counts).toMatchObject({ sourceRecordCount: 4, transformedDayCount: 4, comparedCellCount: 12, expectedObjectCount: 4, actualObjectCount: Array.isArray(target?.objects) ? target.objects.length : 0 }); expect(report.status).toBe('mismatch'); expect(comparisonExitCode(report)).toBe(1)
    }
  })

  it('fails closed for invalid source, target integrity, and duplicate artifacts', () => {
    const sourceBefore = structuredClone(records); expect(compareFirestoreArtifacts([...records, records[0]], transformed, options).report.mismatches[0].kind).toBe('source'); expect(compareFirestoreArtifacts([{ ...records[0], status: [9, 1, 2] }], transformed, options).report.mismatches[0].kind).toBe('source'); expect(records).toEqual(sourceBefore)
    expect(compareFirestoreArtifacts(records, { ...transformed, manifestBytes: new TextEncoder().encode('secret/path/body') }, options).report.mismatches[0].kind).toBe('integrity')
    expect(compareFirestoreArtifacts(records, { ...transformed, objects: [transformed.objects[0], transformed.objects[0]], manifest: transformed.manifest }, options).report.mismatches[0].kind).toBe('integrity')
    const invalidBody = { ...transformed.objects[0], body: new TextEncoder().encode('{"secret":"raw"}'), bytes: 16, sha256: hash(new TextEncoder().encode('{"secret":"raw"}')) }
    expect(compareFirestoreArtifacts(records, manifestFor([invalidBody, ...transformed.objects.slice(1)]), options).report.mismatches[0].kind).toBe('integrity')
    expect(compareFirestoreArtifacts(records, { ...transformed, manifest: { ...transformed.manifest, extra: 'secret' } }, options).report.mismatches[0].kind).toBe('integrity')
    const text = JSON.stringify(compareFirestoreArtifacts(records, { ...transformed, manifestBytes: new TextEncoder().encode('secret/path/body') }, options).report)
    expect(text).not.toMatch(/secret|path|body/i)
  })

  it('matches empty source and rejects tampered machine reports', () => {
    const empty = transformFirestoreRecords([], options); const result = compareFirestoreArtifacts([], empty, options)
    expect(result.report.counts).toEqual({ sourceRecordCount: 0, transformedDayCount: 0, comparedCellCount: 0, expectedObjectCount: 0, actualObjectCount: 0, mismatchCount: 0 }); expect(comparisonExitCode(result.report)).toBe(0)
    expect(() => serializeComparisonReport({ ...result.report, status: 'match', counts: { ...result.report.counts, mismatchCount: 1 } })).toThrow()
    expect(() => humanComparisonReport({ ...result.report, mismatches: [{ raw: 'secret' }] })).toThrow()
    const changed = compareFirestoreArtifacts([
      { slug: 'oda', date: '20240803', status: [2, 1, 0] }, { slug: 'oda', date: '20240801', status: [2, 1, 2] }, { slug: 'oda', date: '20240802', status: [1, 0, 0] },
    ], multi, options).report
    const tamperedReports = [
      { ...changed, schemaVersion: 2 },
      { ...changed, counts: { ...changed.counts, transformedDayCount: changed.counts.transformedDayCount + 1 } },
      { ...changed, mismatches: changed.mismatches.map((item) => ({ ...item, date: item.kind === 'cell' ? '2024-02-30' : item.date })) },
      { ...changed, mismatches: changed.mismatches.map((item) => item.kind === 'cell' ? { ...item, stadium: null } : item) },
      { ...changed, mismatches: [...changed.mismatches].reverse() },
    ]
    expect(changed.mismatches.length).toBeGreaterThan(1)
    for (const [index, tampered] of tamperedReports.entries()) { expect(() => serializeComparisonReport(tampered), `tampered ${index}`).toThrow(); expect(() => humanComparisonReport(tampered), `tampered ${index}`).toThrow(); expect(() => comparisonExitCode(tampered), `tampered ${index}`).toThrow() }
  })
})
