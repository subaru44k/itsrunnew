import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const baseUrl = process.env.ITSRUN_BASE_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const expectEdgeRouting = process.env.ITSRUN_EXPECT_EDGE_ROUTING === 'true';
const hostResolverRule = process.env.ITSRUN_HOST_RESOLVER_RULE;
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: hostResolverRule ? [`--host-resolver-rules=${hostResolverRule}`] : [],
});
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
const tokyoToday = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const today = availabilityManifest.dates.includes(tokyoToday) ? tokyoToday : availabilityManifest.startDate;
const todayIndex = availabilityManifest.dates.indexOf(today);
const tomorrow = availabilityManifest.dates[Math.min(todayIndex + 1, availabilityManifest.dates.length - 1)];
const saturday = availabilityManifest.dates.find(date => new Date(`${date}T12:00:00+09:00`).getUTCDay() === 6);
const todayCounts = statusCounts(datasetForDate(today));
const tomorrowCounts = statusCounts(datasetForDate(tomorrow));
const currentYear = new Date().getFullYear();
const waitForSelectedDate = (page, date) => page.waitForFunction(expected => new URL(location.href).searchParams.get('date') === expected, date);

try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => runtimeErrors.push(error.message));
    await page.route('**/*', route => adPattern.test(route.request().url()) ? route.abort() : route.continue());
    const analyticsRequestsBeforeConsent = requests.filter(url => url.includes('googletagmanager.com/gtag/js')).length;

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '近くで走れるトラックを探す', exact: true }).waitFor();
    const previewBuild = (await page.locator('meta[name="robots"]').getAttribute('content')) === 'noindex,nofollow';
    await page.getByRole('dialog', { name: 'アクセス解析の設定' }).waitFor();
    const consentOverlapsHero = await page.evaluate(() => {
      const consent = document.querySelector('.privacy-consent')?.getBoundingClientRect();
      const hero = document.querySelector('.track-hero')?.getBoundingClientRect();
      return Boolean(consent && hero && consent.bottom > hero.top);
    });
    if (consentOverlapsHero) throw new Error('Analytics consent overlaps the Track Finder hero');
    if (requests.filter(url => url.includes('googletagmanager.com/gtag/js')).length !== analyticsRequestsBeforeConsent) throw new Error('GA4 loaded before analytics consent');
    await page.getByRole('button', { name: '同意しない', exact: true }).click();
    await page.locator('#track-map .track-marker, #track-map .track-cluster').first().waitFor();
    const defaultMapZoom = Number(await page.locator('#track-map').getAttribute('data-zoom'));
    const expectedDefaultZoom = viewport.width < 800 ? 5 : 7;
    if (defaultMapZoom !== expectedDefaultZoom) throw new Error(`Default map zoom at ${viewport.width}px is ${defaultMapZoom}, expected ${expectedDefaultZoom}`);
    await page.getByText(`© 2019–${currentYear} いつラン`, { exact: true }).waitFor();
    if (viewport.width < 800) {
      const facilityNameWhiteSpace = await page.locator('.facility-main strong').first().evaluate(element => getComputedStyle(element).whiteSpace);
      if (facilityNameWhiteSpace === 'nowrap') throw new Error('Mobile facility names are still forced onto one line');
    }
    if ((await page.locator('link[rel="canonical"]').getAttribute('href')) !== 'https://itsrun.info/') throw new Error('Home canonical URL is incorrect');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) throw new Error(`Horizontal overflow at ${viewport.width}px: ${overflow}px`);

    await page.goto(`${baseUrl}/oda-field`, { waitUntil: 'domcontentloaded' });
    await page.getByText('織田フィールド 開放日', { exact: true }).waitFor();
    const noDataIcons = await page.locator('img[alt="no data"]:visible').count();
    if (noDataIcons !== 21) throw new Error(`Expected 21 no-data cells, found ${noDataIcons}`);
    if (await page.locator('a[href*="newyearscardlottery"]').count() !== 0) throw new Error('Removed postcard lottery promotion is still visible');

    await page.goto(`${baseUrl}/en/pace/marathon`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Lap Time for the Marathon', { exact: true }).waitFor();
    const marathonOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (marathonOverflow > 1) throw new Error(`Marathon page overflow at ${viewport.width}px: ${marathonOverflow}px`);

    for (const [path, heading] of [
      ['/yumenoshima', '夢の島陸上競技場 開放日'],
      ['/komazawa', '駒沢オリンピック公園陸上競技場 開放日'],
      ['/todoroki', '等々力陸上競技場 開放日'],
      ['/nozomiantena/index', '田中希実選手の記録集'],
      ['/en/oda-field', "Yoyogi Park Athletic Track's Availability"],
      ['/en/', 'Find a track near you'],
      ['/about', 'いつランについて'],
      ['/tracks/guide', 'トラック検索の使い方'],
      ['/privacy', 'プライバシーポリシー'],
      ['/en/about', 'About ItsRun'],
      ['/en/tracks/guide', 'How to find a workout track'],
      ['/en/privacy', 'Privacy policy'],
    ]) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
      await page.getByText(heading, { exact: true }).waitFor();
    }

    await page.goto(`${baseUrl}/?date=${today}&lat=35.68124&lng=139.76712`, { waitUntil: 'domcontentloaded' });
    await page.locator('#track-map .search-origin-dot').waitFor();
    await page.waitForFunction(() => document.querySelector('#track-map')?.getAttribute('data-zoom') === '13');

    const tracksResponse = await page.goto(`${baseUrl}/tracks`, { waitUntil: 'domcontentloaded' });
    if (expectEdgeRouting && !tracksResponse?.request().redirectedFrom()) throw new Error('/tracks did not return an edge redirect');
    await waitForSelectedDate(page, today);
    if (new URL(page.url()).pathname !== '/') throw new Error('/tracks did not canonicalize to the home route');
    await page.getByRole('heading', { name: '近くで走れるトラックを探す', exact: true }).waitFor();
    await page.getByText('公式情報をもとに表示しています。当日変更もあるため、利用前にご確認ください。「要確認」は利用不可ではありません。', { exact: true }).waitFor();
    if ((await page.locator('meta[property="og:title"]').getAttribute('content')) !== 'いつラン - 日付から探せる陸上競技場・トラック検索') throw new Error('Track Search OGP title did not update');
    await page.locator('#track-map .track-cluster, #track-map .track-marker').first().waitFor();
    const mapFacilityCount = () => page.locator('#track-map').evaluate(element => [...element.querySelectorAll('.track-marker')].length + [...element.querySelectorAll('.track-cluster')].reduce((sum, cluster) => sum + Number(cluster.textContent), 0));
    if (await mapFacilityCount() !== todayCounts.candidates) throw new Error('Clustered map did not represent every candidate facility');
    for (let attempt = 0; attempt < 4 && await page.locator('#track-map .track-marker').count() === 0; attempt += 1) {
      const previousZoom = Number(await page.locator('#track-map').getAttribute('data-zoom'));
      await page.locator('#track-map .track-cluster-shell').first().dispatchEvent('click');
      await page.waitForFunction(zoom => Number(document.querySelector('#track-map')?.getAttribute('data-zoom')) > zoom, previousZoom);
    }
    await page.locator('#track-map .track-marker-shell').first().dispatchEvent('click');
    await page.locator('.detail-card').waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const top = document.querySelector('.detail-card')?.getBoundingClientRect().top;
      return typeof top === 'number' && top >= 48 && top <= 96;
    });
    await page.getByRole('button', { name: '詳細を閉じる', exact: true }).click();
    await page.locator('.detail-card').waitFor({ state: 'detached' });
    for (const toggle of await page.locator('.prefecture-toggle').all()) if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    while (await page.getByRole('button', { name: 'この都道府県をさらに表示', exact: true }).count()) await page.getByRole('button', { name: 'この都道府県をさらに表示', exact: true }).first().click();
    await page.locator('.facility-row .availability--available').first().waitFor();
    await page.locator('.facility-row .availability--partially-available').first().waitFor();
    if (await page.locator('.facility-row .availability--unknown').count() !== todayCounts.unknown) throw new Error('Unknown facilities were unexpectedly removed from candidate results');
    if (await page.locator('.facility-row .availability--unavailable').count() !== 0) throw new Error('Candidate filter should hide explicitly unavailable facilities');

    await page.getByLabel('本日利用不可の施設も表示').check();
    await page.waitForFunction(expected => Number(document.querySelector('.track-controls .result-count')?.textContent?.match(/\d+/)?.[0]) === expected, trackDataset.length);
    // Toggling unavailable facilities can add rows beyond a prefecture's previous
    // pagination limit, so expand the newly visible rows before counting badges.
    for (const toggle of await page.locator('.prefecture-toggle').all()) if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    while (await page.getByRole('button', { name: 'この都道府県をさらに表示', exact: true }).count()) await page.getByRole('button', { name: 'この都道府県をさらに表示', exact: true }).first().click();
    if (await page.locator('.facility-row .availability--unavailable').count() !== todayCounts.unavailable) throw new Error('Unavailable switch did not show unavailable facilities');
    await page.locator('.facility-row').filter({ hasText: '千葉県総合スポーツセンター 陸上競技場' }).locator('button').click();
    await page.locator('.detail-card').getByText('個人利用不可', { exact: true }).waitFor();
    await page.getByRole('button', { name: '詳細を閉じる', exact: true }).click();
    await page.getByLabel('本日利用不可の施設も表示').uncheck();
    await page.waitForFunction(expected => Number(document.querySelector('.track-controls .result-count')?.textContent?.match(/\d+/)?.[0]) === expected, todayCounts.candidates);
    if (await page.locator('.facility-row .availability--unknown').count() !== todayCounts.unknown) throw new Error('Unknown facilities disappeared when unavailable facilities were hidden');
    const selectedCard = page.locator('.facility-row').filter({ hasText: '戸田市スポーツセンター 陸上競技場' });
    const selectedCardButton = selectedCard.locator('button');
    await selectedCardButton.click();
    if (await selectedCardButton.getAttribute('aria-pressed') !== 'true') throw new Error('Selected facility card state is not exposed');
    await page.locator('.detail-card').waitFor({ state: 'visible' });
    await page.locator('.detail-card .today-availability').waitFor();
    const pdfScheduleLink = page.getByRole('link', { name: '確認方法を見る', exact: true });
    if (await pdfScheduleLink.count() && !(await pdfScheduleLink.getAttribute('href'))?.endsWith('.pdf')) throw new Error('PDF availability source link is not exposed in track details');
    await page.getByRole('link', { name: '公式サイト', exact: true }).waitFor();
    const directionsHref = await page.getByRole('link', { name: '経路を見る', exact: true }).getAttribute('href');
    if (!directionsHref?.includes('google.com/maps/dir/?api=1') || !directionsHref.includes('destination=')) throw new Error('Invalid directions URL');
    const actionStyles = await page.locator('.detail-actions .v-btn').evaluateAll(buttons => buttons.map(button => {
      const style = getComputedStyle(button);
      return { className: button.className, color: style.color, height: button.getBoundingClientRect().height };
    }));
    if (actionStyles.some(action => action.height < 44)) throw new Error('Track detail action touch target is below 44px');
    if (!actionStyles.some(action => action.className.includes('action-schedule') && action.color === 'rgb(78, 52, 46)')) throw new Error('Schedule action contrast styling is missing');
    if (!actionStyles.some(action => action.className.includes('action-official') && action.color === 'rgb(255, 255, 255)')) throw new Error('Official-site action contrast styling is missing');
    if (!actionStyles.some(action => action.className.includes('action-directions') && action.color === 'rgb(0, 105, 92)')) throw new Error('Directions action contrast styling is missing');
    await page.getByRole('link', { name: '施設ページ', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/tracks/toda-sports-center-track');
    await page.getByRole('heading', { name: '戸田市スポーツセンター 陸上競技場', exact: true }).waitFor();
    await page.getByRole('link', { name: '地図でこの施設を見る', exact: true }).click();
    await page.waitForFunction(() => new URL(location.href).searchParams.get('track') === 'toda-sports-center-track');
    await page.locator('#track-map .track-marker--selected').waitFor();
    if (await page.locator('.map-tools').getByRole('button', { name: '現在地を使う', exact: true }).count() !== 1) throw new Error('Search-origin controls are not grouped above the map');
    await page.getByRole('button', { name: '地図から基準地点を選ぶ', exact: true }).click();
    await page.locator('#track-map').click({ position: { x: 160, y: 160 } });
    await page.waitForFunction(() => new URL(location.href).searchParams.has('lat') && new URL(location.href).searchParams.has('lng'));
    await page.getByText('選択した地点から近い順に並べました。', { exact: true }).waitFor();
    await page.getByRole('button', { name: '基準地点を解除', exact: true }).click();
    await page.waitForFunction(() => !new URL(location.href).searchParams.has('lat') && !new URL(location.href).searchParams.has('lng'));
    const zoomBeforeLocationFailure = await page.locator('#track-map').getAttribute('data-zoom');
    await page.getByRole('button', { name: '現在地を使う', exact: true }).click();
    await page.getByText(/現在地の利用が許可されませんでした|現在地を取得できません/).waitFor();
    if (await page.locator('#track-map').getAttribute('data-zoom') !== zoomBeforeLocationFailure) throw new Error('Location failure unexpectedly reset the map view');
    for (const toggle of await page.locator('.prefecture-toggle').all()) if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    while (await page.getByRole('button', { name: 'この都道府県をさらに表示', exact: true }).count()) await page.getByRole('button', { name: 'この都道府県をさらに表示', exact: true }).first().click();

    await page.getByRole('button', { name: '明日', exact: true }).click();
    await waitForSelectedDate(page, tomorrow);
    await page.waitForFunction(expected => Number(document.querySelector('.track-controls .result-count')?.textContent?.match(/\d+/)?.[0]) === expected, tomorrowCounts.candidates);
    await page.getByText('明日利用可能', { exact: true }).first().waitFor();
    if (await page.locator('.facility-row .availability--unknown').count() !== tomorrowCounts.unknown) throw new Error('Future unknown facilities were unexpectedly removed');
    await page.getByLabel('明日利用不可の施設も表示').check();
    while (await page.getByRole('button', { name: 'この都道府県をさらに表示', exact: true }).count()) await page.getByRole('button', { name: 'この都道府県をさらに表示', exact: true }).first().click();
    const renderedUnavailable = await page.locator('.facility-row .availability--unavailable').count();
    if (renderedUnavailable !== tomorrowCounts.unavailable) throw new Error(`Selected-date unavailable filter did not update: expected ${tomorrowCounts.unavailable}, rendered ${renderedUnavailable}`);

    await page.getByRole('button', { name: '土曜', exact: true }).click();
    await waitForSelectedDate(page, saturday);

    const selectedFuture = availabilityManifest.dates[7];
    await page.getByLabel('利用日を選ぶ').fill(selectedFuture);
    await page.getByLabel('利用日を選ぶ').dispatchEvent('change');
    await waitForSelectedDate(page, selectedFuture);
    if (await page.getByLabel('利用日を選ぶ').inputValue() !== selectedFuture) throw new Error('Native date selection did not update the selected date');
    const tracksOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (tracksOverflow > 1) throw new Error(`Track page overflow at ${viewport.width}px: ${tracksOverflow}px`);

    await page.goto(`${baseUrl}/tracks?date=invalid`, { waitUntil: 'domcontentloaded' });
    await waitForSelectedDate(page, today);
    await page.getByLabel('利用日を選ぶ').waitFor();
    await page.goto(`${baseUrl}/tracks?date=2099-01-01`, { waitUntil: 'domcontentloaded' });
    await waitForSelectedDate(page, today);

    await page.goto(`${baseUrl}/en/tracks?date=${tomorrow}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Find a track near you', exact: true }).waitFor();
    await page.getByText('Based on official sources. Schedules can change, so check before visiting. “Needs confirmation” does not mean unavailable.', { exact: true }).waitFor();
    await page.getByText('Tomorrow available', { exact: true }).first().waitFor();
    if (new URL(page.url()).pathname !== '/en/') throw new Error('/en/tracks did not canonicalize to the English home route');

    await page.goto(`${baseUrl}/en/?date=${tomorrow}`, { waitUntil: 'domcontentloaded' });
    await waitForSelectedDate(page, tomorrow);
    await page.getByRole('heading', { name: 'Find a track near you', exact: true }).waitFor();

    await page.goto(`${baseUrl}/nozomiantena/index`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: '2020', exact: true }).first().click();
    await page.waitForFunction(() => {
      const target = document.getElementById('2020');
      const top = target?.getBoundingClientRect().top ?? -1;
      return location.hash === '#2020' && top >= 48 && top <= 80;
    });

    await page.goto(`${baseUrl}/manage`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '近くで走れるトラックを探す', exact: true }).waitFor();
    const notFoundResponse = await page.goto(`${baseUrl}/not-a-real-page`, { waitUntil: 'domcontentloaded' });
    if (expectEdgeRouting && notFoundResponse?.status() !== 404) throw new Error(`Unknown route returned HTTP ${notFoundResponse?.status()} instead of 404`);
    await page.getByRole('heading', { name: 'ページが見つかりません', exact: true }).waitFor();
    if ((await page.locator('meta[name="robots"]').getAttribute('content')) !== 'noindex,nofollow') throw new Error('Unknown route is not marked noindex');
    await page.goto(`${baseUrl}/privacy`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'アクセス解析の設定', exact: true }).click();
    await page.getByRole('dialog', { name: 'アクセス解析の設定' }).waitFor();
    if (previewBuild) {
      const beforeAccept = requests.filter(url => url.includes('googletagmanager.com/gtag/js')).length;
      await page.getByRole('button', { name: '解析に同意する', exact: true }).click();
      await page.waitForTimeout(250);
      if (requests.filter(url => url.includes('googletagmanager.com/gtag/js')).length !== beforeAccept) throw new Error('Preview build loaded GA4 after consent');
    } else {
      const analyticsRequest = page.waitForRequest(request => request.url().includes('googletagmanager.com/gtag/js'));
      await page.getByRole('button', { name: '解析に同意する', exact: true }).click();
      await analyticsRequest;
    }
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
