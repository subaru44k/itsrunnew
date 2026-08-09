import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeFirestoreSnapshot } from '../../packages/core/src/firestoreSnapshot.ts'
import { transformFirestoreRecords } from './firestore-transform.mjs'
import { getObjectVersionArgs, humanUploadReport, putObjectArgs, restoreObjectArgs, serializeUploadReport, stsArgs, uploadMigrationRun } from './firestore-upload.mjs'

const raw = JSON.parse(await readFile(new URL('./fixtures/firestore-snapshot.synthetic.json', import.meta.url), 'utf8'))
const records = normalizeFirestoreSnapshot(raw)
const options = { sourceIdentity: 'synthetic-fixture', updatedAt: '2026-08-09T00:00:00.000Z' }
const result = transformFirestoreRecords(records, options)
const bucket = 'itsrun-preview-data-470447451992-ap-northeast-1'
const baseConfig = { profile: 'codex-prod', account: '470447451992', region: 'ap-northeast-1', reviewedExpectedBucket: bucket, bucket, distributionDomain: 'preview.example.test', maxAttempts: 2, timeoutMs: 100 }
const body = (object) => new TextDecoder().decode(object.body)

async function createRun() {
  const runDir = await mkdtemp(join(tmpdir(), 't14d-')); await mkdir(join(runDir, 'data/v1/stadiums'), { recursive: true })
  for (const object of result.objects) { const path = join(runDir, object.key); await mkdir(join(path, '..'), { recursive: true }); await writeFile(path, object.body) }
  const manifestPath = join(runDir, 'manifest.json'); await writeFile(manifestPath, result.manifestBytes); return { runDir, manifestPath, config: { ...baseConfig, runDir, manifestPath } }
}

