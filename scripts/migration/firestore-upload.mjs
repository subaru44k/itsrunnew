import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { parseScheduleMonth } from '../../packages/core/src/index.ts'
import { validateMigrationArtifacts } from './firestore-transform.mjs'

const MAX_BYTES = 32 * 1024
const CACHE_CONTROL = 'public, max-age=0, s-maxage=60'
const PROFILE = 'codex-prod'
const ACCOUNT = '470447451992'
const REGION = 'ap-northeast-1'
const reportKeys = ['schemaVersion', 'status', 'counts', 'objects', 'failure']
const countKeys = ['attempted', 'uploaded', 'readback', 'cloudfront']
const failureCategories = new Set(['config', 'preflight', 'sts', 'upload', 'collision', 'readback', 'cloudfront', 'timeout', 'response'])
const safeKey = (value) => typeof value === 'string' && /^data\/v1\/stadiums\/(?:oda|yumenoshima|komazawa|todoroki)\/availability\/\d{4}-(?:0[1-9]|1[0-2])\.json$/.test(value)
const safeTag = (value) => typeof value === 'string' && /^[A-Za-z0-9._~+\/-]{1,256}$/.test(value)
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

export function stsArgs(config) { return [...globalArgs(config), 'sts', 'get-caller-identity'] }
export function putObjectArgs(config, object) { return [...globalArgs(config), 's3api', 'put-object', '--bucket', config.bucket, '--key', object.key, '--body', object.bodyPath, '--content-type', 'application/json', '--cache-control', CACHE_CONTROL, '--if-none-match', '*'] }
export function getObjectVersionArgs(config, object, outputPath) { return [...globalArgs(config), 's3api', 'get-object', '--bucket', config.bucket, '--key', object.key, '--version-id', object.versionId, outputPath] }
export function restoreObjectArgs(config, object, bodyPath) { if (!strongTag(object.etag)) fail('etag'); return [...globalArgs(config), 's3api', 'put-object', '--bucket', config.bucket, '--key', object.key, '--body', bodyPath, '--content-type', 'application/json', '--cache-control', CACHE_CONTROL, '--if-match', object.etag] }

function configValid(config) {
  return plain(config) && config.profile === PROFILE && config.account === ACCOUNT && config.region === REGION && config.reviewedExpectedBucket === config.bucket && typeof config.bucket === 'string' && config.bucket.length > 0 && typeof config.distributionDomain === 'string' && /^[A-Za-z0-9.-]+$/.test(config.distributionDomain) && isAbsolute(config.runDir) && isAbsolute(config.manifestPath) && beneath(config.runDir, config.manifestPath) && Number.isInteger(config.maxAttempts ?? 3) && (config.maxAttempts ?? 3) > 0 && Number.isInteger(config.timeoutMs ?? 5000) && (config.timeoutMs ?? 5000) > 0
}

async function listFiles(fs, root, current = root) {
  const output = []
  for (const entry of await fs.readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name)
    if (entry.isDirectory()) output.push(...await listFiles(fs, root, path))
    else output.push(path)
  }
  return output
}

async function readBounded(fs, path) {
  const data = bodyBytes(await fs.readFile(path)); if (data.byteLength > MAX_BYTES) fail('size'); return data
}

async function loadArtifacts(config, fs) {
  const runRoot = resolve(config.runDir); const manifestPath = resolve(config.manifestPath)
  const rootReal = await fs.realpath(runRoot); const manifestReal = await fs.realpath(manifestPath)
  if (!beneath(rootReal, manifestReal)) fail('path')
  const manifestBytes = await readBounded(fs, manifestPath); let manifest
  try { manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) } catch { fail('manifest') }
  if (!plain(manifest) || !Array.isArray(manifest.objects)) fail('manifest')
  const objects = []
  for (const metadata of manifest.objects) {
    if (!plain(metadata) || !safeKey(metadata.key)) fail('path')
    const bodyPath = resolve(runRoot, metadata.key); const bodyReal = await fs.realpath(bodyPath)
    if (!beneath(rootReal, bodyReal)) fail('path')
    const body = await readBounded(fs, bodyPath); objects.push({ ...metadata, body, bodyPath })
  }
  const allFiles = await listFiles(fs, runRoot); const expected = new Set([manifestPath, ...objects.map((object) => resolve(runRoot, object.key))].map((path) => resolve(path)))
  if (allFiles.some((path) => !expected.has(resolve(path))) || expected.size !== allFiles.length) fail('extra-file')
  try { validateMigrationArtifacts({ objects: objects.map(({ bodyPath, ...object }) => object), manifest, manifestBytes }) } catch { fail('artifact') }
  return { objects, manifest, manifestBytes }
}

function responseValue(response, key) { return response && typeof response === 'object' ? response[key] : undefined }
function strongTag(value) { return typeof value === 'string' && /^"[A-Za-z0-9._-]+"$/.test(value) }
function versionTag(value) { return typeof value === 'string' && /^[A-Za-z0-9._~+\/-]{1,256}$/.test(value) }
function failureFor(error, stage, key = null) { const category = error?.code === 409 || error?.code === 412 || error?.code === 'PreconditionFailed' ? 'collision' : error?.code === 'timeout' ? 'timeout' : (stage === 'readback' ? 'readback' : stage === 'cloudfront' ? 'cloudfront' : stage); return { stage, category: failureCategories.has(category) ? category : 'response', key } }

