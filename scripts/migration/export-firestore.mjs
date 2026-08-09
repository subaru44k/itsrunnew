import { createHash } from 'node:crypto'
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { normalizeFirestoreSnapshot } from '../../packages/core/src/firestoreSnapshot.ts'

export const PROJECT_ID = 'itsrun-aaf42'
export const DATABASE_ID = '(default)'
export const STADIUMS = Object.freeze({ oda: 'nVfuSmsj9cULg3712chv', yumenoshima: 'VFurPbbeejEbtu1JNTzF', komazawa: 'WrrQXe67xvIkGfMtJ51E', todoroki: '67c7uxgRWDkxr1S4gPaR' })
const MAX_DOCUMENTS = 10000
const MAX_BYTES = 1024 * 1024
const exact = (value, keys) => Object.keys(value).join('\0') === keys.join('\0')
const exactSorted = (value, keys) => Object.keys(value).sort().join('\0') === [...keys].sort().join('\0')
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
const safeCoordinate = (value) => typeof value === 'string' && /^[a-z-]+(?:\[\d+\])?(?:\.document\[\d+\])?$/.test(value)
const preflightHandles = new WeakSet()
const adcHandles = new WeakSet()
const ADC_FILENAME = 'application_default_credentials.json'
const IMPERSONATED_ACCOUNT = 'itsrun-fs-export-20260809@itsrun-aaf42.iam.gserviceaccount.com'
const MAX_ADC_BYTES = 64 * 1024

export class ExportValidationError extends Error {
  constructor(category, coordinate = 'export') { super(`Firestore export validation failed (${category}) at ${safeCoordinate(coordinate) ? coordinate : 'export'}`); this.name = 'ExportValidationError'; this.category = category; this.coordinate = safeCoordinate(coordinate) ? coordinate : 'export' }
}
const fail = (category, coordinate = 'export') => { throw new ExportValidationError(category, coordinate) }
const sanitize = (error, category = 'adapter') => error instanceof ExportValidationError ? error : new ExportValidationError(category)
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const bytes = (value) => new TextEncoder().encode(`${JSON.stringify(value)}\n`)
const canonicalize = (value, coordinate = 'export', seen = new WeakSet()) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('value', coordinate); return value }
  if (typeof value !== 'object' || seen.has(value)) fail('value', coordinate)
  if (Array.isArray(value)) { seen.add(value); const out = value.map((item, index) => canonicalize(item, `${coordinate}[${index}]`, seen)); seen.delete(value); return out }
  if (!plain(value)) fail('value', coordinate)
  seen.add(value); const out = {}; for (const key of Object.keys(value).sort()) { if (value[key] === undefined || typeof value[key] === 'function' || typeof value[key] === 'symbol' || typeof value[key] === 'bigint') fail('value', coordinate); out[key] = canonicalize(value[key], coordinate, seen) }; seen.delete(value); return out
}
const canonicalBytes = (value, coordinate) => { const encoded = bytes(canonicalize(value, coordinate)); if (encoded.byteLength > MAX_BYTES) fail('size', coordinate); return encoded }
const isHash = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const isCapturedAt = (value) => { if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) return false; try { return new Date(value).toISOString() === value } catch { return false } }
const isSafeCredentialValue = (value) => typeof value === 'string' && value.length > 0 && value.length <= 4096
const isAccount = (value) => value === '' || (typeof value === 'string' && value.length <= 320 && /^[^@\s]{1,128}@[^@\s]{1,255}$/.test(value))
const isImpersonationUrl = (value) => { if (typeof value !== 'string') return false; try { const url = new URL(value); if (url.protocol !== 'https:' || url.hostname !== 'iamcredentials.googleapis.com' || url.port || url.search || url.hash) return false; const match = /^\/v1\/projects\/-\/serviceAccounts\/(.+):generateAccessToken$/u.exec(url.pathname); if (!match) return false; const target = decodeURIComponent(match[1]); return target === IMPERSONATED_ACCOUNT && (match[1] === IMPERSONATED_ACCOUNT || match[1] === encodeURIComponent(IMPERSONATED_ACCOUNT)) } catch { return false } }

