import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
const root = resolve(process.env.PREVIEW_SEED_ROOT || '.artifacts/preview-seed')
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'))
for (const object of manifest.objects) {
  const body = await readFile(resolve(root, object.key))
  const hash = createHash('sha256').update(body).digest('hex')
  if (hash !== object.sha256) throw new Error(`Hash mismatch: ${object.key}`)
}
console.log(`Verified ${manifest.objects.length} preview objects`)
