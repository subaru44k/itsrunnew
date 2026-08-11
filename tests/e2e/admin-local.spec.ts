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

test('callback owns OIDC completion while manage owns restoration', async ({ page }) => {
  await setupCallback(page, 'success')
  await page.goto('/manage/callback?code=fake&state=fake#fragment', { waitUntil: 'domcontentloaded' })
  expect(await page.evaluate(() => sessionStorage.getItem('admin-e2e-callback-restore-count'))).toBeNull()
  await expect(page).toHaveURL(/\/manage$/)
  await page.waitForFunction(() => sessionStorage.getItem('admin-e2e-manage-restore-count') === '1')
  expect(await page.evaluate(() => sessionStorage.getItem('admin-e2e-manage-restore-count'))).toBe('1')
  await page.goto('/manage', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => sessionStorage.getItem('admin-e2e-manage-restore-count') === '2')
  expect(await page.evaluate(() => sessionStorage.getItem('admin-e2e-manage-restore-count'))).toBe('2')
  await expect(page.getByRole('button', { name: '管理者としてログイン' })).toBeVisible()
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
function assertExactScheduleBody(body, editedTuple) {
  expect(Object.keys(body).sort()).toEqual(['days', 'schemaVersion', 'stadium', 'yearMonth'])
  expect(body.schemaVersion).toBe(1); expect(body.stadium).toBe('oda'); expect(body.yearMonth).toBe('2026-08')
  const keys = Object.keys(body.days); expect(keys).toHaveLength(31); expect(keys).toEqual(Array.from({ length: 31 }, (_, index) => `2026-08-${String(index + 1).padStart(2, '0')}`))
  for (const key of keys) { expect(body.days[key]).toHaveLength(3); for (const status of body.days[key]) expect([0, 1, 2]).toContain(status) }
  expect(body.days['2026-08-01']).toEqual(editedTuple); expect(body.days['2026-08-02']).toEqual([0, 0, 0])
}

test('B1 update renders the returned document and sends one exact conditional PUT', async ({ page }) => {
  const english = test.info().project.name.toLowerCase().includes('en'); const base = english ? '/en/manage' : '/manage'
  const expectedSaved = english ? 'Saved.' : '保存しました。'; const document = apiDocument(); let getCount = 0; let putCount = 0
  await page.route('**/api/v1/stadiums/oda/availability/2026-08', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') { getCount += 1; await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ document, etag: '"b1-etag"' }) }); return }
    putCount += 1
    expect(request.method()).toBe('PUT'); expect(request.headers()['authorization']).toMatch(/^Bearer /); expect(request.headers()['if-match']).toBe('"b1-etag"'); expect(request.headers()['if-none-match']).toBeUndefined(); expect(request.headers()['content-type']).toContain('application/json')
    const body = JSON.parse(request.postData() || '{}'); assertExactScheduleBody(body, [1, 0, 0])
    const returned = { ...document, updatedAt: '2026-08-09T12:00:00.000Z', days: { ...document.days, '2026-08-01': [1, 0, 0] } }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ document: returned, etag: '"b1-new-etag"', versionId: 'b1-version' }) })
  })
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: english ? 'Sign in as administrator' : '管理者としてログイン' }).click(); await page.waitForURL(`**${base}`)
  await expect(page.locator('.admin-table select')).toHaveCount(93); await page.locator('.admin-table select').first().selectOption('1'); await page.getByRole('button', { name: english ? 'Save' : '保存' }).click(); await expect(page.getByText(expectedSaved)).toBeVisible()
  expect(getCount).toBe(1); expect(putCount).toBe(1); await expect(page.locator('.admin-table select').first()).toHaveValue('1'); await expect(page.locator('body')).toContainText('2026-08-09T12:00:00.000Z'); await expect(page.locator('body')).toContainText('b1-new-etag'); await expect(page.locator('body')).toContainText('b1-version'); expect(await page.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)).some((key) => /token|user/i.test(key)))).toBe(false)
})

