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
  let authorizationUrl = ''
  await page.route('https://admin-e2e.invalid/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/.well-known/openid-configuration') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ authorization_endpoint: 'https://admin-e2e.invalid/authorize', token_endpoint: 'https://admin-e2e.invalid/token', end_session_endpoint: 'https://admin-e2e.invalid/logout', issuer: 'https://admin-e2e.invalid' }) }); return
    }
    if (url.pathname === '/authorize') { authorizationUrl = route.request().url(); await route.fulfill({ contentType: 'text/html', body: '<title>fake authority</title>' }); return }
    await route.fulfill({ status: 404, body: 'not found' })
  })
  await page.goto('/manage', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '管理者としてログイン' }).click()
  await expect.poll(() => authorizationUrl).not.toBe('')
  const params = new URL(authorizationUrl).searchParams
  expect(params.get('response_type')).toBe('code')
  expect(params.get('scope')).toBe('openid email profile itsrun/schedule.write')
  expect(params.get('redirect_uri')).toBe('http://localhost:3000/manage/callback')
  expect(params.get('code_challenge')).toBeTruthy()
  expect(params.get('code_challenge_method')).toBe('S256')
})
