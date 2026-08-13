import { createHash } from 'node:crypto'
import { lstat, readFile, readdir, rename, rm, mkdir, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

export const WEB_DEPLOY_TARGET = Object.freeze({
  account: '470447451992', region: 'ap-northeast-1', stack: 'ItsRunPreviewHosting',
  bucket: 'itsrun-preview-web-470447451992-ap-northeast-1', domain: 'd2via50thoheqm.cloudfront.net',
})
const ROLE = 'itsrun-preview-github-web-deploy'
const MAX_BYTES = 10 * 1024 * 1024
const reportHandles = new WeakSet()

export function parseWebDeployArgs(argv) {
  const values = {}; const seen = new Set(); const allowed = new Set(['mode', 'profile', 'web-dir', 'report-dir'])
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]
    if (!name?.startsWith('--') || !allowed.has(name.slice(2)) || !argv[index + 1] || argv[index + 1].startsWith('--')) throw fail('configuration')
    if (seen.has(name)) throw fail('configuration'); seen.add(name)
    values[name.slice(2)] = argv[index + 1]
  }
  if (!['operator', 'github'].includes(values.mode) || typeof values['web-dir'] !== 'string' || typeof values['report-dir'] !== 'string' || !isAbsolute(values['web-dir']) || !isAbsolute(values['report-dir']) || values.mode === 'operator' && values.profile !== 'codex-prod' || values.mode === 'github' && values.profile) throw fail('configuration')
  return { mode: values.mode, profile: values.profile, webDir: values['web-dir'], reportDir: values['report-dir'] }
}

export function cacheControlForWebObject(key) {
  if (key.endsWith('.html') || key.endsWith('_payload.json') || key === '_nuxt/builds/latest.json') return 'no-cache, no-store, must-revalidate'
  const immutable = key.startsWith('_nuxt/') && (/(^|\/)[A-Za-z0-9_.-]*[A-Za-z0-9_-]{8,}\.[^/]+$/.test(key) || /^_nuxt\/builds\/[^/]+\.json$/.test(key))
  return immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=86400'
}

function fail(category, key = null) { const error = new Error(`web deployment ${category}`); error.category = category; error.key = key; return error }
function safeKey(key) { return typeof key === 'string' && key && !key.startsWith('/') && !key.includes('\\') && key.split('/').every((part) => part && !part.startsWith('.') && part !== '..') }
function inside(root, path) { const rel = relative(resolve(root), resolve(path)); return rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel) }
function modeEnv(config) {
  const env = config.env ?? process.env
  if (config.mode === 'operator') {
    if (config.profile !== 'codex-prod' || env.GITHUB_ACTIONS === 'true' || env.AWS_ACCESS_KEY_ID || env.AWS_SECRET_ACCESS_KEY || env.AWS_SESSION_TOKEN || env.AWS_WEB_IDENTITY_TOKEN_FILE || env.AWS_SHARED_CREDENTIALS_FILE || env.AWS_CONFIG_FILE) throw fail('configuration')
    return { profile: config.profile }
  }
  if (config.mode !== 'github' || config.profile || config.accessKey || config.sessionToken || env.AWS_PROFILE || env.AWS_CONFIG_FILE || env.AWS_SHARED_CREDENTIALS_FILE || env.AWS_WEB_IDENTITY_TOKEN_FILE || typeof env.AWS_ACCESS_KEY_ID !== 'string' || !env.AWS_ACCESS_KEY_ID.trim() || env.AWS_ACCESS_KEY_ID !== env.AWS_ACCESS_KEY_ID.trim() || typeof env.AWS_SECRET_ACCESS_KEY !== 'string' || !env.AWS_SECRET_ACCESS_KEY.trim() || env.AWS_SECRET_ACCESS_KEY !== env.AWS_SECRET_ACCESS_KEY.trim() || typeof env.AWS_SESSION_TOKEN !== 'string' || !env.AWS_SESSION_TOKEN.trim() || env.AWS_SESSION_TOKEN !== env.AWS_SESSION_TOKEN.trim() || env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REPOSITORY !== 'subaru44k/itsrunnew' || env.GITHUB_REF !== 'refs/heads/master') throw fail('configuration')
  return {}
}

async function list(root, prefix = '', fsApi = { readdir }) {
  const entries = await fsApi.readdir(resolve(root, prefix), { withFileTypes: true })
  const out = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const key = prefix ? `${prefix}/${entry.name}` : entry.name
    if (!safeKey(key) || /(^|\/)(credentials?|config|\.env|\.aws|\.artifacts)(\/|$)/i.test(key)) throw fail('path')
    if (entry.isDirectory()) out.push(...await list(root, key, fsApi))
    else if (entry.isFile() && !entry.isSymbolicLink()) out.push(key)
    else throw fail('path')
  }
  return out
}

