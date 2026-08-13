import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
const root = resolve(process.env.PREVIEW_SEED_ROOT || '.artifacts/preview-seed')
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'))
if (manifest.source !== 'non-production fixture' || manifest.schemaVersion !== 1 || manifest.sourceCount !== 7 || !manifest.dateRange || !Array.isArray(manifest.objects) || manifest.objects.length < 1) throw new Error('Invalid preview manifest')
let count = 0
for (const object of manifest.objects) {
  const body = await readFile(resolve(root, object.key))
  const hash = createHash('sha256').update(body).digest('hex')
  if (hash !== object.sha256) throw new Error(`Hash mismatch: ${object.key}`)
  count += object.sourceCount
}
if (count !== manifest.sourceCount) throw new Error('Manifest source count mismatch')
console.log(`Verified ${manifest.objects.length} preview objects`)
