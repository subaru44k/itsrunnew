import { expect, test } from '@playwright/test'

const isEnglish = (projectName: string) => projectName.endsWith('-en')

test.describe('raw preview operational evidence', () => {
  test('375px and 1280px layouts remain usable and overflow-free', async ({ page }, testInfo) => {
    const english = isEnglish(testInfo.project.name)
    await page.goto(english ? '/en/' : '/', { waitUntil: 'networkidle' })
    await expect(page.locator('main#main-content')).toBeVisible()
    await expect(page.locator('h1')).toContainText(english ? 'Yoyogi Park Athletic Track' : '織田フィールド')
    for (const [width, height] of [[375, 812], [1280, 900]] as const) {
      await page.setViewportSize({ width, height })
      await expect(page.locator('#main-content')).toBeVisible()
      await expect(page.locator('.schedule-table')).toBeVisible()
      const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
      expect(dimensions.scroll, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(dimensions.client)
      await page.screenshot({ path: testInfo.outputPath(`preview-operational-${english ? 'en' : 'ja'}-${width}.png`), fullPage: true })
    }
  })

  test('keyboard focus reaches primary navigation and both week controls', async ({ page }, testInfo) => {
    await page.goto(isEnglish(testInfo.project.name) ? '/en/' : '/', { waitUntil: 'networkidle' })
    await page.locator('body').focus()
    const focusedLabels: string[] = []
    let visibleTargetCount = 0
    for (let index = 0; index < 40; index += 1) {
      await page.keyboard.press('Tab')
      const focused = await page.evaluate(() => {
        const element = document.activeElement
        if (!(element instanceof HTMLElement)) return { label: '', visible: false }
        const box = element.getBoundingClientRect()
        return { label: `${element.tagName}:${element.textContent?.trim() || element.getAttribute('aria-label') || ''}`, visible: box.top >= 0 && box.bottom <= window.innerHeight && box.left >= 0 && box.right <= window.innerWidth }
      })
      focusedLabels.push(focused.label)
      if ((focused.label.startsWith('A:') || (focused.label.includes('BUTTON:') && /週|week/i.test(focused.label))) && focused.visible) visibleTargetCount += 1
    }
    expect(focusedLabels.some((label) => label.startsWith('A:'))).toBe(true)
    expect(focusedLabels.some((label) => label.includes('BUTTON:') && /週|week/i.test(label))).toBe(true)
    expect(visibleTargetCount).toBeGreaterThan(0)
  })

  test('schedule table exposes localized accessible structure and status text', async ({ page }, testInfo) => {
    const english = isEnglish(testInfo.project.name)
    await page.goto(english ? '/en/' : '/', { waitUntil: 'networkidle' })
    const table = page.locator('.schedule-table')
    await expect(table).toBeVisible()
    const caption = table.locator('caption')
    await expect(caption).not.toHaveText('')
    expect(await table.locator('th[scope="col"]').count()).toBeGreaterThan(0)
    expect(await table.locator('th[scope="row"]').count()).toBeGreaterThan(0)
    const statuses = await table.locator('tbody td .status').allTextContents()
    expect(statuses.length).toBeGreaterThan(0)
    expect(statuses.every((status) => status.trim().length > 0)).toBe(true)
    await expect(page.locator('html')).toHaveAttribute('lang', english ? 'en-US' : 'ja-JP')
    await expect(page.locator('h1')).toContainText(english ? 'Yoyogi Park Athletic Track' : '織田フィールド')
  })
})
