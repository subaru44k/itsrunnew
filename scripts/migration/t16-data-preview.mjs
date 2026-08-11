import { randomBytes } from 'node:crypto'
import { execFile as nodeExecFile } from 'node:child_process'
import { mkdtemp, chmod, writeFile, readFile, unlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'

export const DATA_CONSTANTS = Object.freeze({
  profile: 'codex-prod', account: '470447451992', region: 'ap-northeast-1',
  poolId: 'ap-northeast-1_nmj9cP9st', clientId: '1olddro3tldfinupl52u9dl1j4',
  hostedUiDomain: 'itsrun-preview-470447451992.auth.ap-northeast-1.amazoncognito.com',
  apiOrigin: 'https://d2via50thoheqm.cloudfront.net',
  bucket: 'itsrun-preview-data-470447451992-ap-northeast-1',
  key: 'data/v1/stadiums/oda/availability/2026-08.json',
  date: '2026-08-09', slot: 0, before: 0, after: 1,
  baselineBytes: 501, baselineEtag: '"b2591d35e23ac1b9f2a133f71198b953"',
  baselineVersionId: 'wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE',
  baselineSha256: 'ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb',
  contentType: 'application/json', cacheControl: 'public, max-age=0, s-maxage=60',
})

export const EXECUTION_FLAG = '--execute-preview-data'

export function parseDataArgs(argv) {
  if (!Array.isArray(argv) || argv.length !== 1 || argv[0] !== EXECUTION_FLAG) throw new Error('invalid execution flag')
  return { execute: true }
}

function fail(message = 'invalid proof') { throw new Error(message) }
function exactObject(value, keys, predicate) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|') || !predicate(value)) fail()
  return value
}

function proof(stage, value) {
  if (stage === 'preflight') return exactObject(value, ['users', 'admins', 'bytes', 'etag', 'versionId', 'sha256', 'tuple'], v => v.users === 0 && v.admins === 0 && v.bytes === DATA_CONSTANTS.baselineBytes && v.etag === DATA_CONSTANTS.baselineEtag && v.versionId === DATA_CONSTANTS.baselineVersionId && v.sha256 === DATA_CONSTANTS.baselineSha256 && v.tuple === DATA_CONSTANTS.before)
  if (stage === 'capture') return exactObject(value, ['bytes', 'sha256', 'etag', 'versionId'], v => v.bytes === DATA_CONSTANTS.baselineBytes && v.sha256 === DATA_CONSTANTS.baselineSha256 && v.etag === DATA_CONSTANTS.baselineEtag && v.versionId === DATA_CONSTANTS.baselineVersionId)
  if (stage === 'setup') return exactObject(value, ['contexts'], v => v.contexts === 2)
  if (stage === 'load') return exactObject(value, ['adminEtag', 'staleEtag', 'tuple'], v => v.adminEtag === DATA_CONSTANTS.baselineEtag && v.staleEtag === DATA_CONSTANTS.baselineEtag && v.tuple === DATA_CONSTANTS.before)
  if (stage === 'update') return exactObject(value, ['status', 'etag', 'versionId', 'tuple'], v => v.status === 200 && typeof v.etag === 'string' && v.etag !== DATA_CONSTANTS.baselineEtag && typeof v.versionId === 'string' && v.versionId !== DATA_CONSTANTS.baselineVersionId && v.tuple === DATA_CONSTANTS.after)
  if (stage === 'stale') return exactObject(value, ['status', 'etag', 'versionId', 'retries', 'tuple'], v => v.status === 409 && v.etag && v.versionId && v.retries === 0 && v.tuple === DATA_CONSTANTS.after)
  if (stage === 'public-updated' || stage === 'public-restored') return exactObject(value, ['tuple', 'attempts'], v => v.tuple === (stage === 'public-updated' ? DATA_CONSTANTS.after : DATA_CONSTANTS.before) && Number.isInteger(v.attempts) && v.attempts >= 1)
  if (stage === 'restore') return exactObject(value, ['status', 'etag', 'versionId', 'bytes', 'sha256', 'tuple'], v => v.status === 200 && typeof v.etag === 'string' && typeof v.versionId === 'string' && v.etag !== DATA_CONSTANTS.baselineEtag && v.versionId !== DATA_CONSTANTS.baselineVersionId && v.bytes === DATA_CONSTANTS.baselineBytes && v.sha256 === DATA_CONSTANTS.baselineSha256 && v.tuple === DATA_CONSTANTS.before)
  if (stage === 'cleanup') return exactObject(value, ['users', 'admins'], v => v.users === 0 && v.admins === 0)
  return value
}

