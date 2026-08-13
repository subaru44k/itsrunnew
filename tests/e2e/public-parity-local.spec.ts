import { test, expect, type Page } from '@playwright/test'
import { EXPECTED_NOZOMI_JA } from '../fixtures/nozomiRecordsExpected'

const english = () => test.info().project.name.includes('en')
const path = (route: string) => english() ? `/en${route}` : route
const hrefPath = (route: string) => path(route) === '/en/' ? '/en' : path(route)

// The committed visual baselines are maintained on Darwin. Linux CI still
// executes every semantic/content/interaction assertion, but has no invented
// platform-specific image set to compare against.
const expectVisualSnapshot = async (page: Page, name: string) => {
  if (process.platform === 'darwin') await expect(page).toHaveScreenshot(name, { fullPage: true })
}

test('public shell exposes every public destination and locale-safe footer', async ({ page }) => {
  await page.goto(path('/'), { waitUntil: 'networkidle' })
  if (test.info().project.name.includes('mobile')) await page.getByRole('button', { name: english() ? 'Menu' : 'メニュー' }).click()
  const recordsLabel = english() ? 'Nozomi Tanaka' : '田中希実'
  if (!test.info().project.name.includes('mobile')) await page.locator('.group-trigger').last().click()
  await expect(page.getByRole('navigation').last()).toContainText(recordsLabel)
  await expect(page.getByRole('link', { name: recordsLabel })).toHaveAttribute('href', path('/nozomiantena/index'))
  await expect(page.getByRole('link', { name: /itsrun_page/ })).toHaveAttribute('href', 'https://twitter.com/itsrun_page')
  await expect(page.locator('.site-footer')).toContainText(english() ? 'Please tweet to @itsrun_page if you have any requests.' : 'ウェブサイトの要望は、@itsrun_pageまでどうぞ')
  const groups = english() ? [
    ['Tokyo', [['Yoyogi Park Athletic Track', '/'], ['Yumenoshima Athletics Stadium', '/yumenoshima'], ['Komazawa Olympic Park Athletic Stadium', '/komazawa']]],
    ['Kanagawa', [['Todoroki Athletic Track', '/todoroki']]], ['Lap Time', [['Marathon', '/pace/marathon']]], ['Records', [['Nozomi Tanaka', '/nozomiantena/index']]],
  ] : [
    ['東京都の競技場', [['織田フィールド', '/'], ['夢の島陸上競技場', '/yumenoshima'], ['駒沢オリンピック公園陸上競技場', '/komazawa']]],
    ['神奈川県の競技場', [['等々力陸上競技場', '/todoroki']]], ['ラップタイム', [['マラソン', '/pace/marathon']]], ['記録集', [['田中希実', '/nozomiantena/index']]],
  ] as const
  const nav = page.getByRole('navigation').last()
  for (const [label, links] of groups) {
    if (!test.info().project.name.includes('mobile')) await nav.getByRole('button', { name: label }).click()
    await expect(nav).toContainText(label)
    for (const [item, href] of links) await expect(nav.getByRole('link', { name: item })).toHaveAttribute('href', hrefPath(href))
  }
  await expectVisualSnapshot(page, 'public-shell.png')
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
  await expect(groups.nth(1)).toBeFocused()
  await groups.nth(2).click()
  await page.locator('.desktop-nav .group-links a').focus()
  await page.keyboard.press('Escape')
  await expect(groups.nth(2)).toHaveAttribute('aria-expanded', 'false')
  await expect(groups.nth(2)).toBeFocused()
})

