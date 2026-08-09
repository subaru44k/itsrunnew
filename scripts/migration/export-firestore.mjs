import { createHash } from 'node:crypto'
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { normalizeFirestoreSnapshot } from '../../packages/core/src/firestoreSnapshot.ts'

export const PROJECT_ID = 'itsrun-aaf42'
export const DATABASE_ID = '(default)'
export const STADIUMS = Object.freeze({ oda: 'nVfuSmsj9cULg3712chv', yumenoshima: 'VFurPbbeejEbtu1JNTzF', komazawa: 'WrrQXe67xvIkGfMtJ51E', todoroki: '67c7uxgRWDkxr1S4gPaR' })
const MAX_DOCUMENTS = 10000
const MAX_BYTES = 1024 * 1024
const exact = (value, keys) => Object.keys(value).join('\0') === keys.join('\0')
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
const safeCoordinate = (value) => typeof value === 'string' && /^[a-z-]+(?:\[\d+\])?(?:\.document\[\d+\])?$/.test(value)

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

export function validateExportConfig(config = {}) {
  const forbidden = ['FIREBASE_SERVICE_ACCOUNT_JSON', 'GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_CONFIG', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_EMULATOR_HUB']
  if (!plain(config) || config.projectId !== PROJECT_ID || config.databaseId !== DATABASE_ID || forbidden.some((key) => config.env?.[key])) fail('config')
  if (typeof config.capturedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(config.capturedAt) || new Date(config.capturedAt).toISOString() !== config.capturedAt) fail('config')
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

export function serializeExport(result) { if (!plain(result) || !(result.snapshotBytes instanceof Uint8Array) || !(result.captureBytes instanceof Uint8Array)) fail('serialization'); return { snapshotBytes: result.snapshotBytes, captureBytes: result.captureBytes } }
function validateRunName(name) { if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name) || name === '.' || name === '..') fail('output') }
async function approvedRoot(root, fs) { const resolved = resolve(root); let info; try { info = await fs.lstat(resolved) } catch { fail('output-root') }; if (!info.isDirectory() || info.isSymbolicLink()) fail('output-root'); return fs.realpath(resolved) }
export function validateOutputName(name) { validateRunName(name); return name }

export async function writeExportRun(result, outputName, options = {}) {
  validateRunName(outputName); const fs = { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile, ...options.fs }; const root = await approvedRoot(options.artifactRoot ?? resolve(process.cwd(), '.artifacts/migration'), fs); const target = resolve(root, outputName); if (!relative(root, target) || relative(root, target).includes(sep)) fail('output')
  try { await fs.stat(target); fail('output-reuse') } catch (error) { if (error instanceof ExportValidationError) throw error; if (error?.code !== 'ENOENT') throw sanitize(error, 'output') }
  const serialized = serializeExport(result); let temp
  try { temp = await fs.mkdtemp(join(root, `.${outputName}-tmp-`)); const tempReal = await fs.realpath(temp); if (!relative(root, tempReal) || relative(root, tempReal).startsWith(`..${sep}`)) fail('output'); await fs.writeFile(join(tempReal, 'snapshot.json'), serialized.snapshotBytes, { flag: 'wx' }); await fs.writeFile(join(tempReal, 'capture.json'), serialized.captureBytes, { flag: 'wx' }); const rereadSnapshot = JSON.parse(await fs.readFile(join(tempReal, 'snapshot.json'), 'utf8')); const rereadCapture = JSON.parse(await fs.readFile(join(tempReal, 'capture.json'), 'utf8')); const rereadNormalized = normalizeFirestoreSnapshot(rereadSnapshot); if (sha256(canonicalBytes({ schemaVersion: 1, records: rereadNormalized }, 'normalized')) !== rereadCapture.normalizedDataSha256) fail('reread'); await fs.rename(tempReal, target); temp = null; return target } catch (error) { if (temp) { try { await fs.rm(temp, { recursive: true, force: true }) } catch {} }; throw sanitize(error, 'output') }
}

function parseArgs(argv) { const args = new Map(); for (let index = 0; index < argv.length; index += 1) { const arg = argv[index]; if (arg === '--help' && argv.length === 1) { args.set('help', true); continue }; if (arg !== '--output' || !argv[index + 1] || argv[index + 1].startsWith('--') || args.has('output') || argv.length !== 2) fail('invocation'); args.set('output', argv[++index]) } return args }
function usage() { console.log('Read-only legacy Firestore export\n\nUsage:\n  node scripts/migration/export-firestore.mjs --output <single-run-name>') }
export async function runCli(argv = process.argv.slice(2), env = process.env, loader) { const args = parseArgs(argv); if (args.has('help')) { usage(); return 0 }; if (!args.has('output')) return 2; const name = validateOutputName(args.get('output')); const config = validateExportConfig({ projectId: PROJECT_ID, databaseId: DATABASE_ID, capturedAt: new Date().toISOString(), env }); const load = loader ?? (async () => { const app = await import('firebase-admin/app'); const firestore = await import('firebase-admin/firestore'); return { ...app, ...firestore } }); const sdk = await load(); let app; try { app = sdk.initializeApp({ credential: sdk.applicationDefault(), projectId: PROJECT_ID }); const db = sdk.getFirestore(app, DATABASE_ID); const adapter = { getDocument: async (path) => { const snap = await db.doc(path).get(); return { exists: snap.exists, data: snap.exists ? snap.data() : null } }, getCollection: async (path) => { const snap = await db.collection(path).get(); return { docs: snap.docs.map((doc) => ({ id: doc.id, data: doc.data() })) } } }; const result = await readFirestoreSnapshot(adapter, config); await writeExportRun(result, name); console.log('Read-only Firestore export completed.'); return 0 } finally { if (app && typeof sdk.deleteApp === 'function') await sdk.deleteApp(app).catch(() => {}) } }

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) { try { process.exitCode = await runCli() } catch (error) { const safe = sanitize(error, 'invocation'); console.error(`BLOCKED: ${safe.message}`); process.exitCode = 2 } }
