import { createHash } from 'node:crypto'
import { execFile as nodeExecFile } from 'node:child_process'
import { mkdtemp, open, readdir, realpath, rm, mkdir, readFile, rename, stat, lstat, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { parseScheduleMonth } from '../../packages/core/src/index.ts'
import { validateMigrationArtifacts } from './firestore-transform.mjs'

const MAX_BYTES = 32 * 1024
const CACHE_CONTROL = 'public, max-age=0, s-maxage=60'
const PROFILE = 'codex-prod'
const ACCOUNT = '470447451992'
const REGION = 'ap-northeast-1'
const MAX_ARTIFACT_FILES = 1024
const MAX_ARTIFACT_DEPTH = 16
const MAX_CLI_OUTPUT_BYTES = 64 * 1024
const AWS_EXECUTABLE = '/usr/local/aws-cli/aws'
const SEALED_MANIFEST_SHA256 = '2d6000e0a56026abc1bdad91717d4627d942b6cef2d19e729239c5192000eb16'
const SEALED_OBJECT_COUNT = 74
const SEALED_PREFIX = 'data/v1/stadiums/'
const SEALED_ALLOWED_PREFIX = /^data\/v1\/stadiums\/$/
const reportKeys = ['schemaVersion', 'status', 'counts', 'objects', 'failure']
const countKeys = ['attempted', 'uploaded', 'readback', 'cloudfront']
const failureCategories = new Set(['config', 'preflight', 'sts', 'upload', 'collision', 'readback', 'cloudfront', 'timeout', 'response'])
const safeKey = (value) => typeof value === 'string' && /^data\/v1\/stadiums\/(?:oda|yumenoshima|komazawa|todoroki)\/availability\/\d{4}-(?:0[1-9]|1[0-2])\.json$/.test(value)
const validBucket = (value) => typeof value === 'string' && value.length >= 3 && value.length <= 63 && /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(value) && !value.includes('..') && !/^\d+(?:\.\d+){3}$/.test(value)
const validDomain = (value) => typeof value === 'string' && value.length <= 253 && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/.test(value) && !value.includes('..') && !/^\d+(?:\.\d+){3}$/.test(value)
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
const exact = (value, keys) => Object.keys(value).join('\u0000') === keys.join('\u0000')
const beneath = (root, candidate) => { const rel = relative(resolve(root), resolve(candidate)); return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel) }
const globalArgs = (config) => ['--profile', config.profile, '--region', config.region, '--output', 'json']
const bodyBytes = (body) => body instanceof Uint8Array ? body : Buffer.from(body)
const safeEnvironment = (value) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.getOwnPropertySymbols(value).length > 0) return false
  for (const key of Object.keys(value)) { const descriptor = Object.getOwnPropertyDescriptor(value, key); if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || typeof descriptor.value !== 'string' || key.startsWith('AWS_')) return false }
  return true
}

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

function sealedConfig(config, approvedTarget) {
  if (!plain(config) || !builderConfigSafe(config) || !plain(approvedTarget) || !exact(approvedTarget, ['bucket', 'distributionDomain']) || approvedTarget.bucket !== config.bucket || approvedTarget.distributionDomain !== config.distributionDomain) fail('config')
  if (config.manifestSha256 !== SEALED_MANIFEST_SHA256 || config.objectCount !== SEALED_OBJECT_COUNT || config.allowedPrefix !== SEALED_PREFIX || !SEALED_ALLOWED_PREFIX.test(config.allowedPrefix)) fail('config')
  if (!isAbsolute(config.runDir) || !isAbsolute(config.manifestPath) || resolve(config.manifestPath) !== resolve(config.runDir, 'manifest.json') || !beneath(config.runDir, config.manifestPath)) fail('path')
  if (config.env !== undefined && !safeEnvironment(config.env)) fail('config')
}

