import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const outputRoot = resolve(process.env.PREVIEW_SEED_ROOT || '.artifacts/preview-seed')
const objects = [
  {
    path: 'data/v1/stadiums/oda/availability/2026-07.json',
    body: { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-07', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-07-01': [0, 1, 2], '2026-07-02': [1, 1, 0] } },
  },
]
const manifest = { source: 'non-production fixture', generatedAt: '2026-01-01T00:00:00.000Z', objects: [] }
for (const object of objects) {
  const body = `${JSON.stringify(object.body, null, 2)}\n`
  const output = resolve(outputRoot, object.path)
  await mkdir(resolve(output, '..'), { recursive: true })
  await writeFile(output, body)
  manifest.objects.push({ key: object.path, sha256: createHash('sha256').update(body).digest('hex'), bytes: Buffer.byteLength(body), cacheControl: 'public, max-age=0, s-maxage=60' })
}
await writeFile(resolve(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Created ${manifest.objects.length} preview objects under ${outputRoot}`)
