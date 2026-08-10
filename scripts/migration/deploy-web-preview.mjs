import { createHash } from 'node:crypto'
import { lstat, readFile, readdir, rename, rm, mkdir, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

export const WEB_DEPLOY_TARGET = Object.freeze({
  account: '470447451992', region: 'ap-northeast-1', stack: 'ItsRunPreviewHosting',
  bucket: 'itsrun-preview-web-470447451992-ap-northeast-1', domain: 'd2via50thoheqm.cloudfront.net',
})
const ROLE = 'itsrun-preview-github-web-deploy'
const MAX_BYTES = 10 * 1024 * 1024

export function parseWebDeployArgs(argv) {
  const values = {}; const allowed = new Set(['mode', 'profile', 'web-dir', 'report-dir'])
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]
    if (!name?.startsWith('--') || !allowed.has(name.slice(2)) || !argv[index + 1] || argv[index + 1].startsWith('--')) throw fail('configuration')
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
function safeKey(key) { return typeof key === 'string' && key && !key.startsWith('.') && !key.startsWith('/') && !key.includes('\\') && key.split('/').every((part) => part && part !== '.' && part !== '..') }
function inside(root, path) { const rel = relative(resolve(root), resolve(path)); return rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel) }
function modeEnv(config) {
  const env = config.env ?? process.env
  if (config.mode === 'operator') {
    if (config.profile !== 'codex-prod' || env.GITHUB_ACTIONS === 'true' || env.AWS_ACCESS_KEY_ID || env.AWS_SECRET_ACCESS_KEY || env.AWS_SESSION_TOKEN || env.AWS_WEB_IDENTITY_TOKEN_FILE || env.AWS_SHARED_CREDENTIALS_FILE || env.AWS_CONFIG_FILE) throw fail('configuration')
    return { profile: config.profile }
  }
  if (config.mode !== 'github' || config.profile || config.accessKey || config.sessionToken || env.AWS_PROFILE || env.AWS_ACCESS_KEY_ID || env.AWS_SECRET_ACCESS_KEY || env.AWS_SHARED_CREDENTIALS_FILE || env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REPOSITORY !== 'subaru44k/itsrunnew' || env.GITHUB_REF !== 'refs/heads/migration/aws-s3-cloudfront') throw fail('configuration')
  return {}
}

async function list(root, prefix = '') {
  const entries = await readdir(resolve(root, prefix), { withFileTypes: true })
  const out = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const key = prefix ? `${prefix}/${entry.name}` : entry.name
    if (!safeKey(key)) throw fail('path')
    if (entry.isDirectory()) out.push(...await list(root, key))
    else if (entry.isFile() && !entry.isSymbolicLink()) out.push(key)
    else throw fail('path')
  }
  return out
}

function contentType(key) {
  if (key.endsWith('.html')) return 'text/html'
  if (key.endsWith('.json')) return 'application/json'
  if (key.endsWith('.js')) return 'application/javascript'
  if (key.endsWith('.css')) return 'text/css'
  if (key.endsWith('.svg')) return 'image/svg+xml'
  if (/\.(png|jpe?g|gif|webp|ico)$/.test(key)) return 'image/*'
  return 'application/octet-stream'
}

export async function collectWebObjects(webDir, fsApi = { lstat, readFile }) {
  if (!isAbsolute(webDir)) throw fail('configuration')
  const root = resolve(webDir)
  const rootStat = await fsApi.lstat(root)
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink?.()) throw fail('path')
  const keys = await list(root)
  if (!keys.length) throw fail('empty')
  const objects = []
  for (const key of keys) {
    const path = resolve(root, key)
    if (!inside(root, path)) throw fail('path')
    const stat = await fsApi.lstat(path)
    if (!stat.isFile() || stat.isSymbolicLink?.() || stat.size > MAX_BYTES) throw fail('path', key)
    const body = await fsApi.readFile(path)
    if (body.byteLength > MAX_BYTES) throw fail('size', key)
    objects.push({ key, path, size: body.byteLength, body, sha256: createHash('sha256').update(body).digest('hex'), contentType: contentType(key), cacheControl: cacheControlForWebObject(key) })
  }
  return objects.sort((a, b) => (a.cacheControl.includes('immutable') ? 0 : a.cacheControl.includes('no-cache') ? 2 : 1) - (b.cacheControl.includes('immutable') ? 0 : b.cacheControl.includes('no-cache') ? 2 : 1) || a.key.localeCompare(b.key))
}

