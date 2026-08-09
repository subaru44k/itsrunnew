import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildReadPlan, readFirestoreSnapshot, serializeExport, validateExportConfig, validateOutputDir, writeExportRun, ExportValidationError } from './export-firestore.mjs'

const fixture = JSON.parse(await readFile(new URL('./fixtures/firestore-snapshot.synthetic.json', import.meta.url), 'utf8'))
const config = { projectId: 'itsrun-aaf42', databaseId: '(default)', capturedAt: '2026-08-09T00:00:00.000Z' }
function fakeAdapter(order = []) {
  return {
    async getDocument(path) { order.push(`doc:${path}`); return path === 'default/0' ? { exists: true, data: { enabled: true } } : null },
    async getCollection(path) { order.push(`collection:${path}`); if (path === 'stadium_info') return { docs: [{ id: 'z', data: { name: 'Z' } }, { id: 'a', data: { name: 'A' } }] }; const collection = fixture.collections.find((item) => path === `availability/${item.legacyId}/date`); return { docs: collection.documents.map((document) => ({ id: document.path.split('/').at(-1), data: document.data })) } }
  }
}

describe('T14E1 local Firestore exporter', () => {
  it('uses the exact read allowlist and deterministic order', async () => {
    const order = []; const result = await readFirestoreSnapshot(fakeAdapter(order), config); expect(order).toEqual(['doc:default/0', 'collection:stadium_info', ...Object.values({ oda: 'nVfuSmsj9cULg3712chv', yumenoshima: 'VFurPbbeejEbtu1JNTzF', komazawa: 'WrrQXe67xvIkGfMtJ51E', todoroki: '67c7uxgRWDkxr1S4gPaR' }).map((id) => `collection:availability/${id}/date`)]); expect(result.normalizedDataSha256).toMatch(/^[a-f0-9]{64}$/); expect(result.capture).toEqual(config); expect(result.snapshot.stadiumInfo).toEqual({ a: { name: 'A' }, z: { name: 'Z' } })
  })

  it('is deterministic and capture metadata does not alter normalized hash', async () => {
    const first = await readFirestoreSnapshot(fakeAdapter(), config); const second = await readFirestoreSnapshot(fakeAdapter(), { ...config, capturedAt: '2026-08-09T00:01:00.000Z' }); expect(first.normalizedDataSha256).toBe(second.normalizedDataSha256); expect([...serializeExport(first)]).not.toEqual([...serializeExport(second)])
  })

  it('supports empty collections and rejects malformed, bounded, or mutating adapters', async () => {
    const empty = await readFirestoreSnapshot({ async getDocument() { return { exists: false, data: null } }, async getCollection(path) { if (path === 'stadium_info') return { docs: [] }; return { docs: [] } } }, config); expect(empty.snapshot.availability.oda.dates).toEqual({})
    await expect(readFirestoreSnapshot({ getDocument: async () => ({ exists: false }), getCollection: async () => ({ docs: Array.from({ length: 10001 }, (_, index) => ({ id: `${index}`, data: {} })) }) }, config)).rejects.toBeInstanceOf(ExportValidationError)
    await expect(readFirestoreSnapshot({ getDocument: async () => ({ exists: false }), getCollection: async () => { throw new Error('raw credential path') } }, config)).rejects.toMatchObject({ category: 'adapter' })
    await expect(readFirestoreSnapshot({ getDocument: async () => ({ exists: false }), getCollection: async () => ({ docs: [] }), set: async () => {} }, config)).rejects.toMatchObject({ category: 'adapter' })
  })

  it('rejects alternate config, credentials, emulator, output traversal, and reused output', async () => {
    for (const invalid of [{ projectId: 'other' }, { ...config, databaseId: 'db2' }, { ...config, env: { GOOGLE_APPLICATION_CREDENTIALS: '/secret/key.json' } }, { ...config, env: { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' } }]) expect(() => validateExportConfig(invalid)).toThrow(ExportValidationError)
    expect(() => validateOutputDir(join(tmpdir(), 'other'))).toThrow(ExportValidationError); expect(() => validateOutputDir(join(process.cwd(), '.artifacts/migration/a/b'))).toThrow(ExportValidationError)
  })

  it('writes only a new atomic ignored run and cleans failed output', async () => {
    const result = await readFirestoreSnapshot(fakeAdapter(), config); const run = join(process.cwd(), '.artifacts/migration', `test-${Date.now()}`); await writeExportRun(result, run); expect(await readFile(join(run, 'export.json'))).toEqual(Buffer.from(serializeExport(result))); await expect(writeExportRun(result, run)).rejects.toBeInstanceOf(ExportValidationError); await rm(run, { recursive: true, force: true })
  })

  it('CLI help and invalid invocation do not initialize the SDK', async () => {
    const help = await import('./export-firestore.mjs'); expect(await help.runCli(['--help'], {})).toBe(0); expect(await help.runCli([], {})).toBe(2); expect(buildReadPlan()).toHaveLength(6); expect(help.runCli).toBeTypeOf('function')
  })
})