export function webContentType(key) {
  if (key.endsWith('.html')) return 'text/html'
  if (key.endsWith('.json')) return 'application/json'
  if (key.endsWith('.js')) return 'application/javascript'
  if (key.endsWith('.css')) return 'text/css'
  if (key.endsWith('.svg')) return 'image/svg+xml'
  if (key.endsWith('.png')) return 'image/png'
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg'
  if (key.endsWith('.gif')) return 'image/gif'
  if (key.endsWith('.webp')) return 'image/webp'
  if (key.endsWith('.ico')) return 'image/x-icon'
  if (key.endsWith('.woff')) return 'font/woff'
  if (key.endsWith('.woff2')) return 'font/woff2'
  if (key.endsWith('.txt')) return 'text/plain'
  if (key.endsWith('.xml')) return 'application/xml'
  if (key.endsWith('.webmanifest')) return 'application/manifest+json'
  if (key.endsWith('.map')) return 'application/json'
  return 'application/octet-stream'
}

export async function collectWebObjects(webDir, fsApi = { lstat, readFile }) {
  if (!isAbsolute(webDir)) throw fail('configuration')
  const root = resolve(webDir)
  const rootStat = await fsApi.lstat(root)
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink?.()) throw fail('path')
  const fs = { lstat, readFile, readdir, ...fsApi }
  const keys = await list(root, '', fs)
  if (!keys.length) throw fail('empty')
  const objects = []
  for (const key of keys) {
    const path = resolve(root, key)
    if (!inside(root, path)) throw fail('path')
    const stat = await fsApi.lstat(path)
    if (!stat.isFile() || stat.isSymbolicLink?.() || stat.size > MAX_BYTES) throw fail('path', key)
    const body = await fsApi.readFile(path)
    if (body.byteLength > MAX_BYTES) throw fail('size', key)
    if (body.byteLength !== stat.size) throw fail('size', key)
    objects.push({ key, path, size: body.byteLength, sha256: createHash('sha256').update(body).digest('hex'), contentType: webContentType(key), cacheControl: cacheControlForWebObject(key) })
  }
  return objects.sort((a, b) => (a.cacheControl.includes('immutable') ? 0 : a.cacheControl.includes('no-cache') ? 2 : 1) - (b.cacheControl.includes('immutable') ? 0 : b.cacheControl.includes('no-cache') ? 2 : 1) || a.key.localeCompare(b.key))
}

export function putObjectArgs(object, bucket, mode = 'operator') {
  if (!safeKey(object.key) || bucket !== WEB_DEPLOY_TARGET.bucket || !isAbsolute(object.path)) throw fail('configuration')
  return ['s3api', 'put-object', '--bucket', bucket, '--key', object.key, '--body', object.path, '--content-type', object.contentType, '--cache-control', object.cacheControl]
}

function outputValues(value) {
  const stack = value?.Stacks?.[0]
  if (!Array.isArray(value?.Stacks) || value.Stacks.length !== 1 || stack?.StackStatus !== 'UPDATE_COMPLETE') throw fail('stack')
  if (!Array.isArray(stack.Outputs) || stack.Outputs.some((item) => !item || typeof item.OutputKey !== 'string' || typeof item.OutputValue !== 'string') || new Set(stack.Outputs.map((item) => item.OutputKey)).size !== stack.Outputs.length) throw fail('stack')
  const outputs = Object.fromEntries(stack.Outputs.map((item) => [item.OutputKey, item.OutputValue]))
  if (outputs.WebBucketName !== WEB_DEPLOY_TARGET.bucket || outputs.DistributionDomainName !== WEB_DEPLOY_TARGET.domain) throw fail('stack')
  return outputs
}

function normalizedCache(value) { return value.split(',').map((part) => part.trim()).filter(Boolean).sort().join(',') }
async function waitUntil(deadline, sleep, milliseconds, now, key) {
  const remaining = Math.max(0, deadline - now())
  if (remaining <= 0 || milliseconds >= remaining) throw fail('timeout', key)
  let timer
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(fail('timeout', key)), remaining) })
  try { await Promise.race([sleep(milliseconds), timeout]); if (now() >= deadline) throw fail('timeout', key) } finally { clearTimeout(timer) }
}
function encodedUrl(domain, key, hash) {
  if (domain !== WEB_DEPLOY_TARGET.domain || !safeKey(key)) throw fail('cloudfront', key)
  return `https://${domain}/${key.split('/').map((segment) => encodeURIComponent(segment)).join('/')}?sha256=${encodeURIComponent(hash)}`
}
export async function verifyWebObject(domain, object, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch
  const maxAttempts = options.maxAttempts ?? 3
  const now = options.now ?? Date.now
  const deadline = now() + (options.timeoutMs ?? 30000)
  const sleep = options.sleep ?? ((ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms)))
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || !Number.isFinite(options.timeoutMs ?? 30000) || (options.timeoutMs ?? 30000) <= 0) throw fail('configuration', object.key)
  let lastError
  for (let attempt = 0; attempt < maxAttempts && now() <= deadline; attempt += 1) {
    const controller = new AbortController(); let timer
    try {
      const remaining = Math.max(0, deadline - now())
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(fail('timeout', object.key)) }, remaining) })
      const operation = (async () => {
        const response = await fetchImpl(encodedUrl(domain, object.key, object.sha256), { signal: controller.signal })
      if (response.status !== 200) throw new Error('status')
      if ((response.headers.get('content-type') ?? '').split(';')[0].trim() !== object.contentType) throw new Error('content-type')
      if (normalizedCache(response.headers.get('cache-control') ?? '') !== normalizedCache(object.cacheControl)) throw new Error('cache-control')
      const body = Buffer.from(await response.arrayBuffer())
      if (body.length > MAX_BYTES || createHash('sha256').update(body).digest('hex') !== object.sha256) throw new Error('hash')
      })()
      await Promise.race([operation, timeout])
      return
    } catch (error) { lastError = error; if (error?.category === 'timeout') break; if (attempt + 1 < maxAttempts) { try { await waitUntil(deadline, sleep, Math.min(1000, Math.max(0, deadline - now())), now, object.key) } catch (waitError) { lastError = waitError; break } } } finally { if (timer) clearTimeout(timer); controller.abort() }
  }
  throw fail(lastError?.category === 'timeout' ? 'timeout' : 'cloudfront', lastError?.key ?? object.key)
}