async function readSealedArtifacts(config, fs, { strictFiles = true } = {}) {
  const runRoot = resolve(config.runDir); const manifestPath = resolve(config.manifestPath)
  const rootInfo = await fs.lstat(runRoot); if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) fail('path')
  const rootReal = await fs.realpath(runRoot); const manifestReal = await fs.realpath(manifestPath)
  if (!beneath(rootReal, manifestReal)) fail('path')
  const manifestInfo = await fs.lstat(manifestPath); if (!manifestInfo.isFile() || manifestInfo.isSymbolicLink()) fail('file')
  const manifestBytes = await readBoundedFile(fs, manifestPath, 1024 * 1024)
  if (sha256(manifestBytes) !== SEALED_MANIFEST_SHA256) fail('manifest')
  let manifest; try { manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) } catch { fail('manifest') }
  if (!plain(manifest) || manifest.objects?.length !== SEALED_OBJECT_COUNT) fail('manifest')
  const objects = []
  for (const metadata of manifest.objects) {
    if (!plain(metadata) || !safeKey(metadata.key) || !metadata.key.startsWith(SEALED_PREFIX)) fail('manifest')
    const bodyPath = resolve(runRoot, metadata.key); const bodyReal = await fs.realpath(bodyPath)
    if (!beneath(rootReal, bodyReal)) fail('path')
    const bodyInfo = await fs.lstat(bodyPath); if (!bodyInfo.isFile() || bodyInfo.isSymbolicLink()) fail('file')
    const body = await readBoundedFile(fs, bodyPath)
    objects.push({ ...metadata, body, bodyPath })
  }
  if (strictFiles) { const allFiles = await listFiles(fs, runRoot, runRoot); const expected = new Set([manifestPath, ...objects.map((object) => resolve(runRoot, object.key))].map((path) => resolve(path))); if (allFiles.some((path) => !expected.has(resolve(path))) || expected.size !== allFiles.length) fail('extra-file') }
  try { validateMigrationArtifacts({ objects: objects.map(({ bodyPath, ...object }) => object), manifest, manifestBytes }) } catch { fail('artifact') }
  return { objects, manifest, manifestBytes }
}

async function writeSealedArtifacts(targetDir, artifacts, fs) {
  if (!isAbsolute(targetDir)) fail('path')
  const target = resolve(targetDir); const parent = resolve(target, '..'); let temp
  try { await fs.stat(target); fail('existing-target') } catch (error) { if (error instanceof UploadValidationError) throw error; if (error?.code !== 'ENOENT') throw error }
  try {
    await fs.mkdir(parent, { recursive: true }); temp = await fs.mkdtemp(join(parent, `.${target.split(sep).pop()}.tmp-`))
    for (const object of artifacts.objects) { const destination = resolve(temp, object.key); if (!beneath(temp, destination)) fail('path'); await fs.mkdir(resolve(destination, '..'), { recursive: true }); await fs.writeFile(destination, object.body, { flag: 'wx' }) }
    await fs.writeFile(resolve(temp, 'manifest.json'), artifacts.manifestBytes, { flag: 'wx' })
    const files = await listFiles(fs, temp, temp); const expected = new Set(['manifest.json', ...artifacts.objects.map((object) => object.key)])
    if (files.map((file) => relative(temp, file)).sort().join('\0') !== [...expected].sort().join('\0')) fail('sealed-files')
    const rereadObjects = []
    for (const object of artifacts.objects) { const body = await readBoundedFile(fs, resolve(temp, object.key)); if (body.byteLength !== object.bytes || sha256(body) !== object.sha256) fail('hash'); rereadObjects.push({ ...object, body }) }
    const rereadManifest = await readBoundedFile(fs, resolve(temp, 'manifest.json'), 1024 * 1024); if (sha256(rereadManifest) !== SEALED_MANIFEST_SHA256) fail('hash')
    validateMigrationArtifacts({ objects: rereadObjects.map(({ bodyPath, ...object }) => object), manifest: artifacts.manifest, manifestBytes: rereadManifest })
    await fs.rename(temp, target); temp = null; return target
  } catch (error) { if (temp) { try { await fs.rm(temp, { recursive: true, force: true }) } catch {} }; if (error instanceof UploadValidationError) throw error; throw new UploadValidationError('sealed-write') }
}

export async function sealUploadRun({ sourceDir, sourceManifestPath = join(sourceDir, 'manifest.json'), targetDir, fsImpl = {} } = {}) {
  const fs = { mkdir, mkdtemp, open, readdir, realpath, readFile, rename, rm, stat, lstat, writeFile, ...fsImpl }
  if (typeof sourceDir !== 'string' || typeof targetDir !== 'string' || !isAbsolute(sourceDir) || !isAbsolute(targetDir)) fail('path')
  const config = { runDir: sourceDir, manifestPath: sourceManifestPath, manifestSha256: SEALED_MANIFEST_SHA256, objectCount: SEALED_OBJECT_COUNT, allowedPrefix: SEALED_PREFIX }
  const artifacts = await readSealedArtifacts(config, fs, { strictFiles: false }); const output = await writeSealedArtifacts(targetDir, artifacts, fs)
  return { output, manifest: artifacts.manifest, manifestBytes: artifacts.manifestBytes, objectCount: artifacts.objects.length }
}

