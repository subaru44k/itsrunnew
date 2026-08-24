import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const baseUrl = process.env.ITSRUN_BASE_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath, headless: true });
const requests = [];
const runtimeErrors = [];
const adPattern = /googlesyndication|doubleclick|googletagmanager|google-analytics|googleadservices/i;
const availabilityManifest = JSON.parse(readFileSync(new URL('../src/data/availability/manifest.json', import.meta.url), 'utf8'));
const trackDataset = JSON.parse(readFileSync(new URL('../src/data/tracks.json', import.meta.url), 'utf8'));
const datasetForDate = date => JSON.parse(readFileSync(new URL(`../src/data/availability/${date}.json`, import.meta.url), 'utf8'));
const statusCounts = dataset => {
  const statuses = dataset.facilities.map(item => Date.now() < new Date(item.freshness.expiresAt).getTime() ? item.status : 'unknown');
  return {
    candidates: statuses.filter(status => status !== 'unavailable').length,
    unavailable: statuses.filter(status => status === 'unavailable').length,
    unknown: statuses.filter(status => status === 'unknown').length,
  };
};
const today = availabilityManifest.startDate;
const tomorrow = availabilityManifest.dates[1];
const saturday = availabilityManifest.dates.find(date => new Date(`${date}T12:00:00+09:00`).getUTCDay() === 6);
const todayCounts = statusCounts(datasetForDate(today));
const tomorrowCounts = statusCounts(datasetForDate(tomorrow));

