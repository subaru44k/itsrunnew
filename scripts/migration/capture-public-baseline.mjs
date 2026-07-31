import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseUrl = (process.env.LEGACY_BASE_URL || 'https://itsrun-aaf42.web.app').replace(/\/$/, '')
const outputPath = resolve(process.env.BASELINE_OUTPUT || 'docs/aws-migration/baseline/public-routes.json')
const routes = [
  '/',
  '/index.html',
  '/yumenoshima',
  '/komazawa',
  '/komazawa_olympic',
  '/todoroki',
  '/pace/marathon',
  '/nozomiantena/index',
  '/en/',
  '/en/yumenoshima',
  '/en/komazawa',
  '/en/todoroki',
  '/en/pace/marathon',
  '/en/nozomiantena/index',
]

function matchMeta(html, expression) {
  return html.match(expression)?.[1] || null
}

const capturedAt = new Date().toISOString()
const results = []

for (const route of routes) {
  const url = `${baseUrl}${route}`
  const response = await fetch(url, { redirect: 'manual' })
  const body = await response.text()
  results.push({
    route,
    url,
    status: response.status,
    location: response.headers.get('location'),
    contentType: response.headers.get('content-type'),
    contentSha256: createHash('sha256').update(body).digest('hex'),
    staticTitle: matchMeta(body, /<title>([^<]*)<\/title>/i),
    staticDescription: matchMeta(body, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i),
  })
}

await mkdir(resolve(outputPath, '..'), { recursive: true })
await writeFile(outputPath, `${JSON.stringify({ baseUrl, capturedAt, routes: results }, null, 2)}\n`)
console.log(`Captured ${results.length} public routes to ${outputPath}`)
