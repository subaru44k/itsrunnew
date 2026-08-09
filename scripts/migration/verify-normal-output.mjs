import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.argv[2] || 'web/.output/public'
const forbidden = ['admin-e2e.invalid', 'admin-e2e-client', 'ADMIN_E2E']
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true }); const result = []
  for (const entry of entries) { const path = join(directory, entry.name); if (entry.isDirectory()) result.push(...await files(path)); else result.push(path) }
  return result
}
for (const path of await files(root)) {
  const text = await readFile(path, 'utf8').catch(() => '')
  if (forbidden.some((marker) => text.includes(marker))) throw new Error(`test-only marker found in normal output: ${path}`)
}
console.log(`Normal output contains no admin E2E markers: ${root}`)
