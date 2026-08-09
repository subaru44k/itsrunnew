import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, open, readdir, realpath, rm, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { parseScheduleMonth } from '../../packages/core/src/index.ts'
import { validateMigrationArtifacts } from './firestore-transform.mjs'

const MAX_BYTES = 32 * 1024
const CACHE_CONTROL = 'public, max-age=0, s-maxage=60'
const PROFILE = 'codex-prod'
const ACCOUNT = '470447451992'
const REGION = 'ap-northeast-1'
const MAX_ARTIFACT_FILES = 1024
const MAX_ARTIFACT_DEPTH = 16
const reportKeys = ['schemaVersion', 'status', 'counts', 'objects', 'failure']
const countKeys = ['attempted', 'uploaded', 'readback', 'cloudfront']
const failureCategories = new Set(['config', 'preflight', 'sts', 'upload', 'collision', 'readback', 'cloudfront', 'timeout', 'response'])
const safeKey = (value) => typeof value === 'string' && /^data\/v1\/stadiums\/(?:oda|yumenoshima|komazawa|todoroki)\/availability\/\d{4}-(?:0[1-9]|1[0-2])\.json$/.test(value)
const safeTag = (value) => typeof value === 'string' && /^[A-Za-z0-9._~+\/-]{1,256}$/.test(value)
const validBucket = (value) => typeof value === 'string' && value.length >= 3 && value.length <= 63 && /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(value) && !value.includes('..') && !/^\d+(?:\.\d+){3}$/.test(value)
const validDomain = (value) => typeof value === 'string' && value.length <= 253 && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/.test(value) && !value.includes('..') && !/^\d+(?:\.\d+){3}$/.test(value)
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
const exact = (value, keys) => Object.keys(value).join('\u0000') === keys.join('\u0000')
const beneath = (root, candidate) => { const rel = relative(resolve(root), resolve(candidate)); return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel) }
const globalArgs = (config) => ['--profile', config.profile, '--region', config.region, '--output', 'json']
const bodyBytes = (body) => body instanceof Uint8Array ? body : Buffer.from(body)

export class UploadValidationError extends Error {
  constructor(category) { super(`Migration upload validation failed (${category})`); this.name = 'UploadValidationError'; this.category = category }
}

const fail = (category) => { throw new UploadValidationError(category) }

function builderConfig(config) { if (!plain(config) || config.profile !== PROFILE || config.account !== ACCOUNT || config.region !== REGION || !validBucket(config.bucket) || !validDomain(config.distributionDomain)) fail('config') }
function builderPath(path, root) { if (typeof root !== 'string' || !isAbsolute(root) || typeof path !== 'string' || path.startsWith('-') || path.split('/').some((part) => part.startsWith('-')) || !isAbsolute(path) || !beneath(root, path)) fail('path') }
export function stsArgs(config) { builderConfig(config); return [...globalArgs(config), 'sts', 'get-caller-identity'] }
export function putObjectArgs(config, object) { builderConfig(config); if (!plain(object) || !safeKey(object.key)) fail('key'); builderPath(object.bodyPath, config.runDir); return [...globalArgs(config), 's3api', 'put-object', '--bucket', config.bucket, '--key', object.key, '--body', object.bodyPath, '--content-type', 'application/json', '--cache-control', CACHE_CONTROL, '--if-none-match', '*'] }
export function getObjectVersionArgs(config, object, outputPath) { builderConfig(config); if (!plain(object) || !safeKey(object.key) || !versionTag(object.versionId)) fail('version'); builderPath(outputPath, config.readbackRoot ?? config.runDir); return [...globalArgs(config), 's3api', 'get-object', '--bucket', config.bucket, '--key', object.key, '--version-id', object.versionId, outputPath] }
export function restoreObjectArgs(config, object, bodyPath) { builderConfig(config); if (!plain(object) || !safeKey(object.key) || !strongTag(object.etag)) fail('etag'); builderPath(bodyPath, config.restoreRoot ?? config.runDir); return [...globalArgs(config), 's3api', 'put-object', '--bucket', config.bucket, '--key', object.key, '--body', bodyPath, '--content-type', 'application/json', '--cache-control', CACHE_CONTROL, '--if-match', object.etag] }