function validateUploadReport(report) {
  if (!plain(report) || !exact(report, reportKeys) || report.schemaVersion !== 1 || !['match', 'mismatch'].includes(report.status) || !plain(report.counts) || !exact(report.counts, countKeys) || !Array.isArray(report.objects) || (report.failure !== null && (!plain(report.failure) || !['config', 'preflight', 'sts', 'upload', 'collision', 'readback', 'cloudfront', 'timeout', 'response'].includes(report.failure.category) || !['preflight', 'sts', 'upload', 'readback', 'cloudfront'].includes(report.failure.stage) || (report.failure.key !== null && !safeKey(report.failure.key))))) throw new TypeError('invalid upload report')
  for (const key of countKeys) if (!Number.isInteger(report.counts[key]) || report.counts[key] < 0) throw new TypeError('invalid upload report')
  if (report.counts.uploaded > report.counts.attempted || report.counts.readback > report.counts.uploaded || report.counts.cloudfront > report.counts.readback || report.objects.length !== report.counts.attempted) throw new TypeError('invalid upload report')
  let previousKey = ''
  for (const object of report.objects) { if (!plain(object) || !exact(object, ['key', 'sha256', 'etag', 'versionId']) || !safeKey(object.key) || (previousKey && object.key <= previousKey) || !/^[a-f0-9]{64}$/.test(object.sha256) || (object.etag !== null && !strongTag(object.etag)) || (object.versionId !== null && !versionTag(object.versionId))) throw new TypeError('invalid upload report'); previousKey = object.key }
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

export async function uploadMigrationRun(config, { runAws, fetch, fsImpl = {} } = {}) {
  const fs = { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, ...fsImpl }; const objectsReport = []; const counts = { attempted: 0, uploaded: 0, readback: 0, cloudfront: 0 }
  let artifacts
  try { if (!configValid(config) || typeof runAws !== 'function' || typeof fetch !== 'function') fail('config'); artifacts = await loadArtifacts(config, fs) } catch (error) { const report = { schemaVersion: 1, status: 'mismatch', counts, objects: [], failure: failureFor(error, error instanceof UploadValidationError ? 'preflight' : 'preflight') }; return { report, machineBytes: serializeUploadReport(report), human: humanUploadReport(report) } }
  try {
    const identity = await runAws(stsArgs(config)); if (!identity || identity.Account !== ACCOUNT) throw Object.assign(new Error(), { code: 'account' })
  } catch (error) { const report = { schemaVersion: 1, status: 'mismatch', counts, objects: [], failure: { stage: 'sts', category: 'sts', key: null } }; return { report, machineBytes: serializeUploadReport(report), human: humanUploadReport(report) } }
  let temp
  try {
    for (const object of artifacts.objects) {
      counts.attempted += 1; const entry = { key: object.key, sha256: object.sha256, etag: null, versionId: null }; objectsReport.push(entry)
      const response = await runAws(putObjectArgs(config, object)); if (!strongTag(responseValue(response, 'ETag')) || !versionTag(responseValue(response, 'VersionId'))) throw Object.assign(new Error(), { code: 'response' }); entry.etag = response.ETag; entry.versionId = response.VersionId; counts.uploaded += 1
    }
    temp = await fs.mkdtemp(join(config.runDir, '.t14d-readback-'))
    for (const [index, object] of artifacts.objects.entries()) {
      const entry = objectsReport[index]; const outputPath = join(temp, `${index}.json`); await runAws(getObjectVersionArgs(config, { ...object, versionId: entry.versionId }, outputPath)); const body = await readBounded(fs, outputPath); if (sha256(body) !== object.sha256) throw Object.assign(new Error(), { code: 'hash' }); const schedule = JSON.parse(new TextDecoder().decode(body)); parseScheduleMonth(schedule, { stadium: object.stadium, yearMonth: object.yearMonth }); counts.readback += 1
    }
    await fs.rm(temp, { recursive: true, force: true }); temp = null
    for (const [index, object] of artifacts.objects.entries()) {
      const entry = objectsReport[index]; const { response, body } = await boundedFetch(fetch, `https://${config.distributionDomain}/${object.key}`, config.maxAttempts ?? 3, config.timeoutMs ?? 5000); const contentType = response.headers?.get('content-type') ?? ''; const cache = response.headers?.get('cache-control') ?? ''; const age = response.headers?.get('age'); if (!contentType.toLowerCase().startsWith('application/json') || !/max-age=0/.test(cache) || !/s-maxage=60/.test(cache) || (age !== null && (!/^\d+$/.test(age) || Number(age) > 60))) throw Object.assign(new Error(), { code: 'headers' }); if (body.byteLength > MAX_BYTES || sha256(body) !== object.sha256) throw Object.assign(new Error(), { code: 'cloudfront' }); const schedule = JSON.parse(new TextDecoder().decode(body)); parseScheduleMonth(schedule, { stadium: object.stadium, yearMonth: object.yearMonth }); counts.cloudfront += 1
    }
  } catch (error) { if (temp) await fs.rm(temp, { recursive: true, force: true }); const stage = counts.uploaded < counts.attempted ? 'upload' : counts.readback < counts.uploaded ? 'readback' : 'cloudfront'; const failure = failureFor(error, stage, objectsReport[Math.max(0, Math.min(objectsReport.length - 1, counts.uploaded))]?.key ?? null); const report = { schemaVersion: 1, status: 'mismatch', counts, objects: objectsReport, failure }; return { report, machineBytes: serializeUploadReport(report), human: humanUploadReport(report) }
  }
  const report = { schemaVersion: 1, status: 'match', counts, objects: objectsReport, failure: null }; return { report, machineBytes: serializeUploadReport(report), human: humanUploadReport(report) }
}
