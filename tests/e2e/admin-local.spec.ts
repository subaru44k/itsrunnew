import { test, expect } from '@playwright/test'

test('administrator route is localized, non-indexable, and fails closed without runtime config', async ({ page }) => {
  await page.goto('/manage', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  await expect(page.locator('main.admin-page')).toContainText(/管理者スケジュール|Schedule administration/)
  await expect(page.getByRole('button', { name: /ログイン|Sign in/ }).or(page.getByRole('alert'))).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/Bearer|access_token|id_token|stack|bucket/i)
  await expect(page.locator('body')).not.toContainText(/Partly available|一部利用/)
})

test('callback route is a clean localized application route', async ({ page }) => {
  await page.goto('/manage/callback', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  await expect(page.locator('main.admin-page')).toContainText(/管理者スケジュール|Schedule administration/)
})
