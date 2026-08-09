import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeFirestoreSnapshot } from '../../packages/core/src/firestoreSnapshot.ts'
import { MigrationWriteError, transformFirestoreRecords, writeMigrationRun } from './firestore-transform.mjs'

const raw = JSON.parse(await readFile(new URL('./fixtures/firestore-snapshot.synthetic.json', import.meta.url), 'utf8'))
const records = normalizeFirestoreSnapshot(raw)
const options = { sourceIdentity: 'synthetic-fixture', updatedAt: '2026-08-09T00:00:00.000Z' }
const clone = (value) => structuredClone(value)

describe('deterministic Firestore monthly transform', () => {
  it('creates exact synthetic keys, counts, ranges, metadata, and parser-valid JSON', () => {
    const result = transformFirestoreRecords(records, options)
    expect(result.objects.map(({ key }) => key)).toEqual([
      'data/v1/stadiums/komazawa/availability/2024-01.json',
      'data/v1/stadiums/oda/availability/2024-02.json',
      'data/v1/stadiums/todoroki/availability/2024-03.json',
      'data/v1/stadiums/yumenoshima/availability/2023-12.json',
    ])
    expect(result.objects.map(({ sourceCount, dateRange, contentType, cacheControl }) => ({ sourceCount, dateRange, contentType, cacheControl }))).toEqual([
      { sourceCount: 1, dateRange: { from: '20240101', to: '20240101' }, contentType: 'application/json', cacheControl: 'public, max-age=0, s-maxage=60' },
      { sourceCount: 1, dateRange: { from: '20240229', to: '20240229' }, contentType: 'application/json', cacheControl: 'public, max-age=0, s-maxage=60' },
      { sourceCount: 1, dateRange: { from: '20240301', to: '20240301' }, contentType: 'application/json', cacheControl: 'public, max-age=0, s-maxage=60' },
      { sourceCount: 1, dateRange: { from: '20231231', to: '20231231' }, contentType: 'application/json', cacheControl: 'public, max-age=0, s-maxage=60' },
    ])
    expect(result.objects.map(({ bytes, sha256 }) => ({ bytes, sha256 }))).toEqual([
      { bytes: 188, sha256: 'd4f799f61635fc234753e554981b97ddb0493569781b6c40418ccf46851218c0' },
      { bytes: 183, sha256: 'd1e97a0a4b58c71a1ada419dfe3fb46e8ef3f9daf826a86aea3214dd65a11a44' },
      { bytes: 188, sha256: 'ad4d519f9afb761291b0ed314de2f3db080f17217b86df5e9bd0305ebd7be012' },
      { bytes: 191, sha256: '133ef50a73e34f3e9bff3b46f3ab8c8e226637e2eb7455e6df266ce6f051626c' },
    ])
    expect(result.manifest).toEqual({ schemaVersion: 1, sourceIdentity: 'synthetic-fixture', migrationUpdatedAt: options.updatedAt, sourceCount: 4, dateRange: { from: '20231231', to: '20240301' }, objects: result.manifest.objects })
    expect(Object.keys(result.manifest)).toEqual(['schemaVersion', 'sourceIdentity', 'migrationUpdatedAt', 'sourceCount', 'dateRange', 'objects'])
    expect(Object.keys(result.manifest.objects[0])).toEqual(['key', 'stadium', 'yearMonth', 'sourceCount', 'dateRange', 'bytes', 'sha256', 'contentType', 'cacheControl'])
    for (const object of result.objects) { const schedule = JSON.parse(new TextDecoder().decode(object.body)); expect(schedule.schemaVersion).toBe(1); expect(Object.keys(schedule)).toEqual(['schemaVersion', 'stadium', 'yearMonth', 'updatedAt', 'days']); expect(object.body.at(-1)).toBe(10) }
  })

  it('is byte-identical across repeated runs and input permutations', () => {
    const first = transformFirestoreRecords(records, options); const permuted = transformFirestoreRecords([...records].reverse(), options); const encode = (result) => result.objects.map(({ key, body, sha256 }) => [key, [...body], sha256])
    expect(encode(first)).toEqual(encode(permuted)); expect(first.manifestBytes).toEqual(permuted.manifestBytes)
  })

  it('requires canonical explicit updatedAt and changes bytes predictably', () => {
    expect(() => transformFirestoreRecords(records, { sourceIdentity: 'synthetic-fixture' })).toThrow(/updated-at/)
    expect(() => transformFirestoreRecords(records, { sourceIdentity: 'synthetic-fixture', updatedAt: 'now' })).toThrow(/updated-at/)
    expect(() => transformFirestoreRecords(records, { sourceIdentity: 'secret token', updatedAt: options.updatedAt })).toThrow(/source-identity/)
    const changed = transformFirestoreRecords(records, { ...options, updatedAt: '2026-08-10T00:00:00.000Z' }); expect(changed.objects[0].sha256).not.toBe(transformFirestoreRecords(records, options).objects[0].sha256)
  })

  it('handles empty input with null aggregate date range', () => {
    const result = transformFirestoreRecords([], options); expect(result.objects).toEqual([]); expect(result.manifest.sourceCount).toBe(0); expect(result.manifest.dateRange).toEqual({ from: null, to: null }); expect(result.manifest.objects).toEqual([])
  })

  it('validates direct records, duplicates, and size before returning artifacts', () => {
    const invalidInputs = [null, {}, [{ slug: 'unknown', date: '20240101', status: [0, 1, 2] }], [{ slug: 'oda', date: '20240230', status: [0, 1, 2] }], [{ slug: 'oda', date: '20240101', status: [0, 1] }], [{ slug: 'oda', date: '20240101', status: [0, 1, 2], extra: 'secret' }], [...records, records[0]]]
    for (const invalid of invalidInputs) { expect(() => transformFirestoreRecords(invalid, options)).toThrow(/Invalid migration input/) }
    const huge = [{ slug: 'oda', date: '20240101', status: [0, 1, 2] }]; expect(transformFirestoreRecords(huge, options).objects).toHaveLength(1)
  })

  it('does not include source raw values, local paths, credentials, or actors', () => {
    const result = transformFirestoreRecords(records, options); const text = JSON.stringify(result.manifest); expect(text).not.toMatch(/nVfuSmsj9cULg3712chv|credential|actor|token|\.artifacts|Users|password/i); expect(result.objects.every(({ body }) => !new TextDecoder().decode(body).includes('nVfuSmsj9cULg3712chv'))).toBe(true)
  })
})