export function validateImpersonatedAdc(value) {
  if (!plain(value) || !exactSorted(value, ['delegates', 'service_account_impersonation_url', 'source_credentials', 'type']) || value.type !== 'impersonated_service_account' || !Array.isArray(value.delegates) || value.delegates.length !== 0 || !isImpersonationUrl(value.service_account_impersonation_url) || !plain(value.source_credentials) || !exactSorted(value.source_credentials, ['account', 'client_id', 'client_secret', 'refresh_token', 'type', 'universe_domain']) || value.source_credentials.type !== 'authorized_user' || value.source_credentials.universe_domain !== 'googleapis.com' || !isAccount(value.source_credentials.account) || !isSafeCredentialValue(value.source_credentials.client_id) || !isSafeCredentialValue(value.source_credentials.client_secret) || !isSafeCredentialValue(value.source_credentials.refresh_token)) fail('adc')
  return true
}

async function preflightAdc(adcPath, options = {}) {
  if (typeof adcPath !== 'string' || !isAbsolute(adcPath) || basename(adcPath) !== ADC_FILENAME) fail('adc')
  const fs = { lstat, readFile, realpath, ...options.fs }; const credentialRoot = resolve(options.credentialRoot ?? join(process.cwd(), '.artifacts/gcloud-t14e'))
  let rootInfo
  try { rootInfo = await fs.lstat(credentialRoot) } catch { fail('adc-root') }
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) fail('adc-root')
  const rootReal = await fs.realpath(credentialRoot); let requestedParent; try { requestedParent = await fs.realpath(dirname(adcPath)) } catch { fail('adc') }; const requested = join(requestedParent, basename(adcPath)); const requestedRel = relative(rootReal, requested); if (!requestedRel || requestedRel.startsWith(`..${sep}`) || isAbsolute(requestedRel)) fail('adc')
  const parts = requestedRel.split(sep); let current = rootReal
  for (const part of parts) { current = join(current, part); let info; try { info = await fs.lstat(current) } catch { fail('adc') }; if (info.isSymbolicLink()) fail('adc') }
  const real = await fs.realpath(requested); const realRel = relative(rootReal, real); if (realRel !== ADC_FILENAME || isAbsolute(realRel) || realRel.startsWith(`..${sep}`)) fail('adc')
  const fileInfo = await fs.lstat(real); if (!fileInfo.isFile() || fileInfo.isSymbolicLink() || fileInfo.size > MAX_ADC_BYTES) fail('adc')
  let parsed; try { parsed = JSON.parse(await fs.readFile(real, 'utf8')) } catch { fail('adc') }
  validateImpersonatedAdc(parsed)
  const handle = Object.freeze({ realPath: real }); adcHandles.add(handle); return handle
}

