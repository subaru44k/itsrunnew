import { expect, test } from '@playwright/test'

const routes = [
  { path: '/', content: '代々木公園陸上競技場' },
  { path: '/index.html', content: '代々木公園陸上競技場', pathname: '/' },
  { path: '/yumenoshima', content: '夢の島陸上競技場' },
  { path: '/komazawa', content: '駒沢オリンピック公園陸上競技場' },
  { path: '/komazawa_olympic', content: '駒沢オリンピック公園陸上競技場', pathname: '/komazawa' },
  { path: '/todoroki', content: '川崎市等々力陸上競技場' },
  { path: '/pace/marathon', content: 'ペース' },
  { path: '/nozomiantena/index', content: '田中希実' },
  { path: '/en/', content: 'Yoyogi Park Athletic Track' },
  { path: '/en/yumenoshima', content: 'Yumenoshima Athletics Stadium' },
  { path: '/en/komazawa', content: 'Komazawa Olympic Park Athletic Stadium' },
  { path: '/en/todoroki', content: 'Kawasaki Todoroki Stadium' },
  { path: '/en/pace/marathon', content: 'Pace' },
  { path: '/en/nozomiantena/index', content: 'Race result of Nozomi Tanaka' },
]

for (const route of routes) {
  test(`preview route renders: ${route.path}`, async ({ page }) => {
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })
    expect(response, `No response for ${route.path}`).not.toBeNull()
    expect(response?.status(), `Unexpected status for ${route.path}`).toBeLessThan(400)
    await expect(page.locator('#main-content')).toBeVisible()
    await expect(page.locator('body')).toContainText(route.content)
    if (route.pathname) expect(new URL(page.url()).pathname).toBe(route.pathname)
  })
}

test('preview Oda schedule and data contract are public and cacheable', async ({ page, request }) => {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window)
    window.fetch = (input, init) => nativeFetch(input, init)
  })
  // Prime both month objects before the browser-side composable runs; this
  // also proves the same public URLs used by the application are available.
  expect((await request.get('/data/v1/stadiums/oda/availability/2026-07.json')).status()).toBe(200)
  expect((await request.get('/data/v1/stadiums/oda/availability/2026-08.json')).status()).toBe(200)
  const response = await page.goto('/en/', { waitUntil: 'networkidle' })
  expect(response?.status()).toBeLessThan(400)
  await expect(page.locator('#schedule-heading')).toBeVisible()
  const retry = page.getByRole('button', { name: 'Retry' })
  if (await retry.isVisible()) await retry.click()
  await expect(page.locator('.schedule-updated')).toContainText('2026', { timeout: 10000 })
  await expect(page.locator('.schedule-table')).toContainText('Available')

  const data = await request.get('/data/v1/stadiums/oda/availability/2026-07.json')
  expect(data.status()).toBe(200)
  expect(data.headers()['cache-control']).toContain('s-maxage=60')
  expect(data.headers()['strict-transport-security']).toBeTruthy()
  expect(data.headers()['x-content-type-options']).toBe('nosniff')
  const document = await data.json()
  expect(document).toMatchObject({ schemaVersion: 1, stadium: 'oda', yearMonth: '2026-07' })
})

test('preview unknown routes and missing assets are not the application shell', async ({ request }) => {
  const missingRoute = await request.get('/does-not-exist')
  expect(missingRoute.status()).toBeGreaterThanOrEqual(400)
  const missingAsset = await request.get('/_nuxt/does-not-exist.js')
  expect(missingAsset.status()).toBeGreaterThanOrEqual(400)
})
