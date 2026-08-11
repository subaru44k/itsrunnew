import { randomBytes } from 'node:crypto'
import { execFile as nodeExecFile } from 'node:child_process'
import { mkdtemp, chmod, writeFile, readFile, unlink, rm, stat, lstat, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, relative, isAbsolute, dirname } from 'node:path'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { awaitHostedUiLogin, awaitSignedInSentinel, runBrowserRoleSession } from './t16-auth-preview.mjs'

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
  apiPath: '/api/v1/stadiums/oda/availability/2026-08',
})

export const EXECUTION_FLAG = '--execute-preview-data'

export function parseDataArgs(argv) {
  if (!Array.isArray(argv) || argv.length !== 1 || argv[0] !== EXECUTION_FLAG) throw new Error('invalid execution flag')
  return { execute: true }
}

function fail(message = 'invalid proof') { throw new Error(message) }
export function validateBucketGates(versioning, publicAccessBlock) {
  const block = publicAccessBlock?.PublicAccessBlockConfiguration
  if (versioning?.Status !== 'Enabled' || block?.BlockPublicAcls !== true || block?.IgnorePublicAcls !== true || block?.BlockPublicPolicy !== true || block?.RestrictPublicBuckets !== true) fail('bucket gate mismatch')
  return true
}
export function classifyCurrentObject(object, baseline, expected = {}) {
  try {
    if (!object || !baseline || !object.head || !object.parsed || !strongEtag(object.head.ETag) || !object.head.VersionId || object.head.ContentType !== DATA_CONSTANTS.contentType || object.head.CacheControl !== DATA_CONSTANTS.cacheControl || object.head.ServerSideEncryption === undefined) return { state: 'unknown' }
    const supplied = ['etag', 'versionId', 'document'].some(key => Object.prototype.hasOwnProperty.call(expected, key)); if (supplied && (!expected.etag || !expected.versionId || !expected.document)) return { state: 'unknown' }
    if (object.head.ETag === DATA_CONSTANTS.baselineEtag && object.head.VersionId === DATA_CONSTANTS.baselineVersionId && Buffer.isBuffer(object.bytes) && Buffer.isBuffer(baseline.bytes) && object.bytes.equals(baseline.bytes) && sha256(object.bytes) === (baseline.sha256 ?? DATA_CONSTANTS.baselineSha256) && object.parsed.tuple === DATA_CONSTANTS.before && exactEqual(object.parsed.document, baseline.parsed.document)) return { state: 'baseline', tuple: DATA_CONSTANTS.before }
    if (object.parsed.tuple !== DATA_CONSTANTS.after || object.head.ETag === DATA_CONSTANTS.baselineEtag || object.head.VersionId === DATA_CONSTANTS.baselineVersionId) return { state: 'unknown' }
    validateOneCellDelta(baseline.parsed.document, object.parsed.document, { requireUpdatedAt: true }); if (!Buffer.isBuffer(object.bytes) || !object.bytes.equals(Buffer.from(JSON.stringify(object.parsed.document)))) return { state: 'unknown' }; if (expected.sha256 && sha256(object.bytes) !== expected.sha256) return { state: 'unknown' }; if (supplied && (object.head.ETag !== expected.etag || object.head.VersionId !== expected.versionId || !exactEqual(object.parsed.document, expected.document) || !object.bytes.equals(Buffer.from(JSON.stringify(expected.document))))) return { state: 'unknown' }
    return { state: 'test', etag: object.head.ETag, versionId: object.head.VersionId, tuple: DATA_CONSTANTS.after, document: clone(object.parsed.document) }
  } catch { return { state: 'unknown' } }
}
export async function validateProtectedMaterial({ fs, parent, run, file, bytes } = {}) {
  const inspect = fs?.lstat ?? fs?.stat; if (typeof inspect !== 'function' || !isAbsolute(parent) || !isAbsolute(run) || !isAbsolute(file)) fail('protected path containment')
  const parentInfo = await inspect(parent); const runInfo = await inspect(run); const fileInfo = await inspect(file); const child = relative(parent, run); const fileChild = relative(run, file)
  if ((parentInfo.mode & 0o777) !== 0o700 || parentInfo.isSymbolicLink?.() || !parentInfo.isDirectory?.() || (runInfo.mode & 0o777) !== 0o700 || runInfo.isSymbolicLink?.() || !runInfo.isDirectory?.() || !child || child.startsWith('..') || dirname(run) !== parent || !child.startsWith('t16-data-') || (fileInfo.mode & 0o777) !== 0o600 || fileInfo.isSymbolicLink?.() || !fileInfo.isFile?.() || !fileChild || fileChild.startsWith('..') || fileChild.includes('/')) fail('protected path containment')
  if (bytes && !(await fs.readFile(file)).equals(bytes)) fail('protected material changed')
  return true
}
export function validateRestoreProof({ response, readback, original, testEtag, testVersionId } = {}) {
  if (!response || !strongEtag(response.ETag) || !response.VersionId || response.ETag === DATA_CONSTANTS.baselineEtag || response.ETag === testEtag || response.VersionId === DATA_CONSTANTS.baselineVersionId || response.VersionId === testVersionId) fail('restore response mismatch')
  if (!readback?.head || readback.head.ETag !== response.ETag || readback.head.VersionId !== response.VersionId || readback.head.ContentType !== DATA_CONSTANTS.contentType || readback.head.CacheControl !== DATA_CONSTANTS.cacheControl || readback.head.ServerSideEncryption === undefined || !Buffer.isBuffer(readback.bytes) || !Buffer.isBuffer(original?.bytes) || !readback.bytes.equals(original.bytes) || readback.bytes.length !== DATA_CONSTANTS.baselineBytes || sha256(readback.bytes) !== DATA_CONSTANTS.baselineSha256 || readback.parsed?.tuple !== DATA_CONSTANTS.before || !exactEqual(readback.parsed.document, original.parsed.document)) fail('restore readback mismatch')
  return true
}
export async function validateProtectedRun({ fs, parent, run } = {}) {
  const inspect = fs?.lstat ?? fs?.stat; if (typeof inspect !== 'function' || !isAbsolute(parent) || !isAbsolute(run)) fail('protected path containment'); const parentPath = resolve(parent); const runPath = resolve(run)
  const parentInfo = await inspect(parentPath); const runInfo = await inspect(runPath); const child = relative(parentPath, runPath)
  if ((parentInfo.mode & 0o777) !== 0o700 || parentInfo.isSymbolicLink?.() || !parentInfo.isDirectory?.() || (runInfo.mode & 0o777) !== 0o700 || runInfo.isSymbolicLink?.() || !runInfo.isDirectory?.() || !child || dirname(runPath) !== parentPath || !child.startsWith('t16-data-')) fail('protected run mismatch')
  return true
}
export function shouldRemoveRecoveryMaterial({ restoreStatus = 'not-required', restoreAttempted = false, recoveryMaterialRetained = false, cleanupFailed = false } = {}) {
  return !cleanupFailed && !recoveryMaterialRetained && (restoreStatus === 'passed' || (restoreStatus === 'not-required' && !restoreAttempted))
}
const cognitoOperations = new Set(['admin-create-user', 'admin-set-user-password', 'admin-add-user-to-group', 'admin-get-user', 'admin-remove-user-from-group', 'admin-delete-user', 'list-users', 'list-users-in-group', 'sts-get-caller-identity'])
const strongEtag = value => typeof value === 'string' && /^"[0-9a-f]{32,}"$/i.test(value)
const safeTimestamp = value => typeof value === 'string' && !Number.isNaN(Date.parse(value)) && value === new Date(value).toISOString()
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const normalizedHeader = (headers, name) => {
  const wanted = name.toLowerCase()
  const entry = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === wanted)
  return typeof entry?.[1] === 'string' ? entry[1].trim().toLowerCase() : ''
}
const headerValue = (headers, name) => {
  const wanted = name.toLowerCase(); const entry = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === wanted)
  return typeof entry?.[1] === 'string' ? entry[1].trim() : ''
}
export async function validateAuthenticatedGetResponse(response, { origin = DATA_CONSTANTS.apiOrigin } = {}) {
  const headers = response.headers(); const url = new URL(response.url()); const expected = new URL(origin)
  if (response.status() !== 200 || url.origin !== expected.origin || url.pathname !== DATA_CONSTANTS.apiPath || normalizedHeader(headers, 'content-type').split(';')[0] !== 'application/json' || normalizedHeader(headers, 'cache-control').split(';')[0] !== 'no-store') fail('authenticated GET contract')
  const payload = await response.json(); if (Object.keys(payload ?? {}).sort().join('|') !== 'document|etag') fail('authenticated GET shape')
  const document = payload.document; const etag = payload.etag; const parsed = parseSchedule(Buffer.from(JSON.stringify(document))); if (!strongEtag(etag) || parsed.tuple !== DATA_CONSTANTS.before) fail('authenticated GET proof')
  return { document: clone(document), etag, tuple: parsed.tuple }
}
function parseSchedule(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 32768) fail('invalid schedule')
  let value
  try { value = JSON.parse(Buffer.from(bytes).toString('utf8')) } catch { fail('invalid schedule') }
  const plain = candidate => candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate) && Object.getPrototypeOf(candidate) === Object.prototype
  if (!plain(value) || Object.keys(value).sort().join('|') !== 'days|schemaVersion|stadium|updatedAt|yearMonth' || value.schemaVersion !== 1 || value.stadium !== 'oda' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.yearMonth) || value.yearMonth !== '2026-08' || !safeTimestamp(value.updatedAt) || !plain(value.days) || Object.keys(value.days).length > 31) fail('invalid schedule')
  const daysInMonth = new Date(Date.UTC(2026, 8, 0)).getUTCDate()
  for (const [date, tuple] of Object.entries(value.days)) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date); const day = Number(match?.[3])
    if (!match || match[1] !== '2026' || match[2] !== '08' || day < 1 || day > daysInMonth || new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, day)).getUTCDate() !== day || !Array.isArray(tuple) || tuple.length !== 3 || !Object.keys(tuple).every(key => ['0', '1', '2'].includes(key)) || tuple.some(item => !Number.isInteger(item) || ![0, 1, 2].includes(item))) fail('invalid schedule')
  }
  const tuple = value.days[DATA_CONSTANTS.date]
  if (!Array.isArray(tuple) || tuple.length !== 3 || tuple.some(item => !Number.isInteger(item) || item < 0 || item > 2)) fail('invalid schedule')
  return { document: value, tuple: tuple[DATA_CONSTANTS.slot] }
}
const clone = value => JSON.parse(JSON.stringify(value))
function exactEqual(left, right) {
  if (Object.is(left, right)) return true
  if (typeof left !== typeof right || left === null || right === null) return false
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => exactEqual(item, right[index]))
  if (typeof left !== 'object') return false
  const leftKeys = Object.keys(left).sort(); const rightKeys = Object.keys(right).sort()
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && exactEqual(left[key], right[key]))
}
export function validateOneCellDelta(baseline, candidate, { requireUpdatedAt = false } = {}) {
  if (!baseline || !candidate || typeof baseline !== 'object' || typeof candidate !== 'object') fail('document delta mismatch')
  const expected = clone(baseline); const baselineUpdatedAt = expected.updatedAt; delete expected.updatedAt
  const actual = clone(candidate); const actualUpdatedAt = actual.updatedAt; delete actual.updatedAt
  if (Object.keys(actual).sort().join('|') !== Object.keys(expected).sort().join('|')) fail('document shape mismatch')
  expected.days[DATA_CONSTANTS.date][DATA_CONSTANTS.slot] = DATA_CONSTANTS.after
  if (!exactEqual(actual, expected) || baseline.days?.[DATA_CONSTANTS.date]?.[DATA_CONSTANTS.slot] !== DATA_CONSTANTS.before) fail('document delta mismatch')
  if (requireUpdatedAt && (!safeTimestamp(actualUpdatedAt) || actualUpdatedAt === baselineUpdatedAt)) fail('server timestamp mismatch')
  return candidate
}
function exactObject(value, keys, predicate) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|') || !predicate(value)) fail()
  return value
}