function configValid(config, approvedTarget) {
  return plain(config) && builderConfigSafe(config) && plain(approvedTarget) && exact(approvedTarget, ['bucket', 'distributionDomain']) && approvedTarget.bucket === config.bucket && approvedTarget.distributionDomain === config.distributionDomain && isAbsolute(config.runDir) && isAbsolute(config.manifestPath) && beneath(config.runDir, config.manifestPath) && isAbsolute(config.readbackRoot ?? config.runDir) && isAbsolute(config.restoreRoot ?? config.runDir) && Number.isInteger(config.maxAttempts ?? 3) && (config.maxAttempts ?? 3) > 0 && Number.isInteger(config.timeoutMs ?? 5000) && (config.timeoutMs ?? 5000) > 0
}
function builderConfigSafe(config) { return config.profile === PROFILE && config.account === ACCOUNT && config.region === REGION && validBucket(config.bucket) && validDomain(config.distributionDomain) }

async function listFiles(fs, root, current = root, depth = 0, limit = MAX_ARTIFACT_FILES) {
  if (depth > MAX_ARTIFACT_DEPTH) fail('depth')
  const output = []
  for (const entry of await fs.readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name)
    if (entry.isSymbolicLink?.()) fail('path')
    if (entry.isDirectory()) output.push(...await listFiles(fs, root, path, depth + 1, limit))
    else if (entry.isFile()) output.push(path)
    else fail('file')
    if (output.length > limit) fail('extra-file')
  }
  return output
}

export async function readBoundedFile(fs, path, maxBytes = MAX_BYTES) {
  if (!Number.isInteger(maxBytes) || maxBytes < 0) fail('size')
  const handle = await fs.open(path, 'r'); const chunks = []; let total = 0
  try {
    while (total <= maxBytes) { const chunk = Buffer.alloc(Math.min(8192, maxBytes + 1 - total)); const result = await handle.read(chunk, 0, chunk.byteLength, total); if (!result.bytesRead) break; chunks.push(chunk.subarray(0, result.bytesRead)); total += result.bytesRead; if (total > maxBytes) fail('size') }
    return Buffer.concat(chunks, total)
  } finally { await handle.close() }
}

async function loadArtifacts(config, fs) {
  const runRoot = resolve(config.runDir); const manifestPath = resolve(config.manifestPath)
  const rootReal = await fs.realpath(runRoot); const manifestReal = await fs.realpath(manifestPath)
  if (!beneath(rootReal, manifestReal)) fail('path')
  const manifestBytes = await readBoundedFile(fs, manifestPath, 1024 * 1024); let manifest
  try { manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) } catch { fail('manifest') }
  if (!plain(manifest) || !Array.isArray(manifest.objects)) fail('manifest')
  const objects = []
  for (const metadata of manifest.objects) {
    if (!plain(metadata) || !safeKey(metadata.key)) fail('path')
    const bodyPath = resolve(runRoot, metadata.key); const bodyReal = await fs.realpath(bodyPath)
    if (!beneath(rootReal, bodyReal)) fail('path')
    const body = await readBoundedFile(fs, bodyPath); objects.push({ ...metadata, body, bodyPath })
  }
  const allFiles = await listFiles(fs, runRoot, runRoot, 0, Math.min(MAX_ARTIFACT_FILES, manifest.objects.length + 1)); const expected = new Set([manifestPath, ...objects.map((object) => resolve(runRoot, object.key))].map((path) => resolve(path)))
  if (allFiles.some((path) => !expected.has(resolve(path))) || expected.size !== allFiles.length) fail('extra-file')
  try { validateMigrationArtifacts({ objects: objects.map(({ bodyPath, ...object }) => object), manifest, manifestBytes }) } catch { fail('artifact') }
  return { objects, manifest, manifestBytes }
}

function responseValue(response, key) { return response && typeof response === 'object' ? response[key] : undefined }
function strongTag(value) { return typeof value === 'string' && /^"[A-Za-z0-9._-]+"$/.test(value) }
function versionTag(value) { return typeof value === 'string' && /^[A-Za-z0-9._~+\/-]{1,256}$/.test(value) }
function failureFor(error, stage, key = null) { const category = error?.category === 'config' ? 'config' : error?.code === 409 || error?.code === 412 || error?.code === 'PreconditionFailed' ? 'collision' : error?.code === 'timeout' ? 'timeout' : (stage === 'readback' ? 'readback' : stage === 'cloudfront' ? 'cloudfront' : stage === 'preflight' ? 'preflight' : stage); return { stage, category: failureCategories.has(category) ? category : 'response', key } }

