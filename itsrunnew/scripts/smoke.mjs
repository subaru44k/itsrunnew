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
const availabilityStatuses = ['available', 'partially_available', 'unknown', 'unavailable'];
const statusLabels = {
  available: '利用可能',
  partially_available: '一部利用可能',
  unknown: '要確認',
  unavailable: '利用不可',
};
const englishStatusLabels = {
  available: 'Available',
  partially_available: 'Partly available',
  unknown: 'Needs confirmation',
  unavailable: 'Unavailable',
};
const effectiveStatus = item => {
  const expiresAt = Date.parse(item.freshness?.expiresAt ?? '');
  return Number.isFinite(expiresAt) && Date.now() < expiresAt ? item.status : 'unknown';
};
const statusCounts = dataset => {
  const counts = Object.fromEntries(availabilityStatuses.map(status => [status, 0]));
  for (const item of dataset.facilities) {
    const status = effectiveStatus(item);
    if (!(status in counts)) throw new Error(`Unknown availability status in ${dataset.date}: ${status}`);
    counts[status] += 1;
  }
  return {
    ...counts,
    candidates: counts.available + counts.partially_available + counts.unknown,
  };
};
const tokyoToday = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const today = availabilityManifest.dates.includes(tokyoToday) ? tokyoToday : availabilityManifest.startDate;
const todayIndex = availabilityManifest.dates.indexOf(today);
if (todayIndex < 0) throw new Error(`Smoke date ${today} is missing from the availability manifest`);
const tomorrow = availabilityManifest.dates[todayIndex + 1] ?? today;
const hasDistinctTomorrow = tomorrow !== today;
const saturday = availabilityManifest.dates.find((date, index) => index >= todayIndex && new Date(`${date}T12:00:00+09:00`).getUTCDay() === 6);
const todayDataset = datasetForDate(today);
const todayCounts = statusCounts(todayDataset);
const tomorrowCounts = statusCounts(datasetForDate(tomorrow));
const representativeTracks = Object.fromEntries(availabilityStatuses.map(status => {
  const record = todayDataset.facilities.find(item => effectiveStatus(item) === status);
  const track = trackDataset.find(item => item.id === record?.trackId);
  return [status, track];
}));
const todaTrack = trackDataset.find(item => item.id === 'toda-sports-center-track');
if (!todaTrack) throw new Error('Toda Sports Center track is required for map-action smoke testing');
const todaRecord = todayDataset.facilities.find(item => item.trackId === todaTrack.id);
if (!todaRecord) throw new Error('Toda Sports Center availability is missing from the selected-date dataset');
const todaStatus = effectiveStatus(todaRecord);
const odaTrack = trackDataset.find(item => item.id === 'yoyogi-park-athletic-track');
if (!odaTrack) throw new Error('Oda Field track is required for canonical-route smoke testing');
const odaRecord = todayDataset.facilities.find(item => item.trackId === odaTrack.id);
if (!odaRecord) throw new Error('Oda Field availability is missing from the selected-date dataset');
const odaStatus = effectiveStatus(odaRecord);
const currentYear = new Date().getFullYear();
const waitForSelectedDate = (page, date) => page.waitForFunction(expected => new URL(location.href).searchParams.get('date') === expected, date);
const availabilityClass = status => `availability--${status.replace('_', '-')}`;
const expandAllFacilityRows = async (page, english = false) => {
  const moreLabel = english ? 'Show more in this prefecture' : 'この都道府県をさらに表示';
  for (const toggle of await page.locator('.prefecture-toggle').all()) {
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  }
  while (await page.getByRole('button', { name: moreLabel, exact: true }).count()) {
    await page.getByRole('button', { name: moreLabel, exact: true }).first().click();
  }
};
const renderedStatusCounts = page => page.locator('.facility-row').evaluateAll((rows, statuses) => {
  const counts = Object.fromEntries(statuses.map(status => [status, 0]));
  for (const row of rows) {
    const status = statuses.find(candidate => row.querySelector(`.${candidate}`));
    if (status) counts[status] += 1;
  }
  return counts;
}, availabilityStatuses.map(availabilityClass));
const assertRenderedStatusCounts = async (page, expected, context) => {
  const actual = await renderedStatusCounts(page);
  for (const status of availabilityStatuses) {
    const className = availabilityClass(status);
    if (actual[className] !== expected[status]) {
      throw new Error(`${context} ${status} rows did not match dataset: expected ${expected[status]}, rendered ${actual[className]}`);
    }
  }
};

