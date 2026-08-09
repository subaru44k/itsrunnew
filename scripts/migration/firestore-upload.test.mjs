import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeFirestoreSnapshot } from '../../packages/core/src/firestoreSnapshot.ts'
import { transformFirestoreRecords } from './firestore-transform.mjs'
import { getObjectVersionArgs, humanUploadReport, putObjectArgs, readBoundedFile, restoreObjectArgs, serializeUploadReport, stsArgs, uploadMigrationRun } from './firestore-upload.mjs'

const raw = JSON.parse(await readFile(new URL('./fixtures/firestore-snapshot.synthetic.json', import.meta.url), 'utf8'))
const records = normalizeFirestoreSnapshot(raw)
const options = { sourceIdentity: 'synthetic-fixture', updatedAt: '2026-08-09T00:00:00.000Z' }
const result = transformFirestoreRecords(records, options)
const bucket = 'itsrun-preview-data-470447451992-ap-northeast-1'
const approvedTarget = { bucket, distributionDomain: 'preview.example.test' }
const baseConfig = { profile: 'codex-prod', account: '470447451992', region: 'ap-northeast-1', bucket, distributionDomain: 'preview.example.test', maxAttempts: 2, timeoutMs: 100 }
const body = (object) => new TextDecoder().decode(object.body)

async function createRun() {
  const runDir = await mkdtemp(join(tmpdir(), 't14d-')); await mkdir(join(runDir, 'data/v1/stadiums'), { recursive: true })
  for (const object of result.objects) { const path = join(runDir, object.key); await mkdir(join(path, '..'), { recursive: true }); await writeFile(path, object.body) }
  const manifestPath = join(runDir, 'manifest.json'); await writeFile(manifestPath, result.manifestBytes); return { runDir, manifestPath, config: { ...baseConfig, runDir, manifestPath, readbackRoot: runDir, restoreRoot: runDir } }
}