function validateUploadReport(report) {
  if (!plain(report) || !exact(report, reportKeys) || report.schemaVersion !== 1 || !['match', 'mismatch'].includes(report.status) || !plain(report.counts) || !exact(report.counts, countKeys) || !Array.isArray(report.objects) || (report.failure !== null && (!plain(report.failure) || !exact(report.failure, ['stage', 'category', 'key']) || !['config', 'preflight', 'sts', 'upload', 'collision', 'readback', 'cloudfront', 'timeout', 'response'].includes(report.failure.category) || !['preflight', 'sts', 'upload', 'readback', 'cloudfront'].includes(report.failure.stage) || (report.failure.key !== null && !safeKey(report.failure.key)) || (report.failure.key !== null && !['upload', 'readback', 'cloudfront'].includes(report.failure.stage)) || (report.failure.key === null && ['upload', 'readback', 'cloudfront'].includes(report.failure.stage))))) throw new TypeError('invalid upload report')
  for (const key of countKeys) if (!Number.isInteger(report.counts[key]) || report.counts[key] < 0) throw new TypeError('invalid upload report')
  if (report.counts.uploaded > report.counts.attempted || report.counts.readback > report.counts.uploaded || report.counts.cloudfront > report.counts.readback || report.objects.length !== report.counts.attempted) throw new TypeError('invalid upload report')
  let previousKey = ''
  for (const [index, object] of report.objects.entries()) { if (!plain(object) || !exact(object, ['key', 'sha256', 'etag', 'versionId']) || !safeKey(object.key) || (previousKey && object.key <= previousKey) || !/^[a-f0-9]{64}$/.test(object.sha256) || (object.etag !== null && !strongTag(object.etag)) || (object.versionId !== null && !versionTag(object.versionId)) || (index < report.counts.uploaded && (object.etag === null || object.versionId === null)) || (index >= report.counts.uploaded && index < report.counts.attempted - (report.status === 'mismatch' && report.failure?.stage === 'upload' ? 1 : 0) && (object.etag === null || object.versionId === null))) throw new TypeError('invalid upload report'); previousKey = object.key }
  if (report.status === 'mismatch' && report.failure && report.failure.key !== null) { const index = report.objects.findIndex((object) => object.key === report.failure.key); if (index < 0 || (report.failure.stage === 'upload' && index !== report.counts.attempted - 1) || (report.failure.stage === 'readback' && index !== report.counts.readback) || (report.failure.stage === 'cloudfront' && index !== report.counts.cloudfront)) throw new TypeError('invalid upload report') }
  if (report.status === 'match' && (report.failure !== null || report.counts.attempted !== report.counts.uploaded || report.counts.uploaded !== report.counts.readback || report.counts.readback !== report.counts.cloudfront)) throw new TypeError('invalid upload report')
  if (report.status === 'mismatch' && report.failure === null) throw new TypeError('invalid upload report')
  return report
}

export function serializeUploadReport(report) { validateUploadReport(report); return new TextEncoder().encode(`${JSON.stringify(report, null, 2)}\n`) }
export function humanUploadReport(report) { validateUploadReport(report); const lines = [`T14D upload: ${report.status.toUpperCase()}`, `Attempted: ${report.counts.attempted}`, `Uploaded: ${report.counts.uploaded}`, `Read back: ${report.counts.readback}`, `CloudFront: ${report.counts.cloudfront}`, `Failure: ${report.failure ? `${report.failure.stage}/${report.failure.category}` : 'none'}`]; for (const object of report.objects) lines.push(`- ${object.key} sha256=${object.sha256} etag=${object.etag ?? 'null'} versionId=${object.versionId ?? 'null'}`); return `${lines.join('\n')}\n` }

async function boundedFetch(fetcher, url, attempts, timeoutMs) {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController(); let fetchTimer; let bodyTimer
    try {
      const fetchTimeout = new Promise((_, reject) => { fetchTimer = setTimeout(() => { controller.abort(); reject(Object.assign(new Error(), { code: 'timeout' })) }, timeoutMs) })
      const response = await Promise.race([fetcher(url, { method: 'GET', signal: controller.signal }), fetchTimeout]); clearTimeout(fetchTimer); fetchTimer = undefined
      if (response.status !== 200) throw Object.assign(new Error(), { code: 'status' })
      const bodyTimeout = new Promise((_, reject) => { bodyTimer = setTimeout(() => { controller.abort(); reject(Object.assign(new Error(), { code: 'timeout' })) }, timeoutMs) })
      const body = bodyBytes(await Promise.race([response.arrayBuffer(), bodyTimeout])); clearTimeout(bodyTimer); bodyTimer = undefined
      return { response, body }
    } catch (error) { lastError = error; if (attempt + 1 === attempts) throw error } finally { if (fetchTimer) clearTimeout(fetchTimer); if (bodyTimer) clearTimeout(bodyTimer); controller.abort() }
  }
  throw lastError
}

