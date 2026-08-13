import { test, expect } from '@playwright/test'

const english = () => test.info().project.name.includes('en')
const path = (route: string) => english() ? `/en${route}` : route

test('public shell exposes every public destination and locale-safe footer', async ({ page }) => {
  await page.goto(path('/'), { waitUntil: 'networkidle' })
  if (test.info().project.name.includes('mobile')) await page.getByRole('button', { name: english() ? 'Menu' : 'メニュー' }).click()
  const recordsLabel = english() ? 'Nozomi Tanaka records' : '田中希実の記録'
  await expect(page.getByRole('navigation')).toContainText(recordsLabel)
  await expect(page.getByRole('link', { name: recordsLabel })).toHaveAttribute('href', path('/nozomiantena'))
  await expect(page.getByRole('link', { name: /itsrun_page/ })).toHaveAttribute('href', 'https://x.com/itsrun_page')
  await expect(page).toHaveScreenshot('public-shell.png', { fullPage: true })
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

test('stadium page keeps editorial and schedule landmarks', async ({ page }) => {
  await page.goto(path('/'), { waitUntil: 'networkidle' })
  await expect(page.locator('h1')).toBeVisible()
  await expect(page.locator('section[aria-labelledby="schedule-heading"]')).toBeVisible()
  await expect(page.locator('section[aria-labelledby="access-heading"]')).toBeVisible()
  await expect(page.locator('iframe.map')).toHaveCount(1)
  await expect(page).toHaveScreenshot('stadium-oda.png', { fullPage: true })
})