test('B1 non-admin 403 is localized, fail-closed, and performs no PUT', async ({ page }) => {
  const english = test.info().project.name.toLowerCase().includes('en'); const base = english ? '/en/manage' : '/manage'; const permission = english ? 'You do not have administrator permission for this operation.' : '管理者権限がないため操作できません。'; let getCount = 0; let putCount = 0
  await page.route('**/api/v1/stadiums/oda/availability/2026-08', async (route) => { if (route.request().method() === 'GET') { getCount += 1; await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'raw-admin-claim' }) }); return }; putCount += 1; await route.fulfill({ status: 403, body: 'raw-admin-claim' }) })
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: english ? 'Sign in as administrator' : '管理者としてログイン' }).click(); await page.waitForURL(`**${base}`); await expect(page.getByRole('alert')).toHaveCount(1); await expect(page.getByRole('alert')).toContainText(permission); expect(getCount).toBe(1); expect(putCount).toBe(0); await expect(page.locator('.admin-table')).toHaveCount(0); await expect(page.locator('body')).not.toContainText(/raw-admin-claim|token|claim/i)
})

test('B1 missing month creates the full calendar with one If-None-Match PUT', async ({ page }) => {
  const english = test.info().project.name.toLowerCase().includes('en'); const base = english ? '/en/manage' : '/manage'; const missing = english ? 'There is no data for this month. You can create it.' : 'この月のデータはありません。新規作成できます。'; let getCount = 0; let putCount = 0
  await page.route('**/api/v1/stadiums/oda/availability/2026-08', async (route) => { const request = route.request(); if (request.method() === 'GET') { getCount += 1; await route.fulfill({ status: 404, body: 'not found raw' }); return }; putCount += 1; expect(request.headers()['authorization']).toMatch(/^Bearer /); expect(request.headers()['content-type']).toContain('application/json'); expect(request.headers()['if-none-match']).toBe('*'); expect(request.headers()['if-match']).toBeUndefined(); const body = JSON.parse(request.postData() || '{}'); assertExactScheduleBody(body, [1, 0, 0]); await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ document: { ...apiDocument(0), updatedAt: '2026-08-09T12:00:00.000Z' }, etag: '"create-etag"', versionId: 'create-version' }) }) })
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: english ? 'Sign in as administrator' : '管理者としてログイン' }).click(); await page.waitForURL(`**${base}`); await expect(page.getByText(missing)).toBeVisible(); await expect(page.locator('.admin-table select')).toHaveCount(93); expect(await page.locator('.admin-table select').evaluateAll((elements) => elements.map((element) => (element as HTMLSelectElement).value))).toEqual(Array(93).fill('0')); await page.locator('.admin-table select').first().selectOption('1'); await page.getByRole('button', { name: english ? 'Save' : '保存' }).click(); await expect(page.getByText(english ? 'Saved.' : '保存しました。')).toBeVisible(); expect(getCount).toBe(1); expect(putCount).toBe(1); await expect(page.locator('body')).toContainText('2026-08-09T12:00:00.000Z'); await expect(page.locator('body')).toContainText('create-etag'); await expect(page.locator('body')).toContainText('create-version'); await expect(page.locator('body')).not.toContainText(/not found raw|token|claim/i)
})

test('B1 expired API GET shows localized reauthentication without retry or raw response', async ({ page }) => {
  const english = test.info().project.name.toLowerCase().includes('en'); const base = english ? '/en/manage' : '/manage'; const auth = english ? 'Authentication could not be completed.' : '認証を完了できませんでした。'; let getCount = 0
  await page.route('**/api/v1/stadiums/oda/availability/2026-08', async (route) => { getCount += 1; await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'raw-expired-token' }) }) })
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: english ? 'Sign in as administrator' : '管理者としてログイン' }).click(); await page.waitForURL(`**${base}`); await expect(page.getByRole('alert')).toContainText(auth); await expect(page.getByRole('button', { name: english ? 'Sign in as administrator' : '管理者としてログイン' })).toBeVisible(); expect(getCount).toBe(1); await page.getByRole('button', { name: english ? 'Sign in as administrator' : '管理者としてログイン' }).click(); await page.waitForURL(`**${base}`); const settings = await page.evaluate(() => JSON.parse(sessionStorage.getItem('admin-e2e-login-settings') || '{}')); expect(settings.responseType).toBe('code'); expect(settings.codeChallengeMethod).toBe('S256'); expect(settings.scope).toBe('openid email profile itsrun/schedule.write'); expect(settings.redirectUri).toBe('http://localhost:3000/manage/callback'); expect(getCount).toBe(1); await expect(page.locator('body')).not.toContainText(/raw-expired-token|access_token|claims/i)
})