function proof(stage, value) {
  if (stage === 'preflight') return exactObject(value, ['users', 'admins', 'bytes', 'etag', 'versionId', 'sha256', 'tuple'], v => v.users === 0 && v.admins === 0 && v.bytes === DATA_CONSTANTS.baselineBytes && v.etag === DATA_CONSTANTS.baselineEtag && v.versionId === DATA_CONSTANTS.baselineVersionId && v.sha256 === DATA_CONSTANTS.baselineSha256 && v.tuple === DATA_CONSTANTS.before)
  if (stage === 'capture') return exactObject(value, ['bytes', 'sha256', 'etag', 'versionId'], v => v.bytes === DATA_CONSTANTS.baselineBytes && v.sha256 === DATA_CONSTANTS.baselineSha256 && v.etag === DATA_CONSTANTS.baselineEtag && v.versionId === DATA_CONSTANTS.baselineVersionId)
  if (stage === 'setup') return exactObject(value, ['contexts'], v => v.contexts === 2)
  if (stage === 'load') return exactObject(value, ['adminEtag', 'staleEtag', 'tuple'], v => v.adminEtag === DATA_CONSTANTS.baselineEtag && v.staleEtag === DATA_CONSTANTS.baselineEtag && v.tuple === DATA_CONSTANTS.before)
  if (stage === 'update') return exactObject(value, ['status', 'etag', 'versionId', 'cacheControl', 'updatedAt', 'document', 'tuple', 'puts'], v => v.status === 200 && strongEtag(v.etag) && v.etag !== DATA_CONSTANTS.baselineEtag && typeof v.versionId === 'string' && v.versionId.length > 0 && v.cacheControl === 'no-store' && safeTimestamp(v.updatedAt) && v.document?.days?.[DATA_CONSTANTS.date]?.[DATA_CONSTANTS.slot] === DATA_CONSTANTS.after && v.tuple === DATA_CONSTANTS.after && v.puts === 1)
  if (stage === 'stale') return exactObject(value, ['status', 'etag', 'cacheControl', 'puts', 'retries', 'tuple'], v => v.status === 409 && strongEtag(v.etag) && v.cacheControl === 'no-store' && v.puts === 1 && v.retries === 0 && v.tuple === DATA_CONSTANTS.after)
  if (stage === 'public-updated' || stage === 'public-restored') return exactObject(value, ['tuple', 'attempts'], v => v.tuple === (stage === 'public-updated' ? DATA_CONSTANTS.after : DATA_CONSTANTS.before) && Number.isInteger(v.attempts) && v.attempts >= 1)
  if (stage === 'restore') return exactObject(value, ['status', 'etag', 'versionId', 'bytes', 'sha256', 'tuple'], v => v.status === 200 && typeof v.etag === 'string' && typeof v.versionId === 'string' && v.etag !== DATA_CONSTANTS.baselineEtag && v.versionId !== DATA_CONSTANTS.baselineVersionId && v.bytes === DATA_CONSTANTS.baselineBytes && v.sha256 === DATA_CONSTANTS.baselineSha256 && v.tuple === DATA_CONSTANTS.before)
  if (stage === 'cleanup') { if (value && Object.keys(value).sort().join('|') === 'admins|recoveryMaterialRetained|users') return exactObject(value, ['users', 'admins', 'recoveryMaterialRetained'], v => v.users === 0 && v.admins === 0 && typeof v.recoveryMaterialRetained === 'boolean'); return exactObject(value, ['users', 'admins'], v => v.users === 0 && v.admins === 0) }
  return value
}

