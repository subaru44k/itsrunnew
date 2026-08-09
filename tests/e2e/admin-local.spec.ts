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
  await expect(page).toHaveURL(/\/manage$/)
  await expect(page.locator('main.admin-page')).toContainText('管理者スケジュール')
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

function apiDocument(status = 0) {
  const days = Object.fromEntries(Array.from({ length: 31 }, (_, index) => [`2026-08-${String(index + 1).padStart(2, '0')}`, [status, status, status]]))
  return { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-08-01T00:00:00.000Z', days }
}

test('B1 update renders the returned document and sends one exact conditional PUT', async ({ page }) => {
  const english = test.info().project.name.toLowerCase().includes('en'); const base = english ? '/en/manage' : '/manage'
  const expectedSaved = english ? 'Saved.' : '保存しました。'; const document = apiDocument(); let getCount = 0; let putCount = 0
  await page.route('**/api/v1/stadiums/oda/availability/2026-08', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') { getCount += 1; await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ document, etag: '"b1-etag"' }) }); return }
    putCount += 1
    expect(request.method()).toBe('PUT'); expect(request.headers()['authorization']).toMatch(/^Bearer /); expect(request.headers()['if-match']).toBe('"b1-etag"'); expect(request.headers()['if-none-match']).toBeUndefined(); expect(request.headers()['content-type']).toContain('application/json')
    const body = JSON.parse(request.postData() || '{}'); expect(body).toEqual(expect.objectContaining({ schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: expect.any(Object) })); expect(body.updatedAt).toBeUndefined(); expect(body.days['2026-08-01'][0]).toBe(1)
    const returned = { ...document, updatedAt: '2026-08-09T12:00:00.000Z', days: { ...document.days, '2026-08-01': [1, 0, 0] } }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ document: returned, etag: '"b1-new-etag"', versionId: 'b1-version' }) })
  })
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: english ? 'Sign in as administrator' : '管理者としてログイン' }).click(); await page.waitForURL(`**${base}`)
  await expect(page.locator('.admin-table select')).toHaveCount(93); await page.locator('.admin-table select').first().selectOption('1'); await page.getByRole('button', { name: english ? 'Save' : '保存' }).click(); await expect(page.getByText(expectedSaved)).toBeVisible()
  expect(getCount).toBeGreaterThanOrEqual(1); expect(putCount).toBe(1); await expect(page.locator('.admin-table select').first()).toHaveValue('1'); await expect(page.locator('body')).toContainText('b1-new-etag'); await expect(page.locator('body')).toContainText('b1-version'); expect(await page.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)).some((key) => /token|user/i.test(key)))).toBe(false)
})

test('B1 non-admin 403 is localized, fail-closed, and performs no PUT', async ({ page }) => {
  const english = test.info().project.name.toLowerCase().includes('en'); const base = english ? '/en/manage' : '/manage'; const permission = english ? 'You do not have administrator permission for this operation.' : '管理者権限がないため操作できません。'; let getCount = 0; let putCount = 0
  await page.route('**/api/v1/stadiums/oda/availability/2026-08', async (route) => { if (route.request().method() === 'GET') { getCount += 1; await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'raw-admin-claim' }) }); return }; putCount += 1; await route.fulfill({ status: 403, body: 'raw-admin-claim' }) })
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: english ? 'Sign in as administrator' : '管理者としてログイン' }).click(); await page.waitForURL(`**${base}`); await expect(page.getByRole('alert')).toContainText(permission); expect(getCount).toBe(1); expect(putCount).toBe(0); await expect(page.locator('.admin-table')).toHaveCount(0); await expect(page.locator('body')).not.toContainText(/raw-admin-claim|token|claim/i)
})

test('B1 missing month creates the full calendar with one If-None-Match PUT', async ({ page }) => {
  const english = test.info().project.name.toLowerCase().includes('en'); const base = english ? '/en/manage' : '/manage'; const missing = english ? 'There is no data for this month. You can create it.' : 'この月のデータはありません。新規作成できます。'; let getCount = 0; let putCount = 0
  await page.route('**/api/v1/stadiums/oda/availability/2026-08', async (route) => { const request = route.request(); if (request.method() === 'GET') { getCount += 1; await route.fulfill({ status: 404, body: 'not found raw' }); return }; putCount += 1; expect(request.headers()['if-none-match']).toBe('*'); expect(request.headers()['if-match']).toBeUndefined(); const body = JSON.parse(request.postData() || '{}'); expect(body.stadium).toBe('oda'); expect(body.yearMonth).toBe('2026-08'); expect(body.updatedAt).toBeUndefined(); await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ document: { ...apiDocument(0), updatedAt: '2026-08-09T12:00:00.000Z' }, etag: '"create-etag"', versionId: 'create-version' }) }) })
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: english ? 'Sign in as administrator' : '管理者としてログイン' }).click(); await page.waitForURL(`**${base}`); await expect(page.getByText(missing)).toBeVisible(); await expect(page.locator('.admin-table select')).toHaveCount(93); await page.locator('.admin-table select').first().selectOption('1'); await page.getByRole('button', { name: english ? 'Save' : '保存' }).click(); await expect(page.getByText(english ? 'Saved.' : '保存しました。')).toBeVisible(); expect(getCount).toBe(1); expect(putCount).toBe(1); await expect(page.locator('body')).toContainText('create-etag'); await expect(page.locator('body')).toContainText('create-version'); await expect(page.locator('body')).not.toContainText(/not found raw|token|claim/i)
})