export function validateCapture(capture, snapshot, normalizedDataSha256 = undefined) {
  if (!plain(capture) || !plain(snapshot) || !exactSorted(capture, ['schemaVersion', 'projectId', 'databaseId', 'capturedAt', 'normalizedDataSha256', 'counts', 'contexts']) || capture.schemaVersion !== 1 || capture.projectId !== PROJECT_ID || capture.databaseId !== DATABASE_ID || !isCapturedAt(capture.capturedAt) || !isHash(capture.normalizedDataSha256)) fail('capture')
  if (!plain(capture.counts) || !exactSorted(capture.counts, ['collections', 'documents', 'stadiumInfo']) || ![capture.counts.collections, capture.counts.documents, capture.counts.stadiumInfo].every((value) => Number.isInteger(value) && value >= 0)) fail('capture')
  if (!plain(capture.contexts) || !exactSorted(capture.contexts, ['default', 'stadiumInfo']) || !plain(capture.contexts.default) || !plain(capture.contexts.stadiumInfo) || !exactSorted(capture.contexts.default, ['exists', 'bytes', 'sha256']) || !exactSorted(capture.contexts.stadiumInfo, ['bytes', 'sha256'])) fail('capture')
  const defaultContext = capture.contexts.default
  const infoContext = capture.contexts.stadiumInfo
  if (typeof defaultContext.exists !== 'boolean' || !Number.isInteger(defaultContext.bytes) || defaultContext.bytes < 0 || (defaultContext.exists ? !isHash(defaultContext.sha256) : defaultContext.bytes !== 0 || defaultContext.sha256 !== null) || !Number.isInteger(infoContext.bytes) || infoContext.bytes < 0 || !isHash(infoContext.sha256)) fail('capture')
  if (!plain(snapshot) || snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.collections) || snapshot.collections.length !== capture.counts.collections || snapshot.collections.some((item) => !plain(item) || !Array.isArray(item.documents))) fail('capture')
  const documents = snapshot.collections.reduce((sum, item) => sum + item.documents.length, 0)
  if (documents !== capture.counts.documents || capture.counts.collections !== Object.keys(STADIUMS).length) fail('capture')
  let normalized
  try { normalized = normalizeFirestoreSnapshot(snapshot) } catch { fail('capture') }
  const computed = sha256(canonicalBytes({ schemaVersion: 1, records: normalized }, 'normalized'))
  if (computed !== capture.normalizedDataSha256 || (normalizedDataSha256 !== undefined && computed !== normalizedDataSha256)) fail('capture')
  return capture
}