function successFetch() { return async (url) => { const object = result.objects.find((candidate) => url.endsWith(candidate.key)); return new Response(body(object), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=60', age: '0' } }) } }

describe('T14D injected local upload tooling', () => {
  it('builds exact AWS arguments and never includes forbidden operations', () => {
    const config = { ...baseConfig, runDir: '/safe/run', readbackRoot: '/safe/run/read', restoreRoot: '/safe/restore' }; const object = { ...result.objects[0], bodyPath: '/safe/run/data.json', versionId: 'v1', etag: '"abc123"' }
    expect(stsArgs(config)).toEqual(['--profile', 'codex-prod', '--region', 'ap-northeast-1', '--output', 'json', 'sts', 'get-caller-identity'])
    expect(putObjectArgs(config, object)).toEqual(['--profile', 'codex-prod', '--region', 'ap-northeast-1', '--output', 'json', 's3api', 'put-object', '--bucket', bucket, '--key', object.key, '--body', object.bodyPath, '--content-type', 'application/json', '--cache-control', 'public, max-age=0, s-maxage=60', '--if-none-match', '*'])
    expect(getObjectVersionArgs(config, object, '/safe/run/read/read.json')).toEqual(['--profile', 'codex-prod', '--region', 'ap-northeast-1', '--output', 'json', 's3api', 'get-object', '--bucket', bucket, '--key', object.key, '--version-id', 'v1', '/safe/run/read/read.json'])
    expect(restoreObjectArgs(config, object, '/safe/restore/old.json')).toEqual(['--profile', 'codex-prod', '--region', 'ap-northeast-1', '--output', 'json', 's3api', 'put-object', '--bucket', bucket, '--key', object.key, '--body', '/safe/restore/old.json', '--content-type', 'application/json', '--cache-control', 'public, max-age=0, s-maxage=60', '--if-match', '"abc123"'])
    const text = JSON.stringify([stsArgs(config), putObjectArgs(config, object), getObjectVersionArgs(config, object, '/safe/run/read/read.json'), restoreObjectArgs(config, object, '/safe/restore/old.json')]); expect(text).not.toMatch(/delete|sync|cp|invalidation|s3:\*/i)
    expect(() => stsArgs({ ...config, distributionDomain: 'https://preview.example.test/path' })).toThrow()
    expect(() => putObjectArgs(config, { ...object, bodyPath: '/safe/run/../secret.json' })).toThrow()
    expect(() => getObjectVersionArgs(config, object, '/safe/run/read/../../secret.json')).toThrow()
    expect(() => restoreObjectArgs(config, object, '/safe/restore/-secret.json')).toThrow()
  })

  it('requires a separate approved target and validates target DNS syntax before any injected call', async () => {
    const { runDir, config } = await createRun(); const calls = []; const runAws = async () => { calls.push('aws'); return { Account: '470447451992' } }
    const missing = await uploadMigrationRun(config, { runAws, fetch: successFetch() }); expect(missing.report.failure.stage).toBe('preflight'); expect(calls).toEqual([])
    const selfApproval = await uploadMigrationRun({ ...config, approvedTarget: { bucket: config.bucket, distributionDomain: config.distributionDomain } }, { runAws, fetch: successFetch() }); expect(selfApproval.report.failure.stage).toBe('preflight'); expect(calls).toEqual([])
    for (const domain of ['preview.example.test:443', 'https://preview.example.test', 'a..b.test', '*.example.test', '127.0.0.1']) { const invalid = await uploadMigrationRun({ ...config, distributionDomain: domain }, { runAws, fetch: successFetch(), approvedTarget: { bucket: config.bucket, distributionDomain: domain } }); expect(invalid.report.failure.stage).toBe('preflight'); expect(calls).toEqual([]) }
    const mismatch = await uploadMigrationRun(config, { runAws, fetch: successFetch(), approvedTarget: { bucket: 'other-bucket', distributionDomain: config.distributionDomain } }); expect(mismatch.report.failure.stage).toBe('preflight'); expect(calls).toEqual([]); await rm(runDir, { recursive: true, force: true })
  })

  it('reads only maxBytes plus one and always closes the injected handle', async () => {
    const reads = []; let closed = 0
    const fs = { open: async () => ({ read: async (buffer, offset, length) => { reads.push(length); buffer.fill(65, offset, offset + length); return { bytesRead: length } }, close: async () => { closed += 1 } }) }
    await expect(readBoundedFile(fs, '/manifest.json', 10)).rejects.toThrow(); expect(reads).toEqual([11]); expect(closed).toBe(1)
    let done = false; closed = 0
    const exactFs = { open: async () => ({ read: async (buffer, offset, length) => { if (done) return { bytesRead: 0 }; done = true; buffer.fill(65, offset, offset + length); return { bytesRead: length - 1 } }, close: async () => { closed += 1 } }) }
    await expect(readBoundedFile(exactFs, '/manifest.json', 10)).resolves.toHaveLength(10); expect(closed).toBe(1)
    const closeFailFs = { open: async () => ({ read: async () => ({ bytesRead: 0 }), close: async () => { throw new Error('raw close path') } }) }; await expect(readBoundedFile(closeFailFs, '/manifest.json', 10)).rejects.toThrow('raw close path')
    let closeCount = 0; const readCloseFailFs = { open: async () => ({ read: async () => { throw new Error('raw read path') }, close: async () => { closeCount += 1; throw new Error('raw close path') } }) }; await expect(readBoundedFile(readCloseFailFs, '/manifest.json', 10)).rejects.toThrow('raw close path'); expect(closeCount).toBe(1)
  })

  it('rejects recursive depth and global file-count overflow before AWS', async () => {
    const { runDir: depthDir, config: depthConfig } = await createRun(); let nested = depthDir; for (let index = 0; index < 18; index += 1) { nested = join(nested, `d${index}`); await mkdir(nested) }; await writeFile(join(nested, 'extra.txt'), 'x'); const calls = []; const depth = await uploadMigrationRun(depthConfig, { runAws: async () => { calls.push('aws') }, fetch: successFetch(), approvedTarget }); expect(depth.report.failure.stage).toBe('preflight'); expect(calls).toEqual([]); await rm(depthDir, { recursive: true, force: true })
    const { runDir: countDir, config: countConfig } = await createRun(); await writeFile(join(countDir, 'extra-a.txt'), 'x'); const count = await uploadMigrationRun(countConfig, { runAws: async () => { calls.push('aws') }, fetch: successFetch(), approvedTarget }); expect(count.report.failure.stage).toBe('preflight'); expect(calls).toEqual([]); await rm(countDir, { recursive: true, force: true })
  })

  it('accepts only the explicit upload report state-machine matrix', () => {
    const tagged = result.objects.slice(0, 2).map((object) => ({ key: object.key, sha256: object.sha256, etag: '"abc123"', versionId: 'v1' })); const nullTagged = tagged.map((object) => ({ ...object, etag: null, versionId: null })); const valid = [
      { schemaVersion: 1, status: 'mismatch', counts: { attempted: 0, uploaded: 0, readback: 0, cloudfront: 0 }, objects: [], failure: { stage: 'preflight', category: 'config', key: null } },
      { schemaVersion: 1, status: 'mismatch', counts: { attempted: 0, uploaded: 0, readback: 0, cloudfront: 0 }, objects: [], failure: { stage: 'sts', category: 'sts', key: null } },
      { schemaVersion: 1, status: 'mismatch', counts: { attempted: 2, uploaded: 1, readback: 0, cloudfront: 0 }, objects: [tagged[0], nullTagged[1]], failure: { stage: 'upload', category: 'collision', key: tagged[1].key } },
      { schemaVersion: 1, status: 'mismatch', counts: { attempted: 2, uploaded: 2, readback: 1, cloudfront: 0 }, objects: tagged, failure: { stage: 'readback', category: 'readback', key: tagged[1].key } },
      { schemaVersion: 1, status: 'mismatch', counts: { attempted: 2, uploaded: 2, readback: 2, cloudfront: 0 }, objects: tagged, failure: { stage: 'cleanup', category: 'readback', key: null } },
      { schemaVersion: 1, status: 'mismatch', counts: { attempted: 2, uploaded: 2, readback: 2, cloudfront: 1 }, objects: tagged, failure: { stage: 'cloudfront', category: 'timeout', key: tagged[1].key } },
      { schemaVersion: 1, status: 'match', counts: { attempted: 2, uploaded: 2, readback: 2, cloudfront: 2 }, objects: tagged, failure: null }
    ]; for (const report of valid) expect(() => serializeUploadReport(report)).not.toThrow()
    const invalid = [
      { ...valid[0], failure: { stage: 'preflight', category: 'collision', key: null } },
      { ...valid[1], counts: { attempted: 1, uploaded: 0, readback: 0, cloudfront: 0 } },
      { ...valid[2], objects: [tagged[0], tagged[1]] },
      { ...valid[2], counts: { attempted: 2, uploaded: 0, readback: 0, cloudfront: 0 } },
      { ...valid[3], failure: { stage: 'readback', category: 'readback', key: tagged[0].key } },
      { ...valid[4], counts: { attempted: 2, uploaded: 2, readback: 1, cloudfront: 0 } },
      { ...valid[5], failure: { stage: 'cloudfront', category: 'config', key: tagged[1].key } },
      { ...valid[5], objects: [{ ...tagged[0], etag: null }, tagged[1]] },
      { ...valid[6], failure: { stage: 'cloudfront', category: 'cloudfront', key: tagged[1].key } }
    ]; for (const report of invalid) expect(() => serializeUploadReport(report)).toThrow()
  })

  it('preflights local artifacts, uploads/readbacks deterministically, then verifies CloudFront', async () => {
    const { runDir, manifestPath, config } = await createRun(); const calls = []; const runAws = async (args) => { calls.push(args); if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) return { ETag: '"abc123"', VersionId: `v${calls.length}` }; const output = args.at(-1); const key = args[args.indexOf('--key') + 1]; await writeFile(output, result.objects.find((object) => object.key === key).body); return {} }
    const uploaded = await uploadMigrationRun(config, { runAws, fetch: successFetch(), approvedTarget }); expect(uploaded.report).toMatchObject({ status: 'match', counts: { attempted: 4, uploaded: 4, readback: 4, cloudfront: 4 } }); expect(calls.filter((args) => args.includes('put-object'))).toHaveLength(4); expect(calls.filter((args) => args.includes('get-object'))).toHaveLength(4); expect(uploaded.human).toContain('Failure: none'); expect([...await readFile(manifestPath)]).toEqual([...result.manifestBytes]); await rm(runDir, { recursive: true, force: true })
  })

  it('does not call AWS for config, path, extra-file, symlink, or STS mismatch', async () => {
    const { runDir, config } = await createRun(); const calls = []; const fake = async () => { calls.push('called'); return { Account: 'wrong' } }
    const invalidConfig = await uploadMigrationRun({ ...config, bucket: 'other' }, { runAws: fake, fetch: successFetch(), approvedTarget }); expect(invalidConfig.report.failure.category).toBe('config'); expect(invalidConfig.report.failure.stage).toBe('preflight'); expect(calls).toEqual([])
    await writeFile(join(runDir, 'extra.txt'), 'x'); const extra = await uploadMigrationRun(config, { runAws: fake, fetch: successFetch(), approvedTarget }); expect(extra.report.failure.category).toBe('preflight'); expect(calls).toEqual([]); await rm(join(runDir, 'extra.txt'))
    const outside = await mkdtemp(join(tmpdir(), 't14d-out-')); const expected = join(runDir, result.objects[0].key); await rm(expected); await symlink(join(outside, 'body'), expected); await writeFile(join(outside, 'body'), result.objects[0].body); const link = await uploadMigrationRun(config, { runAws: fake, fetch: successFetch(), approvedTarget }); expect(link.report.failure.category).toBe('preflight'); expect(calls).toEqual([]); await rm(outside, { recursive: true, force: true }); await rm(runDir, { recursive: true, force: true })
    const { runDir: stsDir, config: stsConfig } = await createRun(); const sts = await uploadMigrationRun(stsConfig, { runAws: fake, fetch: successFetch(), approvedTarget }); expect(sts.report.failure.stage).toBe('sts'); expect(calls).toContain('called'); await rm(stsDir, { recursive: true, force: true })
    const { runDir: openDir, config: openConfig } = await createRun(); const opened = await uploadMigrationRun(openConfig, { runAws: fake, fetch: successFetch(), approvedTarget, fsImpl: { open: async () => { throw new Error('raw file path') } } }); expect(opened.report.failure).toEqual({ stage: 'preflight', category: 'preflight', key: null }); expect(JSON.stringify(opened.report)).not.toContain('raw file path'); await rm(openDir, { recursive: true, force: true })
    const { runDir: ioDir, config: ioConfig } = await createRun(); let ioClosed = 0; const io = await uploadMigrationRun(ioConfig, { runAws: fake, fetch: successFetch(), approvedTarget, fsImpl: { open: async () => ({ read: async () => { throw new Error('raw read path') }, close: async () => { ioClosed += 1; throw new Error('raw close path') } }) } }); expect(io.report.failure).toEqual({ stage: 'preflight', category: 'preflight', key: null }); expect(JSON.stringify(io.report)).not.toMatch(/raw (read|close) path/); expect(ioClosed).toBe(1); await rm(ioDir, { recursive: true, force: true })
  })

  it('stops on conditional collision without later writes or retries', async () => {
    const { runDir, config } = await createRun(); const calls = []; const runAws = async (args) => { calls.push(args); if (args.includes('get-caller-identity')) return { Account: '470447451992' }; throw Object.assign(new Error('raw secret'), { code: 412 }) }; const report = await uploadMigrationRun(config, { runAws, fetch: successFetch(), approvedTarget }); expect(report.report.failure.category).toBe('collision'); expect(report.report.counts).toMatchObject({ attempted: 1, uploaded: 0 }); expect(calls.filter((args) => args.includes('put-object'))).toHaveLength(1); expect(JSON.stringify(report.report)).not.toMatch(/raw secret|bucket|domain/i); await rm(runDir, { recursive: true, force: true })
  })

  it('reports readback and CloudFront failures safely and validates report schema', async () => {
    const { runDir, config } = await createRun(); const runAws = async (args) => { if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) return { ETag: '"abc123"', VersionId: 'v1' }; await writeFile(args.at(-1), 'bad'); return {} }; const readback = await uploadMigrationRun(config, { runAws, fetch: successFetch(), approvedTarget }); expect(readback.report.failure.stage).toBe('readback'); expect(readback.report.counts.uploaded).toBe(4); await rm(runDir, { recursive: true, force: true })
    const success = { schemaVersion: 1, status: 'match', counts: { attempted: 0, uploaded: 0, readback: 0, cloudfront: 0 }, objects: [], failure: null }; expect(serializeUploadReport(success)).toBeInstanceOf(Uint8Array); expect(humanUploadReport(success)).toContain('Failure: none')
  })

  it('reports the second object as the current failure and rejects tag omissions without later calls', async () => {
    const { runDir: readDir, config: readConfig } = await createRun(); let readCount = 0; const readAws = async (args) => { if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) return { ETag: '"abc123"', VersionId: 'v1' }; readCount += 1; const key = args[args.indexOf('--key') + 1]; await writeFile(args.at(-1), result.objects.find((object) => object.key === key).body); if (readCount === 2) throw Object.assign(new Error(), { code: 'hash' }) }
    const readback = await uploadMigrationRun(readConfig, { runAws: readAws, fetch: successFetch(), approvedTarget }); expect(readback.report.failure.stage).toBe('readback'); expect(readback.report.failure.key).toBe(readback.report.objects[1].key); expect(readback.report.counts.uploaded).toBe(4); await rm(readDir, { recursive: true, force: true })
    const { runDir: tagDir, config: tagConfig } = await createRun(); let putCount = 0; const tagAws = async (args) => { if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) { putCount += 1; return { ETag: null, VersionId: 'v1' } } throw new Error('must not read back') }
    const tags = await uploadMigrationRun(tagConfig, { runAws: tagAws, fetch: successFetch(), approvedTarget }); expect(tags.report.failure.stage).toBe('upload'); expect(tags.report.failure.key).toBe(result.objects[0].key); expect(tags.report.counts).toMatchObject({ attempted: 1, uploaded: 0 }); expect(putCount).toBe(1); await rm(tagDir, { recursive: true, force: true })
    const { runDir: versionDir, config: versionConfig } = await createRun(); let versionPutCount = 0; const versionAws = async (args) => { if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) { versionPutCount += 1; return { ETag: '"abc123"', VersionId: 'bad value' } } throw new Error('must not read back') }
    const versions = await uploadMigrationRun(versionConfig, { runAws: versionAws, fetch: successFetch(), approvedTarget }); expect(versions.report.failure.stage).toBe('upload'); expect(versions.report.failure.key).toBe(result.objects[0].key); expect(versions.report.counts.uploaded).toBe(0); expect(versionPutCount).toBe(1); await rm(versionDir, { recursive: true, force: true })
    const { runDir: edgeDir, config: edgeConfig } = await createRun(); const edgeAws = async (args) => { if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) return { ETag: '"abc123"', VersionId: 'v1' }; const key = args[args.indexOf('--key') + 1]; await writeFile(args.at(-1), result.objects.find((object) => object.key === key).body); return {} }; const edgeFetch = async (url) => { if (url.endsWith(result.objects[1].key)) return new Response('', { status: 503 }); return new Response(body(result.objects.find((object) => url.endsWith(object.key))), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=60' } }) }
    const edge = await uploadMigrationRun(edgeConfig, { runAws: edgeAws, fetch: edgeFetch, approvedTarget }); expect(edge.report.failure.stage).toBe('cloudfront'); expect(edge.report.failure.key).toBe(result.objects[1].key); expect(edge.report.counts.cloudfront).toBe(1); await rm(edgeDir, { recursive: true, force: true })
    const tampered = { schemaVersion: 1, status: 'mismatch', counts: { attempted: 1, uploaded: 1, readback: 0, cloudfront: 0 }, objects: [{ key: result.objects[0].key, sha256: result.objects[0].sha256, etag: null, versionId: null }], failure: { stage: 'readback', category: 'readback', key: null, raw: 'secret/path' } }; expect(() => serializeUploadReport(tampered)).toThrow(); expect(() => humanUploadReport(tampered)).toThrow()
    const illegalStage = { ...tampered, failure: { stage: 'cleanup', category: 'readback', key: result.objects[0].key } }; expect(() => serializeUploadReport(illegalStage)).toThrow()
    const wrongKey = { ...tampered, failure: { stage: 'readback', category: 'readback', key: 'data/v1/stadiums/oda/availability/2024-02.json' }, objects: [{ ...tampered.objects[0], etag: '"abc123"', versionId: 'v1' }] }; expect(() => serializeUploadReport(wrongKey)).toThrow()
  })

  it('sanitizes cleanup failures and preserves the original readback failure', async () => {
    const makeAws = async (args) => { if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) return { ETag: '"abc123"', VersionId: 'v1' }; await writeFile(args.at(-1), result.objects.find((object) => args.includes(object.key)).body); return {} }
    const success = await createRun(); const cleanup = await uploadMigrationRun(success.config, { runAws: makeAws, fetch: successFetch(), approvedTarget, fsImpl: { rm: async (path) => { if (path.includes('.t14d-readback-')) throw new Error('raw cleanup path') } } }); expect(cleanup.report.failure).toEqual({ stage: 'cleanup', category: 'readback', key: null }); expect(() => serializeUploadReport(cleanup.report)).not.toThrow(); expect(cleanup.human).not.toContain('raw cleanup path'); await rm(success.runDir, { recursive: true, force: true })
    const original = await createRun(); const preserved = await uploadMigrationRun(original.config, { runAws: async (args) => { if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) return { ETag: '"abc123"', VersionId: 'v1' }; await writeFile(args.at(-1), 'bad'); throw new Error('raw original') }, fetch: successFetch(), approvedTarget, fsImpl: { rm: async (path) => { if (path.includes('.t14d-readback-')) throw new Error('raw cleanup path') } } }); expect(preserved.report.failure.stage).toBe('readback'); expect(preserved.report.failure.key).toBe(preserved.report.objects[0].key); expect(preserved.human).not.toContain('raw'); await rm(original.runDir, { recursive: true, force: true })
  })

  it('stops after N successful puts on collision with exact prefix metadata', async () => {
    const { runDir, config } = await createRun(); let puts = 0; const calls = []; const runAws = async (args) => { calls.push(args); if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) { puts += 1; if (puts === 2) throw Object.assign(new Error(), { code: 412 }); return { ETag: '"abc123"', VersionId: 'v1' } }; throw new Error('readback forbidden') }; const report = await uploadMigrationRun(config, { runAws, fetch: successFetch(), approvedTarget }); expect(report.report.counts).toEqual({ attempted: 2, uploaded: 1, readback: 0, cloudfront: 0 }); expect(report.report.objects[0].etag).toBe('"abc123"'); expect(report.report.objects[1].etag).toBeNull(); expect(calls.filter((args) => args.includes('get-object'))).toHaveLength(0); await rm(runDir, { recursive: true, force: true })
  })

  it('rejects pending or non-stream CloudFront bodies without unbounded arrayBuffer', async () => {
    const { runDir: pendingDir, config: pendingConfig } = await createRun(); let signal; const pendingAws = async (args) => { if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) return { ETag: '"abc123"', VersionId: 'v1' }; await writeFile(args.at(-1), result.objects.find((object) => args.includes(object.key)).body); return {} }; const pendingBody = new ReadableStream({ start() {}, cancel() { return Promise.reject(new Error('cancel failure')) } }); const pending = await uploadMigrationRun({ ...pendingConfig, timeoutMs: 10, maxAttempts: 1 }, { runAws: pendingAws, fetch: async (_url, options) => { signal = options.signal; return new Response(pendingBody, { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=60' } }) }, approvedTarget }); expect(pending.report.failure.category).toBe('timeout'); expect(signal?.aborted).toBe(true); await rm(pendingDir, { recursive: true, force: true })
    const { runDir: plainDir, config: plainConfig } = await createRun(); const plain = await uploadMigrationRun({ ...plainConfig, maxAttempts: 1 }, { runAws: pendingAws, fetch: async () => ({ status: 200, headers: new Headers({ 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=60' }), arrayBuffer: async () => new Uint8Array(1 << 20) }), approvedTarget }); expect(plain.report.failure.stage).toBe('cloudfront'); expect(plain.report.failure.key).toBe(result.objects[0].key); await rm(plainDir, { recursive: true, force: true })
  })

  it('bounds CloudFront retries and settles pending fetches without AWS fallback', async () => {
    const { runDir: retryDir, config: retryConfig } = await createRun(); let fetchCalls = 0; const runAws = async (args) => { if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) return { ETag: '"abc123"', VersionId: 'v1' }; await writeFile(args.at(-1), result.objects.find((object) => args.includes(object.key)).body); return {} }; const retryFetch = async (url) => { fetchCalls += 1; if (fetchCalls % 2 === 1) return new Response('', { status: 503 }); return new Response(body(result.objects.find((object) => url.endsWith(object.key))), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=60' } }) }; const retried = await uploadMigrationRun(retryConfig, { runAws, fetch: retryFetch, approvedTarget }); expect(retried.report.status).toBe('match'); expect(fetchCalls).toBe(8); await rm(retryDir, { recursive: true, force: true })
    const { runDir: timeoutDir, config: timeoutConfig } = await createRun(); const timed = await uploadMigrationRun({ ...timeoutConfig, maxAttempts: 1, timeoutMs: 5 }, { runAws, fetch: () => new Promise(() => {}), approvedTarget }); expect(timed.report.failure.category).toBe('timeout'); expect(timed.report.counts.cloudfront).toBe(0); await rm(timeoutDir, { recursive: true, force: true })
  })

  it('strictly validates CloudFront MIME, directives, Age, streaming bounds, and current-key failures', async () => {
    const variants = [
      { 'content-type': 'application/jsonx', 'cache-control': 'public, max-age=0, s-maxage=60' },
      { 'content-type': 'application/json', 'cache-control': 'public, max-age=00, s-maxage=60' },
      { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=61' },
      { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=60', age: '61' },
      { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=60', age: 'x' }
    ]
    for (const headers of variants) {
      const { runDir, config } = await createRun(); const calls = []; const runAws = async (args) => { calls.push(args); if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) return { ETag: '"abc123"', VersionId: 'v1' }; await writeFile(args.at(-1), result.objects.find((object) => args.includes(object.key)).body); return {} }; const checked = await uploadMigrationRun(config, { runAws, fetch: async (url) => new Response(body(result.objects[0]), { status: 200, headers }), approvedTarget }); expect(checked.report.failure.stage).toBe('cloudfront'); expect(checked.report.failure.key).toBe(result.objects[0].key); expect(checked.report.counts.cloudfront).toBe(0); expect(calls.filter((args) => args.includes('get-object'))).toHaveLength(4); await rm(runDir, { recursive: true, force: true })
    }
    const { runDir: streamDir, config: streamConfig } = await createRun(); const streamRunAws = async (args) => { if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) return { ETag: '"abc123"', VersionId: 'v1' }; await writeFile(args.at(-1), result.objects.find((object) => args.includes(object.key)).body); return {} }; const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); controller.enqueue(new TextEncoder().encode('"bad":true}')); controller.close() } }); const streamed = await uploadMigrationRun(streamConfig, { runAws: streamRunAws, fetch: async () => new Response(stream, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=60' } }), approvedTarget }); expect(streamed.report.failure.stage).toBe('cloudfront'); expect(streamed.report.failure.key).toBe(result.objects[0].key); await rm(streamDir, { recursive: true, force: true })
    const { runDir: overDir, config: overConfig } = await createRun(); const overRunAws = async (args) => { if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) return { ETag: '"abc123"', VersionId: 'v1' }; await writeFile(args.at(-1), result.objects.find((object) => args.includes(object.key)).body); return {} }; const oversized = await uploadMigrationRun({ ...overConfig, maxAttempts: 1 }, { runAws: overRunAws, fetch: async () => new Response(new Uint8Array(32769), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=60' } }), approvedTarget }); expect(oversized.report.failure.stage).toBe('cloudfront'); expect(oversized.report.failure.key).toBe(result.objects[0].key); await rm(overDir, { recursive: true, force: true })
    const { runDir: deadlineDir, config: deadlineConfig } = await createRun(); let deadlineCalls = 0; const deadlineRunAws = async (args) => { if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) return { ETag: '"abc123"', VersionId: 'v1' }; await writeFile(args.at(-1), result.objects.find((object) => args.includes(object.key)).body); return {} }; const deadlineFetch = async () => { deadlineCalls += 1; if (deadlineCalls === 1) return new Response('', { status: 503 }); return new Promise(() => {}) }; const deadline = await uploadMigrationRun({ ...deadlineConfig, timeoutMs: 20, maxAttempts: 4 }, { runAws: deadlineRunAws, fetch: deadlineFetch, approvedTarget }); expect(deadline.report.failure.category).toBe('timeout'); expect(deadlineCalls).toBe(2); await rm(deadlineDir, { recursive: true, force: true })
  })
})
