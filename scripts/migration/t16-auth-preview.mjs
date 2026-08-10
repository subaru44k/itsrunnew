import { randomBytes } from 'node:crypto'
import { execFile as nodeExecFile } from 'node:child_process'
import { chmod, mkdtemp, mkdir, stat, unlink, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { createProtectedCliInput, createSanitizedBrowserRecorder, driveHostedUiSignIn } from './t16-auth-harness.mjs'

export const AUTH_CONSTANTS = Object.freeze({
  profile: 'codex-prod', account: '470447451992', region: 'ap-northeast-1',
  poolId: 'ap-northeast-1_nmj9cP9st', clientId: '1olddro3tldfinupl52u9dl1j4',
  hostedUiDomain: 'itsrun-preview-470447451992.auth.ap-northeast-1.amazoncognito.com',
  cloudFrontBase: 'https://d2via50thoheqm.cloudfront.net', group: 'admins',
  apiPath: '/api/schedule/oda/2026-08',
})

export const EXECUTION_FLAG = '--execute-preview-auth'
export const COGNITO_MUTATING_OPERATIONS = Object.freeze([
  'admin-create-user', 'admin-set-user-password', 'admin-add-user-to-group',
  'admin-get-user', 'admin-remove-user-from-group', 'admin-delete-user',
])
const COGNITO_READ_OPERATIONS = Object.freeze(['list-users', 'list-groups'])
const operationSet = new Set([...COGNITO_MUTATING_OPERATIONS, ...COGNITO_READ_OPERATIONS])
const checkpoints = new Set(['preflight', 'setup', 'admin-form', 'admin-callback', 'admin-sentinel', 'non-admin-form', 'non-admin-callback', 'non-admin-sentinel', 'cleanup', 'complete'])

export function parseAuthArgs(argv) {
  if (!Array.isArray(argv) || argv.length !== 1 || argv[0] !== EXECUTION_FLAG) throw new Error('invalid execution flag')
  return { execute: true }
}

function identities(nextRandomBytes) {
  const suffix = nextRandomBytes(12).toString('hex')
  return Object.freeze({
    adminAlias: `preview-t16-admin-${suffix}@rehearsal.invalid`,
    nonAdminAlias: `preview-t16-nonadmin-${suffix}@rehearsal.invalid`,
    adminPassword: `Aa1!${nextRandomBytes(24).toString('hex')}`,
    nonAdminPassword: `Bb2!${nextRandomBytes(24).toString('hex')}`,
  })
}

function safeFailure(error) {
  if (error?.name === 'TimeoutError') return 'timeout'
  if (error?.message === 'invalid proof') return 'invalid-proof'
  return 'operation-failed'
}

function proof(stage, value) {
  const exact = (keys, test) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== keys.sort().join('|') || !test(value)) throw new Error('invalid proof')
    return value
  }
  if (stage === 'preflight') return exact(['target', 'users', 'admins'], v => v.target === 'auth' && v.users === 0 && v.admins === 0)
  if (stage === 'setup') return exact(['users', 'admins'], v => v.users === 2 && v.admins === 1)
  if (stage.endsWith('-form')) return exact(['desktop', 'mobile'], v => v.desktop === 'form-submitted' && v.mobile === 'form-submitted')
  if (stage.endsWith('-callback')) return exact(['desktop', 'mobile'], v => v.desktop === true && v.mobile === true)
  if (stage === 'admin-sentinel') return exact(['desktop', 'mobile'], v => v.desktop === 200 && v.mobile === 200)
  if (stage === 'non-admin-sentinel') return exact(['desktop', 'mobile'], v => v.desktop === 403 && v.mobile === 403)
  if (stage === 'cleanup') return exact(['users', 'admins'], v => v.users === 0 && v.admins === 0)
  throw new Error('invalid proof')
}

export async function runAuthCoordinator(adapters = {}) {
  let lastCheckpoint = 'preflight'; let failure = null; let failureCheckpoint = null
  const counts = { operations: 0, writes: 0, restores: 0, cleanups: 0 }
  const roleOutcomes = { admin: 'not-run', 'non-admin': 'not-run' }
  const invoke = async (stage, fn, role = null) => {
    lastCheckpoint = stage; counts.operations += 1
    try { const result = await (typeof fn === 'function' ? fn({ stage, role }) : fn?.run?.({ stage, role })); proof(stage, result); if (role) roleOutcomes[role] = 'passed' }
    catch (error) { if (role) roleOutcomes[role] = 'failed'; failure = { stage, category: safeFailure(error) }; failureCheckpoint = stage; throw error }
  }
  try {
    await invoke('preflight', adapters.preflight)
    await invoke('setup', adapters.setup)
    for (const [stage, name, method, role] of [['admin-form', 'admin', 'form', 'admin'], ['admin-callback', 'admin', 'callback', 'admin'], ['admin-sentinel', 'admin', 'sentinel', 'admin'], ['non-admin-form', 'nonAdmin', 'form', 'non-admin'], ['non-admin-callback', 'nonAdmin', 'callback', 'non-admin'], ['non-admin-sentinel', 'nonAdmin', 'sentinel', 'non-admin']]) await invoke(stage, adapters[name]?.[method], role)
  } catch {}
  finally {
    lastCheckpoint = 'cleanup'; counts.operations += 1; counts.cleanups += 1
    try { proof('cleanup', await adapters.cleanup({ stage: 'cleanup' })) }
    catch (error) { failure ??= { stage: 'cleanup', category: safeFailure(error) }; failureCheckpoint ??= 'cleanup' }
  }
  const status = failure ? 'failed' : 'success'
  return { status, lastCheckpoint: status === 'success' ? 'complete' : lastCheckpoint, failureCheckpoint, roleOutcomes, counts, failure, restoreStatus: 'not-required', cleanupStatus: failure?.stage === 'cleanup' ? 'failed' : 'passed' }
}