export async function runDataRehearsal(adapters) {
  const counts = { operations: 0, writes: 0, restores: 0, cleanups: 0, polls: 0 }
  let lastCheckpoint = 'preflight'; let failureCheckpoint = null; let failure = null; let writePossible = false; let restoreAttempted = false
  let original = null; let recoveryOriginal = null; let testEtag; let testVersionId; let recoveryMaterialRetained = false; let failureCategory = 'typed-failure'
  let writeStatus = 'not-started'; let staleStatus = 'not-started'; let restoreStatus = 'not-required'; let cleanupStatus = 'not-started'
  const invoke = async (stage, fn, count = true) => { lastCheckpoint = stage; if (count) counts.operations += 1; const value = await fn(); proof(stage, value); return value }
  try {
    await invoke('preflight', adapters.preflight)
    original = await invoke('capture', adapters.capture)
    recoveryOriginal = typeof adapters.getOriginal === 'function' ? adapters.getOriginal() : original
    await invoke('setup', adapters.setup)
    await invoke('load', adapters.load)
    // Mark the operation possible before entering the boundary. A transport
    // failure can leave S3 changed even when no response was received.
    writePossible = true; counts.operations += 1; lastCheckpoint = 'update'
    let updated
    try { updated = proof('update', await adapters.update({ date: DATA_CONSTANTS.date, slot: DATA_CONSTANTS.slot, from: DATA_CONSTANTS.before, to: DATA_CONSTANTS.after, ifMatch: DATA_CONSTANTS.baselineEtag })) } catch (error) {
      if (typeof adapters.readCurrent !== 'function') throw error
      const current = await adapters.readCurrent()
      if (current.state === 'baseline') { writePossible = false; throw error }
      if (current.state === 'test') { testEtag = current.etag; testVersionId = current.versionId; throw error }
      recoveryMaterialRetained = true
      writePossible = false
      failureCategory = 'recovery-required'; throw new Error('recovery-required')
    }
    counts.writes += 1; writeStatus = 'passed'; testEtag = updated.etag; testVersionId = updated.versionId
    staleStatus = 'started'; const stale = await invoke('stale', () => adapters.stale({ ifMatch: DATA_CONSTANTS.baselineEtag, date: DATA_CONSTANTS.date, slot: DATA_CONSTANTS.slot, value: DATA_CONSTANTS.after })); staleStatus = stale.status === 409 ? 'passed' : 'failed'
    if (typeof adapters.readCurrent !== 'function') throw new Error('current readback unavailable')
    const current = await adapters.readCurrent({ state: 'test', etag: testEtag, versionId: testVersionId, document: updated.document })
    if (current.state !== 'test' || current.etag !== testEtag || current.versionId !== testVersionId || current.tuple !== DATA_CONSTANTS.after || !current.document || !exactEqual(current.document, updated.document)) throw new Error('current coupling mismatch')
    counts.polls += 1; await invoke('public-updated', () => adapters.poll({ expected: DATA_CONSTANTS.after, maxAttempts: 60, maxMs: 70000 }), false)
    lastCheckpoint = 'restore'; counts.operations += 1; restoreAttempted = true; counts.restores += 1; restoreStatus = 'started'; const restored = proof('restore', await adapters.restore({ ifMatch: testEtag, versionId: testVersionId, original: recoveryOriginal })); restoreStatus = 'passed'; writePossible = false
    counts.polls += 1; await invoke('public-restored', () => adapters.poll({ expected: DATA_CONSTANTS.before, maxAttempts: 60, maxMs: 70000 }), false); lastCheckpoint = 'cleanup'
  } catch (error) {
    failureCheckpoint = lastCheckpoint; failure = { checkpoint: lastCheckpoint, category: failureCategory }
    if (restoreAttempted && restoreStatus === 'started') { restoreStatus = 'failed'; recoveryMaterialRetained = true }
    if (writePossible && !restoreAttempted) {
      lastCheckpoint = 'restore'; restoreAttempted = true; counts.restores += 1; restoreStatus = 'started'
      try { proof('restore', await adapters.restore({ ifMatch: testEtag, versionId: testVersionId, original: recoveryOriginal, recovery: true })); restoreStatus = 'passed'; writePossible = false } catch { restoreStatus = 'failed'; recoveryMaterialRetained = true }
    }
  } finally {
    lastCheckpoint = 'cleanup'; counts.operations += 1; counts.cleanups += 1
    try { const cleaned = proof('cleanup', await adapters.cleanup({ restoreStatus, restoreAttempted, recoveryMaterialRetained })); if (cleaned.recoveryMaterialRetained === true) recoveryMaterialRetained = true; cleanupStatus = 'passed' } catch { cleanupStatus = 'failed'; recoveryMaterialRetained = true }
  }
  const status = restoreStatus === 'failed' || cleanupStatus === 'failed' ? 'failed' : failure ? 'failed' : 'success'
  return { status, lastCheckpoint: status === 'success' ? 'complete' : lastCheckpoint, failureCheckpoint, counts, writeStatus, staleStatus, restoreStatus, cleanupStatus, recoveryMaterialRetained, failure }
}