function conflictDocument(status = 0) { return apiDocument(status) }
function selectionDocument(stadium: string, yearMonth: string) {
  const daysInMonth = new Date(Date.UTC(Number(yearMonth.slice(0, 4)), Number(yearMonth.slice(5, 7)), 0)).getUTCDate()
  const days = Object.fromEntries(Array.from({ length: daysInMonth }, (_, index) => [`${yearMonth}-${String(index + 1).padStart(2, '0')}`, [0, 0, 0]]))
  return { schemaVersion: 1, stadium, yearMonth, updatedAt: `${yearMonth}-01T00:00:00.000Z`, days }
}
async function signInForB2(page, english) {
  const base = english ? '/en/manage' : '/manage'; await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: english ? 'Sign in as administrator' : '管理者としてログイン' }).click(); await page.waitForURL(`**${base}`); await expect(page.locator('.admin-table select')).toHaveCount(93); return base
}

test('B2 stale conflict preserves diff and explicit rebase uses latest ETag', async ({ page }) => {
  const english = test.info().project.name.toLowerCase().includes('en'); const doc = conflictDocument(); const latest = conflictDocument(2); let gets = 0; let puts = 0
  await page.route('**/api/v1/stadiums/oda/availability/2026-08', async (route) => { const request = route.request(); if (request.method() === 'GET') { gets += 1; await route.fulfill({ contentType: 'application/json', body: JSON.stringify(gets === 1 ? { document: doc, etag: '"base"' } : { document: latest, etag: '"latest"' }) }); return }; puts += 1; expect(request.headers()['if-match']).toBe(puts === 1 ? '"base"' : '"latest"'); expect(request.headers()['if-none-match']).toBeUndefined(); if (puts === 1) { await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'raw-conflict-body' }) }); return }; await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ document: { ...latest, updatedAt: '2026-08-09T12:00:00.000Z' }, etag: '"saved"', versionId: 'saved-version' }) }) })
  await page.route('**/api/v1/stadiums/oda/availability/2026-08', async (route) => { if (route.request().method() === 'PUT') { const body = JSON.parse(route.request().postData() || '{}'); expect(body.days['2026-08-01']).toEqual([1, 0, 0]); } await route.fallback() })
  await signInForB2(page, english); await page.locator('.admin-table select').first().selectOption('1'); await page.getByRole('button', { name: english ? 'Save' : '保存' }).click(); await expect(page.getByText(english ? 'The schedule changed elsewhere.' : '別の更新があるため保存できませんでした。')).toBeVisible(); expect(gets).toBe(2); expect(puts).toBe(1); await expect(page.getByRole('button', { name: english ? 'Save' : '保存' })).toHaveCount(0)
  const diffRow = page.locator('section[aria-labelledby="conflict-title"] table tbody tr').filter({ hasText: '2026-08-01' }).filter({ hasText: '09:00-12:00' }); await expect(diffRow).toHaveCount(1); await expect(diffRow.locator('td').nth(0)).toHaveText('09:00-12:00'); await expect(diffRow.locator('td').nth(1)).toHaveText(english ? 'Unknown' : '未公開'); await expect(diffRow.locator('td').nth(2)).toHaveText(english ? 'Available' : '利用可能'); await expect(diffRow.locator('td').nth(3)).toHaveText(english ? 'Unavailable' : '利用不可'); await expect(page.locator('body')).not.toContainText('raw-conflict-body')
  await page.getByRole('button', { name: english ? 'Keep edits on latest' : '最新値へ再適用して編集を維持' }).click(); await expect(page.locator('.admin-table select').first()).toHaveValue('1'); await page.getByRole('button', { name: english ? 'Save' : '保存' }).click(); await expect(page.getByText(english ? 'Saved.' : '保存しました。')).toBeVisible(); expect(puts).toBe(2); await expect(page.locator('body')).toContainText('saved-version')
})