export function headObjectArgs(config, key) { builderConfig(config); if (!safeKey(key)) fail('key'); return [...globalArgs(config), 's3api', 'head-object', '--bucket', config.bucket, '--key', key] }

function validateAwsArgs(args) {
  if (!Array.isArray(args) || args.length < 7 || args[0] !== '--profile' || args[2] !== '--region' || args[4] !== '--output' || args[5] !== 'json' || args[1] !== PROFILE || args[3] !== REGION) fail('command')
  const command = args.slice(6); const operation = command[1]
  if (command[0] === 'sts' && command.length === 2 && operation === 'get-caller-identity') return
  if (command[0] !== 's3api' || !['head-object', 'put-object', 'get-object'].includes(operation) || args.some((value) => typeof value !== 'string' || value.startsWith('--delete') || /^(?:sync|cp|copy|delete)$/i.test(value))) fail('command')
  const bucketAt = command.indexOf('--bucket'); const keyAt = command.indexOf('--key')
  if (bucketAt !== 2 || keyAt !== 4 || command[3] !== 'itsrun-preview-data-470447451992-ap-northeast-1' || !safeKey(command[5])) fail('command')
  if (operation === 'head-object' && command.length !== 6) fail('command')
  if (operation === 'put-object') {
    if (command.length !== 14 || command[6] !== '--body' || !isAbsolute(command[7]) || command[8] !== '--content-type' || command[9] !== 'application/json' || command[10] !== '--cache-control' || command[11] !== CACHE_CONTROL || command[12] !== '--if-none-match' || command[13] !== '*') fail('command')
  }
  if (operation === 'get-object') {
    if (command.length !== 9 || command[6] !== '--version-id' || !versionTag(command[7]) || !isAbsolute(command[8])) fail('command')
  }
}
function classifyAwsError(error, stderr, args) {
  const text = typeof stderr === 'string' ? stderr.slice(0, MAX_CLI_OUTPUT_BYTES) : ''
  const operation = Array.isArray(args) ? args[7] : undefined
  const leading = (code) => new RegExp(`^\\n?(?:aws: \\[ERROR\\]: )?An error occurred \\((?:${code})\\) when calling the ${operation === 'head-object' ? 'HeadObject' : operation === 'put-object' ? 'PutObject' : ''} operation:`).test(text)
  if (error?.code === 254 && operation === 'head-object' && (leading('404|NotFound|NoSuchKey'))) return 'NotFound'
  if (error?.code === 254 && operation === 'head-object' && (leading('403|AccessDenied|Forbidden'))) return 'AccessDenied'
  if (error?.code === 254 && operation === 'put-object' && leading('409|412|PreconditionFailed')) return 'Collision'
  return 'Other'
}
const sanitizedAwsEnv = (env = process.env) => Object.fromEntries(Object.entries(env ?? {}).filter(([key]) => !key.startsWith('AWS_')))
export async function preflightAwsExecutable(fs = { lstat, realpath }) {
  try { const info = await fs.lstat(AWS_EXECUTABLE); if (!info.isFile() || info.isSymbolicLink() || !(info.mode & 0o111) || resolve(await fs.realpath(AWS_EXECUTABLE)) !== AWS_EXECUTABLE) fail('executable') } catch (error) { if (error instanceof UploadValidationError) throw error; fail('executable') }
  return AWS_EXECUTABLE
}
export async function runAwsJson(execFileImpl = nodeExecFile, args, { maxOutputBytes = MAX_CLI_OUTPUT_BYTES, env = process.env, roots = null } = {}) {
  if (typeof execFileImpl !== 'function' || !Number.isInteger(maxOutputBytes) || maxOutputBytes < 1) fail('command'); validateAwsArgs(args)
  const operation = args[7]; const command = args.slice(6); if (roots && (!plain(roots) || (operation === 'put-object' && (!isAbsolute(roots.sealedRoot) || !beneath(roots.sealedRoot, command[7]))) || (operation === 'get-object' && (!isAbsolute(roots.readbackRoot) || !beneath(roots.readbackRoot, command[8]))))) fail('path')
  const executable = execFileImpl === nodeExecFile ? AWS_EXECUTABLE : 'aws'; const childEnv = sanitizedAwsEnv(env)
  return await new Promise((resolvePromise, reject) => {
    execFileImpl(executable, args, { shell: false, windowsHide: true, encoding: 'utf8', maxBuffer: maxOutputBytes, env: childEnv }, (error, stdout = '', stderr = '') => {
      if (Buffer.byteLength(stdout) > maxOutputBytes || Buffer.byteLength(stderr) > maxOutputBytes) return reject(new UploadValidationError('output'))
      if (error) { const safe = new UploadValidationError('command'); safe.code = error.code; safe.serviceCode = classifyAwsError(error, stderr, args); return reject(safe) }
      try { const value = JSON.parse(stdout); return resolvePromise(value) } catch { return reject(new UploadValidationError('json')) }
    })
  })
}