export function safeArgs(operation, { inputPath, ifMatch, checksum } = {}) {
  if (!['head-object', 'get-object', 'put-object'].includes(operation)) fail('forbidden data operation')
  const base = ['s3api', operation, '--bucket', DATA_CONSTANTS.bucket, '--key', DATA_CONSTANTS.key]
  if (operation === 'get-object') { if (typeof inputPath !== 'string') fail('protected output required'); return [...base, inputPath] }
  if (operation === 'put-object') {
    if (typeof inputPath !== 'string' || typeof ifMatch !== 'string' || typeof checksum !== 'string') fail('protected restore arguments required')
    return [...base, '--body', inputPath, '--if-match', ifMatch, '--content-type', DATA_CONSTANTS.contentType, '--cache-control', DATA_CONSTANTS.cacheControl, '--checksum-algorithm', 'SHA256', '--checksum-sha256', checksum]
  }
  return base
}
export function safeBucketArgs(operation) {
  if (!['get-bucket-versioning', 'get-public-access-block'].includes(operation)) fail('forbidden bucket operation')
  return ['s3api', operation, '--bucket', DATA_CONSTANTS.bucket]
}

export function createProtectedDataCli({ execFile = promisify(nodeExecFile) } = {}) {
  const env = { AWS_PROFILE: DATA_CONSTANTS.profile, AWS_REGION: DATA_CONSTANTS.region, AWS_DEFAULT_REGION: DATA_CONSTANTS.region, PATH: process.env.PATH ?? '' }
  return async (operation, options = {}) => execFile('aws', ['get-bucket-versioning', 'get-public-access-block'].includes(operation) ? safeBucketArgs(operation) : safeArgs(operation, options), { env, windowsHide: true })
}

