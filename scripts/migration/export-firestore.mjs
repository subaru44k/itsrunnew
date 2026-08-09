#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { normalizeFirestoreSnapshot } from '../../packages/core/src/firestoreSnapshot.ts'

export const PROJECT_ID = 'itsrun-aaf42'
export const DATABASE_ID = '(default)'
export const STADIUMS = Object.freeze({ oda: 'nVfuSmsj9cULg3712chv', yumenoshima: 'VFurPbbeejEbtu1JNTzF', komazawa: 'WrrQXe67xvIkGfMtJ51E', todoroki: '67c7uxgRWDkxr1S4gPaR' })
const MAX_DOCUMENTS = 10000
const MAX_SERIALIZED_BYTES = 1024 * 1024
const exact = (value, keys) => Object.keys(value).join('\u0000') === keys.join('\u0000')
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
const safeCoordinate = (value) => typeof value === 'string' && /^[a-z-]+(?:\[\d+\])?(?:\.document\[\d+\])?$/.test(value)
const fail = (category, coordinate = 'export') => { throw new ExportValidationError(category, coordinate) }

export class ExportValidationError extends Error {
  constructor(category, coordinate = 'export') { super(`Firestore export validation failed (${category}) at ${safeCoordinate(coordinate) ? coordinate : 'export'}`); this.name = 'ExportValidationError'; this.category = category; this.coordinate = safeCoordinate(coordinate) ? coordinate : 'export' }
}

const sanitize = (error, category = 'adapter') => error instanceof ExportValidationError ? error : new ExportValidationError(category)
const cloneData = (value) => { try { return structuredClone(value) } catch { fail('document-shape') } }
const bodyBytes = (value) => new TextEncoder().encode(`${JSON.stringify(value)}\n`)
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

export function validateExportConfig(config = {}) {
  const forbiddenEnv = ['FIREBASE_SERVICE_ACCOUNT_JSON', 'GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_CONFIG', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_EMULATOR_HUB']
  if (!plain(config) || config.projectId !== PROJECT_ID || config.databaseId !== DATABASE_ID || forbiddenEnv.some((key) => config.env?.[key])) fail('config')
  if (typeof config.capturedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(config.capturedAt) || new Date(config.capturedAt).toISOString() !== config.capturedAt) fail('config')
  return { projectId: PROJECT_ID, databaseId: DATABASE_ID, capturedAt: config.capturedAt }
}

export function buildReadPlan() {
  return [{ operation: 'document', path: 'default/0' }, { operation: 'collection', path: 'stadium_info' }, ...Object.entries(STADIUMS).map(([slug, legacyId]) => ({ operation: 'collection', path: `availability/${legacyId}/date`, slug }))]
}

function validateAdapter(adapter) {
  if (!plain(adapter) || typeof adapter.getDocument !== 'function' || typeof adapter.getCollection !== 'function') fail('adapter')
  for (const key of Object.keys(adapter)) if (/^(set|add|update|delete|batch|runTransaction|onSnapshot|auth|storage|collectionGroup)/i.test(key)) fail('adapter')
}

function docsFromCollection(value, coordinate) {
  if (!plain(value) || !Array.isArray(value.docs) || value.docs.length > MAX_DOCUMENTS) fail('count', coordinate)
  return value.docs.map((doc, index) => { if (!plain(doc) || typeof doc.id !== 'string' || !plain(doc.data)) fail('document-shape', `${coordinate}.document[${index}]`); return { id: doc.id, data: cloneData(doc.data) } }).sort((left, right) => left.id.localeCompare(right.id))
}

export async function readFirestoreSnapshot(adapter, config) {
  const validated = validateExportConfig(config); validateAdapter(adapter); const read = async (method, path) => { try { return await adapter[method](path) } catch (error) { throw sanitize(error) } }
  const plan = buildReadPlan(); const defaultValue = await read('getDocument', 'default/0'); const infoValue = await read('getCollection', 'stadium_info')
  if (!plain(defaultValue) || typeof defaultValue.exists !== 'boolean' || (defaultValue.exists && !plain(defaultValue.data))) fail('document-shape', 'default')
  const stadiumInfoDocs = docsFromCollection(infoValue, 'stadium_info'); const stadiumInfo = Object.fromEntries(stadiumInfoDocs.map((doc) => [doc.id, doc.data])); const collections = []
  for (const item of plan.slice(2)) { const collection = docsFromCollection(await read('getCollection', item.path), item.path); collections.push({ slug: item.slug, legacyId: STADIUMS[item.slug], documents: collection.map((doc) => ({ path: `${item.path.replace(/\/date$/, '')}/date/${doc.id}`, data: doc.data })) }) }
  const raw = { schemaVersion: 1, collections }; let normalized
  try { normalized = normalizeFirestoreSnapshot(raw) } catch (error) { throw sanitize(error, 'snapshot') }
  const normalizedData = { schemaVersion: 1, collections: normalized }
  const normalizedDataBytes = bodyBytes(normalizedData); if (normalizedDataBytes.byteLength > MAX_SERIALIZED_BYTES) fail('size')
  const snapshot = { schemaVersion: 1, projectId: validated.projectId, databaseId: validated.databaseId, capturedAt: validated.capturedAt, default: defaultValue.exists ? cloneData(defaultValue.data) : null, stadiumInfo, availability: Object.fromEntries(collections.map((collection) => [collection.slug, { legacyId: collection.legacyId, dates: Object.fromEntries(collection.documents.map((doc) => [doc.path.split('/').at(-1), doc.data])) }])) }
  const snapshotBytes = bodyBytes(snapshot); if (snapshotBytes.byteLength > MAX_SERIALIZED_BYTES) fail('size')
  return { snapshot, normalizedDataBytes, normalizedDataSha256: sha256(normalizedDataBytes), capture: { projectId: validated.projectId, databaseId: validated.databaseId, capturedAt: validated.capturedAt }, plan }
}

export function serializeExport(result) {
  if (!plain(result) || !plain(result.snapshot) || !(result.normalizedDataBytes instanceof Uint8Array) || !/^[a-f0-9]{64}$/.test(result.normalizedDataSha256)) fail('serialization')
  const output = { schemaVersion: 1, capture: result.capture, normalizedDataSha256: result.normalizedDataSha256, snapshot: result.snapshot }; const bytes = bodyBytes(output); if (bytes.byteLength > MAX_SERIALIZED_BYTES) fail('size'); return bytes
}

export function validateOutputDir(output, cwd = process.cwd()) {
  if (typeof output !== 'string' || !isAbsolute(output)) fail('output')
  const root = resolve(cwd, '.artifacts/migration'); const target = resolve(output); const rel = relative(root, target)
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel) || rel.includes(sep) || basename(target).startsWith('.')) fail('output')
  return target
}