function notFound(error) { return error?.serviceCode === 'NotFound' || error?.code === 404 || error?.code === '404' || error?.code === 'NotFound' || error?.code === 'NoSuchKey' }
export async function preflightSealedAbsence(config, artifacts, runAws) {
  if (typeof runAws !== 'function') fail('config')
  for (const object of artifacts.objects) {
    try { const response = await runAws(headObjectArgs(config, object.key)); if (!plain(response)) fail('preflight') ; fail('present') } catch (error) { if (notFound(error)) continue; if (error instanceof UploadValidationError) throw error; fail('preflight') }
  }
  return { objectCount: artifacts.objects.length, allAbsent: true }
}

export async function writeUploadReports(report, reportDir, fsImpl = {}) {
  if (!isAbsolute(reportDir)) fail('report-path')
  const fs = { mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat, writeFile, ...fsImpl }; const machineBytes = serializeUploadReport(report); const human = humanUploadReport(report); const target = resolve(reportDir); let temp
  try { await fs.stat(target); fail('report-existing') } catch (error) { if (error instanceof UploadValidationError) throw error; if (error?.code !== 'ENOENT') throw error }
  try { await fs.mkdir(resolve(target, '..'), { recursive: true }); temp = await fs.mkdtemp(join(resolve(target, '..'), `.${target.split(sep).pop()}.tmp-`)); await fs.writeFile(resolve(temp, 'report.json'), machineBytes, { flag: 'wx' }); await fs.writeFile(resolve(temp, 'report.txt'), human, { flag: 'wx' }); if (JSON.stringify([...await fs.readFile(resolve(temp, 'report.json'))]) !== JSON.stringify([...machineBytes])) fail('report-reread'); await fs.rename(temp, target); temp = null; return target } catch (error) { if (temp) { try { await fs.rm(temp, { recursive: true, force: true }) } catch {} }; if (error instanceof UploadValidationError) throw error; throw new UploadValidationError('report-write') }
}

export async function uploadSealedMigrationRun(config, { runAws, fetch, approvedTarget, fsImpl = {}, reportDir } = {}) {
  const fs = { mkdir, mkdtemp, open, readdir, realpath, readFile, rename, rm, stat, lstat, writeFile, ...fsImpl }; const counts = { attempted: 0, uploaded: 0, readback: 0, cloudfront: 0 }
  let artifacts
  try { sealedConfig(config, approvedTarget); artifacts = await readSealedArtifacts(config, fs) } catch (error) { const report = { schemaVersion: 1, status: 'mismatch', counts, objects: [], failure: { stage: 'preflight', category: 'preflight', key: null } }; if (reportDir) await writeUploadReports(report, reportDir, fs); return { report, machineBytes: serializeUploadReport(report), human: humanUploadReport(report) } }
  try { const identity = await runAws(stsArgs(config)); if (!identity || identity.Account !== ACCOUNT) fail('sts'); await preflightSealedAbsence(config, artifacts, runAws) } catch (error) { const report = { schemaVersion: 1, status: 'mismatch', counts, objects: [], failure: { stage: error?.category === 'sts' ? 'sts' : 'preflight', category: error?.category === 'sts' ? 'sts' : 'preflight', key: null } }; if (reportDir) await writeUploadReports(report, reportDir, fs); return { report, machineBytes: serializeUploadReport(report), human: humanUploadReport(report) } }
  const result = await executeUploadMigrationRun(config, { runAws, fetch, approvedTarget, fsImpl }, false); if (reportDir) await writeUploadReports(result.report, reportDir, fs); return result
}