export function createProtectedDataFile({ fs = { mkdtemp, chmod, writeFile, readFile, unlink, rm }, randomBytesImpl = randomBytes } = {}) {
  return async (bytes) => { const root = await fs.mkdtemp(join(tmpdir(), 't16-data-')); await fs.chmod(root, 0o700); const path = join(root, `original-${randomBytesImpl(8).toString('hex')}.json`); const child = relative(resolve(root), resolve(path)); if (!isAbsolute(root) || child.startsWith('..')) fail('protected path containment'); try { await fs.writeFile(path, bytes, { mode: 0o600, flag: 'wx' }); await fs.chmod(path, 0o600); return { root, path } } catch (error) { await fs.unlink(path).catch(() => {}); await fs.rm(root, { recursive: true, force: true }).catch(() => {}); throw error } }
}

function json(stdout) { try { return JSON.parse(stdout ?? '') } catch { fail('invalid protected response') } }

function makeProtectedCognitoCli({ execFile = promisify(nodeExecFile), fs }) {
  const env = { AWS_PROFILE: DATA_CONSTANTS.profile, AWS_REGION: DATA_CONSTANTS.region, AWS_DEFAULT_REGION: DATA_CONSTANTS.region, PATH: process.env.PATH ?? '' }
  return async (operation, payload, { root, jsonOutput = false } = {}) => {
    if (!cognitoOperations.has(operation)) fail('forbidden cognito operation')
    if (operation === 'sts-get-caller-identity') {
      const result = await execFile('aws', ['sts', 'get-caller-identity'], { env, windowsHide: true })
      return jsonOutput ? json(result.stdout) : result
    }
    let args = ['cognito-idp', operation, '--user-pool-id', DATA_CONSTANTS.poolId]
    if (operation === 'list-users-in-group') args.push('--group-name', 'admins')
    if (payload) {
      if (!root) fail('protected cognito root required')
      const path = join(root, `cognito-${randomBytes(8).toString('hex')}.json`)
      await fs.writeFile(path, JSON.stringify(payload), { mode: 0o600, flag: 'wx' }); await fs.chmod(path, 0o600)
      try { args = ['cognito-idp', operation, '--cli-input-json', `file://${path}`]; const result = await execFile('aws', args, { env, windowsHide: true }); return jsonOutput ? json(result.stdout) : result } finally { await fs.unlink(path).catch(() => {}) }
    }
    const result = await execFile('aws', args, { env, windowsHide: true }); return jsonOutput ? json(result.stdout) : result
  }
}

async function defaultBrowserLauncher() {
  const { chromium } = await import('playwright')
  return chromium.launch({ headless: true })
}