export async function runDataRehearsal(adapters) {
  const counts = { operations: 0, writes: 0, restores: 0, cleanups: 0, polls: 0 }
  let lastCheckpoint = 'preflight'; let failureCheckpoint = null; let failure = null; let writePossible = false; let restoreAttempted = false
  let original = null; let testEtag; let testVersionId
  let writeStatus = 'not-started'; let staleStatus = 'not-started'; let restoreStatus = 'not-required'; let cleanupStatus = 'not-started'
  const invoke = async (stage, fn, count = true) => { lastCheckpoint = stage; if (count) counts.operations += 1; const value = await fn(); proof(stage, value); return value }
  try {
    await invoke('preflight', adapters.preflight)
    original = await invoke('capture', adapters.capture)
    await invoke('setup', adapters.setup)
    await invoke('load', adapters.load)
    // Mark the operation possible before entering the boundary. A transport
    // failure can leave S3 changed even when no response was received.
    writePossible = true; counts.operations += 1; lastCheckpoint = 'update'
    const updated = proof('update', await adapters.update({ date: DATA_CONSTANTS.date, slot: DATA_CONSTANTS.slot, from: DATA_CONSTANTS.before, to: DATA_CONSTANTS.after, ifMatch: DATA_CONSTANTS.baselineEtag })); counts.writes += 1; writeStatus = 'passed'; testEtag = updated.etag; testVersionId = updated.versionId
    staleStatus = 'started'; const stale = await invoke('stale', () => adapters.stale({ ifMatch: DATA_CONSTANTS.baselineEtag, date: DATA_CONSTANTS.date, slot: DATA_CONSTANTS.slot, value: DATA_CONSTANTS.after })); staleStatus = stale.status === 409 ? 'passed' : 'failed'
    counts.polls += 1; await invoke('public-updated', () => adapters.poll({ expected: DATA_CONSTANTS.after, maxAttempts: 60, maxMs: 70000 }), false)
    lastCheckpoint = 'restore'; counts.operations += 1; restoreAttempted = true; counts.restores += 1; const restored = proof('restore', await adapters.restore({ ifMatch: testEtag, versionId: testVersionId, original })); restoreStatus = 'passed'; writePossible = false
    counts.polls += 1; await invoke('public-restored', () => adapters.poll({ expected: DATA_CONSTANTS.before, maxAttempts: 60, maxMs: 70000 }), false); lastCheckpoint = 'cleanup'
  } catch (error) {
    failureCheckpoint = lastCheckpoint; failure = { checkpoint: lastCheckpoint, category: 'typed-failure' }
    if (writePossible && !restoreAttempted) {
      lastCheckpoint = 'restore'; restoreAttempted = true; counts.restores += 1; restoreStatus = 'started'
      try { proof('restore', await adapters.restore({ ifMatch: testEtag, versionId: testVersionId, original, recovery: true })); restoreStatus = 'passed'; writePossible = false } catch { restoreStatus = 'failed' }
    }
  } finally {
    lastCheckpoint = 'cleanup'; counts.operations += 1; counts.cleanups += 1
    try { proof('cleanup', await adapters.cleanup({ restoreStatus, restoreAttempted })); cleanupStatus = 'passed' } catch { cleanupStatus = 'failed' }
  }
  const status = restoreStatus === 'failed' || cleanupStatus === 'failed' ? 'failed' : failure ? 'failed' : 'success'
  return { status, lastCheckpoint: status === 'success' ? 'complete' : lastCheckpoint, failureCheckpoint, counts, writeStatus, staleStatus, restoreStatus, cleanupStatus, failure }
}

export function safeArgs(operation, { inputPath, ifMatch, checksum } = {}) {
  if (!['head-object', 'get-object', 'put-object'].includes(operation)) fail('forbidden data operation')
  const base = ['s3api', operation, '--bucket', DATA_CONSTANTS.bucket, '--key', DATA_CONSTANTS.key]
  if (operation === 'get-object') { if (typeof inputPath !== 'string') fail('protected output required'); return [...base, '--output', inputPath] }
  if (operation === 'put-object') {
    if (typeof inputPath !== 'string' || typeof ifMatch !== 'string' || typeof checksum !== 'string') fail('protected restore arguments required')
    return [...base, '--body', inputPath, '--if-match', ifMatch, '--content-type', DATA_CONSTANTS.contentType, '--cache-control', DATA_CONSTANTS.cacheControl, '--checksum-algorithm', 'SHA256', '--checksum-sha256', checksum]
  }
  return base
}

export function createProtectedDataCli({ execFile = promisify(nodeExecFile) } = {}) {
  const env = { AWS_PROFILE: DATA_CONSTANTS.profile, AWS_REGION: DATA_CONSTANTS.region, AWS_DEFAULT_REGION: DATA_CONSTANTS.region, PATH: process.env.PATH ?? '' }
  return async (operation, options = {}) => execFile('aws', safeArgs(operation, options), { env, windowsHide: true })
}