test('B1 expired API GET shows localized reauthentication without retry or raw response', async ({ page }) => {
  const english = test.info().project.name.toLowerCase().includes('en'); const base = english ? '/en/manage' : '/manage'; const auth = english ? 'Authentication could not be completed.' : '認証を完了できませんでした。'; let getCount = 0
  await page.route('**/api/v1/stadiums/oda/availability/2026-08', async (route) => { getCount += 1; await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'raw-expired-token' }) }) })
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: english ? 'Sign in as administrator' : '管理者としてログイン' }).click(); await page.waitForURL(`**${base}`); await expect(page.getByRole('alert')).toContainText(auth); await expect(page.getByRole('button', { name: english ? 'Sign in as administrator' : '管理者としてログイン' })).toBeVisible(); expect(getCount).toBe(1); await expect(page.locator('body')).not.toContainText(/raw-expired-token|access_token|claims/i)
})

async function setE2eMode(page, value) { await page.addInitScript((mode) => sessionStorage.setItem('admin-e2e-mode', mode), value) }
async function setupCallback(page, mode) {
  await page.addInitScript((value) => { sessionStorage.setItem('admin-e2e-mode', value); sessionStorage.setItem('admin-e2e-transaction', JSON.stringify({ state: { returnPath: value === 'hostileReturn' ? 'https://evil.invalid' : '/manage' }, codeChallenge: 'test-only' })) }, mode)
  const days = Object.fromEntries(Array.from({ length: 31 }, (_, index) => [`2026-08-${String(index + 1).padStart(2, '0')}`, [0, 0, 0]]))
  const document = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-08-01T00:00:00.000Z', days }
  await page.route('**/api/v1/stadiums/oda/availability/2026-08', async (route) => await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ document, etag: '"callback-etag"' }) }))
}

for (const callbackCase of ['success', 'callbackFailure', 'hostileReturn']) {
  test(`direct callback ${callbackCase} is deterministic and same-origin`, async ({ page }) => {
    await setupCallback(page, callbackCase)
    await page.goto('/manage/callback?code=fake&state=fake#fragment', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/manage$/)
    expect(await page.evaluate(() => ({ callback: sessionStorage.getItem('admin-e2e-callback-count'), cleanup: sessionStorage.getItem('admin-e2e-cleanup-count'), transaction: sessionStorage.getItem('admin-e2e-transaction') }))).toEqual({ callback: '1', cleanup: '1', transaction: null })
    if (callbackCase === 'success') await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible()
    if (callbackCase === 'callbackFailure') await expect(page.getByRole('alert')).toContainText('認証を完了できませんでした。')
    await expect(page.locator('body')).not.toContainText(/fake callback failure|evil\.invalid|admin-e2e-memory-token|claims/i)
  })
}

test('OIDC init and login failures are sanitized and offer retry without raw details', async ({ page }) => {
  await setE2eMode(page, 'initFailure')
  await page.goto('/manage', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('alert')).toContainText('認証を完了できませんでした。')
  await expect(page.locator('body')).not.toContainText(/fake init failure|token|claims/i)
})

test('login redirect failure is sanitized without raw details', async ({ page }) => {
  await setE2eMode(page, 'loginFailure')
  await page.goto('/manage', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '管理者としてログイン' }).click()
  await expect(page.getByRole('alert')).toContainText('認証を完了できませんでした。')
  await expect(page.locator('body')).not.toContainText(/fake redirect failure|token|claims/i)
})

test('logout clears memory authentication and leaves signed-out UI', async ({ page }) => {
  await page.goto('/manage', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '管理者としてログイン' }).click()
  await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible()
  await page.getByRole('button', { name: 'ログアウト' }).click()
  await expect(page.getByRole('button', { name: '管理者としてログイン' })).toBeVisible()
  expect(await page.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)).some((key) => /token|user/i.test(key)))).toBe(false)
  await expect(page.locator('body')).not.toContainText(/admin-e2e-memory-token|claims/i)
})

for (const lifecycle of ['expired', 'unloaded', 'silentRenew']) {
  test(`${lifecycle} event clears memory authentication`, async ({ page }) => {
    await setE2eMode(page, lifecycle)
    await page.goto('/manage', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: '管理者としてログイン' }).click()
    await expect(page.getByRole('button', { name: '管理者としてログイン' })).toBeVisible()
    expect(await page.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)).some((key) => /token|user/i.test(key)))).toBe(false)
    await expect(page.locator('body')).not.toContainText(/admin-e2e-memory-token|claims|raw/i)
  })
}