function responseValue(response, key) { return response && typeof response === 'object' ? response[key] : undefined }
function strongTag(value) { return typeof value === 'string' && /^"[A-Za-z0-9._-]+"$/.test(value) }
function versionTag(value) { return typeof value === 'string' && /^[A-Za-z0-9._~+\/-]{1,256}$/.test(value) }
function failureFor(error, stage, key = null) { const category = error?.category === 'config' ? 'config' : stage === 'cleanup' ? 'readback' : stage === 'upload' && (error?.code === 409 || error?.code === 412 || error?.code === 'PreconditionFailed' || error?.serviceCode === 'Collision') ? 'collision' : error?.code === 'timeout' ? 'timeout' : (stage === 'readback' ? 'readback' : stage === 'cloudfront' ? 'cloudfront' : stage === 'preflight' ? 'preflight' : stage); return { stage, category: failureCategories.has(category) ? category : 'response', key } }

function validateUploadReport(report) {
  if (!plain(report) || !exact(report, reportKeys) || report.schemaVersion !== 1 || !['match', 'mismatch'].includes(report.status) || !plain(report.counts) || !exact(report.counts, countKeys) || !Array.isArray(report.objects) || (report.failure !== null && (!plain(report.failure) || !exact(report.failure, ['stage', 'category', 'key']) || !['config', 'preflight', 'sts', 'upload', 'collision', 'readback', 'cloudfront', 'timeout', 'response'].includes(report.failure.category) || !['preflight', 'sts', 'upload', 'readback', 'cloudfront', 'cleanup'].includes(report.failure.stage) || (report.failure.key !== null && !safeKey(report.failure.key)) || (report.failure.stage === 'cleanup' && (report.failure.category !== 'readback' || report.failure.key !== null)) || (report.failure.key !== null && !['upload', 'readback', 'cloudfront'].includes(report.failure.stage)) || (report.failure.key === null && ['upload', 'readback', 'cloudfront'].includes(report.failure.stage))))) throw new TypeError('invalid upload report')
  for (const key of countKeys) if (!Number.isInteger(report.counts[key]) || report.counts[key] < 0) throw new TypeError('invalid upload report')
  if (report.counts.uploaded > report.counts.attempted || report.counts.readback > report.counts.uploaded || report.counts.cloudfront > report.counts.readback || report.objects.length !== report.counts.attempted) throw new TypeError('invalid upload report')
  let previousKey = ''
  for (const [index, object] of report.objects.entries()) { if (!plain(object) || !exact(object, ['key', 'sha256', 'etag', 'versionId']) || !safeKey(object.key) || (previousKey && object.key <= previousKey) || !/^[a-f0-9]{64}$/.test(object.sha256) || (object.etag !== null && !strongTag(object.etag)) || (object.versionId !== null && !versionTag(object.versionId)) || (index < report.counts.uploaded && (object.etag === null || object.versionId === null)) || (index >= report.counts.uploaded && index < report.counts.attempted - (report.status === 'mismatch' && report.failure?.stage === 'upload' ? 1 : 0) && (object.etag === null || object.versionId === null))) throw new TypeError('invalid upload report'); previousKey = object.key }
  if (report.status === 'mismatch' && report.failure && report.failure.key !== null) { const index = report.objects.findIndex((object) => object.key === report.failure.key); if (index < 0 || (report.failure.stage === 'upload' && index !== report.counts.attempted - 1) || (report.failure.stage === 'readback' && index !== report.counts.readback) || (report.failure.stage === 'cloudfront' && index !== report.counts.cloudfront)) throw new TypeError('invalid upload report') }
  if (report.status === 'match' && (report.failure !== null || report.counts.attempted !== report.counts.uploaded || report.counts.uploaded !== report.counts.readback || report.counts.readback !== report.counts.cloudfront || report.objects.some((object) => object.etag === null || object.versionId === null))) throw new TypeError('invalid upload report')
  if (report.status === 'mismatch' && report.failure === null) throw new TypeError('invalid upload report')
  if (report.status === 'mismatch') {
    const { stage, category, key } = report.failure; const { attempted, uploaded, readback, cloudfront } = report.counts
    if (stage === 'preflight' && !['config', 'preflight'].includes(category)) throw new TypeError('invalid upload report')
    if (stage === 'sts' && (category !== 'sts' || key !== null || attempted !== 0 || uploaded !== 0 || readback !== 0 || cloudfront !== 0 || report.objects.length !== 0)) throw new TypeError('invalid upload report')
    if (stage === 'preflight' && (key !== null || attempted !== 0 || uploaded !== 0 || readback !== 0 || cloudfront !== 0 || report.objects.length !== 0)) throw new TypeError('invalid upload report')
    if (stage === 'upload' && (!['collision', 'upload', 'response'].includes(category) || key !== report.objects[attempted - 1]?.key || uploaded !== attempted - 1 || readback !== 0 || cloudfront !== 0 || report.objects.some((object, index) => index < uploaded ? object.etag === null || object.versionId === null : index === attempted - 1 ? object.etag !== null || object.versionId !== null : true))) throw new TypeError('invalid upload report')
    if (stage === 'readback' && (!['readback', 'response'].includes(category) || key !== report.objects[readback]?.key || attempted !== uploaded || attempted !== report.objects.length || cloudfront !== 0 || report.objects.some((object) => object.etag === null || object.versionId === null))) throw new TypeError('invalid upload report')
    if (stage === 'cleanup' && (category !== 'readback' || key !== null || attempted !== uploaded || attempted !== readback || attempted !== report.objects.length || cloudfront !== 0 || report.objects.some((object) => object.etag === null || object.versionId === null))) throw new TypeError('invalid upload report')
    if (stage === 'cloudfront' && (!['cloudfront', 'timeout', 'response'].includes(category) || key !== report.objects[cloudfront]?.key || attempted !== uploaded || attempted !== readback || attempted !== report.objects.length || report.objects.some((object) => object.etag === null || object.versionId === null))) throw new TypeError('invalid upload report')
  }
  return report
}