export async function deployWebPreview(config, options = {}) {
  if (config.account !== WEB_DEPLOY_TARGET.account || config.region !== WEB_DEPLOY_TARGET.region || config.stack !== WEB_DEPLOY_TARGET.stack || config.bucket && config.bucket !== WEB_DEPLOY_TARGET.bucket || config.domain && config.domain !== WEB_DEPLOY_TARGET.domain || !isAbsolute(config.webDir)) throw fail('configuration')
  const mode = modeEnv(config); const runAws = options.runAws
  if (typeof runAws !== 'function') throw fail('configuration')
  let objects; try { objects = await collectWebObjects(config.webDir, options.fsApi) } catch (error) { throw fail(error.category ?? 'preflight', error.key) }
  const identity = await runAws(['sts', 'get-caller-identity'])
  if (identity?.Account !== config.account || config.mode === 'github' && !new RegExp(`^arn:aws:sts::${config.account}:assumed-role/${ROLE}/[A-Za-z0-9+=,.@_-]{1,64}$`).test(identity.Arn ?? '')) throw fail('identity')
  const outputs = outputValues(await runAws(['cloudformation', 'describe-stacks', '--stack-name', config.stack]))
  let uploadedCount = 0; let verifiedCount = 0
  try {
    for (const object of objects) { await runAws(putObjectArgs(object, outputs.WebBucketName, config.mode)); uploadedCount += 1 }
  } catch { const error = fail('upload'); error.attemptedCount = objects.length; error.uploadedCount = uploadedCount; error.verifiedCount = 0; throw error }
  try {
    for (const object of objects) { await verifyWebObject(outputs.DistributionDomainName, object, options); verifiedCount += 1 }
  } catch (error) { const result = fail(error?.category === 'timeout' ? 'timeout' : 'cloudfront', error?.key); result.attemptedCount = objects.length; result.uploadedCount = uploadedCount; result.verifiedCount = verifiedCount; throw result }
  return { schemaVersion: 1, status: 'match', mode: config.mode, attemptedCount: objects.length, uploadedCount, verifiedCount, objectCount: objects.length, objects: objects.map(({ key, size, sha256, contentType, cacheControl }) => ({ key, size, sha256, contentType, cacheControl })) }
}

export async function prepareWebReportTarget(workspaceRoot, reportRoot, fsApi = { mkdir, lstat }) {
  const expectedParent = resolve(workspaceRoot, '.artifacts', 'migration')
  if (!isAbsolute(workspaceRoot) || !isAbsolute(reportRoot) || resolve(reportRoot, '..') !== expectedParent || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(reportRoot.split(sep).at(-1))) throw fail('report')
  for (const parent of [resolve(workspaceRoot), resolve(workspaceRoot, '.artifacts'), expectedParent]) {
    try { const stat = await fsApi.lstat(parent); if (!stat.isDirectory() || stat.isSymbolicLink?.()) throw fail('report') } catch (error) {
      if (error?.category === 'report') throw error
      await fsApi.mkdir(parent)
    }
  }
  const root = resolve(reportRoot)
  try { await fsApi.lstat(root); throw fail('report') } catch (error) { if (error?.category === 'report') throw error }
  await fsApi.mkdir(root)
  const handle = Object.freeze({ root, target: `${root}/web-deploy-report.json`, workspaceRoot: resolve(workspaceRoot) }); reportHandles.add(handle); return handle
}

export async function writeWebReport(handle, report, fsApi = { mkdir, rename, rm, writeFile, lstat }) {
  if (!reportHandles.has(handle) || !report || !['match', 'failed'].includes(report.status) || report.schemaVersion !== 1) throw fail('report')
  const temp = `${handle.root}/.report-${process.pid}`
  try { await fsApi.mkdir(temp); await fsApi.writeFile(`${temp}/report.json`, `${JSON.stringify(report)}\n`); try { await fsApi.lstat(handle.target); throw fail('report') } catch (error) { if (error?.category === 'report') throw error }; await fsApi.rename(`${temp}/report.json`, handle.target); await fsApi.rm(temp, { recursive: true, force: true }) } catch { await fsApi.rm(temp, { recursive: true, force: true }).catch(() => {}); throw fail('report') }
  return handle.target
}