test('B2 replacement confirmation cancel preserves conflict, accept replaces latest without PUT', async ({ page }) => {
  const english = test.info().project.name.toLowerCase().includes('en'); const doc = conflictDocument(); const latest = conflictDocument(2); let gets = 0; let puts = 0
  await page.route('**/api/v1/stadiums/oda/availability/2026-08', async (route) => { const request = route.request(); if (request.method() === 'GET') { gets += 1; await route.fulfill({ contentType: 'application/json', body: JSON.stringify(gets === 1 ? { document: doc, etag: '"base"' } : { document: latest, etag: '"latest"' }) }); return }; puts += 1; await route.fulfill({ status: 409, body: 'raw-conflict-body' }) })
  await signInForB2(page, english); await page.locator('.admin-table select').first().selectOption('1'); await page.getByRole('button', { name: english ? 'Save' : '保存' }).click(); await expect(page.getByRole('button', { name: english ? 'Replace with latest' : '最新値で置き換え' })).toBeVisible(); const confirm = english ? 'Replace local edits with the latest server value?' : '最新のサーバー値でローカル編集を置き換えますか？'; page.once('dialog', async (dialog) => { expect(dialog.message()).toBe(confirm); await dialog.dismiss() }); await page.getByRole('button', { name: english ? 'Replace with latest' : '最新値で置き換え' }).click(); expect(puts).toBe(1); await expect(page.getByRole('button', { name: english ? 'Replace with latest' : '最新値で置き換え' })).toBeVisible(); page.once('dialog', async (dialog) => { expect(dialog.message()).toBe(confirm); await dialog.accept() }); await page.getByRole('button', { name: english ? 'Replace with latest' : '最新値で置き換え' }).click(); expect(puts).toBe(1); await expect(page.getByRole('button', { name: english ? 'Save' : '保存' })).toBeDisabled(); await expect(page.locator('.admin-table select').first()).toHaveValue('2'); expect(gets).toBe(2)
})

test('B2 comparison failure exposes GET-only retry and then latest actions', async ({ page }) => {
  const english = test.info().project.name.toLowerCase().includes('en'); const doc = conflictDocument(); const latest = conflictDocument(2); let gets = 0; let puts = 0
  await page.route('**/api/v1/stadiums/oda/availability/2026-08', async (route) => { const request = route.request(); if (request.method() === 'GET') { gets += 1; await route.fulfill(gets === 1 ? { contentType: 'application/json', body: JSON.stringify({ document: doc, etag: '"base"' }) } : gets === 2 ? { status: 500, body: 'raw-comparison-body' } : { contentType: 'application/json', body: JSON.stringify({ document: latest, etag: '"latest"' }) }); return }; puts += 1; await route.fulfill({ status: 409, body: 'raw-conflict-body' }) })
  await signInForB2(page, english); await page.locator('.admin-table select').first().selectOption('1'); await page.getByRole('button', { name: english ? 'Save' : '保存' }).click(); await expect(page.getByRole('button', { name: english ? 'Retry latest comparison' : '最新値の取得を再試行' })).toBeVisible(); expect(gets).toBe(2); expect(puts).toBe(1); await expect(page.locator('body')).toContainText(english ? 'The latest schedule could not be loaded.' : '最新データを取得できませんでした。'); await expect(page.locator('body')).not.toContainText(/raw-comparison-body|raw-conflict-body/); await page.getByRole('button', { name: english ? 'Retry latest comparison' : '最新値の取得を再試行' }).click(); await expect(page.getByRole('button', { name: english ? 'Keep edits on latest' : '最新値へ再適用して編集を維持' })).toBeVisible(); const retryDiff = page.locator('section[aria-labelledby="conflict-title"] table tbody tr').filter({ hasText: '2026-08-01' }).filter({ hasText: '09:00-12:00' }); await expect(retryDiff).toHaveCount(1); await expect(retryDiff.locator('td').nth(1)).toHaveText(english ? 'Unknown' : '未公開'); await expect(retryDiff.locator('td').nth(2)).toHaveText(english ? 'Available' : '利用可能'); await expect(retryDiff.locator('td').nth(3)).toHaveText(english ? 'Unavailable' : '利用不可'); expect(gets).toBe(3); expect(puts).toBe(1)
})