test('desktop locale action stays on the header row after every group', async ({ page }) => {
  test.skip(test.info().project.name.includes('mobile'))
  await page.goto(path('/'), { waitUntil: 'networkidle' })
  const headerBox = await page.locator('.desktop-nav').boundingBox()
  const localeBox = await page.locator('.desktop-nav .locale-action').boundingBox()
  const groupsBox = await page.locator('.desktop-nav .nav-groups').boundingBox()
  expect(headerBox && localeBox && groupsBox).toBeTruthy()
  expect(localeBox!.y).toBeLessThan(headerBox!.y + headerBox!.height)
  expect(localeBox!.x).toBeGreaterThan(groupsBox!.x + groupsBox!.width - 1)
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
  for (const button of await page.locator('.range-picker button').all()) {
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.desktop-pace tbody tr')).toHaveCount(19)
    await expect(page.locator('.mobile-pace tbody tr')).toHaveCount(11)
  }
  await expectVisualSnapshot(page, 'pace.png')
})

test('records feature preserves sixty rows, anchors, and locale content', async ({ page }) => {
  await page.goto(path('/nozomiantena'), { waitUntil: 'networkidle' })
  await expect(page.locator('.records-year')).toHaveCount(2)
  await expect(page.locator('tbody tr')).toHaveCount(60)
  await expect(page.locator('a[href="#2021"]')).toHaveCount(1)
  await expect(page.locator('a[href="#2020"]')).toHaveCount(1)
  if (!english()) await expect(page.locator('tbody').first()).toContainText('東京オリンピック')
  if (!english()) {
    const actual = await page.locator('tbody tr').evaluateAll((rows) => rows.map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() ?? '')))
    expect(actual).toEqual(EXPECTED_NOZOMI_JA.map(([, date, meet, event, result]) => [date, meet, event, result]))
    expect(actual.flat().some((cell) => /Distance|Championship|Meet|Olympics/.test(cell))).toBe(false)
  }
  await expectVisualSnapshot(page, 'records.png')
})

const stadiumParity = {
  oda: { ja: ['織田フィールド 開放日', '織田フィールドの個人利用可能時間は以下の通りです。', '織田フィールドの情報', '代々木公園陸上競技場(織田フィールド)'], en: ["Yoyogi Park Athletic Track's Availability", "The following is the Yoyogi Park Athletic Track's open schedule.", 'About Yoyogi Park Athletic Track', 'Yoyogi Park Atheletic Stadium (Oda Field)'] },
  yumenoshima: { ja: ['夢の島陸上競技場 開放日', '夢の島陸上競技場の個人利用可能時間は以下の通りです。', '夢の島陸上競技場の情報', '夢の島陸上競技場'], en: ["Yumenoshima Athletics Stadium's Availability", "The following is the Yumenoshima Athletics Stadium's open schedule.", 'About Yumenoshima Athletics Stadium', 'Yumenoshima Athletics Stadium'] },
  komazawa: { ja: ['駒沢オリンピック公園陸上競技場 開放日', '駒沢オリンピック公園陸上競技場の個人利用可能時間は以下の通りです。', '駒沢オリンピック公園陸上競技場の情報', '駒沢オリンピック公園陸上競技場'], en: ["Komazawa Olympic Park Athletic Stadium's Availability", "The following is the Komazawa Olympic Park Athletic Stadium's open schedule.", 'About Komazawa Olympic Stadium Athletic Stadium', 'Komazawa Olympic Stadium Athletic Stadium'] },
  todoroki: { ja: ['等々力陸上競技場 開放日', '等々力陸上競技場の個人利用可能時間は以下の通りです。', '等々力陸上競技場の情報', '川崎市等々力陸上競技場'], en: ["Todoroki Stadium's Availability", "The following is the Todoroki Stadium's open schedule.", 'About Todoroki Stadium', 'Kawasaki Todoroki Stadium'] },
} as const
const legacyMaps = {
  oda: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.4061911644067!2d139.69173161501527!3d35.66699913836023!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188cad8ba1d227%3A0x8b5756b02932d0b1!2z5Luj44CF5pyo5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sjp!4v1526609293873',
  yumenoshima: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3242.198853620734!2d139.82042951502805!3d35.6474720394305!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188830ec82b0eb%3A0x38e551d88d939e11!2z44CSMTM2LTAwODEg5p2x5Lqs6YO95rGf5p2x5Yy65aSi44Gu5bO277yR5LiB55uu77yR4oiS77yS!5e0!3m2!1sja!2sjp!4v1527175702727',
  komazawa: 'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d12972.346488110566!2d139.663655!3d35.625591!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x21788df8b6ff02d4!2z6aeS5rKi44Kq44Oq44Oz44OU44OD44Kv5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sus!4v1527932434339',
  todoroki: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3244.666567187979!2d139.64847281502654!3d35.58662084276266!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6018f50ab35bb61b%3A0xb861571ec1e0f177!2z44CSMjExLTAwNTIg56We5aWI5bed55yM5bed5bSO5biC5Lit5Y6f5Yy6562J44CF5Yqb77yR4oiS77yR!5e0!3m2!1sja!2sjp!4v1527175366004',
} as const