function makeFs(fsPort = {}) {
  return { chmod: fsPort.chmod ?? chmod, mkdtemp: fsPort.mkdtemp ?? (prefix => mkdtemp(prefix)), mkdir: fsPort.mkdir ?? mkdir, stat: fsPort.stat ?? stat, writeFile: fsPort.writeFile ?? writeFile, unlink: fsPort.unlink ?? unlink, rm: fsPort.rm ?? rm }
}

async function runRealBrowserRole(role, username, password) {
  const { chromium } = await import('playwright')
  const outcomes = {}
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport })
    const recorder = createSanitizedBrowserRecorder(page)
    try {
      const target = `https://${AUTH_CONSTANTS.hostedUiDomain}/login?client_id=${AUTH_CONSTANTS.clientId}&response_type=code&redirect_uri=${encodeURIComponent(`${AUTH_CONSTANTS.cloudFrontBase}/manage/callback`)}`
      await page.goto(target, { waitUntil: 'domcontentloaded' })
      const submitted = await driveHostedUiSignIn(page, { username, password, waitForNavigationSignal: () => page.waitForURL(url => new URL(url).pathname === '/manage/callback', { timeout: 30000 }) })
      outcomes[viewport.width > 600 ? 'desktop' : 'mobile'] = submitted.checkpoint
      if (submitted.checkpoint !== 'form-submitted') throw new Error('form proof failed')
      const callback = recorder.snapshot().events.some(event => event.kind === 'navigation' && event.path === '/manage/callback')
      if (!callback) throw new Error('callback proof failed')
      const response = await page.request.get(`${AUTH_CONSTANTS.cloudFrontBase}${AUTH_CONSTANTS.apiPath}`)
      outcomes[viewport.width > 600 ? 'desktopStatus' : 'mobileStatus'] = response.status()
      if (role === 'admin' && response.status() !== 200 || role === 'non-admin' && response.status() !== 403) throw new Error('sentinel proof failed')
      const logout = page.locator('[data-testid="admin-logout"], a[href*="logout"], button:has-text("Logout"), button:has-text("ログアウト")')
      if (await logout.count() < 1) throw new Error('signed-in sentinel failed')
    } finally { recorder.detach(); await browser.close() }
  }
  return { form: { desktop: outcomes.desktop, mobile: outcomes.mobile }, callback: { desktop: true, mobile: true }, sentinel: { desktop: outcomes.desktopStatus, mobile: outcomes.mobileStatus } }
}

function realBrowserRole(role, username, password) {
  let result
  const run = async () => { result ??= runRealBrowserRole(role, username, password); return result }
  return { form: async () => (await run()).form, callback: async () => (await run()).callback, sentinel: async () => (await run()).sentinel }
}

function makeCli(command = {}) {
  const exec = command.execFile ?? promisify(nodeExecFile)
  const env = { AWS_PROFILE: AUTH_CONSTANTS.profile, AWS_REGION: AUTH_CONSTANTS.region, AWS_DEFAULT_REGION: AUTH_CONSTANTS.region, PATH: process.env.PATH ?? '' }
  return async (operation, payload, { json = false, root, inputPath } = {}) => {
    if (!operationSet.has(operation)) throw new Error('forbidden cognito operation')
    let args = ['cognito-idp', operation, '--user-pool-id', AUTH_CONSTANTS.poolId]
    if (operation === 'list-groups') args = ['cognito-idp', operation, '--user-pool-id', AUTH_CONSTANTS.poolId]
    if (payload) args = []
    if (inputPath) args = ['cognito-idp', operation, '--cli-input-json', `file://${inputPath}`]
    else if (payload) throw new Error('protected input required')
    const result = await exec('aws', args, { env, windowsHide: true })
    if (!json) return undefined
    try { return JSON.parse(result.stdout ?? '') } catch { throw new Error('invalid aws json') }
  }
}