test('B2 dirty same-selection reload requires explicit discard confirmation', async ({ page }) => {
  const english = test.info().project.name.toLowerCase().includes('en'); const doc = apiDocument(); let gets = 0
  await page.route('**/api/v1/stadiums/oda/availability/2026-08', async (route) => { gets += 1; await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ document: doc, etag: '"reload"' }) }) })
  const base = await signInForB2(page, english); await page.locator('.admin-table select').first().selectOption('1'); const load = page.getByRole('button', { name: english ? 'Load' : '読み込む' }); const discard = page.getByRole('button', { name: english ? 'Discard changes' : '変更を破棄' }); const confirm = english ? 'Discard unsaved changes?' : '未保存の変更を破棄しますか？'; page.once('dialog', async (dialog) => { expect(dialog.message()).toBe(confirm); await dialog.dismiss() }); await load.click(); expect(gets).toBe(1); await expect(page.locator('.admin-table select').first()).toHaveValue('1'); page.once('dialog', async (dialog) => { expect(dialog.message()).toBe(confirm); await dialog.accept() }); await discard.click(); await expect(page.locator('.admin-table select').first()).toHaveValue('0'); expect(gets).toBe(2); await expect(page).toHaveURL(`http://localhost:3000${base}`)
})

test('B2 dirty month and stadium changes require confirmation and exact new GET', async ({ page }) => {
  const english = test.info().project.name.toLowerCase().includes('en'); const doc = apiDocument(); let gets = 0; let requested = ''
  await page.route('**/api/v1/stadiums/*/availability/*', async (route) => { const request = route.request(); if (request.method() === 'GET') { gets += 1; requested = new URL(request.url()).pathname; await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ document: { ...doc, stadium: request.url().includes('yumenoshima') ? 'yumenoshima' : 'oda', yearMonth: request.url().endsWith('2026-09') ? '2026-09' : '2026-08' }, etag: '"selection"' }) }); return } await route.continue() })
  await page.route('**/api/v1/stadiums/yumenoshima/availability/2026-09', async (route) => { const request = route.request(); if (request.method() === 'GET') { gets += 1; requested = new URL(request.url()).pathname; await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ document: selectionDocument('yumenoshima', '2026-09'), etag: '\"selection\"' }) }); return } await route.continue() })
  await signInForB2(page, english); await page.locator('.admin-table select').first().selectOption('1'); const confirm = english ? 'Discard unsaved changes?' : '未保存の変更を破棄しますか？'; const stadiumSelect = page.locator('.admin-filters select'); const monthInput = page.locator('.admin-filters input[type="month"]'); await stadiumSelect.selectOption('yumenoshima'); await monthInput.fill('2026-09'); const load = page.getByRole('button', { name: english ? 'Load' : '読み込む' }); page.once('dialog', async (dialog) => { expect(dialog.message()).toBe(confirm); await dialog.dismiss() }); await load.click(); expect(gets).toBe(1); await expect(stadiumSelect).toHaveValue('oda'); await expect(monthInput).toHaveValue('2026-08'); await expect(page.locator('.admin-table select').first()).toHaveValue('1'); await stadiumSelect.selectOption('yumenoshima'); await monthInput.fill('2026-09'); page.once('dialog', async (dialog) => { expect(dialog.message()).toBe(confirm); await dialog.accept() }); await load.click(); await expect(stadiumSelect).toHaveValue('yumenoshima'); await expect(monthInput).toHaveValue('2026-09'); await expect(page.locator('.admin-table select')).toHaveCount(90); expect(gets).toBe(2); expect(requested).toBe('/api/v1/stadiums/yumenoshima/availability/2026-09')
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
    await expect(page.locator('body')).not.toContainText(/fake callback failure|evil\.invalid|admin-e2e-memory-token|claims|code=fake|state=fake/i)
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