for (const [slug, route] of [['oda', '/'], ['yumenoshima', '/yumenoshima'], ['komazawa', '/komazawa'], ['todoroki', '/todoroki']] as const) test(`stadium ${slug} keeps editorial and schedule landmarks`, async ({ page }) => {
  await page.route('**/data/v1/stadiums/*/availability/*.json', async (route) => {
    const url = new URL(route.request().url()); const match = /availability\/(\d{4}-\d{2})\.json$/.exec(url.pathname); const yearMonth = match?.[1] ?? '2026-08'; const stadium = slug
    const days = Object.fromEntries(Array.from({ length: 28 }, (_, i) => [`${yearMonth}-${String(i + 1).padStart(2, '0')}`, [0, 1, 2]]))
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schemaVersion: 1, stadium, yearMonth, updatedAt: '2026-08-13T00:00:00.000Z', days }) })
  })
  await page.goto(path(route), { waitUntil: 'networkidle' })
  const copy = stadiumParity[slug][english() ? 'en' : 'ja']
  await expect(page.locator('h1')).toHaveText(copy[0]); await expect(page.locator('.lead')).toHaveText(copy[1]); await expect(page.locator('#info-heading')).toHaveText(copy[2]); await expect(page.locator('.official-name')).toHaveText(copy[3])
  await expect(page.locator('.stadium-card')).toHaveCount(2); await expect(page.locator('.stadium-card').nth(0)).toContainText(english() ? 'Availability' : '利用可能'); await expect(page.locator('.stadium-card').nth(1)).toContainText(copy[2])
  await expect(page.locator('iframe.map')).toHaveAttribute('src', legacyMaps[slug])
  const symbols = await page.locator('.status-symbol').allTextContents(); expect(symbols).toEqual(expect.arrayContaining(['?', '○', '×']))
  await expect(page.locator('.status-symbol').first()).toHaveAttribute('aria-hidden', 'true')
  await expect(page.getByText(english() ? 'Unknown' : '未公開').first()).toBeVisible(); await expect(page.getByText(english() ? 'Available' : '利用可能').first()).toBeVisible(); await expect(page.getByText(english() ? 'Unavailable' : '利用不可').first()).toBeVisible()
  if (slug === 'oda') { await expect(page.getByRole('link', { name: /年賀|New Year's/ })).toHaveAttribute('href', 'https://newyearscardlottery.link/') }
  await expect(page.locator('h1')).toBeVisible()
  await expect(page.locator('section[aria-labelledby="schedule-heading"]')).toBeVisible()
  await expect(page.locator('#access-heading')).toBeVisible()
  await expect(page.locator('iframe.map')).toHaveCount(1)
  await expectVisualSnapshot(page, `stadium-${slug}.png`)
})

test('locale SEO links preserve canonical and alternate routes', async ({ page }) => {
  await page.goto(path('/nozomiantena'), { waitUntil: 'networkidle' })
  const expected = path('/nozomiantena')
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${expected.replaceAll('/', '\\/')}$`))
  for (const locale of ['ja', 'en', 'x-default']) await expect(page.locator(`link[rel="alternate"][hreflang="${locale}"]`)).toHaveCount(1)
  await expect(page.locator('link[rel="alternate"][hreflang="ja"]')).toHaveAttribute('href', /\/nozomiantena$/)
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /\/en\/nozomiantena$/)
})
