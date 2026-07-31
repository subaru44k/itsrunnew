import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const baseUrl = (process.env.LEGACY_BASE_URL || 'https://itsrun-aaf42.web.app').replace(/\/$/, '')
const outputPath = resolve(process.env.BROWSER_BASELINE_OUTPUT || 'docs/aws-migration/baseline/browser-routes.json')
const screenshotDirectory = resolve(process.env.BROWSER_BASELINE_SCREENSHOTS || '.artifacts/legacy-baseline')
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

function filenameFor(route) {
  return route === '/' ? 'index' : route.replace(/^\//, '').replaceAll('/', '__')
}

await mkdir(screenshotDirectory, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const capturedAt = new Date().toISOString()
const results = []

for (const route of routes) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' })
  await page.locator('#app').waitFor()
  const description = await page.locator('meta[name="description"]').getAttribute('content')
  const screenshotPath = resolve(screenshotDirectory, `${filenameFor(route)}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: true })
  results.push({
    route,
    requestedUrl: `${baseUrl}${route}`,
    finalUrl: page.url(),
    status: response?.status() ?? null,
    title: await page.title(),
    description,
    screenshot: screenshotPath,
  })
}

await browser.close()
await mkdir(resolve(outputPath, '..'), { recursive: true })
await writeFile(outputPath, `${JSON.stringify({ baseUrl, capturedAt, routes: results }, null, 2)}\n`)
console.log(`Captured browser baseline for ${results.length} public routes to ${outputPath}`)
