import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const july = JSON.stringify({ schemaVersion: 1, stadium: 'oda', yearMonth: '2026-07', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-07-31': [0, 1, 2] } })
const august = JSON.stringify({ schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-01': [0, 1, 2] } })

function pathFor(projectName: string) { return projectName.includes('-en') ? '/en/' : '/' }
function isJapanese(projectName: string) { return !projectName.includes('-en') }

async function routeSchedule(page: Page, mode: 'success' | 'network' | 'invalid' | 'unpublished') {
  await page.route('**/data/v1/stadiums/oda/availability/*.json', async (route) => {
    if (mode === 'network') return route.abort('failed')
    if (mode === 'invalid') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    if (mode === 'unpublished') return route.fulfill({ status: 404, body: '' })
    const body = route.request().url().includes('2026-08') ? august : july
    return route.fulfill({ status: 200, contentType: 'application/json', body })
  })
}

test('loading is localized before the first response', async ({ page }, testInfo) => {
  let release!: () => void
  const hold = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/data/v1/stadiums/oda/availability/*.json', async (route) => { await hold; const body = route.request().url().includes('2026-08') ? august : july; await route.fulfill({ status: 200, contentType: 'application/json', body }) })
  const navigation = page.goto(pathFor(testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('status')).toContainText(isJapanese(testInfo.project.name) ? '読み込み中' : 'Loading')
  release()
  await navigation
})

for (const mode of ['network', 'invalid', 'unpublished'] as const) {
  test(`${mode} state is localized and exclusive`, async ({ page }, testInfo) => {
    await routeSchedule(page, mode)
    await page.goto(pathFor(testInfo.project.name), { waitUntil: 'networkidle' })
    const expected = isJapanese(testInfo.project.name)
      ? { network: '接続できません', invalid: 'データを利用できません', unpublished: '準備中です' }[mode]
      : { network: 'could not be reached', invalid: 'data is temporarily unavailable', unpublished: 'being prepared' }[mode]
    if (mode === 'unpublished') {
      await expect(page.getByRole('status')).toContainText(expected)
      await expect(page.getByRole('alert')).toHaveCount(0)
    } else {
      await expect(page.getByRole('alert')).toContainText(expected)
      await expect(page.getByRole('button', { name: /再試行|Retry/ })).toBeVisible()
      await expect(page.getByRole('status')).not.toContainText(/準備中|being prepared/)
      await expect(page.getByRole('alert')).not.toContainText(/Failed|TypeError|fetch|request/i)
    }
  })
}

test('retained data and retry are localized', async ({ page }, testInfo) => {
  let mode: 'success' | 'network' = 'success'
  await page.route('**/data/v1/stadiums/oda/availability/*.json', async (route) => {
    if (mode === 'network') return route.abort('failed')
    const body = route.request().url().includes('2026-08') ? august : july
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })
  await page.goto(pathFor(testInfo.project.name), { waitUntil: 'networkidle' })
  mode = 'network'
  await page.getByRole('button', { name: isJapanese(testInfo.project.name) ? '次の週' : 'Next week' }).click()
  await expect(page.getByRole('alert')).toContainText(isJapanese(testInfo.project.name) ? '最後に取得できた' : 'last successful')
  await expect(page.locator('.schedule-table')).toContainText(isJapanese(testInfo.project.name) ? '利用可能' : 'Available')
  mode = 'success'
  await page.getByRole('button', { name: /再試行|Retry/ }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.schedule-updated')).toBeVisible()
})