console.log(`Availability coverage ${today}: ${availabilityStatuses.map(status => `${status}=${todayCounts[status]}${representativeTracks[status] ? ` (${representativeTracks[status].id})` : ' (no representative)'}`).join(', ')}`);
if (!saturday) console.log(`Skipping Saturday shortcut coverage because ${today}–${availabilityManifest.endDate} has no Saturday on or after the selected date`);

try {
  const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`);
  if (!sitemapResponse.ok) throw new Error(`Sitemap returned HTTP ${sitemapResponse.status}`);
  const sitemapText = await sitemapResponse.text();
  if (!sitemapText.includes(`<loc>https://itsrun.info/tracks/${odaTrack.id}</loc>`)
    || !sitemapText.includes(`<loc>https://itsrun.info/en/tracks/${odaTrack.id}</loc>`)
    || /https:\/\/itsrun\.info\/(?:en\/)?oda-field\/?(?:<|\?|#)/.test(sitemapText)) {
    throw new Error('Sitemap does not contain the canonical Oda detail URLs exclusively');
  }

  const startupPage = await browser.newPage();
  let releaseManifest;
  const manifestGate = new Promise(resolve => { releaseManifest = resolve; });
  await startupPage.route('**/availability/manifest.json', async route => {
    await manifestGate;
    await route.continue();
  });
  try {
    const dateRequest = startupPage.waitForRequest(request => /\/availability\/\d{4}-\d{2}-\d{2}\.json$/.test(new URL(request.url()).pathname));
    await startupPage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await startupPage.locator('.track-hero').waitFor();
    await dateRequest;
  } finally {
    releaseManifest();
    await startupPage.close();
  }

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => runtimeErrors.push(error.message));
    await page.route('**/*', route => adPattern.test(route.request().url()) ? route.abort() : route.continue());
    await page.addInitScript(() => {
      window.__itsrunGeolocationRequests = 0;
      const geolocation = navigator.geolocation;
      window.__itsrunGeolocationCounterInstalled = !geolocation;
      if (!geolocation) return;
      try {
        const originalGetCurrentPosition = geolocation.getCurrentPosition.bind(geolocation);
        Object.defineProperty(geolocation, 'getCurrentPosition', {
          configurable: true,
          writable: true,
          value: (...args) => {
            window.__itsrunGeolocationRequests += 1;
            return originalGetCurrentPosition(...args);
          },
        });
        window.__itsrunGeolocationCounterInstalled = true;
      } catch {
        // A browser that exposes an unusual geolocation object may reject the
        // method replacement; the assertion below then fails rather than
        // silently weakening the no-auto-request check.
      }
    });
    const analyticsRequestsBeforeConsent = requests.filter(url => url.includes('googletagmanager.com/gtag/js')).length;

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '近くで走れるトラックを探す', exact: true }).waitFor();
    const odaDiscoveryHref = await page.locator('[data-oda-discovery-link], .oda-discovery-link a').getAttribute('href');
    if (odaDiscoveryHref !== `/tracks/${odaTrack.id}`) throw new Error('Japanese home Oda discovery link is not canonical');
    if (new URL(page.url()).searchParams.has('date')) throw new Error('Home without a date automatically added one');
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
    const expectedCoverageZoom = viewport.width < 800 ? 5 : 7;
    if (defaultMapZoom !== 13) throw new Error(`Initial sample map zoom at ${viewport.width}px is ${defaultMapZoom}, expected 13`);
    await page.getByText('表示例：新宿周辺', { exact: true }).waitFor();
    await page.getByRole('button', { name: '掲載エリア全体を見る', exact: true }).waitFor();
    if (await page.locator('#track-map .search-origin-dot').count() !== 0) throw new Error('Initial sample map unexpectedly rendered a search origin');
    await page.locator('.facility-heading').getByText('都道府県別に表示', { exact: true }).waitFor();
    const initialGeolocationState = await page.evaluate(() => ({
      count: window.__itsrunGeolocationRequests,
      installed: window.__itsrunGeolocationCounterInstalled,
    }));
    if (!initialGeolocationState.installed) throw new Error('Could not install the geolocation request counter');
    const initialGeolocationRequests = initialGeolocationState.count;
    if (initialGeolocationRequests !== 0) throw new Error(`Geolocation was requested automatically on home load (${initialGeolocationRequests} calls)`);

    await page.getByRole('button', { name: '掲載エリア全体を見る', exact: true }).click();
    await page.waitForFunction(expected => Number(document.querySelector('#track-map')?.getAttribute('data-zoom')) === expected, expectedCoverageZoom);
    if (await page.locator('#track-map .search-origin-dot').count() !== 0) throw new Error('Coverage map unexpectedly rendered a search origin');
    await page.locator('.facility-heading').getByText('都道府県別に表示', { exact: true }).waitFor();

    const locationPage = await browser.newPage({ viewport });
    locationPage.on('request', request => requests.push(request.url()));
    locationPage.on('pageerror', error => runtimeErrors.push(error.message));
    await locationPage.route('**/*', route => adPattern.test(route.request().url()) ? route.abort() : route.continue());
    await locationPage.emulateMedia({ reducedMotion: 'reduce' });
    await locationPage.context().setGeolocation({ latitude: 35.68124, longitude: 139.76712 });
    await locationPage.context().grantPermissions(['geolocation'], { origin: new URL(baseUrl).origin });
    await locationPage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await locationPage.getByRole('heading', { name: '近くで走れるトラックを探す', exact: true }).waitFor();
    await locationPage.getByRole('dialog', { name: 'アクセス解析の設定' }).waitFor();
    await locationPage.getByRole('button', { name: '同意しない', exact: true }).click();
    await locationPage.locator('#track-map .track-marker, #track-map .track-cluster').first().waitFor();
    await locationPage.locator('.track-hero-actions').getByRole('button', { name: '現在地から探す', exact: true }).click();
    await locationPage.locator('#track-map .search-origin-dot').waitFor();
    await locationPage.getByText(/^\d+施設を現在地から直線距離の近い順に表示しています。$/, { exact: true }).waitFor();
    await locationPage.locator('.facility-heading').getByText('現在地から近い順', { exact: true }).waitFor();
    await locationPage.waitForFunction(() => {
      const target = document.getElementById('track-map-section');
      const top = target?.getBoundingClientRect().top ?? -1;
      return document.activeElement === target
        && top >= 48 && top <= 100
        && document.querySelector('#track-map')?.getAttribute('data-zoom') === '13';
    });
    await locationPage.context().clearPermissions();
    await locationPage.close();
    await page.getByText(`© 2019–${currentYear} いつラン`, { exact: true }).waitFor();
    if (viewport.width < 800) {
      const facilityNameWhiteSpace = await page.locator('.facility-main strong').first().evaluate(element => getComputedStyle(element).whiteSpace);
      if (facilityNameWhiteSpace === 'nowrap') throw new Error('Mobile facility names are still forced onto one line');
    }
    if ((await page.locator('link[rel="canonical"]').getAttribute('href')) !== 'https://itsrun.info/') throw new Error('Home canonical URL is incorrect');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) throw new Error(`Horizontal overflow at ${viewport.width}px: ${overflow}px`);

    for (const legacyPath of ['/oda-field', '/oda-field/', '/en/oda-field', '/en/oda-field/']) {
      const query = `?date=${today}&tag=a%26b#legacy-section`;
      await page.goto(`${baseUrl}${legacyPath}${query}`, { waitUntil: 'domcontentloaded' });
      const expectedPath = legacyPath.startsWith('/en/') ? `/en/tracks/${odaTrack.id}` : `/tracks/${odaTrack.id}`;
      await page.waitForFunction(({ path, date }) => {
        const url = new URL(location.href);
        return url.pathname === path
          && url.searchParams.get('date') === date
          && url.searchParams.get('tag') === 'a&b'
          && url.hash === '#legacy-section';
      }, { path: expectedPath, date: today });
    }

    await page.goto(`${baseUrl}/tracks/${odaTrack.id}?date=${today}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '織田フィールド（代々木公園陸上競技場）', exact: true }).waitFor();
    await page.getByRole('heading', { name: '2026年11月30日まで利用停止予定', exact: true }).waitFor();
    await page.getByRole('heading', { name: odaStatus === 'unavailable' ? 'この日の代替候補' : 'この日の周辺トラック', exact: true }).waitFor();
    if (await page.locator('.related-section .alternative-link').count() !== 5) throw new Error('Oda Field did not use the shared five-item ranked alternatives');
    await page.getByText('平常時の使用感（工事前）', { exact: true }).waitFor();
    await page.getByText('原宿駅から徒歩圏内にある競技場。非常に立地がよく、火水金土と21時まで利用可能で、利用料金も無料ということで、該当日の19時以降は仕事帰りの社会人や大学生でごった返す。', { exact: true }).waitFor();
    await page.getByRole('heading', { name: '施設・トラック情報', exact: true }).waitFor();
    await page.getByRole('heading', { name: '織田フィールドの情報', exact: true }).waitFor();
    const odaNearbyHref = await page.getByRole('link', { name: 'この施設を基準に周辺を比較', exact: true }).getAttribute('href');
    if (!odaNearbyHref?.startsWith(`/?date=${today}`) || !odaNearbyHref.includes('lat=35.6669') || !odaNearbyHref.includes('lng=139.6941')) throw new Error('Oda Field nearby search link is missing canonical home path or selected date');
    const odaNoticeHref = await page.getByRole('link', { name: '公式の利用停止案内を見る', exact: true }).getAttribute('href');
    if (odaNoticeHref !== odaTrack.urls.schedule) throw new Error('Oda closure notice does not point to the official schedule notice');
    if (await page.locator('.oda-closure').getByText('12月1日の自動的な再開を前提にせず', { exact: false }).count() !== 1) throw new Error('Oda closure caveat is missing');
    const odaStructuredData = JSON.parse(await page.locator('#track-structured-data').textContent() ?? '{}');
    if (odaStructuredData.url !== `https://itsrun.info/tracks/${odaTrack.id}` || odaStructuredData.name !== odaTrack.name.ja) throw new Error('Oda JSON-LD does not match the canonical detail metadata');
    if (await page.locator('img[alt="no data"]:visible').count() !== 0) throw new Error('Old no-data schedule is still visible on Oda Field detail');
    if (await page.locator('a[href*="newyearscardlottery"]').count() !== 0) throw new Error('Removed postcard lottery promotion is still visible');

    await page.locator('.language-button').click();
    await page.waitForURL(url => url.pathname === `/en/tracks/${odaTrack.id}` && url.searchParams.get('date') === today);
    await page.getByRole('heading', { name: 'Yoyogi Park Athletic Track (Oda Field)', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Closed through November 30, 2026 (planned)', exact: true }).waitFor();
    const englishOdaStructuredData = JSON.parse(await page.locator('#track-structured-data').textContent() ?? '{}');
    if (englishOdaStructuredData.url !== `https://itsrun.info/en/tracks/${odaTrack.id}` || englishOdaStructuredData.name !== odaTrack.name.en) throw new Error('English Oda JSON-LD does not match the canonical detail metadata');
    await page.locator('.language-button').click();
    await page.waitForURL(url => url.pathname === `/tracks/${odaTrack.id}` && url.searchParams.get('date') === today);

    await page.goto(`${baseUrl}/en/pace/marathon`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Marathon pace table', exact: true }).waitFor();
    const marathonOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (marathonOverflow > 1) throw new Error(`Marathon page overflow at ${viewport.width}px: ${marathonOverflow}px`);

    for (const [path, heading] of [
      ['/yumenoshima', '夢の島陸上競技場 開放日'],
      ['/komazawa', '駒沢オリンピック公園陸上競技場 開放日'],
      ['/todoroki', '等々力陸上競技場 開放日'],
      ['/nozomiantena/index', '田中希実選手の記録集'],
      ['/ryuji-miura/index', '三浦龍司選手の記録集'],
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
    await page.locator('.date-controls input[type="date"]').waitFor();
    if (await page.locator('.date-controls input').inputValue() !== today) throw new Error('/tracks without a date did not default to today');
    if (new URL(page.url()).searchParams.has('date')) throw new Error('/tracks without a date automatically added one');
    if (new URL(page.url()).pathname !== '/') throw new Error('/tracks did not canonicalize to the home route');
    await page.getByRole('heading', { name: '近くで走れるトラックを探す', exact: true }).waitFor();
    await page.getByText('公式情報をもとに表示しています。当日変更もあるため、利用前にご確認ください。「要確認」は利用不可ではありません。', { exact: true }).waitFor();
    if ((await page.locator('meta[property="og:title"]').getAttribute('content')) !== '個人利用できる陸上競技場・トラック検索｜日付・現在地から探す - いつラン') throw new Error('Track Search OGP title did not update');
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
    await expandAllFacilityRows(page);
    await assertRenderedStatusCounts(page, { ...todayCounts, unavailable: 0 }, 'Today candidate filter');
    if (await page.locator('.facility-row .availability--unknown').count() !== todayCounts.unknown) throw new Error('Unknown facilities were unexpectedly removed from candidate results');
    if (await page.locator('.facility-row .availability--unavailable').count() !== 0) throw new Error('Candidate filter should hide explicitly unavailable facilities');

    await page.getByLabel('本日利用不可の施設も表示').check();
    await page.waitForFunction(expected => Number(document.querySelector('.track-controls .result-count')?.textContent?.match(/\d+/)?.[0]) === expected, trackDataset.length);
    // Toggling unavailable facilities can add rows beyond a prefecture's previous
    // pagination limit, so expand the newly visible rows before counting badges or selecting Toda.
    await expandAllFacilityRows(page);
    await assertRenderedStatusCounts(page, todayCounts, 'Today all-facility filter');
    if (await page.locator('.facility-row .availability--unavailable').count() !== todayCounts.unavailable) throw new Error('Unavailable switch did not show unavailable facilities');

    const chibaCard = page.locator('.facility-row').filter({ hasText: '千葉県総合スポーツセンター 陸上競技場' });
    await chibaCard.locator('button').click();
    await page.locator('.detail-card').getByText('個人利用不可', { exact: true }).waitFor();
    await page.getByRole('button', { name: '詳細を閉じる', exact: true }).click();

    await page.getByLabel('本日利用不可の施設も表示').uncheck();
    await page.waitForFunction(expected => Number(document.querySelector('.track-controls .result-count')?.textContent?.match(/\d+/)?.[0]) === expected, todayCounts.candidates);
    await expandAllFacilityRows(page);
    await assertRenderedStatusCounts(page, { ...todayCounts, unavailable: 0 }, 'Today candidate filter after unavailable toggle');
    if (await page.locator('.facility-row .availability--unknown').count() !== todayCounts.unknown) throw new Error('Unknown facilities disappeared when unavailable facilities were hidden');
    if (await page.locator('.facility-row .availability--unavailable').count() !== 0) throw new Error('Candidate filter should hide explicitly unavailable facilities after toggle');

    // Re-enable the full list after the candidate assertions: Toda may be unavailable
    // for the selected date and therefore absent from the default candidate rows.
    await page.getByLabel('本日利用不可の施設も表示').check();
    await page.waitForFunction(expected => Number(document.querySelector('.track-controls .result-count')?.textContent?.match(/\d+/)?.[0]) === expected, trackDataset.length);
    await expandAllFacilityRows(page);
    await assertRenderedStatusCounts(page, todayCounts, 'Today all-facility filter before Toda selection');

    const selectedCard = page.locator('.facility-row').filter({ hasText: todaTrack.name.ja });
    const selectedCardButton = selectedCard.locator('button');
    await selectedCardButton.click();
    if (await selectedCardButton.getAttribute('aria-pressed') !== 'true') throw new Error('Selected facility card state is not exposed');
    await page.locator('.detail-card').waitFor({ state: 'visible' });
    await page.locator(`.detail-card .today-availability.${availabilityClass(todaStatus)}`).waitFor();
    if (await page.locator(`.detail-card .today-availability.${availabilityClass(todaStatus)}`).count() !== 1) throw new Error(`Toda detail status did not match the selected-date dataset: expected ${todaStatus}`);
    const pdfScheduleLink = page.getByRole('link', { name: '確認方法を見る', exact: true });
    if (await pdfScheduleLink.count() && (await pdfScheduleLink.getAttribute('href')) !== 'https://toda-zaidan.org/sportscenter/shisetsu_sc/yoyaku_sc/') throw new Error('Toda availability source link did not use the official stable landing page');
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
    const detailBreadcrumbHref = await page.locator('.breadcrumbs').getByRole('link', { name: 'トラック検索', exact: true }).getAttribute('href');
    if (detailBreadcrumbHref !== '/') throw new Error('Track detail breadcrumb unexpectedly focuses the map or a facility');
    await page.getByRole('link', { name: '地図上の位置を見る', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/' && url.hash === '#track-map-section'
      && url.searchParams.get('date') === today
      && url.searchParams.get('track') === 'toda-sports-center-track');
    await page.locator('#track-map .track-marker--selected').waitFor();
    await page.locator('.detail-card').waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const target = document.getElementById('track-map-section');
      const top = target?.getBoundingClientRect().top ?? -1;
      return document.activeElement === target && top >= 48 && top <= 100;
    });
    if (new URL(page.url()).searchParams.has('lat') || new URL(page.url()).searchParams.has('lng')) throw new Error('Facility map action unexpectedly added a search origin');
    if (await page.locator('.map-tools').getByRole('button', { name: '現在地から探す', exact: true }).count() !== 1) throw new Error('Search-origin controls are not grouped above the map');

    await page.goto(`${baseUrl}/tracks/toda-sports-center-track?date=${today}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '戸田市スポーツセンター 陸上競技場', exact: true }).waitFor();
    await page.getByRole('link', { name: 'この施設を基準に周辺を比較', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/' && url.hash === '#track-map-section'
      && url.searchParams.get('date') === today
      && !url.searchParams.has('track')
      && url.searchParams.get('lat') === todaTrack.location.latitude.toFixed(4)
      && url.searchParams.get('lng') === todaTrack.location.longitude.toFixed(4));
    await page.locator('#track-map .search-origin-dot').waitFor();
    await page.waitForFunction(() => {
      const target = document.getElementById('track-map-section');
      const top = target?.getBoundingClientRect().top ?? -1;
      return document.activeElement === target
        && top >= 48 && top <= 100
        && document.querySelector('#track-map')?.getAttribute('data-zoom') === '13'
        && !document.querySelector('.detail-card');
    });

    await page.getByRole('button', { name: '地図から基準地点を選ぶ', exact: true }).click();
    await page.locator('#track-map').click({ position: { x: 160, y: 160 } });
    await page.waitForFunction(() => new URL(location.href).searchParams.has('lat') && new URL(location.href).searchParams.has('lng'));
    await page.getByText('選択した地点から近い順に並べました。', { exact: true }).waitFor();
    await page.getByRole('button', { name: '基準地点を解除', exact: true }).click();
    await page.waitForFunction(() => !new URL(location.href).searchParams.has('lat') && !new URL(location.href).searchParams.has('lng'));
    const zoomBeforeLocationFailure = await page.locator('#track-map').getAttribute('data-zoom');
    await page.locator('.map-tools').getByRole('button', { name: '現在地から探す', exact: true }).click();
    await page.getByText(/現在地の利用が許可されませんでした|現在地を取得できません/).waitFor();
    if (await page.locator('#track-map').getAttribute('data-zoom') !== zoomBeforeLocationFailure) throw new Error('Location failure unexpectedly reset the map view');
    await expandAllFacilityRows(page);

    await page.getByRole('button', { name: '明日', exact: true }).click();
    await waitForSelectedDate(page, tomorrow);
    await page.waitForFunction(expected => Number(document.querySelector('.track-controls .result-count')?.textContent?.match(/\d+/)?.[0]) === expected, tomorrowCounts.candidates);
    await expandAllFacilityRows(page);
    await assertRenderedStatusCounts(page, { ...tomorrowCounts, unavailable: 0 }, 'Tomorrow candidate filter');
    if (hasDistinctTomorrow && tomorrowCounts.available > 0) await page.getByText('明日利用可能', { exact: true }).first().waitFor();
    if (await page.locator('.facility-row .availability--unknown').count() !== tomorrowCounts.unknown) throw new Error('Future unknown facilities were unexpectedly removed');
    const tomorrowUnavailableLabel = hasDistinctTomorrow ? '明日利用不可の施設も表示' : '本日利用不可の施設も表示';
    await page.getByLabel(tomorrowUnavailableLabel).check();
    await expandAllFacilityRows(page);
    await assertRenderedStatusCounts(page, tomorrowCounts, 'Tomorrow all-facility filter');
    const renderedUnavailable = await page.locator('.facility-row .availability--unavailable').count();
    if (renderedUnavailable !== tomorrowCounts.unavailable) throw new Error(`Selected-date unavailable filter did not update: expected ${tomorrowCounts.unavailable}, rendered ${renderedUnavailable}`);

    if (saturday) {
      await page.getByRole('button', { name: '土曜', exact: true }).click();
      await waitForSelectedDate(page, saturday);
    }

    const selectedFuture = availabilityManifest.dates[Math.min(7, availabilityManifest.dates.length - 1)] ?? today;
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
    await page.waitForFunction(expected => Number(document.querySelector('.track-controls .result-count')?.textContent?.match(/\d+/)?.[0]) === expected, tomorrowCounts.candidates);
    await expandAllFacilityRows(page, true);
    await assertRenderedStatusCounts(page, { ...tomorrowCounts, unavailable: 0 }, 'English tomorrow candidate filter');
    if (hasDistinctTomorrow && tomorrowCounts.available > 0) await page.getByText('Tomorrow available', { exact: true }).first().waitFor();
    if (new URL(page.url()).pathname !== '/en/') throw new Error('/en/tracks did not canonicalize to the English home route');

    await page.goto(`${baseUrl}/en/?date=${tomorrow}`, { waitUntil: 'domcontentloaded' });
    await waitForSelectedDate(page, tomorrow);
    await page.getByRole('heading', { name: 'Find a track near you', exact: true }).waitFor();
    const englishOdaDiscoveryHref = await page.locator('[data-oda-discovery-link], .oda-discovery-link a').getAttribute('href');
    if (englishOdaDiscoveryHref !== `/en/tracks/${odaTrack.id}`) throw new Error('English home Oda discovery link is not canonical');

    await page.goto(`${baseUrl}/nozomiantena/index`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: '2020', exact: true }).first().click();
    await page.waitForFunction(() => {
      const target = document.getElementById('2020');
      const top = target?.getBoundingClientRect().top ?? -1;
      return location.hash === '#2020' && top >= 48 && top <= 80;
    });

    await page.goto(`${baseUrl}/ryuji-miura/index`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '三浦龍司選手の記録集', exact: true }).waitFor();
    await page.getByRole('link', { name: '2020', exact: true }).first().click();
    await page.waitForFunction(() => {
      const target = document.getElementById('2020');
      const top = target?.getBoundingClientRect().top ?? -1;
      return location.hash === '#2020' && top >= 48 && top <= 80;
    });

    const canonicalStatus = availabilityStatuses.find(status => representativeTracks[status]);
    if (!canonicalStatus) throw new Error('No valid availability representative is available for canonical detail smoke testing');
    const canonicalRepresentative = representativeTracks[canonicalStatus];
    await page.goto(`${baseUrl}/tracks/${canonicalRepresentative.id}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: statusLabels[canonicalStatus], exact: true }).waitFor();
    if (new URL(page.url()).searchParams.has('date')) throw new Error('Track detail without date unexpectedly added a date query');
    if (await page.getByLabel('日付を選ぶ').inputValue() !== today) throw new Error('Track detail without date did not default to today');
    if ((await page.locator('link[rel="canonical"]').getAttribute('href')) !== `https://itsrun.info/tracks/${canonicalRepresentative.id}`) throw new Error('Track detail canonical unexpectedly includes a date query');

    for (const status of availabilityStatuses) {
      const representative = representativeTracks[status];
      if (!representative) {
        console.log(`Skipping ${status} representative detail coverage for ${today}: no effective-status record`);
        continue;
      }
      await page.goto(`${baseUrl}/tracks/${representative.id}?date=${today}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: statusLabels[status], exact: true }).waitFor();
      await page.getByRole('heading', { name: status === 'unavailable' ? 'この日の代替候補' : 'この日の周辺トラック', exact: true }).waitFor();
      if (await page.locator('.related-section .alternative-link').count() !== 5) throw new Error(`${status} detail did not render five ranked alternatives`);
      const firstAlternativeHref = await page.locator('.related-section .alternative-link').first().getAttribute('href');
      if (!firstAlternativeHref?.startsWith('/tracks/') || firstAlternativeHref.includes('?')) throw new Error(`${status} alternative link is not canonical`);
      const nearbySearchHref = await page.getByRole('link', { name: 'この施設を基準に周辺を比較', exact: true }).getAttribute('href');
      if (!nearbySearchHref?.includes(`date=${today}`) || !nearbySearchHref.includes('lat=') || !nearbySearchHref.includes('lng=')) throw new Error(`${status} nearby map search is missing the selected date or origin`);
      if ((await page.locator('link[rel="canonical"]').getAttribute('href')) !== `https://itsrun.info/tracks/${representative.id}`) throw new Error(`${status} detail canonical unexpectedly includes a date query`);
      const emphasized = await page.locator('.related-section').evaluate(element => element.classList.contains('related-section--urgent'));
      if (emphasized !== (status === 'unavailable')) throw new Error(`${status} detail alternative emphasis is incorrect`);
      if (viewport.width < 800) {
        const mobileOrder = await page.evaluate(() => ({
          availability: document.querySelector('.availability-panel')?.getBoundingClientRect().top ?? 0,
          alternatives: document.querySelector('.related-section')?.getBoundingClientRect().top ?? 0,
          information: document.querySelector('.info-section')?.getBoundingClientRect().top ?? 0,
        }));
        if (!(mobileOrder.availability < mobileOrder.alternatives && mobileOrder.alternatives < mobileOrder.information)) throw new Error(`${status} mobile alternatives are not placed immediately after availability`);
      }
    }

    const englishStatus = representativeTracks.unavailable
      ? 'unavailable'
      : availabilityStatuses.find(status => status !== 'unavailable' && representativeTracks[status]);
    if (!englishStatus) {
      console.log(`Skipping English representative detail coverage for ${today}: no effective-status record`);
    } else {
      const englishRepresentative = representativeTracks[englishStatus];
      const englishAvailabilityClass = availabilityClass(englishStatus);
      await page.goto(`${baseUrl}/en/tracks/${englishRepresentative.id}?date=${today}`, { waitUntil: 'domcontentloaded' });
      await page.locator(`.availability-panel.${englishAvailabilityClass}`).waitFor();
      await page.getByRole('heading', { name: englishStatusLabels[englishStatus], exact: true }).waitFor();
      await page.getByRole('heading', { name: englishStatus === 'unavailable' ? 'Nearby alternatives for this date' : 'Nearby tracks for this date', exact: true }).waitFor();
      const englishUrgent = await page.locator('.related-section').evaluate(element => element.classList.contains('related-section--urgent'));
      if (englishUrgent !== (englishStatus === 'unavailable')) throw new Error(`English ${englishStatus} detail alternative emphasis is incorrect`);
      const englishAlternativeHref = await page.locator('.related-section .alternative-link').first().getAttribute('href');
      if (!englishAlternativeHref?.startsWith('/en/tracks/') || englishAlternativeHref.includes('?')) throw new Error('English alternative link is not canonical');
      await page.getByRole('link', { name: 'View location on map', exact: true }).click();
      await page.waitForURL(url => url.pathname === '/en/' && url.hash === '#track-map-section'
        && url.searchParams.get('date') === today
        && url.searchParams.get('track') === englishRepresentative.id);
      await page.locator('#track-map .track-marker--selected').waitFor();
      await page.locator(`.detail-card .today-availability.${englishAvailabilityClass}`).waitFor();
      await page.waitForFunction(() => {
        const target = document.getElementById('track-map-section');
        const top = target?.getBoundingClientRect().top ?? -1;
        return document.activeElement === target && top >= 48 && top <= 100;
      });
    }

    // Document links stay canonical; activating a link preserves selected state.
    // Exercise both languages and future dates so default-today behavior cannot
    // accidentally make a dropped date look correct.
    for (const prefix of ['', '/en']) {
      await page.goto(`${baseUrl}${prefix}/`, { waitUntil: 'domcontentloaded' });
      await page.locator('.date-controls input[type="date"]').waitFor();
      if (new URL(page.url()).search) throw new Error('Bare home gained a query');
      await page.locator('[data-oda-discovery-link]').click();
      await page.waitForURL(url => url.pathname === `${prefix}/tracks/${odaTrack.id}`);
      if (new URL(page.url()).search) throw new Error('Default facility navigation added a date');
      await page.goto(`${baseUrl}${prefix}/?date=${tomorrow}&lat=35.8414&lng=139.8626`, { waitUntil: 'domcontentloaded' });
      // The first row can change when the date JSON hides unavailable tracks.
      // Wait for that data to reach the list before reading and activating its link.
      await page.waitForFunction(expected => {
        const count = Number.parseInt(document.querySelector('.facility-heading strong')?.textContent ?? '', 10);
        return count === expected && !document.querySelector('[aria-label="availability loading"]');
      }, tomorrowCounts.candidates);
      const detailLink = page.locator('.facility-row a').first();
      await detailLink.waitFor();
      const href = await detailLink.getAttribute('href');
      if (!href?.startsWith(`${prefix}/tracks/`) || href.includes('?')) throw new Error('Search result href is not canonical');
      if (prefix) await detailLink.press('Enter');
      else await detailLink.click();
      await page.waitForURL(url => url.pathname === href && url.searchParams.get('date') === tomorrow && url.searchParams.get('lat') === '35.8414' && url.searchParams.get('lng') === '139.8626');
      await page.locator('.date-panel input[type="date"]').waitFor();
      if (await page.locator('.date-panel input').inputValue() !== tomorrow) throw new Error('Facility navigation lost selected date');
      // Address-bar sharing/reloading retains the context.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.date-panel input[type="date"]').waitFor();
      if (await page.locator('.date-panel input').inputValue() !== tomorrow) throw new Error('Shared facility URL lost selected date');
      await page.locator('.related-section[data-availability-loaded="true"]').waitFor();
      const alternative = page.locator('.alternative-link').first();
      const alternativeHref = await alternative.getAttribute('href');
      if (!alternativeHref || alternativeHref.includes('?')) throw new Error('Alternative href is not canonical');
      await alternative.click();
      await page.waitForURL(url => url.pathname === alternativeHref && url.searchParams.get('date') === tomorrow);
      await page.locator('.breadcrumbs a').click();
      await page.waitForURL(url => url.pathname === `${prefix}/` && url.searchParams.get('date') === tomorrow);
      await page.locator('.date-controls input[type="date"]').waitFor();
      if (await page.locator('.date-controls input').inputValue() !== tomorrow) throw new Error('Breadcrumb lost selected date');
    }

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