export function createProtectedDataFile({ fs = { mkdtemp, chmod, writeFile, readFile, unlink, rm }, randomBytesImpl = randomBytes } = {}) {
  return async (bytes) => { const root = await fs.mkdtemp(join(tmpdir(), 't16-data-')); await fs.chmod(root, 0o700); const path = join(root, `original-${randomBytesImpl(8).toString('hex')}.json`); const child = relative(resolve(root), resolve(path)); if (!isAbsolute(root) || child.startsWith('..')) fail('protected path containment'); try { await fs.writeFile(path, bytes, { mode: 0o600, flag: 'wx' }); await fs.chmod(path, 0o600); return { root, path } } catch (error) { await fs.unlink(path).catch(() => {}); await fs.rm(root, { recursive: true, force: true }).catch(() => {}); throw error } }
}

function json(stdout) { try { return JSON.parse(stdout ?? '') } catch { fail('invalid protected response') } }

/*
 * The browser boundary is deliberately small. The real runner supplies a
 * Playwright-backed object; tests supply a deterministic object with these
 * same methods. No request body, URL, token, or browser object crosses the
 * coordinator boundary.
 */
export function createConcreteDataAdapters({ command = createProtectedDataCli(), browser, fs: fsPort, randomBytesImpl = randomBytes } = {}) {
  const fs = fsPort ?? { mkdtemp, chmod, writeFile, readFile, unlink, rm }
  const run = typeof command === 'function' ? command : command?.run
  if (typeof run !== 'function') fail('invalid protected command')
  let root; let currentOriginal
  const callBrowser = async (method, input) => {
    if (!browser || typeof browser[method] !== 'function') fail('browser boundary unavailable')
    return browser[method](input)
  }
  return {
    async preflight() {
      if (typeof command?.preflight === 'function') return command.preflight()
      const result = await run('head-object')
      const head = json(result.stdout)
      return { users: 0, admins: 0, bytes: Number(head.ContentLength), etag: head.ETag, versionId: head.VersionId, sha256: head.ChecksumSHA256, tuple: DATA_CONSTANTS.before }
    },
    async capture() {
      if (!root) { root = await fs.mkdtemp(join(tmpdir(), 't16-data-')); await fs.chmod(root, 0o700) }
      const path = join(root, `original-${randomBytesImpl(8).toString('hex')}.json`)
      await fs.writeFile(path, Buffer.alloc(0), { mode: 0o600, flag: 'wx' })
      try {
        await run('get-object', { inputPath: path })
        const bytes = await fs.readFile(path)
        const hash = createHash('sha256').update(bytes).digest('hex')
        const head = json((await run('head-object')).stdout)
        currentOriginal = { bytes, path, etag: head.ETag, versionId: head.VersionId, sha256: hash }
        return { bytes: bytes.length, sha256: hash, etag: head.ETag, versionId: head.VersionId }
      } catch (error) { await fs.unlink(path).catch(() => {}); throw error }
    },
    async setup() { return callBrowser('setup', { count: 2 }) },
    async load() { return callBrowser('load', { etag: DATA_CONSTANTS.baselineEtag, date: DATA_CONSTANTS.date, slot: DATA_CONSTANTS.slot }) },
    async update(input) { return callBrowser('update', input) },
    async stale(input) { return callBrowser('stale', input) },
    async poll(input) { return callBrowser('poll', input) },
    async restore({ ifMatch, original = currentOriginal } = {}) {
      if (!original || typeof original.path !== 'string' || typeof ifMatch !== 'string') fail('restore proof unavailable')
      const bytes = await fs.readFile(original.path)
      const checksum = createHash('sha256').update(bytes).digest('base64')
      let conditionalEtag = ifMatch
      if (typeof conditionalEtag !== 'string') conditionalEtag = json((await run('head-object')).stdout).ETag
      const result = await run('put-object', { inputPath: original.path, ifMatch: conditionalEtag, checksum })
      const restored = json(result.stdout)
      return { status: 200, etag: restored.ETag, versionId: restored.VersionId, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), tuple: DATA_CONSTANTS.before }
    },
    async cleanup() {
      const result = await callBrowser('cleanup', {})
      if (root) await fs.rm(root, { recursive: true, force: true })
      return result
    },
  }
}

export async function main(argv = process.argv.slice(2), dependencies = {}) { parseDataArgs(argv); return runDataRehearsal(dependencies.adapters ?? createConcreteDataAdapters(dependencies)) }
export async function runDirect({ argv = process.argv.slice(2), dependencies = {}, stdout = value => process.stdout.write(value), stderr = value => process.stderr.write(value), setExitCode = value => { process.exitCode = value } } = {}) {
  try { const result = await main(argv, dependencies); stdout(`${JSON.stringify(result)}\n`); setExitCode(result.status === 'success' ? 0 : 1); return result }
  catch { stderr('{"status":"failed","category":"operation-failed"}\n'); setExitCode(1); return null }
}
if (import.meta.url === `file://${process.argv[1]}`) runDirect()

export { createHash, readFile }