function createAliases(nextRandomBytes) { return identities(nextRandomBytes) }

export function createConcreteAuthAdapters({ command, browser, fs: fsPort, randomBytesImpl = randomBytes, clock = () => Date.now() } = {}) {
  const fs = makeFs(fsPort); const cli = makeCli(command); const ids = createAliases(randomBytesImpl); let root; let adminUsername; let nonAdminUsername
  const browserFactory = browser ?? ((role, username, password) => realBrowserRole(role, username, password))
  const protectedCall = async (operation, payload, json = false) => {
    const path = join(root, `${operation}-${Math.floor(clock())}.json`)
    await fs.writeFile(path, JSON.stringify(payload), { mode: 0o600, flag: 'wx' })
    try { return await cli(operation, null, { json, root, inputPath: path }) } finally { await fs.unlink(path).catch(() => {}) }
  }
  const cognito = async (operation, payload, json = false) => {
    if (!COGNITO_MUTATING_OPERATIONS.includes(operation)) throw new Error('forbidden cognito operation')
    return protectedCall(operation, payload, json)
  }
  const readCount = async operation => (await cli(operation, null, { json: true }))
  return {
    identities: { adminAlias: ids.adminAlias, nonAdminAlias: ids.nonAdminAlias },
    async preflight() { const users = await readCount('list-users'); const groups = await readCount('list-groups'); return { target: 'auth', users: users?.Users?.length ?? -1, admins: groups?.Groups?.find(g => g.GroupName === AUTH_CONSTANTS.group)?.Users?.length ?? 0 } },
    async setup() {
      root ??= await fs.mkdtemp(join(tmpdir(), 't16-auth-')); await fs.chmod(root, 0o700)
      const admin = await cognito('admin-create-user', { UserPoolId: AUTH_CONSTANTS.poolId, Username: ids.adminAlias, MessageAction: 'SUPPRESS' }, true); adminUsername = admin?.User?.Username; if (typeof adminUsername !== 'string' || !adminUsername) throw new Error('invalid create response')
      await cognito('admin-set-user-password', { UserPoolId: AUTH_CONSTANTS.poolId, Username: adminUsername, Password: ids.adminPassword, Permanent: true });
      const nonAdmin = await cognito('admin-create-user', { UserPoolId: AUTH_CONSTANTS.poolId, Username: ids.nonAdminAlias, MessageAction: 'SUPPRESS' }, true); nonAdminUsername = nonAdmin?.User?.Username; if (typeof nonAdminUsername !== 'string' || !nonAdminUsername) throw new Error('invalid create response')
      await cognito('admin-set-user-password', { UserPoolId: AUTH_CONSTANTS.poolId, Username: nonAdminUsername, Password: ids.nonAdminPassword, Permanent: true }); await cognito('admin-add-user-to-group', { UserPoolId: AUTH_CONSTANTS.poolId, Username: adminUsername, GroupName: AUTH_CONSTANTS.group });
      for (const username of [adminUsername, nonAdminUsername]) { const current = await cognito('admin-get-user', { UserPoolId: AUTH_CONSTANTS.poolId, Username: username }, true); if (current?.User?.Username !== username) throw new Error('invalid get response') }
      return { users: 2, admins: 1 }
    },
    admin: browserFactory('admin', ids.adminAlias, ids.adminPassword, AUTH_CONSTANTS),
    nonAdmin: browserFactory('non-admin', ids.nonAdminAlias, ids.nonAdminPassword, AUTH_CONSTANTS),
    async cleanup() { if (adminUsername) { try { await cognito('admin-remove-user-from-group', { UserPoolId: AUTH_CONSTANTS.poolId, Username: adminUsername, GroupName: AUTH_CONSTANTS.group }) } finally { await cognito('admin-delete-user', { UserPoolId: AUTH_CONSTANTS.poolId, Username: adminUsername }) } } if (nonAdminUsername) await cognito('admin-delete-user', { UserPoolId: AUTH_CONSTANTS.poolId, Username: nonAdminUsername }); const users = await readCount('list-users'); const groups = await readCount('list-groups'); await fs.rm(root, { recursive: true, force: true }).catch(() => {}); return { users: users?.Users?.length ?? -1, admins: groups?.Groups?.find(g => g.GroupName === AUTH_CONSTANTS.group)?.Users?.length ?? 0 } },
  }
}

export async function main(argv = process.argv.slice(2), dependencies = {}) { parseAuthArgs(argv); const adapters = dependencies.adapters ?? createConcreteAuthAdapters(dependencies); return runAuthCoordinator(adapters) }

if (import.meta.url === `file://${process.argv[1]}`) main().then(result => process.stdout.write(`${JSON.stringify(result)}\n`)).catch(() => { process.stderr.write('{"status":"failed","category":"operation-failed"}\n'); process.exitCode = 1 })

export { createProtectedCliInput, createSanitizedBrowserRecorder, driveHostedUiSignIn }