export function validateExportConfig(config = {}) {
  const forbidden = ['FIREBASE_SERVICE_ACCOUNT_JSON', 'GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_CONFIG', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_EMULATOR_HUB']
  if (!plain(config) || config.projectId !== PROJECT_ID || config.databaseId !== DATABASE_ID || forbidden.some((key) => config.env?.[key])) fail('config')
  if (!isCapturedAt(config.capturedAt)) fail('config')
  return { projectId: PROJECT_ID, databaseId: DATABASE_ID, capturedAt: config.capturedAt }
}
export function buildReadPlan() { return [{ operation: 'document', path: 'default/0' }, { operation: 'collection', path: 'stadium_info' }, ...Object.entries(STADIUMS).map(([slug, legacyId]) => ({ operation: 'collection', path: `availability/${legacyId}/date`, slug }))] }
function validateAdapter(adapter) { if (!plain(adapter) || typeof adapter.getDocument !== 'function' || typeof adapter.getCollection !== 'function') fail('adapter'); for (const key of Object.keys(adapter)) if (/^(set|add|update|delete|batch|runTransaction|onSnapshot|auth|storage|collectionGroup)/i.test(key)) fail('adapter') }
async function readCall(adapter, method, path) { try { return await adapter[method](path) } catch (error) { throw sanitize(error) } }
function docsFromCollection(value, coordinate) { if (!plain(value) || !Array.isArray(value.docs) || value.docs.length > MAX_DOCUMENTS) fail('count', coordinate); const ids = new Set(); return value.docs.map((doc, index) => { if (!plain(doc) || typeof doc.id !== 'string' || ids.has(doc.id)) fail('document-shape', `${coordinate}.document[${index}]`); ids.add(doc.id); canonicalBytes(doc.data, `${coordinate}.document[${index}]`); return { id: doc.id, data: canonicalize(doc.data, `${coordinate}.document[${index}]`) } }).sort((a, b) => a.id.localeCompare(b.id)) }

export async function readFirestoreSnapshot(adapter, config) {
  const validated = validateExportConfig(config); validateAdapter(adapter); const plan = buildReadPlan(); const defaultValue = await readCall(adapter, 'getDocument', 'default/0'); const infoDocs = docsFromCollection(await readCall(adapter, 'getCollection', 'stadium_info'), 'stadium_info')
  if (!plain(defaultValue) || typeof defaultValue.exists !== 'boolean' || (defaultValue.exists && !plain(defaultValue.data))) fail('document-shape', 'default'); if (defaultValue.exists) canonicalBytes(defaultValue.data, 'default')
  const collections = []; for (const item of plan.slice(2)) { const docs = docsFromCollection(await readCall(adapter, 'getCollection', item.path), item.path); collections.push({ slug: item.slug, legacyId: STADIUMS[item.slug], documents: docs.map((doc) => ({ path: `${item.path.replace(/\/date$/, '')}/date/${doc.id}`, data: doc.data })) }) }
  const snapshot = canonicalize({ schemaVersion: 1, collections }, 'snapshot'); let normalized; try { normalized = normalizeFirestoreSnapshot(snapshot) } catch (error) { throw sanitize(error, 'snapshot') }
  const snapshotBytes = canonicalBytes(snapshot, 'snapshot'); const normalizedDataBytes = canonicalBytes({ schemaVersion: 1, records: normalized }, 'normalized'); const infoContext = canonicalBytes(infoDocs, 'stadium_info'); const defaultContext = defaultValue.exists ? canonicalBytes(defaultValue.data, 'default') : new Uint8Array()
  const capture = canonicalize({ schemaVersion: 1, projectId: validated.projectId, databaseId: validated.databaseId, capturedAt: validated.capturedAt, normalizedDataSha256: sha256(normalizedDataBytes), counts: { collections: collections.length, documents: collections.reduce((sum, item) => sum + item.documents.length, 0), stadiumInfo: infoDocs.length }, contexts: { default: { exists: defaultValue.exists, bytes: defaultContext.byteLength, sha256: defaultValue.exists ? sha256(defaultContext) : null }, stadiumInfo: { bytes: infoContext.byteLength, sha256: sha256(infoContext) } } }, 'capture'); const captureBytes = canonicalBytes(capture, 'capture')
  return { snapshot, snapshotBytes, capture, captureBytes, normalizedDataSha256: capture.normalizedDataSha256, plan }
}

export function serializeExport(result) { if (!plain(result) || !plain(result.snapshot) || !plain(result.capture) || !(result.snapshotBytes instanceof Uint8Array) || !(result.captureBytes instanceof Uint8Array)) fail('serialization'); const expectedSnapshot = canonicalBytes(result.snapshot, 'snapshot'); let normalized; try { normalized = normalizeFirestoreSnapshot(result.snapshot) } catch { fail('serialization') }; const expectedHash = sha256(canonicalBytes({ schemaVersion: 1, records: normalized }, 'normalized')); validateCapture(result.capture, result.snapshot, expectedHash); const expectedCapture = canonicalBytes(result.capture, 'capture'); if (JSON.stringify([...expectedSnapshot]) !== JSON.stringify([...result.snapshotBytes]) || JSON.stringify([...expectedCapture]) !== JSON.stringify([...result.captureBytes])) fail('serialization'); return { snapshotBytes: expectedSnapshot, captureBytes: expectedCapture } }
function validateRunName(name) { if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name) || name === '.' || name === '..') fail('output') }
export function validateOutputName(name) { validateRunName(name); return name }

