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

test('OIDC login uses authorization code + PKCE settings and exact administrator scopes', async ({ page }) => {
  await page.goto('/manage', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '管理者としてログイン' }).click()
  await page.waitForURL('**/manage')
  const settings = await page.evaluate(() => JSON.parse(sessionStorage.getItem('admin-e2e-login-settings') || '{}'))
  expect(settings.responseType).toBe('code'); expect(settings.scope).toBe('openid email profile itsrun/schedule.write'); expect(settings.redirectUri).toBe('http://localhost:3000/manage/callback'); expect(settings.codeChallengeMethod).toBe('S256')
  expect(JSON.stringify(settings)).not.toMatch(/access.token|id.token|claims/i)
  await page.evaluate(() => sessionStorage.removeItem('admin-e2e-login-settings'))
})

test('test-only authority can exercise authenticated GET/edit/conditional PUT without persistence', async ({ page }) => {
  const days = Object.fromEntries(Array.from({ length: 31 }, (_, index) => [`2026-08-${String(index + 1).padStart(2, '0')}`, [0, 0, 0]]))
  const document = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-08-01T00:00:00.000Z', days }
  let putCount = 0
  await page.route('**/api/v1/stadiums/oda/availability/2026-08', async (route) => {
    if (route.request().method() === 'GET') { await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ document, etag: '"initial-etag"' }) }); return }
    putCount += 1
    expect(route.request().headers()['if-match']).toBe('"initial-etag"')
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ document: { ...document, updatedAt: '2026-08-09T00:00:00.000Z' }, etag: '"updated-etag"', versionId: 'version-1' }) })
  })
  await page.goto('/manage', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '管理者としてログイン' }).click()
  await page.waitForURL('**/manage')
  await page.locator('input[type="month"]').fill('2026-08')
  await expect(page.locator('.admin-table select').first()).toBeVisible()
  await page.locator('.admin-table select').first().selectOption('1')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByText('Saved.').or(page.getByText('保存しました。'))).toBeVisible()
  expect(putCount).toBe(1)
  await expect(page.locator('body')).not.toContainText(/admin-e2e-memory-token|claims|raw body/i)
  expect(await page.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)).some((key) => /token|user/i.test(key)))).toBe(false)
})