export async function writeExportRun(result, output, fs = {}) {
  const io = { mkdir, mkdtemp, rename, rm, stat, writeFile, ...fs }; const target = validateOutputDir(output); try { await io.stat(target); fail('output-reuse') } catch (error) { if (error instanceof ExportValidationError) throw error; if (error?.code !== 'ENOENT') throw sanitize(error, 'output') }
  const bytes = serializeExport(result); const parent = dirname(target); let temp
  try { await io.mkdir(parent, { recursive: true }); temp = await io.mkdtemp(join(parent, `.${basename(target)}-tmp-`)); await io.writeFile(join(temp, 'export.json'), bytes, { flag: 'wx' }); await io.rename(temp, target); return target } catch (error) { if (temp) { try { await io.rm(temp, { recursive: true, force: true }) } catch {} }; throw sanitize(error, 'output') }
}

function parseArgs(argv) { const args = new Map(); for (let index = 0; index < argv.length; index += 1) { if (!argv[index].startsWith('--')) fail('invocation'); const key = argv[index].slice(2); if (key === 'help') { args.set(key, true); continue }; if (!argv[index + 1] || argv[index + 1].startsWith('--')) fail('invocation'); args.set(key, argv[index + 1]); index += 1 } return args }
function usage() { console.log('Read-only legacy Firestore export\n\nUsage:\n  node scripts/migration/export-firestore.mjs --output <new-run>') }

export async function runCli(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv); if (args.has('help')) { usage(); return 0 }
  const output = args.get('output'); if (!output) { console.error('BLOCKED: provide --output <new ignored run>; no Firestore operation was attempted.'); return 2 }
  const outputDir = validateOutputDir(resolve(output)); validateExportConfig({ projectId: PROJECT_ID, databaseId: DATABASE_ID, capturedAt: new Date().toISOString(), env })
  const { applicationDefault, initializeApp } = await import('firebase-admin/app'); const { getFirestore } = await import('firebase-admin/firestore'); const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID }); const db = getFirestore(app, DATABASE_ID)
  const adapter = { getDocument: async (path) => { const snap = await db.doc(path).get(); return { exists: snap.exists, data: snap.exists ? snap.data() : null } }, getCollection: async (path) => { const snap = await db.collection(path).get(); return { docs: snap.docs.map((doc) => ({ id: doc.id, data: doc.data() })) } } }
  const result = await readFirestoreSnapshot(adapter, { projectId: PROJECT_ID, databaseId: DATABASE_ID, capturedAt: new Date().toISOString(), env }); await writeExportRun(result, outputDir); console.log('Read-only Firestore export completed.'); return 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) { try { process.exitCode = await runCli() } catch (error) { const safe = sanitize(error, 'invocation'); console.error(`BLOCKED: ${safe.message}`); process.exitCode = 2 } }