export async function preflightOutput(name, options = {}) {
  validateRunName(name); const fs = { lstat, mkdir, realpath, stat, ...options.fs }; const workspace = resolve(options.workspaceRoot ?? process.cwd()); const artifactRoot = resolve(options.artifactRoot ?? join(workspace, '.artifacts/migration')); let workspaceInfo
  try { workspaceInfo = await fs.lstat(workspace) } catch { fail('output-root') }; if (!workspaceInfo.isDirectory() || workspaceInfo.isSymbolicLink()) fail('output-root')
  const workspaceReal = await fs.realpath(workspace); const requestedRel = relative(workspace, artifactRoot); if (requestedRel.startsWith(`..${sep}`) || isAbsolute(requestedRel)) fail('output-root'); const canonicalArtifactRoot = resolve(workspaceReal, requestedRel)
  const artifactParent = dirname(canonicalArtifactRoot); try { const parentInfo = await fs.lstat(artifactParent); if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) fail('output-root') } catch (error) { if (error?.code !== 'ENOENT') throw error; await fs.mkdir(artifactParent, { recursive: true }) }
  try { await fs.lstat(canonicalArtifactRoot) } catch (error) { if (error?.code !== 'ENOENT') fail('output-root'); await fs.mkdir(canonicalArtifactRoot, { recursive: false }) }
  const rootInfo = await fs.lstat(canonicalArtifactRoot); if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) fail('output-root'); const rootReal = await fs.realpath(canonicalArtifactRoot); const rootRel = relative(workspaceReal, rootReal); if (!rootRel || rootRel.startsWith(`..${sep}`) || isAbsolute(rootRel)) fail('output-root')
  const target = resolve(rootReal, name); if (relative(rootReal, target) !== name) fail('output'); try { await fs.lstat(target); fail('output-reuse') } catch (error) { if (error instanceof ExportValidationError) throw error; if (error?.code !== 'ENOENT') throw sanitize(error, 'output') }
  const handle = Object.freeze({ rootReal, target, workspaceReal, outputName: name })
  preflightHandles.add(handle)
  return handle
}

export async function writeExportRun(result, outputName, options = {}) {
  validateRunName(outputName); const fs = { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat, writeFile, ...options.fs }; const handle = options.targetHandle ?? await preflightOutput(outputName, options); if (!preflightHandles.has(handle) || !plain(handle) || Object.keys(handle).sort().join('\0') !== ['outputName', 'rootReal', 'target', 'workspaceReal'].sort().join('\0') || handle.outputName !== outputName || typeof handle.rootReal !== 'string' || typeof handle.target !== 'string' || typeof handle.workspaceReal !== 'string') fail('output-root'); const root = handle.rootReal; const target = handle.target; const expectedTarget = resolve(root, outputName); const rootRel = relative(handle.workspaceReal, root); const targetRel = relative(root, target); if (rootRel.startsWith(`..${sep}`) || isAbsolute(rootRel) || target !== expectedTarget || targetRel !== outputName || targetRel.startsWith(`..${sep}`) || isAbsolute(targetRel)) fail('output-root'); const rereadRoot = await fs.realpath(root); if (rereadRoot !== root) fail('output-root'); const rootInfo = await fs.lstat(root); if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) fail('output-root')
  try { await fs.stat(target); fail('output-reuse') } catch (error) { if (error instanceof ExportValidationError) throw error; if (error?.code !== 'ENOENT') throw sanitize(error, 'output') }
  const serialized = serializeExport(result); let temp
  try { temp = await fs.mkdtemp(join(root, `.${outputName}-tmp-`)); const tempReal = await fs.realpath(temp); if (!relative(root, tempReal) || relative(root, tempReal).startsWith(`..${sep}`)) fail('output'); await fs.writeFile(join(tempReal, 'snapshot.json'), serialized.snapshotBytes, { flag: 'wx' }); await fs.writeFile(join(tempReal, 'capture.json'), serialized.captureBytes, { flag: 'wx' }); const files = (await fs.readdir(tempReal)).sort(); if (files.length !== 2 || files[0] !== 'capture.json' || files[1] !== 'snapshot.json') fail('reread'); for (const filename of files) { const info = await fs.lstat(join(tempReal, filename)); if (!info.isFile() || info.isSymbolicLink()) fail('reread') }; const rereadSnapshotBytes = new Uint8Array(await fs.readFile(join(tempReal, 'snapshot.json'))); const rereadCaptureBytes = new Uint8Array(await fs.readFile(join(tempReal, 'capture.json'))); if (JSON.stringify([...rereadSnapshotBytes]) !== JSON.stringify([...serialized.snapshotBytes]) || JSON.stringify([...rereadCaptureBytes]) !== JSON.stringify([...serialized.captureBytes])) fail('reread'); const rereadSnapshot = JSON.parse(new TextDecoder().decode(rereadSnapshotBytes)); const rereadCapture = JSON.parse(new TextDecoder().decode(rereadCaptureBytes)); validateCapture(rereadCapture, rereadSnapshot, result.capture.normalizedDataSha256); const beforeRenameRoot = await fs.realpath(root); if (beforeRenameRoot !== root) fail('output-root'); try { await fs.lstat(target); fail('output-reuse') } catch (error) { if (error instanceof ExportValidationError) throw error; if (error?.code !== 'ENOENT') throw sanitize(error, 'output') }; await fs.rename(tempReal, target); temp = null; return target } catch (error) { if (temp) { try { await fs.rm(temp, { recursive: true, force: true }) } catch {} }; throw sanitize(error, 'output') }
}

