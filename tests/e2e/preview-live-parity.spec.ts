import { expect, test } from '@playwright/test'
import { EXPECTED_NOZOMI_JA } from '../fixtures/nozomiRecordsExpected'

const isEnglish = () => test.info().project.name.endsWith('-en')
const localized = (route: string) => isEnglish() ? `/en${route}` : route
const hrefPath = (route: string) => localized(route) === '/en/' ? '/en' : localized(route)

const navGroups = {
  ja: [
    ['東京都の競技場', [['織田フィールド', '/'], ['夢の島陸上競技場', '/yumenoshima'], ['駒沢オリンピック公園陸上競技場', '/komazawa']]],
    ['神奈川県の競技場', [['等々力陸上競技場', '/todoroki']]], ['ラップタイム', [['マラソン', '/pace/marathon']]], ['記録集', [['田中希実', '/nozomiantena/index']]],
  ],
  en: [
    ['Tokyo', [['Yoyogi Park Athletic Track', '/'], ['Yumenoshima Athletics Stadium', '/yumenoshima'], ['Komazawa Olympic Park Athletic Stadium', '/komazawa']]],
    ['Kanagawa', [['Todoroki Athletic Track', '/todoroki']]], ['Lap Time', [['Marathon', '/pace/marathon']]], ['Records', [['Nozomi Tanaka', '/nozomiantena/index']]],
  ],
} as const

test('live shell exposes every grouped destination and exact footer', async ({ page }) => {
  await page.goto(localized('/'), { waitUntil: 'networkidle' })
  const mobile = test.info().project.name.startsWith('mobile')
  if (mobile) await page.getByRole('button', { name: isEnglish() ? 'Menu' : 'メニュー' }).click()
  const nav = page.getByRole('navigation').last()
  for (const [label, links] of navGroups[isEnglish() ? 'en' : 'ja']) {
    if (!mobile) await nav.getByRole('button', { name: label }).click()
    await expect(nav).toContainText(label)
    for (const [item, route] of links) await expect(nav.getByRole('link', { name: item })).toHaveAttribute('href', hrefPath(route))
  }
  await expect(page.getByRole('link', { name: /itsrun_page/ })).toHaveAttribute('href', 'https://twitter.com/itsrun_page')
  await expect(page.locator('.site-footer')).toContainText(isEnglish() ? 'Please tweet to @itsrun_page if you have any requests.' : 'ウェブサイトの要望は、@itsrun_pageまでどうぞ')
})

test('live pace exposes all ranges, orientations, and switching', async ({ page }) => {
  await page.goto(localized('/pace/marathon'), { waitUntil: 'networkidle' })
  await expect(page.locator('.range-picker button')).toHaveCount(3)
  for (const button of await page.locator('.range-picker button').all()) {
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.desktop-pace tbody tr')).toHaveCount(19)
    await expect(page.locator('.desktop-pace thead th')).toHaveCount(12)
    await expect(page.locator('.mobile-pace tbody tr')).toHaveCount(11)
  }
})

test('live records preserve the complete Japanese transcript', async ({ page }) => {
  await page.goto(localized('/nozomiantena'), { waitUntil: 'networkidle' })
  await expect(page.locator('tbody tr')).toHaveCount(60)
  await expect(page.locator('.records-year')).toHaveCount(2)
  if (!isEnglish()) {
    const actual = await page.locator('tbody tr').evaluateAll((rows) => rows.map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() ?? '')))
    expect(actual).toEqual(EXPECTED_NOZOMI_JA.map(([, date, meet, event, result]) => [date, meet, event, result]))
    expect(actual.flat().some((cell) => /Distance|Championship|Meet|Olympics/.test(cell))).toBe(false)
  }
})

