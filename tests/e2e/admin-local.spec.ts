import { test, expect } from '@playwright/test'

test('administrator route is localized, non-indexable, and fails closed without runtime config', async ({ page }) => {
  const english = test.info().project.name.toLowerCase().includes('en')
  const expectedTitle = english ? 'Schedule administration' : '管理者スケジュール'
  const expectedConfig = english ? 'The administrator page is not configured.' : '管理画面を設定できません。'
  await page.goto(english ? '/en/manage' : '/manage', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  await expect(page).toHaveTitle(new RegExp(`^${expectedTitle} \\|`))
  await expect(page.locator('main.admin-page')).toContainText(expectedTitle)
  const alert = page.getByRole('alert')
  const login = page.getByRole('button', { name: english ? 'Sign in as administrator' : '管理者としてログイン' })
  await expect(alert.or(login)).toBeVisible()
  if (await alert.count()) await expect(alert).toContainText(expectedConfig)
  await expect(page.locator('body')).not.toContainText(/Bearer|access_token|id_token|stack|bucket/i)
  await expect(page.locator('body')).not.toContainText(/Partly available|一部利用/)
})

test('callback route is a clean localized application route', async ({ page }) => {
  const english = test.info().project.name.toLowerCase().includes('en')
  await page.goto(english ? '/en/manage/callback' : '/manage/callback', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  await expect(page.locator('main.admin-page')).toContainText(english ? 'Schedule administration' : '管理者スケジュール')
})