export function putObjectArgs(object, bucket, mode = 'operator') {
  if (!safeKey(object.key) || bucket !== WEB_DEPLOY_TARGET.bucket || !isAbsolute(object.path) || mode === 'github' && object.path.includes('..')) throw fail('configuration')
  return ['s3api', 'put-object', '--bucket', bucket, '--key', object.key, '--body', object.path, '--content-type', object.contentType, '--cache-control', object.cacheControl]
}

function outputValues(value) {
  const stack = value?.Stacks?.[0]
  const outputs = Object.fromEntries((stack?.Outputs ?? []).map((item) => [item.OutputKey, item.OutputValue]))
  if (outputs.WebBucketName !== WEB_DEPLOY_TARGET.bucket || outputs.DistributionDomainName !== WEB_DEPLOY_TARGET.domain) throw fail('stack')
  return outputs
}

function normalizedCache(value) { return value.split(',').map((part) => part.trim()).filter(Boolean).sort().join(',') }
async function verifyObject(domain, object, options) {
  const fetchImpl = options.fetchImpl ?? fetch
  const maxAttempts = options.maxAttempts ?? 3
  const deadline = (options.now?.() ?? Date.now()) + (options.timeoutMs ?? 30000)
  for (let attempt = 0; attempt < maxAttempts && (options.now?.() ?? Date.now()) <= deadline; attempt += 1) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - (options.now?.() ?? Date.now())))
    try {
      const response = await fetchImpl(`https://${domain}/${object.key}`, { signal: controller.signal })
      if (response.status !== 200) throw new Error('status')
      if ((response.headers.get('content-type') ?? '').split(';')[0].trim() !== object.contentType) throw new Error('content-type')
      if (normalizedCache(response.headers.get('cache-control') ?? '') !== normalizedCache(object.cacheControl)) throw new Error('cache-control')
      const body = Buffer.from(await response.arrayBuffer())
      if (body.length > MAX_BYTES || createHash('sha256').update(body).digest('hex') !== object.sha256) throw new Error('hash')
      return
    } catch { if (attempt + 1 >= maxAttempts) throw fail('cloudfront', object.key) } finally { clearTimeout(timer); controller.abort() }
  }
  throw fail('timeout')
}

export async function deployWebPreview(config, options = {}) {
  if (config.account !== WEB_DEPLOY_TARGET.account || config.region !== WEB_DEPLOY_TARGET.region || config.stack !== WEB_DEPLOY_TARGET.stack || config.bucket && config.bucket !== WEB_DEPLOY_TARGET.bucket || config.domain && config.domain !== WEB_DEPLOY_TARGET.domain || !isAbsolute(config.webDir)) throw fail('configuration')
  const mode = modeEnv(config); const runAws = options.runAws
  if (typeof runAws !== 'function') throw fail('configuration')
  let objects; try { objects = await collectWebObjects(config.webDir, options.fsApi) } catch (error) { throw fail(error.category ?? 'preflight', error.key) }
  const identity = await runAws(['sts', 'get-caller-identity', '--region', config.region, ...(mode.profile ? ['--profile', mode.profile] : [])])
  if (identity?.Account !== config.account || config.mode === 'github' && (!identity.Arn?.includes(`assumed-role/${ROLE}/`) || !identity.Arn?.split('/')[2])) throw fail('identity')
  const outputs = outputValues(await runAws(['cloudformation', 'describe-stacks', '--stack-name', config.stack, '--region', config.region, ...(mode.profile ? ['--profile', mode.profile] : [])]))
  for (const object of objects) await runAws(putObjectArgs(object, outputs.WebBucketName, config.mode))
  for (const object of objects) await verifyObject(outputs.DistributionDomainName, object, options)
  return { schemaVersion: 1, status: 'match', mode: config.mode, objectCount: objects.length, objects: objects.map(({ key, size, sha256, contentType, cacheControl }) => ({ key, size, sha256, contentType, cacheControl })) }
}

export async function writeWebReport(report, reportRoot, fsApi = { mkdir, rename, rm, writeFile }) {
  if (!reportRoot || !isAbsolute(reportRoot) || !report || report.status !== 'match') throw fail('report')
  const root = resolve(reportRoot); await fsApi.mkdir(root, { recursive: true }); const temp = `${root}/.report-${process.pid}`; const target = `${root}/web-deploy-report.json`
  try { await fsApi.mkdir(temp); await fsApi.writeFile(`${temp}/report.json`, `${JSON.stringify(report)}\n`); await fsApi.rename(`${temp}/report.json`, target); await fsApi.rm(temp, { recursive: true, force: true }) } catch { await fsApi.rm(temp, { recursive: true, force: true }).catch(() => {}); throw fail('report') }
  return target
}