const stadiums = {
  oda: { route: '/', ja: ['織田フィールド 開放日', '織田フィールドの個人利用可能時間は以下の通りです。', '織田フィールドの情報', '代々木公園陸上競技場(織田フィールド)'], en: ["Yoyogi Park Athletic Track's Availability", "The following is the Yoyogi Park Athletic Track's open schedule.", 'About Yoyogi Park Athletic Track', 'Yoyogi Park Atheletic Stadium (Oda Field)'], map: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.4061911644067!2d139.69173161501527!3d35.66699913836023!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188cad8ba1d227%3A0x8b5756b02932d0b1!2z5Luj44CF5pyo5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sjp!4v1526609293873' },
  yumenoshima: { route: '/yumenoshima', ja: ['夢の島陸上競技場 開放日', '夢の島陸上競技場の個人利用可能時間は以下の通りです。', '夢の島陸上競技場の情報', '夢の島陸上競技場'], en: ["Yumenoshima Athletics Stadium's Availability", "The following is the Yumenoshima Athletics Stadium's open schedule.", 'About Yumenoshima Athletics Stadium', 'Yumenoshima Athletics Stadium'], map: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3242.198853620734!2d139.82042951502805!3d35.6474720394305!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188830ec82b0eb%3A0x38e551d88d939e11!2z44CSMTM2LTAwODEg5p2x5Lqs6YO95rGf5p2x5Yy65aSi44Gu5bO277yR5LiB55uu77yR4oiS77yS!5e0!3m2!1sja!2sjp!4v1527175702727' },
  komazawa: { route: '/komazawa', ja: ['駒沢オリンピック公園陸上競技場 開放日', '駒沢オリンピック公園陸上競技場の個人利用可能時間は以下の通りです。', '駒沢オリンピック公園陸上競技場の情報', '駒沢オリンピック公園陸上競技場'], en: ["Komazawa Olympic Park Athletic Stadium's Availability", "The following is the Komazawa Olympic Park Athletic Stadium's open schedule.", 'About Komazawa Olympic Stadium Athletic Stadium', 'Komazawa Olympic Stadium Athletic Stadium'], map: 'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d12972.346488110566!2d139.663655!3d35.625591!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x21788df8b6ff02d4!2z6aeS5rKi44Kq44Oq44Oz44OU44OD44Kv5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sus!4v1527932434339' },
  todoroki: { route: '/todoroki', ja: ['等々力陸上競技場 開放日', '等々力陸上競技場の個人利用可能時間は以下の通りです。', '等々力陸上競技場の情報', '川崎市等々力陸上競技場'], en: ["Todoroki Stadium's Availability", "The following is the Todoroki Stadium's open schedule.", 'About Todoroki Stadium', 'Kawasaki Todoroki Stadium'], map: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3244.666567187979!2d139.64847281502654!3d35.58662084276266!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6018f50ab35bb61b%3A0xb861571ec1e0f177!2z44CSMjExLTAwNTIg56We5aWI5bed55yM5bed5bSO5biC5Lit5Y6f5Yy6562J44CF5Yqb77yR4oiS77yR!5e0!3m2!1sja!2sjp!4v1527175366004' },
} as const

for (const [slug, stadium] of Object.entries(stadiums)) test(`live ${slug} preserves editorial cards and schedule`, async ({ page }) => {
  await page.goto(localized(stadium.route), { waitUntil: 'networkidle' })
  const copy = stadium[isEnglish() ? 'en' : 'ja']
  await expect(page.locator('h1')).toHaveText(copy[0]); await expect(page.locator('.lead')).toHaveText(copy[1]); await expect(page.locator('#info-heading')).toHaveText(copy[2]); await expect(page.locator('.official-name')).toHaveText(copy[3])
  await expect(page.locator('.stadium-card')).toHaveCount(2); await expect(page.locator('iframe.map')).toHaveAttribute('src', stadium.map)
  await expect(page.locator('[role=alert]')).toHaveCount(0); await expect(page.getByRole('button', { name: /再試行|Retry/ })).toHaveCount(0)
  if (slug === 'oda') {
    await expect(page.locator('.schedule-table')).toContainText(isEnglish() ? /Available|Unavailable|Unknown|Loading/ : /利用可能|利用不可|未公開|読み込み/)
    await expect(page.getByRole('status')).toHaveCount(0)
  } else {
    const unpublished = page.getByRole('status')
    await expect(unpublished).toHaveCount(1)
    await expect(unpublished).toContainText(isEnglish() ? 'Schedule data is being prepared.' : 'スケジュールを準備中です。')
    await expect(unpublished.locator('.status-symbol')).toHaveCount(1)
    await expect(unpublished.locator('.status-symbol')).toHaveText('?')
  }
  if (slug === 'oda') await expect(page.getByRole('link', { name: /年賀|New Year's/ })).toHaveAttribute('href', 'https://newyearscardlottery.link/')
})

test('live locale SEO links remain paired', async ({ page }) => {
  await page.goto(localized('/nozomiantena'), { waitUntil: 'networkidle' })
  const base = isEnglish() ? '/nozomiantena' : '/nozomiantena'
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', isEnglish() ? '/en/nozomiantena' : base)
  await expect(page.locator('link[rel="alternate"][hreflang="ja"]')).toHaveAttribute('href', base)
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', `/en${base}`)
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', base)
})