export async function uploadMigrationRun(config, { runAws, fetch, approvedTarget, fsImpl = {} } = {}) {
  const fs = { mkdir, mkdtemp, open, readdir, realpath, rm, stat, ...fsImpl }; const objectsReport = []; const counts = { attempted: 0, uploaded: 0, readback: 0, cloudfront: 0 }
  let artifacts
  try { if (!configValid(config, approvedTarget) || typeof runAws !== 'function' || typeof fetch !== 'function') fail('config'); artifacts = await loadArtifacts(config, fs) } catch (error) { const report = { schemaVersion: 1, status: 'mismatch', counts, objects: [], failure: failureFor(error, error instanceof UploadValidationError ? 'preflight' : 'preflight') }; return { report, machineBytes: serializeUploadReport(report), human: humanUploadReport(report) } }
  try {
    const identity = await runAws(stsArgs(config)); if (!identity || identity.Account !== ACCOUNT) throw Object.assign(new Error(), { code: 'account' })
  } catch (error) { const report = { schemaVersion: 1, status: 'mismatch', counts, objects: [], failure: { stage: 'sts', category: 'sts', key: null } }; return { report, machineBytes: serializeUploadReport(report), human: humanUploadReport(report) } }
  let temp; let currentStage = 'upload'; let currentKey = null
  try {
    for (const object of artifacts.objects) {
      currentStage = 'upload'; currentKey = object.key; counts.attempted += 1; const entry = { key: object.key, sha256: object.sha256, etag: null, versionId: null }; objectsReport.push(entry)
      const response = await runAws(putObjectArgs(config, object)); if (!strongTag(responseValue(response, 'ETag')) || !versionTag(responseValue(response, 'VersionId'))) throw Object.assign(new Error(), { code: 'response' }); entry.etag = response.ETag; entry.versionId = response.VersionId; counts.uploaded += 1
    }
    temp = await fs.mkdtemp(join(config.runDir, '.t14d-readback-'))
    for (const [index, object] of artifacts.objects.entries()) {
      currentStage = 'readback'; currentKey = object.key; const entry = objectsReport[index]; const outputPath = join(temp, `${index}.json`); await runAws(getObjectVersionArgs(config, { ...object, versionId: entry.versionId }, outputPath)); const body = await readBoundedFile(fs, outputPath); if (sha256(body) !== object.sha256) throw Object.assign(new Error(), { code: 'hash' }); const schedule = JSON.parse(new TextDecoder().decode(body)); parseScheduleMonth(schedule, { stadium: object.stadium, yearMonth: object.yearMonth }); counts.readback += 1
    }
    await fs.rm(temp, { recursive: true, force: true }); temp = null
    for (const [index, object] of artifacts.objects.entries()) {
      currentStage = 'cloudfront'; currentKey = object.key; const entry = objectsReport[index]; const { response, body } = await boundedFetch(fetch, `https://${config.distributionDomain}/${object.key}`, config.maxAttempts ?? 3, config.timeoutMs ?? 5000); const contentType = response.headers?.get('content-type') ?? ''; const cache = response.headers?.get('cache-control') ?? ''; const age = response.headers?.get('age'); if (!contentType.toLowerCase().startsWith('application/json') || !/max-age=0/.test(cache) || !/s-maxage=60/.test(cache) || (age !== null && (!/^\d+$/.test(age) || Number(age) > 60))) throw Object.assign(new Error(), { code: 'headers' }); if (body.byteLength > MAX_BYTES || sha256(body) !== object.sha256) throw Object.assign(new Error(), { code: 'cloudfront' }); const schedule = JSON.parse(new TextDecoder().decode(body)); parseScheduleMonth(schedule, { stadium: object.stadium, yearMonth: object.yearMonth }); counts.cloudfront += 1
    }
  } catch (error) { if (temp) { try { await fs.rm(temp, { recursive: true, force: true }) } catch {} }; const failure = failureFor(error, currentStage, currentKey); const report = { schemaVersion: 1, status: 'mismatch', counts, objects: objectsReport, failure }; return { report, machineBytes: serializeUploadReport(report), human: humanUploadReport(report) }
  }
  const report = { schemaVersion: 1, status: 'match', counts, objects: objectsReport, failure: null }; return { report, machineBytes: serializeUploadReport(report), human: humanUploadReport(report) }
}
