import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const expected = new Map([
  ['web', '@itsrun/web'],
  ['packages/core', '@itsrun/core'],
  ['services/schedule-api', '@itsrun/schedule-api'],
  ['infra', '@itsrun/infra'],
])

for (const [relativePath, expectedName] of expected) {
  const packagePath = resolve(root, relativePath, 'package.json')
  if (!existsSync(packagePath)) {
    throw new Error(`Missing workspace package: ${relativePath}`)
  }

  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  if (packageJson.name !== expectedName || packageJson.private !== true) {
    throw new Error(`Invalid workspace metadata: ${relativePath}`)
  }
}

const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
if (tracked.status !== 0) throw new Error('Unable to inspect tracked migration paths')
const trackedPaths = tracked.stdout.split('\0').filter(Boolean)
if (trackedPaths.some((path) => path === 'itsrunnew' || path.startsWith('itsrunnew/'))) {
  throw new Error('Legacy itsrunnew paths remain tracked')
}

const manifests = ['package.json', ...[...expected.keys()].map((path) => `${path}/package.json`)]
for (const relativePath of manifests) {
  const packageJson = JSON.parse(readFileSync(resolve(root, relativePath), 'utf8'))
  const direct = { ...packageJson.dependencies, ...packageJson.devDependencies, ...packageJson.optionalDependencies }
  if (Object.hasOwn(direct, 'firebase-admin')) {
    throw new Error(`Removed migration dependency remains direct: ${relativePath}`)
  }
}

const activeForbidden = /firebase-admin|firestoreSnapshot|export-firestore|firestore-(?:compare|transform|upload)|legacy Vue 2 application/i
const activeFiles = trackedPaths.filter((path) => !path.startsWith('docs/aws-migration/') && path !== 'package-lock.json' && !path.startsWith('package-lock') && path !== 'scripts/check-workspaces.mjs')
for (const relativePath of activeFiles) {
  const text = readFileSync(resolve(root, relativePath), 'utf8')
  if (activeForbidden.test(text)) throw new Error(`Removed legacy reference remains active: ${relativePath}`)
}

const lockText = readFileSync(resolve(root, 'package-lock.json'), 'utf8')
if (/node_modules\/firebase-admin|"firebase-admin"\s*:/.test(lockText)) {
  throw new Error('Removed firebase-admin graph remains in root lockfile')
}

console.log(`Workspace structure and T17 removal boundary are valid (${expected.size} packages).`)
