import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

function argument(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

const start = argument('start') || process.env.PREVIEW_SEED_START
if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error('Usage: node create-preview-seed.mjs --start YYYY-MM-DD')
const startDate = new Date(`${start}T00:00:00Z`)
if (Number.isNaN(startDate.valueOf())) throw new Error(`Invalid start date: ${start}`)
const outputRoot = resolve(process.env.PREVIEW_SEED_ROOT || '.artifacts/preview-seed')
const day = (offset) => {
  const date = new Date(startDate)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}
const groups = new Map()
for (let offset = 0; offset < 7; offset += 1) {
  const date = day(offset)
  const yearMonth = date.slice(0, 7)
  const days = groups.get(yearMonth) || {}
  days[date] = [offset % 3, (offset + 1) % 3, (offset + 2) % 3]
  groups.set(yearMonth, days)
}
const objects = [...groups.entries()].map(([yearMonth, days]) => ({
  path: `data/v1/stadiums/oda/availability/${yearMonth}.json`,
  body: { schemaVersion: 1, stadium: 'oda', yearMonth, updatedAt: '2026-01-01T00:00:00.000Z', days },
}))
const manifest = { source: 'non-production fixture', schemaVersion: 1, generatedAt: '2026-01-01T00:00:00.000Z', sourceCount: 7, dateRange: { start: day(0), end: day(6) }, objects: [] }
for (const object of objects) {
  const body = `${JSON.stringify(object.body, null, 2)}\n`
  const output = resolve(outputRoot, object.path)
  await mkdir(resolve(output, '..'), { recursive: true })
  await writeFile(output, body)
  manifest.objects.push({ key: object.path, schemaVersion: 1, sourceCount: Object.keys(object.body.days).length, dateRange: { start: Object.keys(object.body.days)[0], end: Object.keys(object.body.days).at(-1) }, sha256: createHash('sha256').update(body).digest('hex'), bytes: Buffer.byteLength(body), cacheControl: 'public, max-age=0, s-maxage=60' })
}
await mkdir(outputRoot, { recursive: true })
await writeFile(resolve(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Created ${manifest.objects.length} preview objects for ${manifest.dateRange.start}..${manifest.dateRange.end} under ${outputRoot}`)
