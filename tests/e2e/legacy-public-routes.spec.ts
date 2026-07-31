import { expect, test } from '@playwright/test'

const publicRoutes = [
  { path: '/', title: /いつラン/ },
  { path: '/index.html', title: /いつラン/ },
  { path: '/yumenoshima', title: /いつラン/ },
  { path: '/komazawa', title: /いつラン/ },
  { path: '/komazawa_olympic', title: /いつラン/ },
  { path: '/todoroki', title: /いつラン/ },
  { path: '/pace/marathon', title: /いつラン/ },
  { path: '/nozomiantena/index', title: /田中希実/ },
  { path: '/en/', title: /It's Run/ },
  { path: '/en/yumenoshima', title: /It's Run/ },
  { path: '/en/komazawa', title: /It's Run/ },
  { path: '/en/todoroki', title: /It's Run/ },
  { path: '/en/pace/marathon', title: /It's Run/ },
  { path: '/en/nozomiantena/index', title: /Race result of Nozomi Tanaka/ },
]

for (const route of publicRoutes) {
  test(`legacy public route loads: ${route.path}`, async ({ page }, testInfo) => {
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })

    expect(response, `No response for ${route.path}`).not.toBeNull()
    expect(response?.status(), `Unexpected status for ${route.path}`).toBeLessThan(400)
    await expect(page.locator('#app')).toBeVisible()
    await expect(page).toHaveTitle(route.title)
    await page.screenshot({ path: testInfo.outputPath('baseline.png'), fullPage: true })
  })
}