try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => runtimeErrors.push(error.message));
    await page.route('**/*', route => adPattern.test(route.request().url()) ? route.abort() : route.continue());

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.getByText('織田フィールド 開放日', { exact: true }).waitFor();
    await page.getByText('©2019 — いつラン', { exact: true }).waitFor();
    const noDataIcons = await page.locator('img[alt="no data"]:visible').count();
    if (noDataIcons !== 21) throw new Error(`Expected 21 no-data cells, found ${noDataIcons}`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) throw new Error(`Horizontal overflow at ${viewport.width}px: ${overflow}px`);

    await page.goto(`${baseUrl}/en/pace/marathon`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Lap Time for the Marathon', { exact: true }).waitFor();
    const marathonOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (marathonOverflow > 1) throw new Error(`Marathon page overflow at ${viewport.width}px: ${marathonOverflow}px`);

    for (const [path, heading] of [
      ['/yumenoshima', '夢の島陸上競技場 開放日'],
      ['/komazawa', '駒沢オリンピック公園陸上競技場 開放日'],
      ['/todoroki', '等々力陸上競技場 開放日'],
      ['/nozomiantena/index', '田中希実選手の記録集'],
      ['/en/', "Yoyogi Park Athletic Track's Availability"],
    ]) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
      await page.getByText(heading, { exact: true }).waitFor();
    }

    await page.goto(`${baseUrl}/tracks`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(url => url.searchParams.get('date') === today);
    await page.getByRole('heading', { name: '近くで走れるトラックを探す', exact: true }).waitFor();
    await page.locator('#track-map .track-marker').first().waitFor();
    const initialMarkers = await page.locator('#track-map .track-marker').count();
    if (initialMarkers !== todayCounts.candidates) throw new Error(`Expected ${todayCounts.candidates} candidate track markers, found ${initialMarkers}`);
    await page.locator('.facility-card .availability--available').first().waitFor();
    await page.locator('.facility-card .availability--partially-available').first().waitFor();
    if (await page.locator('.facility-card .availability--unknown').count() !== todayCounts.unknown) throw new Error('Unknown facilities were unexpectedly removed from candidate results');
    if (await page.locator('.facility-card .availability--unavailable').count() !== 0) throw new Error('Candidate filter should hide explicitly unavailable facilities');

    await page.getByLabel('本日利用不可の施設も表示').check();
    await page.waitForFunction(expected => document.querySelectorAll('#track-map .track-marker').length === expected, trackDataset.length);
    if (await page.locator('.facility-card .availability--unavailable').count() !== todayCounts.unavailable) throw new Error('Unavailable switch did not show unavailable facilities');
    await page.getByLabel('本日利用不可の施設も表示').uncheck();
    await page.waitForFunction(expected => document.querySelectorAll('#track-map .track-marker').length === expected, todayCounts.candidates);
    if (await page.locator('.facility-card .availability--unknown').count() !== todayCounts.unknown) throw new Error('Unknown facilities disappeared when unavailable facilities were hidden');
    await page.locator('.facility-card').filter({ hasText: '戸田市スポーツセンター 陸上競技場' }).click();
    await page.getByText('本日は要確認', { exact: true }).last().waitFor();
    const pdfScheduleLink = page.getByRole('link', { name: '確認方法を見る', exact: true });
    await pdfScheduleLink.waitFor();
    if (!(await pdfScheduleLink.getAttribute('href'))?.endsWith('.pdf')) throw new Error('PDF availability source link is not exposed in track details');
    await page.getByRole('link', { name: '公式サイト', exact: true }).waitFor();
    const directionsHref = await page.getByRole('link', { name: '経路を見る', exact: true }).getAttribute('href');
    if (!directionsHref?.includes('google.com/maps/dir/?api=1') || !directionsHref.includes('destination=')) throw new Error('Invalid directions URL');
    await page.getByRole('button', { name: '現在地を表示', exact: true }).click();
    await page.getByText(/現在地の利用が許可されませんでした|現在地を取得できません/).waitFor();

    await page.getByRole('button', { name: '明日', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('date') === tomorrow);
    await page.waitForFunction(expected => document.querySelectorAll('#track-map .track-marker').length === expected, tomorrowCounts.candidates);
    await page.getByText('明日利用可能', { exact: true }).first().waitFor();
    if (await page.locator('.facility-card .availability--unknown').count() !== tomorrowCounts.unknown) throw new Error('Future unknown facilities were unexpectedly removed');
    await page.getByLabel('明日利用不可の施設も表示').check();
    if (await page.locator('.facility-card .availability--unavailable').count() !== tomorrowCounts.unavailable) throw new Error('Selected-date unavailable filter did not update');

    await page.getByRole('button', { name: '土曜', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('date') === saturday);

    const selectedFuture = availabilityManifest.dates[7];
    await page.getByLabel('利用日を選ぶ').fill(selectedFuture);
    await page.getByLabel('利用日を選ぶ').dispatchEvent('change');
    await page.waitForURL(url => url.searchParams.get('date') === selectedFuture);
    if (await page.getByLabel('利用日を選ぶ').inputValue() !== selectedFuture) throw new Error('Native date selection did not update the selected date');
    const tracksOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (tracksOverflow > 1) throw new Error(`Track page overflow at ${viewport.width}px: ${tracksOverflow}px`);

    await page.goto(`${baseUrl}/tracks?date=invalid`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(url => url.searchParams.get('date') === today);
    await page.getByLabel('利用日を選ぶ').waitFor();
    await page.goto(`${baseUrl}/tracks?date=2099-01-01`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(url => url.searchParams.get('date') === today);

    await page.goto(`${baseUrl}/en/tracks?date=${tomorrow}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Find a track near you', exact: true }).waitFor();
    await page.getByText('Tomorrow available', { exact: true }).first().waitFor();

    await page.goto(`${baseUrl}/nozomiantena/index`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: '2020年の大会結果・記録', exact: true }).first().click();
    await page.waitForFunction(() => {
      const target = document.getElementById('2020');
      const top = target?.getBoundingClientRect().top ?? -1;
      return location.hash === '#2020' && top >= 48 && top <= 80;
    });

    await page.goto(`${baseUrl}/manage`, { waitUntil: 'domcontentloaded' });
    await page.getByText('織田フィールド 開放日', { exact: true }).waitFor();
    await page.close();
  }

  if (requests.some(url => /firebase|firestore|googleapis\.com\/identitytoolkit/i.test(url))) {
    throw new Error('A Firebase request was detected');
  }
  if (runtimeErrors.length > 0) throw new Error(`Runtime errors detected:\n${runtimeErrors.join('\n')}`);
  console.log('Smoke test passed for desktop/mobile, public routes, year anchors, /manage removal, and Firebase isolation.');
} finally {
  await browser.close();
}
