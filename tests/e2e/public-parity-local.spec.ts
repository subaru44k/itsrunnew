import { test, expect } from '@playwright/test'

const english = () => test.info().project.name.includes('en')
const path = (route: string) => english() ? `/en${route}` : route

test('public shell exposes every public destination and locale-safe footer', async ({ page }) => {
  await page.goto(path('/'), { waitUntil: 'networkidle' })
  if (test.info().project.name.includes('mobile')) await page.getByRole('button', { name: english() ? 'Menu' : 'メニュー' }).click()
  const recordsLabel = english() ? 'Nozomi Tanaka' : '田中希実'
  if (!test.info().project.name.includes('mobile')) await page.locator('.group-trigger').last().click()
  await expect(page.getByRole('navigation').last()).toContainText(recordsLabel)
  await expect(page.getByRole('link', { name: recordsLabel })).toHaveAttribute('href', path('/nozomiantena/index'))
  await expect(page.getByRole('link', { name: /itsrun_page/ })).toHaveAttribute('href', 'https://twitter.com/itsrun_page')
  await expect(page).toHaveScreenshot('public-shell.png', { fullPage: true })
})

test('desktop groups are exclusive and close on outside click/Escape with focus return', async ({ page }) => {
  test.skip(test.info().project.name.includes('mobile'))
  await page.goto(path('/'), { waitUntil: 'networkidle' })
  const groups = page.locator('.desktop-nav .group-trigger')
  await groups.nth(0).click()
  await expect(groups.nth(0)).toHaveAttribute('aria-expanded', 'true')
  await groups.nth(1).click()
  await expect(groups.nth(0)).toHaveAttribute('aria-expanded', 'false')
  await expect(groups.nth(1)).toHaveAttribute('aria-expanded', 'true')
  await page.locator('.site-main').click({ position: { x: 5, y: 5 } })
  await expect(groups.nth(1)).toHaveAttribute('aria-expanded', 'false')
  await groups.nth(2).click()
  await page.keyboard.press('Escape')
  await expect(groups.nth(2)).toHaveAttribute('aria-expanded', 'false')
  await expect(groups.nth(2)).toBeFocused()
})

test('mobile drawer closes by backdrop, Escape, and route selection with focus return', async ({ page }) => {
  test.skip(!test.info().project.name.includes('mobile'))
  await page.goto(path('/'), { waitUntil: 'networkidle' })
  const menu = page.getByRole('button', { name: english() ? 'Menu' : 'メニュー' })
  await menu.click()
  await expect(page.locator('.mobile-drawer')).toBeVisible()
  await page.locator('.drawer-backdrop').click({ position: { x: 380, y: 5 } })
  await expect(page.locator('.mobile-drawer')).toBeHidden()
  await expect(menu).toBeFocused()
  await menu.click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.mobile-drawer')).toBeHidden()
  await expect(menu).toBeFocused()
  await menu.click()
  await page.getByRole('link', { name: english() ? 'Nozomi Tanaka' : '田中希実' }).click()
  await expect(page).toHaveURL(new RegExp(`${path('/nozomiantena/index')}$`))
})

test('language action preserves the current corresponding route', async ({ page }) => {
  await page.goto(path('/yumenoshima'), { waitUntil: 'networkidle' })
  if (test.info().project.name.includes('mobile')) await page.getByRole('button', { name: english() ? 'Menu' : 'メニュー' }).click()
  await page.getByRole('link', { name: english() ? '日本語' : 'English' }).click()
  await expect(page).toHaveURL(new RegExp(english() ? '/yumenoshima$' : '/en/yumenoshima$'))
})

test('pace feature renders all ranges and both table orientations', async ({ page }) => {
  await page.goto(path('/pace/marathon'), { waitUntil: 'networkidle' })
  await expect(page.locator('.range-picker button')).toHaveCount(3)
  await expect(page.locator('.desktop-pace tbody tr')).toHaveCount(19)
  await expect(page.locator('.desktop-pace thead th')).toHaveCount(12)
  await expect(page.locator('.mobile-pace tbody tr')).toHaveCount(11)
  await page.locator('.range-picker button').nth(2).click()
  await expect(page.locator('.desktop-pace tbody tr')).toHaveCount(19)
  await expect(page).toHaveScreenshot('pace.png', { fullPage: true })
})

test('records feature preserves sixty rows, anchors, and locale content', async ({ page }) => {
  await page.goto(path('/nozomiantena'), { waitUntil: 'networkidle' })
  await expect(page.locator('.records-year')).toHaveCount(2)
  await expect(page.locator('tbody tr')).toHaveCount(60)
  await expect(page.locator('a[href="#2021"]')).toHaveCount(1)
  await expect(page.locator('a[href="#2020"]')).toHaveCount(1)
  if (!english()) await expect(page.locator('tbody').first()).toContainText('東京オリンピック')
  await expect(page).toHaveScreenshot('records.png', { fullPage: true })
})

for (const [slug, route] of [['oda', '/'], ['yumenoshima', '/yumenoshima'], ['komazawa', '/komazawa'], ['todoroki', '/todoroki']] as const) test(`stadium ${slug} keeps editorial and schedule landmarks`, async ({ page }) => {
  await page.goto(path(route), { waitUntil: 'networkidle' })
  await expect(page.locator('h1')).toBeVisible()
  await expect(page.locator('section[aria-labelledby="schedule-heading"]')).toBeVisible()
  await expect(page.locator('#access-heading')).toBeVisible()
  await expect(page.locator('iframe.map')).toHaveCount(1)
  await expect(page).toHaveScreenshot(`stadium-${slug}.png`, { fullPage: true })
})
