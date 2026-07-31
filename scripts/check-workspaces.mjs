import { existsSync, readFileSync } from 'node:fs'
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

console.log(`Workspace structure is valid (${expected.size} packages).`)