function parseArgs(argv) { if (argv.length === 0) return new Map(); if (argv.length === 1 && argv[0] === '--help') return new Map([['help', true]]); if (argv.length !== 4 || argv[0] !== '--output' || argv[2] !== '--impersonated-adc' || !argv[1] || !argv[3]) fail('invocation'); return new Map([['output', argv[1]], ['adc', argv[3]]]) }
function usage() { console.log('Read-only legacy Firestore export\n\nUsage:\n  node scripts/migration/export-firestore.mjs --output <single-run-name> --impersonated-adc <absolute-ADC-path>') }
export async function runCli(argv = process.argv.slice(2), env = process.env, loader, options = {}) { const args = parseArgs(argv); if (args.has('help')) { usage(); return 0 }; if (!args.has('output')) return 2; const name = validateOutputName(args.get('output')); const targetHandle = await preflightOutput(name, options); const adcHandle = await preflightAdc(args.get('adc'), options); const config = validateExportConfig({ projectId: PROJECT_ID, databaseId: DATABASE_ID, capturedAt: new Date().toISOString(), env }); const load = loader ?? (async () => { const app = await import('firebase-admin/app'); const firestore = await import('firebase-admin/firestore'); return { ...app, ...firestore } }); let sdk; try { sdk = await load() } catch (error) { throw sanitize(error, 'sdk') }; let app; let primaryError; let resultCode; const hadCredentialEnv = Object.prototype.hasOwnProperty.call(process.env, 'GOOGLE_APPLICATION_CREDENTIALS'); const previousCredentialEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS; try { process.env.GOOGLE_APPLICATION_CREDENTIALS = adcHandle.realPath; const credential = await sdk.applicationDefault(); app = await sdk.initializeApp({ credential, projectId: PROJECT_ID }); const db = await sdk.getFirestore(app, DATABASE_ID); const adapter = { getDocument: async (path) => { const snap = await db.doc(path).get(); return { exists: snap.exists, data: snap.exists ? snap.data() : null } }, getCollection: async (path) => { const snap = await db.collection(path).get(); return { docs: snap.docs.map((doc) => ({ id: doc.id, data: doc.data() })) } } }; const result = await readFirestoreSnapshot(adapter, config); await writeExportRun(result, name, { ...options, targetHandle }); resultCode = 0 } catch (error) { primaryError = sanitize(error, 'sdk') } finally { if (app && typeof sdk.deleteApp === 'function') { try { await sdk.deleteApp(app) } catch (error) { if (!primaryError) primaryError = sanitize(error, 'cleanup') } } try { if (hadCredentialEnv) process.env.GOOGLE_APPLICATION_CREDENTIALS = previousCredentialEnv; else delete process.env.GOOGLE_APPLICATION_CREDENTIALS } catch (error) { if (!primaryError) primaryError = sanitize(error, 'cleanup') } } if (primaryError) throw primaryError; console.log('Read-only Firestore export completed.'); return resultCode }

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) { try { process.exitCode = await runCli() } catch (error) { const safe = sanitize(error, 'invocation'); console.error(`BLOCKED: ${safe.message}`); process.exitCode = 2 } }
