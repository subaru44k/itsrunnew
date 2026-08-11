import { randomBytes } from 'node:crypto'
import { execFile as nodeExecFile } from 'node:child_process'
import { mkdtemp, chmod, writeFile, readFile, unlink, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, relative, isAbsolute } from 'node:path'
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
const cognitoOperations = new Set(['admin-create-user', 'admin-set-user-password', 'admin-add-user-to-group', 'admin-get-user', 'admin-remove-user-from-group', 'admin-delete-user', 'list-users', 'list-users-in-group', 'sts-get-caller-identity'])
const strongEtag = value => typeof value === 'string' && /^"[0-9a-f]{32,}"$/i.test(value)
const safeTimestamp = value => typeof value === 'string' && !Number.isNaN(Date.parse(value)) && value === new Date(value).toISOString()
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
function parseSchedule(bytes) {
  let value
  try { value = JSON.parse(Buffer.from(bytes).toString('utf8')) } catch { fail('invalid schedule') }
  if (!value || value.schemaVersion !== 1 || value.stadium !== 'oda' || value.yearMonth !== '2026-08' || !safeTimestamp(value.updatedAt) || !value.days || typeof value.days !== 'object') fail('invalid schedule')
  const tuple = value.days[DATA_CONSTANTS.date]
  if (!Array.isArray(tuple) || tuple.length !== 3 || tuple.some(item => !Number.isInteger(item) || item < 0 || item > 2)) fail('invalid schedule')
  return { document: value, tuple: tuple[DATA_CONSTANTS.slot] }
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
  if (stage === 'update') return exactObject(value, ['status', 'etag', 'versionId', 'cacheControl', 'updatedAt', 'tuple', 'puts'], v => v.status === 200 && strongEtag(v.etag) && v.etag !== DATA_CONSTANTS.baselineEtag && typeof v.versionId === 'string' && v.versionId.length > 0 && v.cacheControl === 'no-store' && safeTimestamp(v.updatedAt) && v.tuple === DATA_CONSTANTS.after && v.puts === 1)
  if (stage === 'stale') return exactObject(value, ['status', 'etag', 'versionId', 'cacheControl', 'puts', 'retries', 'tuple'], v => v.status === 409 && strongEtag(v.etag) && typeof v.versionId === 'string' && v.versionId.length > 0 && v.cacheControl === 'no-store' && v.puts === 1 && v.retries === 0 && v.tuple === DATA_CONSTANTS.after)
  if (stage === 'public-updated' || stage === 'public-restored') return exactObject(value, ['tuple', 'attempts'], v => v.tuple === (stage === 'public-updated' ? DATA_CONSTANTS.after : DATA_CONSTANTS.before) && Number.isInteger(v.attempts) && v.attempts >= 1)
  if (stage === 'restore') return exactObject(value, ['status', 'etag', 'versionId', 'bytes', 'sha256', 'tuple'], v => v.status === 200 && typeof v.etag === 'string' && typeof v.versionId === 'string' && v.etag !== DATA_CONSTANTS.baselineEtag && v.versionId !== DATA_CONSTANTS.baselineVersionId && v.bytes === DATA_CONSTANTS.baselineBytes && v.sha256 === DATA_CONSTANTS.baselineSha256 && v.tuple === DATA_CONSTANTS.before)
  if (stage === 'cleanup') return exactObject(value, ['users', 'admins'], v => v.users === 0 && v.admins === 0)
  return value
}