export function createPlaywrightDataBrowser({ launcher = defaultBrowserLauncher, origin = DATA_CONSTANTS.apiOrigin, fetchImpl = globalThis.fetch, clock = () => globalThis.performance?.now?.() ?? Date.now(), sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), timer = setTimeout, clearTimer = clearTimeout } = {}) {
  let chromium; let contexts = []; let pages = []; let loaded = []; let accepted = null
  const pageFor = index => { const page = pages[index]; if (!page) fail('browser context unavailable'); return page }
  return {
    async setup({ username, password } = {}) {
      if (typeof username !== 'string' || typeof password !== 'string') fail('browser credentials unavailable')
      chromium = await launcher(); contexts = [await chromium.newContext(), await chromium.newContext()]; pages = await Promise.all(contexts.map(context => context.newPage()))
      const getResponses = pages.map(page => page.waitForResponse(response => { try { const url = new URL(response.url()); return url.origin === new URL(origin).origin && url.pathname === DATA_CONSTANTS.apiPath && response.request().method() === 'GET' } catch { return false } }))
      for (const page of pages) { await page.goto(`${origin}/manage`, { waitUntil: 'domcontentloaded' }); await runBrowserRoleSession(page, { username, password, viewport: 'desktop' }); await page.waitForURL(url => new URL(url).pathname === '/manage'); await awaitSignedInSentinel(page, { viewport: 'desktop' }) }
      loaded = await Promise.all(getResponses.map(response => validateAuthenticatedGetResponse(response, { origin })))
      return { contexts: 2 }
    },
    async load({ etag }) { if (typeof etag !== 'string' || loaded.length !== 2 || loaded.some(result => result.etag !== etag)) fail('browser baseline mismatch'); return { adminEtag: loaded[0].etag, staleEtag: loaded[1].etag, tuple: DATA_CONSTANTS.before } },
    async update(input) { return this.submit(pageFor(0), input, DATA_CONSTANTS.after) },
    async stale(input) { return this.submit(pageFor(1), input, DATA_CONSTANTS.after, true) },
    async submit(page, input, value, stale = false) { const index = pages.indexOf(page); const baseline = loaded[index]?.document ?? input.baselineDocument; if (!baseline) fail('page baseline unavailable'); const expectedOrigin = new URL(origin).origin; const cell = page.locator(`#${DATA_CONSTANTS.date}-${DATA_CONSTANTS.slot}`); await cell.selectOption(String(value)); const matches = request => { try { const url = new URL(request.url()); return url.origin === expectedOrigin && url.pathname === DATA_CONSTANTS.apiPath && request.method() === 'PUT' } catch { return false } }; let requestCount = 0; const onRequest = request => { if (matches(request)) requestCount += 1 }; page.on?.('request', onRequest); const requestPromise = page.waitForRequest(matches); const responsePromise = page.waitForResponse(response => { try { const url = new URL(response.url()); return url.origin === expectedOrigin && url.pathname === DATA_CONSTANTS.apiPath && response.request().method() === 'PUT' } catch { return false } }); const comparisonPromise = stale ? page.waitForResponse(response => { try { const url = new URL(response.url()); return url.origin === expectedOrigin && url.pathname === DATA_CONSTANTS.apiPath && response.request().method() === 'GET' } catch { return false } }) : null; try { await page.getByRole('button', { name: /Save|保存/ }).click(); const request = await requestPromise; const response = await responsePromise; const requestUrl = new URL(request.url()); const responseUrl = new URL(response.url()); const headers = request.headers(); const body = request.postDataJSON(); if (requestUrl.origin !== expectedOrigin || requestUrl.pathname !== DATA_CONSTANTS.apiPath || responseUrl.origin !== expectedOrigin || responseUrl.pathname !== DATA_CONSTANTS.apiPath || requestCount !== 1 || normalizedHeader(headers, 'content-type').split(';')[0] !== 'application/json' || headerValue(headers, 'if-match') !== input.ifMatch || headerValue(headers, 'if-none-match') || !body || Object.keys(body).sort().join('|') !== 'days|schemaVersion|stadium|yearMonth' || body.schemaVersion !== 1 || body.stadium !== 'oda' || body.yearMonth !== '2026-08') fail('UI PUT contract'); validateOneCellDelta({ ...baseline, updatedAt: undefined }, { ...body, updatedAt: undefined }); const cacheControl = normalizedHeader(response.headers(), 'cache-control').split(';')[0]; if (response.status() === 409) { if (normalizedHeader(response.headers(), 'content-type').split(';')[0] !== 'application/json') fail('conflict contract'); if (!stale || cacheControl !== 'no-store') fail('conflict contract'); const comparison = await comparisonPromise; if (comparison.status() !== 200 || new URL(comparison.url()).origin !== expectedOrigin || new URL(comparison.url()).pathname !== DATA_CONSTANTS.apiPath || normalizedHeader(comparison.headers(), 'content-type').split(';')[0] !== 'application/json' || normalizedHeader(comparison.headers(), 'cache-control').split(';')[0] !== 'no-store') fail('comparison contract'); const current = await comparison.json(); if (Object.keys(current ?? {}).sort().join('|') !== 'document|etag' || !strongEtag(current?.etag) || !accepted || current.etag !== accepted.etag || !exactEqual(current.document, accepted.document)) fail('comparison mismatch'); const conflictHeading = page.getByRole?.('heading', { name: /conflict|競合/i }); const conflictButton = page.getByRole?.('button', { name: /rebase|replace|latest|再適用|置き換え|最新/i }); if (!conflictHeading || !conflictButton || !(await conflictHeading.isVisible().catch(() => false)) || !(await conflictButton.isVisible().catch(() => false))) fail('conflict UI missing'); return { status: 409, etag: current.etag, cacheControl, puts: 1, retries: 0, tuple: value } } const result = await response.json(); if (normalizedHeader(response.headers(), 'content-type').split(';')[0] !== 'application/json') fail('UI response contract'); if (response.status() !== 200 || cacheControl !== 'no-store' || Object.keys(result ?? {}).sort().join('|') !== 'document|etag|versionId' || typeof result.versionId !== 'string' || !result.versionId) fail('update contract'); validateOneCellDelta(baseline, result.document, { requireUpdatedAt: true }); const etag = result.etag; if (!strongEtag(etag)) fail('update etag'); const document = result.document; const parsed = parseSchedule(Buffer.from(JSON.stringify(document))); accepted = { document: clone(document), etag, versionId: result.versionId }; return { status: 200, etag, versionId: result.versionId, cacheControl, updatedAt: document.updatedAt, document, tuple: parsed.tuple, puts: 1 } } finally { page.off?.('request', onRequest) } },
    async poll({ expected, maxAttempts = 60, maxMs = 70000 } = {}) {
      if (![DATA_CONSTANTS.before, DATA_CONSTANTS.after].includes(expected) || !Number.isInteger(maxAttempts) || maxAttempts < 1 || !Number.isFinite(maxMs) || maxMs <= 0 || typeof fetchImpl !== 'function') fail('observation contract')
      const url = `${origin}/${DATA_CONSTANTS.key}`; const started = clock(); const deadline = started + maxMs; let attempts = 0
      const settle = promise => { Promise.resolve(promise).catch(() => {}); return promise }
      const remaining = () => Math.max(0, deadline - clock())
      const raceDeadline = (promise, controller) => new Promise((resolve, reject) => {
        const ms = remaining(); if (ms <= 0) { controller?.abort(); reject(new Error('observation deadline')); return }
        const timeoutId = timer(() => { controller?.abort(); reject(new Error('observation deadline')) }, ms)
        settle(promise).then(resolve, reject).finally(() => { clearTimer(timeoutId) })
      })
      const readBody = async (response, signal) => {
        const length = Number(response.headers?.get?.('content-length')); if (Number.isFinite(length) && length > 32768) fail('public response too large')
        if (response.body?.getReader) { const reader = response.body.getReader({ signal }); let cancelled = false; const cancel = () => { if (!cancelled) { cancelled = true; Promise.resolve(reader.cancel?.()).catch(() => {}) } }; signal?.addEventListener('abort', cancel, { once: true }); const parts = []; let size = 0; try { for (;;) { const next = await reader.read(); if (next.done) break; const chunk = Buffer.from(next.value); size += chunk.length; if (size > 32768) { cancel(); fail('public response too large') } parts.push(chunk) } } finally { signal?.removeEventListener('abort', cancel); reader.releaseLock?.() } return Buffer.concat(parts) }
        if (typeof response.arrayBuffer !== 'function') fail('public response body unavailable'); const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.length > 32768) fail('public response too large'); return bytes
      }
      try {
        for (attempts = 1; attempts <= maxAttempts && remaining() > 0; attempts += 1) {
          const controller = new AbortController()
          try {
            const response = await raceDeadline(fetchImpl(url, { method: 'GET', cache: 'no-store', credentials: 'omit', headers: { accept: DATA_CONSTANTS.contentType }, signal: controller.signal }), controller)
            const type = response.headers?.get?.('content-type')?.split(';')[0].trim().toLowerCase(); const cache = response.headers?.get?.('cache-control')?.trim().toLowerCase()
            if (response.status !== 200 || type !== DATA_CONSTANTS.contentType || cache !== DATA_CONSTANTS.cacheControl) fail('public response contract')
            const body = await raceDeadline(readBody(response, controller.signal), controller); const parsed = parseSchedule(body)
            if (parsed.tuple === expected) return { tuple: expected, attempts }
          } catch (error) { if (/invalid schedule|public response contract|public response too large|public response body unavailable/.test(error?.message ?? '') || remaining() <= 0) throw error } finally { controller.abort() }
          const delay = Math.min(1000, remaining()); if (delay <= 0) break
          await raceDeadline(sleep(delay), undefined)
        }
      } catch { fail('observation timeout') }
      fail('observation timeout')
    },
    async cleanup() { for (const context of contexts) await context.close().catch(() => {}); await chromium?.close?.().catch?.(() => {}) },
  }
}