function successFetch() { return async (url) => { const object = result.objects.find((candidate) => url.endsWith(candidate.key)); return new Response(body(object), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=60', age: '0' } }) } }

describe('T14D injected local upload tooling', () => {
  it('builds exact AWS arguments and never includes forbidden operations', () => {
    const config = { ...baseConfig }; const object = { ...result.objects[0], bodyPath: '/safe/run/data.json', versionId: 'v1', etag: '"abc123"' }
    expect(stsArgs(config)).toEqual(['--profile', 'codex-prod', '--region', 'ap-northeast-1', '--output', 'json', 'sts', 'get-caller-identity'])
    expect(putObjectArgs(config, object)).toEqual(['--profile', 'codex-prod', '--region', 'ap-northeast-1', '--output', 'json', 's3api', 'put-object', '--bucket', bucket, '--key', object.key, '--body', object.bodyPath, '--content-type', 'application/json', '--cache-control', 'public, max-age=0, s-maxage=60', '--if-none-match', '*'])
    expect(getObjectVersionArgs(config, object, '/safe/read.json')).toContain('--version-id'); expect(restoreObjectArgs(config, object, '/safe/old.json')).toContain('--if-match')
    const text = JSON.stringify([stsArgs(config), putObjectArgs(config, object), getObjectVersionArgs(config, object, '/safe/read.json'), restoreObjectArgs(config, object, '/safe/old.json')]); expect(text).not.toMatch(/delete|sync|cp|invalidation|s3:\*/i)
  })

  it('preflights local artifacts, uploads/readbacks deterministically, then verifies CloudFront', async () => {
    const { runDir, manifestPath, config } = await createRun(); const calls = []; const runAws = async (args) => { calls.push(args); if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) return { ETag: '"abc123"', VersionId: `v${calls.length}` }; const output = args.at(-1); const key = args[args.indexOf('--key') + 1]; await writeFile(output, result.objects.find((object) => object.key === key).body); return {} }
    const uploaded = await uploadMigrationRun(config, { runAws, fetch: successFetch() }); expect(uploaded.report).toMatchObject({ status: 'match', counts: { attempted: 4, uploaded: 4, readback: 4, cloudfront: 4 } }); expect(calls.filter((args) => args.includes('put-object'))).toHaveLength(4); expect(calls.filter((args) => args.includes('get-object'))).toHaveLength(4); expect(uploaded.human).toContain('Failure: none'); expect([...await readFile(manifestPath)]).toEqual([...result.manifestBytes]); await rm(runDir, { recursive: true, force: true })
  })

  it('does not call AWS for config, path, extra-file, symlink, or STS mismatch', async () => {
    const { runDir, config } = await createRun(); const calls = []; const fake = async () => { calls.push('called'); return { Account: 'wrong' } }
    const invalidConfig = await uploadMigrationRun({ ...config, bucket: 'other' }, { runAws: fake, fetch: successFetch() }); expect(invalidConfig.report.failure.category).toBe('preflight'); expect(calls).toEqual([])
    await writeFile(join(runDir, 'extra.txt'), 'x'); const extra = await uploadMigrationRun(config, { runAws: fake, fetch: successFetch() }); expect(extra.report.failure.category).toBe('preflight'); expect(calls).toEqual([]); await rm(join(runDir, 'extra.txt'))
    const outside = await mkdtemp(join(tmpdir(), 't14d-out-')); const expected = join(runDir, result.objects[0].key); await rm(expected); await symlink(join(outside, 'body'), expected); await writeFile(join(outside, 'body'), result.objects[0].body); const link = await uploadMigrationRun(config, { runAws: fake, fetch: successFetch() }); expect(link.report.failure.category).toBe('preflight'); expect(calls).toEqual([]); await rm(outside, { recursive: true, force: true }); await rm(runDir, { recursive: true, force: true })
    const { runDir: stsDir, config: stsConfig } = await createRun(); const sts = await uploadMigrationRun(stsConfig, { runAws: fake, fetch: successFetch() }); expect(sts.report.failure.stage).toBe('sts'); expect(calls).toContain('called'); await rm(stsDir, { recursive: true, force: true })
  })

  it('stops on conditional collision without later writes or retries', async () => {
    const { runDir, config } = await createRun(); const calls = []; const runAws = async (args) => { calls.push(args); if (args.includes('get-caller-identity')) return { Account: '470447451992' }; throw Object.assign(new Error('raw secret'), { code: 412 }) }; const report = await uploadMigrationRun(config, { runAws, fetch: successFetch() }); expect(report.report.failure.category).toBe('collision'); expect(report.report.counts).toMatchObject({ attempted: 1, uploaded: 0 }); expect(calls.filter((args) => args.includes('put-object'))).toHaveLength(1); expect(JSON.stringify(report.report)).not.toMatch(/raw secret|bucket|domain/i); await rm(runDir, { recursive: true, force: true })
  })

  it('reports readback and CloudFront failures safely and validates report schema', async () => {
    const { runDir, config } = await createRun(); const runAws = async (args) => { if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) return { ETag: '"abc123"', VersionId: 'v1' }; await writeFile(args.at(-1), 'bad'); return {} }; const readback = await uploadMigrationRun(config, { runAws, fetch: successFetch() }); expect(readback.report.failure.stage).toBe('readback'); expect(readback.report.counts.uploaded).toBe(4); await rm(runDir, { recursive: true, force: true })
    const success = { schemaVersion: 1, status: 'match', counts: { attempted: 0, uploaded: 0, readback: 0, cloudfront: 0 }, objects: [], failure: null }; expect(serializeUploadReport(success)).toBeInstanceOf(Uint8Array); expect(humanUploadReport(success)).toContain('Failure: none')
  })

  it('bounds CloudFront retries and settles pending fetches without AWS fallback', async () => {
    const { runDir: retryDir, config: retryConfig } = await createRun(); let fetchCalls = 0; const runAws = async (args) => { if (args.includes('get-caller-identity')) return { Account: '470447451992' }; if (args.includes('put-object')) return { ETag: '"abc123"', VersionId: 'v1' }; await writeFile(args.at(-1), result.objects.find((object) => args.includes(object.key)).body); return {} }; const retryFetch = async (url) => { fetchCalls += 1; if (fetchCalls % 2 === 1) return new Response('', { status: 503 }); return new Response(body(result.objects.find((object) => url.endsWith(object.key))), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=60' } }) }; const retried = await uploadMigrationRun(retryConfig, { runAws, fetch: retryFetch }); expect(retried.report.status).toBe('match'); expect(fetchCalls).toBe(8); await rm(retryDir, { recursive: true, force: true })
    const { runDir: timeoutDir, config: timeoutConfig } = await createRun(); const timed = await uploadMigrationRun({ ...timeoutConfig, maxAttempts: 1, timeoutMs: 5 }, { runAws, fetch: () => new Promise(() => {}) }); expect(timed.report.failure.category).toBe('timeout'); expect(timed.report.counts.cloudfront).toBe(0); await rm(timeoutDir, { recursive: true, force: true })
  })
})