export async function runDataRehearsal(adapters) {
  const counts = { operations: 0, writes: 0, restores: 0, cleanups: 0, polls: 0 }
  let lastCheckpoint = 'preflight'; let failureCheckpoint = null; let failure = null; let writePossible = false; let restoreAttempted = false
  let original = null; let recoveryOriginal = null; let testEtag; let testVersionId; let recoveryMaterialRetained = false
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
      writePossible = false
      throw new Error('recovery-required')
    }
    counts.writes += 1; writeStatus = 'passed'; testEtag = updated.etag; testVersionId = updated.versionId
    staleStatus = 'started'; const stale = await invoke('stale', () => adapters.stale({ ifMatch: DATA_CONSTANTS.baselineEtag, date: DATA_CONSTANTS.date, slot: DATA_CONSTANTS.slot, value: DATA_CONSTANTS.after })); staleStatus = stale.status === 409 ? 'passed' : 'failed'
    counts.polls += 1; await invoke('public-updated', () => adapters.poll({ expected: DATA_CONSTANTS.after, maxAttempts: 60, maxMs: 70000 }), false)
    lastCheckpoint = 'restore'; counts.operations += 1; restoreAttempted = true; counts.restores += 1; restoreStatus = 'started'; const restored = proof('restore', await adapters.restore({ ifMatch: testEtag, versionId: testVersionId, original: recoveryOriginal })); restoreStatus = 'passed'; writePossible = false
    counts.polls += 1; await invoke('public-restored', () => adapters.poll({ expected: DATA_CONSTANTS.before, maxAttempts: 60, maxMs: 70000 }), false); lastCheckpoint = 'cleanup'
  } catch (error) {
    failureCheckpoint = lastCheckpoint; failure = { checkpoint: lastCheckpoint, category: 'typed-failure' }
    if (restoreAttempted && restoreStatus === 'started') { restoreStatus = 'failed'; recoveryMaterialRetained = true }
    if (writePossible && !restoreAttempted) {
      lastCheckpoint = 'restore'; restoreAttempted = true; counts.restores += 1; restoreStatus = 'started'
      try { proof('restore', await adapters.restore({ ifMatch: testEtag, versionId: testVersionId, original: recoveryOriginal, recovery: true })); restoreStatus = 'passed'; writePossible = false } catch { restoreStatus = 'failed'; recoveryMaterialRetained = true }
    }
  } finally {
    lastCheckpoint = 'cleanup'; counts.operations += 1; counts.cleanups += 1
    try { proof('cleanup', await adapters.cleanup({ restoreStatus, restoreAttempted, recoveryMaterialRetained })); cleanupStatus = 'passed' } catch { cleanupStatus = 'failed' }
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

export function createProtectedDataCli({ execFile = promisify(nodeExecFile) } = {}) {
  const env = { AWS_PROFILE: DATA_CONSTANTS.profile, AWS_REGION: DATA_CONSTANTS.region, AWS_DEFAULT_REGION: DATA_CONSTANTS.region, PATH: process.env.PATH ?? '' }
  return async (operation, options = {}) => execFile('aws', safeArgs(operation, options), { env, windowsHide: true })
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

export function createPlaywrightDataBrowser({ launcher = defaultBrowserLauncher, origin = DATA_CONSTANTS.apiOrigin, httpsPort, clock = () => Date.now(), sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  let chromium; let contexts = []; let pages = []
  const pageFor = index => { const page = pages[index]; if (!page) fail('browser context unavailable'); return page }
  return {
    async setup({ username, password } = {}) {
      if (typeof username !== 'string' || typeof password !== 'string') fail('browser credentials unavailable')
      chromium = await launcher(); contexts = [await chromium.newContext(), await chromium.newContext()]; pages = await Promise.all(contexts.map(context => context.newPage()))
      for (const page of pages) { await page.goto(`${origin}/manage`, { waitUntil: 'domcontentloaded' }); await runBrowserRoleSession(page, { username, password, viewport: 'desktop' }); await page.waitForURL(url => new URL(url).pathname === '/manage'); await awaitSignedInSentinel(page, { viewport: 'desktop' }) }
      return { contexts: 2 }
    },
    async load({ etag }) { if (typeof etag !== 'string') fail('baseline etag unavailable'); const results = []; for (const page of pages) { const result = await page.evaluate(async path => { const response = await fetch(path, { cache: 'no-store' }); return { status: response.status, etag: response.headers.get('etag'), cacheControl: response.headers.get('cache-control') } }, DATA_CONSTANTS.apiPath); results.push(result) } if (results.some(result => result.status !== 200 || result.etag !== etag)) fail('browser baseline mismatch'); return { adminEtag: results[0].etag, staleEtag: results[1].etag, tuple: DATA_CONSTANTS.before } },
    async update(input) { return this.submit(pageFor(0), input, DATA_CONSTANTS.after) },
    async stale(input) { return this.submit(pageFor(1), input, DATA_CONSTANTS.after, true) },
    async submit(page, input, value, stale = false) { const cell = page.locator(`#${DATA_CONSTANTS.date}-${DATA_CONSTANTS.slot}`); await cell.selectOption(String(value)); const responsePromise = page.waitForResponse(response => { try { return new URL(response.url()).pathname === DATA_CONSTANTS.apiPath && response.request().method() === 'PUT' } catch { return false } }); await page.getByRole('button', { name: /Save|保存/ }).click(); const response = await responsePromise; const cacheControl = response.headers()['cache-control'] ?? ''; const etag = response.headers().etag ?? ''; let updatedAt = ''; let tuple = value; if (response.status() === 200) { const payload = await response.json(); updatedAt = payload?.document?.updatedAt ?? ''; tuple = payload?.document?.days?.[DATA_CONSTANTS.date]?.[DATA_CONSTANTS.slot] ?? value } return { status: response.status(), etag, versionId: response.headers()['x-version-id'] ?? '', cacheControl, updatedAt, tuple, puts: 1, ...(stale ? { retries: 0 } : {}) } },
    async poll({ expected, maxAttempts = 60, maxMs = 70000 } = {}) { const started = clock(); for (let attempt = 1; attempt <= maxAttempts && clock() - started <= maxMs; attempt += 1) { const result = httpsPort?.get ? await httpsPort.get(`${origin}/${DATA_CONSTANTS.key}`) : await pageFor(0).evaluate(async path => { const response = await fetch(path, { cache: 'no-store' }); const body = await response.json(); return { tuple: body?.days?.['2026-08-09']?.[0] } }, `${origin}/${DATA_CONSTANTS.key}`); if (result.tuple === expected) return { tuple: expected, attempts: attempt }; await sleep(1000) } fail('observation timeout') },
    async cleanup() { for (const context of contexts) await context.close().catch(() => {}); await chromium?.close?.().catch?.(() => {}) },
  }
}

/*
 * The browser boundary is deliberately small. The real runner supplies a
 * Playwright-backed object; tests supply a deterministic object with these
 * same methods. No request body, URL, token, or browser object crosses the
 * coordinator boundary.
 */
export function createConcreteDataAdapters({ command, execFile, browser, browserLauncher = defaultBrowserLauncher, httpsPort, clock = () => Date.now(), sleep, fs: fsPort, randomBytesImpl = randomBytes } = {}) {
  const fs = fsPort ?? { mkdtemp, chmod, writeFile, readFile, unlink, rm, stat }
  command ??= createProtectedDataCli({ execFile: execFile ?? promisify(nodeExecFile) })
  const run = typeof command === 'function' ? command : command?.run
  if (typeof run !== 'function') fail('invalid protected command')
  const cognito = makeProtectedCognitoCli({ execFile: execFile ?? promisify(nodeExecFile), fs }); let root; let currentOriginal; let identity; let captureCounter = 0; const browserPort = browser ?? createPlaywrightDataBrowser({ launcher: browserLauncher, httpsPort, clock, sleep })
  const protectedRoot = async () => { root ??= await fs.mkdtemp(join(tmpdir(), 't16-data-')); await fs.chmod(root, 0o700); return root }
  const readObject = async ({ retain = false } = {}) => {
    const dir = await protectedRoot(); const path = join(dir, `capture-${captureCounter += 1}-${randomBytesImpl(8).toString('hex')}.json`); const child = relative(resolve(dir), resolve(path)); if (!isAbsolute(dir) || child.startsWith('..')) fail('protected path containment')
    const dirInfo = await fs.stat(dir); if ((dirInfo.mode & 0o777) !== 0o700 || dirInfo.isSymbolicLink?.()) fail('protected directory mode')
    await fs.writeFile(path, Buffer.alloc(0), { mode: 0o600, flag: 'wx' }); await fs.chmod(path, 0o600)
    try {
      const head = json((await run('head-object')).stdout); await run('get-object', { inputPath: path }); const bytes = await fs.readFile(path); const parsed = parseSchedule(bytes)
      const info = await fs.stat(path); if ((info.mode & 0o777) !== 0o600 || info.isSymbolicLink?.() || bytes.length !== 501 || sha256(bytes) !== DATA_CONSTANTS.baselineSha256) fail('protected capture mismatch')
      return { path, bytes, head, parsed }
    } finally { if (!retain) await fs.unlink(path).catch(() => {}) }
  }
  const browserCall = async (method, input) => { if (!browserPort || typeof browserPort[method] !== 'function') fail('browser method unavailable'); return browserPort[method](input) }
  return {
    async preflight() {
      const caller = await cognito('sts-get-caller-identity', null, { jsonOutput: true }); if (caller?.Account !== DATA_CONSTANTS.account) fail('account mismatch')
      const users = await cognito('list-users', null, { jsonOutput: true }); const admins = await cognito('list-users-in-group', null, { jsonOutput: true }); if ((users?.Users?.length ?? -1) !== 0 || (admins?.Users?.length ?? -1) !== 0) fail('nonempty identity gate')
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
    async readCurrent() { const object = await readObject(); const tuple = object.parsed.tuple; if (object.head.ETag === DATA_CONSTANTS.baselineEtag && object.head.VersionId === DATA_CONSTANTS.baselineVersionId && tuple === DATA_CONSTANTS.before) return { state: 'baseline' }; if (tuple === DATA_CONSTANTS.after && strongEtag(object.head.ETag) && object.head.VersionId !== DATA_CONSTANTS.baselineVersionId) return { state: 'test', etag: object.head.ETag, versionId: object.head.VersionId }; return { state: 'unknown' } },
    async restore({ ifMatch, original = currentOriginal } = {}) {
      if (!original?.path || !ifMatch) fail('restore proof unavailable'); const checksum = createHash('sha256').update(original.bytes).digest('base64'); const result = await run('put-object', { inputPath: original.path, ifMatch, checksum }); const response = json(result.stdout); if (!strongEtag(response.ETag) || !response.VersionId) fail('restore response mismatch'); const readback = await readObject(); if (readback.parsed.tuple !== DATA_CONSTANTS.before || sha256(readback.bytes) !== DATA_CONSTANTS.baselineSha256) fail('restore readback mismatch'); return { status: 200, etag: response.ETag, versionId: response.VersionId, bytes: readback.bytes.length, sha256: sha256(readback.bytes), tuple: readback.parsed.tuple }
    },
    async cleanup({ recoveryMaterialRetained = false } = {}) { let failed = false; try { await browserCall('cleanup', {}) } catch { failed = true } const dir = await protectedRoot(); if (identity) { await cognito('admin-remove-user-from-group', { UserPoolId: DATA_CONSTANTS.poolId, Username: identity, GroupName: 'admins' }, { root: dir }).catch(() => { failed = true }); await cognito('admin-delete-user', { UserPoolId: DATA_CONSTANTS.poolId, Username: identity }, { root: dir }).catch(() => { failed = true }) } let users = -1; let admins = -1; try { users = (await cognito('list-users', null, { jsonOutput: true }))?.Users?.length ?? -1 } catch { failed = true } try { admins = (await cognito('list-users-in-group', null, { jsonOutput: true }))?.Users?.length ?? -1 } catch { failed = true } if (users !== 0 || admins !== 0) failed = true; if (!recoveryMaterialRetained && root) await fs.rm(root, { recursive: true, force: true }); if (failed) fail('cleanup failed'); return { users, admins } },
  }
}

export async function main(argv = process.argv.slice(2), dependencies = {}) { parseDataArgs(argv); if (dependencies.adapters && dependencies.testOnly !== true) throw new Error('complete adapter injection is test-only'); return runDataRehearsal(dependencies.adapters ?? createConcreteDataAdapters(dependencies)) }
export async function runDirect({ argv = process.argv.slice(2), dependencies = {}, stdout = value => process.stdout.write(value), stderr = value => process.stderr.write(value), setExitCode = value => { process.exitCode = value } } = {}) {
  try { const result = await main(argv, dependencies); stdout(`${JSON.stringify(result)}\n`); setExitCode(result.status === 'success' ? 0 : 1); return result }
  catch { stderr('{"status":"failed","category":"operation-failed"}\n'); setExitCode(1); return null }
}
if (import.meta.url === `file://${process.argv[1]}`) runDirect()

export { createHash, readFile }
