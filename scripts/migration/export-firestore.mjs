#!/usr/bin/env node

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index]
  if (value.startsWith('--')) {
    args.set(value.slice(2), process.argv[index + 1] || true)
    index += 1
  }
}

if (args.has('help')) {
  console.log(`Read-only legacy Firestore export\n\nUsage:\n  node scripts/migration/export-firestore.mjs --output <file>\n\nCredentials (one required):\n  FIREBASE_SERVICE_ACCOUNT_JSON=<JSON>\n  GOOGLE_APPLICATION_CREDENTIALS=<path>\n\nThe script never writes to Firestore and never includes credentials in output.`)
  process.exit(0)
}

const output = args.get('output')
if (!output) {
  console.error('BLOCKED: provide --output <file>; no Firestore operation was attempted.')
  process.exit(2)
}

let adminApp
let adminFirestore
try {
  ;({ initializeApp, cert } = await import('firebase-admin/app'))
  ;({ getFirestore } = await import('firebase-admin/firestore'))
  adminApp = { initializeApp, cert }
  adminFirestore = { getFirestore }
} catch {
  console.error('BLOCKED: firebase-admin is not installed. T01 only creates this read-only interface; install it in the migration tooling task before exporting production data.')
  process.exit(2)
}

const projectId = process.env.FIREBASE_PROJECT_ID || 'itsrun-aaf42'
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
let credential
if (serviceAccountJson) {
  try {
    credential = adminApp.cert(JSON.parse(serviceAccountJson))
  } catch {
    console.error('BLOCKED: FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.')
    process.exit(2)
  }
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  credential = adminApp.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
} else {
  console.error('BLOCKED: set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS; no Firestore operation was attempted.')
  process.exit(2)
}

const app = adminApp.initializeApp({ credential, projectId })
const db = adminFirestore.getFirestore(app)
const stadiums = {
  oda: 'nVfuSmsj9cULg3712chv',
  yumenoshima: 'VFurPbbeejEbtu1JNTzF',
  komazawa: 'WrrQXe67xvIkGfMtJ51E',
  todoroki: '67c7uxgRWDkxr1S4gPaR',
}

const stadiumInfo = {}
const infoSnapshot = await db.collection('stadium_info').get()
for (const document of infoSnapshot.docs.sort((left, right) => left.id.localeCompare(right.id))) {
  stadiumInfo[document.id] = document.data()
}

const availability = {}
for (const [slug, legacyId] of Object.entries(stadiums)) {
  const dates = {}
  const dateSnapshot = await db.collection('availability').doc(legacyId).collection('date').get()
  for (const document of dateSnapshot.docs.sort((left, right) => left.id.localeCompare(right.id))) {
    dates[document.id] = document.data()
  }
  availability[slug] = { legacyId, dates }
}

const defaultDocument = await db.collection('default').doc('0').get()
const snapshot = {
  schemaVersion: 1,
  projectId,
  capturedAt: new Date().toISOString(),
  default: defaultDocument.exists ? defaultDocument.data() : null,
  stadiumInfo,
  availability,
}

const { mkdir, writeFile } = await import('node:fs/promises')
const { resolve } = await import('node:path')
const target = resolve(output)
await mkdir(resolve(target, '..'), { recursive: true })
await writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`)
console.log(`Read-only Firestore export written to ${target}`)