describe('atomic migration artifact writer', () => {
  it('writes nested objects and manifest through one atomic rename', async () => {
    const parent = await mkdtemp(join(tmpdir(), 't14b-')); const target = join(parent, 'run-1'); const result = transformFirestoreRecords(records, options); await writeMigrationRun({ targetDir: target, ...result }); expect((await stat(join(target, 'manifest.json'))).isFile()).toBe(true); expect((await stat(join(target, result.objects[0].key))).isFile()).toBe(true); await rm(parent, { recursive: true, force: true })
  })

  it('refuses existing empty and non-empty targets', async () => {
    const parent = await mkdtemp(join(tmpdir(), 't14b-')); const result = transformFirestoreRecords(records, options); const empty = join(parent, 'empty'); const nonempty = join(parent, 'nonempty'); await (await import('node:fs/promises')).mkdir(empty); await (await import('node:fs/promises')).mkdir(nonempty); await (await import('node:fs/promises')).writeFile(join(nonempty, 'keep'), 'x'); await expect(writeMigrationRun({ targetDir: empty, ...result })).rejects.toThrow('existing-target'); await expect(writeMigrationRun({ targetDir: nonempty, ...result })).rejects.toThrow('existing-target'); await rm(parent, { recursive: true, force: true })
  })

  it('cleans the exact temporary directory after an injected write failure', async () => {
    const parent = await mkdtemp(join(tmpdir(), 't14b-')); const target = join(parent, 'run-fail'); const result = transformFirestoreRecords(records, options); const failing = async () => { throw new Error('simulated') }; await expect(writeMigrationRun({ targetDir: target, ...result, fsImpl: { writeFile: failing } })).rejects.toBeInstanceOf(MigrationWriteError); expect(await readdir(parent)).toEqual([]); await rm(parent, { recursive: true, force: true })
  })

  it('rejects relative targets and traversal keys without creating output', async () => {
    const result = transformFirestoreRecords(records, options); await expect(writeMigrationRun({ targetDir: 'relative-run', ...result })).rejects.toBeInstanceOf(MigrationWriteError); const parent = await mkdtemp(join(tmpdir(), 't14b-')); await expect(writeMigrationRun({ targetDir: join(parent, 'traversal'), objects: [{ ...result.objects[0], key: '../escape.json' }], manifest: result.manifest })).rejects.toBeInstanceOf(MigrationWriteError); expect(await readdir(parent)).toEqual([]); await rm(parent, { recursive: true, force: true })
  })
})