export function serializeUploadReport(report) { validateUploadReport(report); return new TextEncoder().encode(`${JSON.stringify(report, null, 2)}\n`) }
export function humanUploadReport(report) { validateUploadReport(report); const lines = [`T14D upload: ${report.status.toUpperCase()}`, `Attempted: ${report.counts.attempted}`, `Uploaded: ${report.counts.uploaded}`, `Read back: ${report.counts.readback}`, `CloudFront: ${report.counts.cloudfront}`, `Failure: ${report.failure ? `${report.failure.stage}/${report.failure.category}` : 'none'}`]; for (const object of report.objects) lines.push(`- ${object.key} sha256=${object.sha256} etag=${object.etag ?? 'null'} versionId=${object.versionId ?? 'null'}`); return `${lines.join('\n')}\n` }

async function readResponseBody(response, deadlinePromise, maxBytes = MAX_BYTES) {
  const reader = response.body?.getReader?.()
  if (!reader) throw Object.assign(new Error(), { code: 'body' })
  const chunks = []; let total = 0; let completed = false
  const cancelReader = () => { try { Promise.resolve(reader.cancel()).catch(() => {}) } catch {} }
  try {
    while (true) {
      const result = await Promise.race([reader.read(), deadlinePromise]); if (result.done) break
      const chunk = bodyBytes(result.value); total += chunk.byteLength; if (total > maxBytes) { cancelReader(); throw Object.assign(new Error(), { code: 'size' }) }; chunks.push(chunk)
    }
    completed = true; return Buffer.concat(chunks, total)
  } catch (error) {
    if (error?.code !== 'size') cancelReader()
    throw error
  } finally { if (completed) { try { reader.releaseLock() } catch {} } }
}

function validateCloudFrontResponse(response, body, object) {
  if (response.status !== 200) throw Object.assign(new Error(), { code: 'status' })
  const contentType = response.headers?.get('content-type') ?? ''; if (contentType.split(';', 1)[0].trim().toLowerCase() !== 'application/json') throw Object.assign(new Error(), { code: 'headers' })
  const directives = new Map(); for (const directive of (response.headers?.get('cache-control') ?? '').split(/[,;]/)) { const [rawKey, ...rawValue] = directive.trim().split('='); if (!rawKey) continue; const key = rawKey.toLowerCase(); const value = rawValue.join('='); if (directives.has(key)) throw Object.assign(new Error(), { code: 'headers' }); directives.set(key, value) }
  if (directives.get('max-age') !== '0' || directives.get('s-maxage') !== '60') throw Object.assign(new Error(), { code: 'headers' })
  const age = response.headers?.get('age'); if (age !== null && (!/^\d+$/.test(age) || Number(age) > 60)) throw Object.assign(new Error(), { code: 'headers' })
  if (body.byteLength > MAX_BYTES || sha256(body) !== object.sha256) throw Object.assign(new Error(), { code: 'cloudfront' })
  let schedule; try { schedule = JSON.parse(new TextDecoder().decode(body)) } catch { throw Object.assign(new Error(), { code: 'cloudfront' }) }
  try { parseScheduleMonth(schedule, { stadium: object.stadium, yearMonth: object.yearMonth }) } catch { throw Object.assign(new Error(), { code: 'cloudfront' }) }
}