/*
 * The browser boundary is deliberately small. The real runner supplies a
 * Playwright-backed object; tests supply a deterministic object with these
 * same methods. No request body, URL, token, or browser object crosses the
 * coordinator boundary.
 */
export function createConcreteDataAdapters({ command, execFile, browser, browserLauncher = defaultBrowserLauncher, fetchImpl = globalThis.fetch, clock = () => globalThis.performance?.now?.() ?? Date.now(), sleep, timer = setTimeout, clearTimer = clearTimeout, fs: fsPort, randomBytesImpl = randomBytes } = {}) {
  const fs = fsPort ?? { mkdtemp, chmod, writeFile, readFile, unlink, rm, stat, lstat, mkdir }
  command ??= createProtectedDataCli({ execFile: execFile ?? promisify(nodeExecFile) })
  const run = typeof command === 'function' ? command : command?.run
  if (typeof run !== 'function') fail('invalid protected command')
  const cognito = makeProtectedCognitoCli({ execFile: execFile ?? promisify(nodeExecFile), fs }); let root; let currentOriginal; let identity; let captureCounter = 0; const browserPort = browser ?? createPlaywrightDataBrowser({ launcher: browserLauncher, fetchImpl, clock, sleep, timer, clearTimer })
  const protectedRoot = async () => { if (!root) { const parent = resolve('.artifacts/migration'); await fs.mkdir(parent, { recursive: true, mode: 0o700 }); await fs.chmod(parent, 0o700); const parentInfo = await (fs.lstat ?? fs.stat)(parent); if ((parentInfo.mode & 0o777) !== 0o700 || parentInfo.isSymbolicLink?.()) fail('protected parent mode'); root = await fs.mkdtemp(join(parent, 't16-data-')); await fs.chmod(root, 0o700); const rootInfo = await (fs.lstat ?? fs.stat)(root); if ((rootInfo.mode & 0o777) !== 0o700 || rootInfo.isSymbolicLink?.()) fail('protected run mode') } return root }
  const readObject = async ({ retain = false, allowTest = false } = {}) => {
    const dir = await protectedRoot(); const path = join(dir, `capture-${captureCounter += 1}-${randomBytesImpl(8).toString('hex')}.json`); const child = relative(resolve(dir), resolve(path)); if (!isAbsolute(dir) || child.startsWith('..')) fail('protected path containment')
    const dirInfo = await (fs.lstat ?? fs.stat)(dir); if ((dirInfo.mode & 0o777) !== 0o700 || dirInfo.isSymbolicLink?.()) fail('protected directory mode')
    await fs.writeFile(path, Buffer.alloc(0), { mode: 0o600, flag: 'wx' }); await fs.chmod(path, 0o600)
    try {
      const head = json((await run('head-object')).stdout); await run('get-object', { inputPath: path }); const info = await (fs.lstat ?? fs.stat)(path); if ((info.mode & 0o777) !== 0o600 || info.isSymbolicLink?.() || (allowTest ? info.size > 32768 : info.size !== DATA_CONSTANTS.baselineBytes)) fail('protected capture mismatch'); const bytes = await fs.readFile(path); const parsed = parseSchedule(bytes)
      if ((allowTest ? bytes.length > 32768 : bytes.length !== DATA_CONSTANTS.baselineBytes) || !strongEtag(head.ETag) || typeof head.VersionId !== 'string' || !head.VersionId || head.ContentType !== DATA_CONSTANTS.contentType || head.CacheControl !== DATA_CONSTANTS.cacheControl || head.ServerSideEncryption === undefined || (!allowTest && (sha256(bytes) !== DATA_CONSTANTS.baselineSha256 || head.ETag !== DATA_CONSTANTS.baselineEtag || head.VersionId !== DATA_CONSTANTS.baselineVersionId || !exactEqual(parsed.document, currentOriginal?.parsed?.document ?? parsed.document)))) fail('protected capture mismatch')
      return { path, bytes, sha256: sha256(bytes), head, parsed }
    } finally { if (!retain) await fs.unlink(path).catch(() => {}) }
  }
  const browserCall = async (method, input) => { if (!browserPort || typeof browserPort[method] !== 'function') fail('browser method unavailable'); return browserPort[method](input) }
  return {
    async preflight() {
      const caller = await cognito('sts-get-caller-identity', null, { jsonOutput: true }); if (caller?.Account !== DATA_CONSTANTS.account) fail('account mismatch')
      const users = await cognito('list-users', null, { jsonOutput: true }); const admins = await cognito('list-users-in-group', null, { jsonOutput: true }); if ((users?.Users?.length ?? -1) !== 0 || (admins?.Users?.length ?? -1) !== 0) fail('nonempty identity gate')
      const versioning = json((await run('get-bucket-versioning')).stdout); const publicBlock = json((await run('get-public-access-block')).stdout); validateBucketGates(versioning, publicBlock)
      const object = await readObject({ retain: true }); const head = object.head; if (head.ContentType !== DATA_CONSTANTS.contentType || head.CacheControl !== DATA_CONSTANTS.cacheControl || head.ServerSideEncryption === undefined) fail('object metadata mismatch')
      currentOriginal = object; return { users: 0, admins: 0, bytes: object.bytes.length, etag: head.ETag, versionId: head.VersionId, sha256: sha256(object.bytes), tuple: object.parsed.tuple }
    },
    async capture() { const object = await readObject({ retain: true }); currentOriginal = object; return { bytes: object.bytes.length, sha256: sha256(object.bytes), etag: object.head.ETag, versionId: object.head.VersionId } },
    getOriginal() { return currentOriginal },
    async setup() {
      const dir = await protectedRoot(); const suffix = randomBytesImpl(8).toString('hex'); const alias = `preview-t16-data-${suffix}@rehearsal.invalid`; const password = `Aa1!${randomBytesImpl(24).toString('hex')}`
      const created = await cognito('admin-create-user', { UserPoolId: DATA_CONSTANTS.poolId, Username: alias, MessageAction: 'SUPPRESS' }, { root: dir, jsonOutput: true }); identity = created?.User?.Username; if (typeof identity !== 'string' || !identity) fail('internal username missing')
      await cognito('admin-set-user-password', { UserPoolId: DATA_CONSTANTS.poolId, Username: identity, Password: password, Permanent: true }, { root: dir }); await cognito('admin-add-user-to-group', { UserPoolId: DATA_CONSTANTS.poolId, Username: identity, GroupName: 'admins' }, { root: dir })
      const verified = await cognito('admin-get-user', { UserPoolId: DATA_CONSTANTS.poolId, Username: identity }, { root: dir, jsonOutput: true }); if (verified?.Username !== identity) fail('internal username mismatch')
      return browserCall('setup', { contexts: 2, username: alias, password })
    },
    async load(input) { return browserCall('load', input) }, async update(input) { return browserCall('update', input) }, async stale(input) { return browserCall('stale', input) }, async poll(input) { return browserCall('poll', input) },
    async readCurrent(expected = {}) { let object; try { object = await readObject({ allowTest: true }) } catch { return { state: 'unknown' } } return classifyCurrentObject(object, currentOriginal, expected) },
    async restore({ ifMatch, versionId, original = currentOriginal } = {}) {
      if (!original?.path || !ifMatch) fail('restore proof unavailable'); await validateProtectedMaterial({ fs, parent: resolve('.artifacts/migration'), run: dirname(original.path), file: original.path, bytes: original.bytes }); const checksum = createHash('sha256').update(original.bytes).digest('base64'); const result = await run('put-object', { inputPath: original.path, ifMatch, checksum }); const response = json(result.stdout); const readback = await readObject({ allowTest: true }); validateRestoreProof({ response, readback, original, testEtag: ifMatch, testVersionId: versionId }); return { status: 200, etag: response.ETag, versionId: response.VersionId, bytes: readback.bytes.length, sha256: sha256(readback.bytes), tuple: readback.parsed.tuple }
    },
    async cleanup({ restoreStatus = 'not-required', restoreAttempted = false, recoveryMaterialRetained = false } = {}) { let failed = false; try { await browserCall('cleanup', {}) } catch { failed = true; recoveryMaterialRetained = true } const dir = identity ? await protectedRoot() : root; if (identity) { await cognito('admin-remove-user-from-group', { UserPoolId: DATA_CONSTANTS.poolId, Username: identity, GroupName: 'admins' }, { root: dir }).catch(() => { failed = true; recoveryMaterialRetained = true }); await cognito('admin-delete-user', { UserPoolId: DATA_CONSTANTS.poolId, Username: identity }, { root: dir }).catch(() => { failed = true; recoveryMaterialRetained = true }) } let users = -1; let admins = -1; try { users = (await cognito('list-users', null, { jsonOutput: true }))?.Users?.length ?? -1 } catch { failed = true; recoveryMaterialRetained = true } try { admins = (await cognito('list-users-in-group', null, { jsonOutput: true }))?.Users?.length ?? -1 } catch { failed = true; recoveryMaterialRetained = true } if (users !== 0 || admins !== 0) failed = true; const removable = shouldRemoveRecoveryMaterial({ restoreStatus, restoreAttempted, recoveryMaterialRetained, cleanupFailed: failed }); if (root && removable) { try { const parent = resolve('.artifacts/migration'); await validateProtectedRun({ fs, parent, run: root }); await fs.rm(root, { recursive: true, force: true }) } catch { failed = true; recoveryMaterialRetained = true } } if (failed) fail('cleanup failed'); return { users, admins, recoveryMaterialRetained } },
  }
}

export async function main(argv = process.argv.slice(2), dependencies = {}) { parseDataArgs(argv); if (dependencies.adapters && dependencies.testOnly !== true) throw new Error('complete adapter injection is test-only'); return runDataRehearsal(dependencies.adapters ?? createConcreteDataAdapters(dependencies)) }
export async function runDirect({ argv = process.argv.slice(2), dependencies = {}, stdout = value => process.stdout.write(value), stderr = value => process.stderr.write(value), setExitCode = value => { process.exitCode = value } } = {}) {
  try { const result = await main(argv, dependencies); stdout(`${JSON.stringify(result)}\n`); setExitCode(result.status === 'success' ? 0 : 1); return result }
  catch { stderr('{"status":"failed","category":"operation-failed"}\n'); setExitCode(1); return null }
}
if (import.meta.url === `file://${process.argv[1]}`) runDirect()

export { createHash, readFile }