async function boundedFetch(fetcher, url, attempts, timeoutMs, object) {
  const controller = new AbortController(); const deadlineAt = Date.now() + timeoutMs; let deadlineTimer
  const deadlinePromise = new Promise((_, reject) => { const delay = Math.max(0, deadlineAt - Date.now()); deadlineTimer = setTimeout(() => { controller.abort(); reject(Object.assign(new Error(), { code: 'timeout' })) }, delay) })
  let lastError
  try {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (Date.now() >= deadlineAt) throw Object.assign(new Error(), { code: 'timeout' })
      try { const response = await Promise.race([fetcher(url, { method: 'GET', signal: controller.signal }), deadlinePromise]); if (response.status !== 200) throw Object.assign(new Error(), { code: 'status' }); const body = await readResponseBody(response, deadlinePromise); validateCloudFrontResponse(response, body, object); return { response, body } } catch (error) { lastError = error; if (error?.code === 'timeout' || Date.now() >= deadlineAt || attempt + 1 === attempts) throw error }
    }
  } finally { if (deadlineTimer) clearTimeout(deadlineTimer); controller.abort() }
  throw lastError
}

async function executeUploadMigrationRun(config, { runAws, fetch, approvedTarget, fsImpl = {} } = {}, performSts = true) {
  const fs = { mkdtemp, open, readdir, realpath, rm, ...fsImpl }; const objectsReport = []; const counts = { attempted: 0, uploaded: 0, readback: 0, cloudfront: 0 }
  let artifacts
  try { if (!configValid(config, approvedTarget) || typeof runAws !== 'function' || typeof fetch !== 'function') fail('config'); artifacts = await loadArtifacts(config, fs) } catch (error) { const report = { schemaVersion: 1, status: 'mismatch', counts, objects: [], failure: failureFor(error, error instanceof UploadValidationError ? 'preflight' : 'preflight') }; return { report, machineBytes: serializeUploadReport(report), human: humanUploadReport(report) } }
  if (performSts) {
    try {
      const identity = await runAws(stsArgs(config)); if (!identity || identity.Account !== ACCOUNT) throw Object.assign(new Error(), { code: 'account' })
    } catch (error) { const report = { schemaVersion: 1, status: 'mismatch', counts, objects: [], failure: { stage: 'sts', category: 'sts', key: null } }; return { report, machineBytes: serializeUploadReport(report), human: humanUploadReport(report) }
    }
  }
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
    try { await fs.rm(temp, { recursive: true, force: true }) } catch { const report = { schemaVersion: 1, status: 'mismatch', counts, objects: objectsReport, failure: { stage: 'cleanup', category: 'readback', key: null } }; temp = null; return { report, machineBytes: serializeUploadReport(report), human: humanUploadReport(report) } }; temp = null
    for (const [index, object] of artifacts.objects.entries()) {
      currentStage = 'cloudfront'; currentKey = object.key; await boundedFetch(fetch, `https://${config.distributionDomain}/${object.key}`, config.maxAttempts ?? 3, config.timeoutMs ?? 5000, object); counts.cloudfront += 1
    }
  } catch (error) { if (temp) { try { await fs.rm(temp, { recursive: true, force: true }) } catch {} }; const failure = failureFor(error, currentStage, currentKey); const report = { schemaVersion: 1, status: 'mismatch', counts, objects: objectsReport, failure }; return { report, machineBytes: serializeUploadReport(report), human: humanUploadReport(report) }
  }
  const report = { schemaVersion: 1, status: 'match', counts, objects: objectsReport, failure: null }; return { report, machineBytes: serializeUploadReport(report), human: humanUploadReport(report) }
}

export async function uploadMigrationRun(config, options = {}) {
  return executeUploadMigrationRun(config, options, true)
}
