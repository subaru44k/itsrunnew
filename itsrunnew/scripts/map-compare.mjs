import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const oldUrl = process.env.ITSRUN_OLD_URL ?? 'http://127.0.0.1:4172';
const newUrl = process.env.ITSRUN_NEW_URL ?? 'http://127.0.0.1:4173';
const output = process.env.ITSRUN_MAP_OUTPUT ?? '/tmp/itsrun-map-comparison';
const tilePattern = 'https://tile.openstreetmap.org/**';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const measurements = [];
const errors = [];
const adPattern = /googlesyndication|doubleclick|googletagmanager|google-analytics|googleadservices/i;
await mkdir(output, { recursive: true });

function isMapTilerUrl(url) {
  return url.hostname === 'maptiler.com' || url.hostname.endsWith('.maptiler.com');
}

async function assertOsmAttribution(page, context) {
  const attribution = page.locator('#track-map .leaflet-control-attribution');
  assert.match(await attribution.textContent() ?? '', /OpenStreetMap/, `${context}: attribution missing`);
}

function assertNoMapTilerRequests(requests, context) {
  assert.equal(requests, 0, `${context}: new map must make zero MapTiler requests`);
}

async function ready(page) {
  await page.locator('#track-map .track-marker, #track-map .track-cluster').first().waitFor();
  await page.locator('.map-message').waitFor({ state: 'detached' });
  await page.waitForTimeout(800);
}
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    for (const [version, base] of [['old', oldUrl], ['new', newUrl]]) {
      const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
      page.on('pageerror', error => errors.push(`${version}: ${error.message.replace(/key=[^&\s]+/g, 'key=REDACTED')}`));
      let tileRequests = 0; let osmTileRequests = 0;
      let maptilerRequests = 0;
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.hostname === 'tile.openstreetmap.org') { tileRequests++; osmTileRequests++; }
        if (isMapTilerUrl(url)) maptilerRequests++;
      });
      await page.route('**/*', route => adPattern.test(route.request().url()) ? route.abort() : route.continue());
      const start = Date.now();
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '同意しない', exact: true }).click();
      await ready(page);
      if (version === 'new') {
        await assertOsmAttribution(page, `${version}/${viewport.width}/initial`);
        assertNoMapTilerRequests(maptilerRequests, `${version}/${viewport.width}/initial`);
      }
      const initialMs = Date.now() - start;
      const initialTiles = tileRequests;
      for (const phase of ['initial', 'coverage', 'selected', 'english']) {
        if (phase === 'coverage') {
          await page.getByRole('button', { name: '掲載エリア全体を見る', exact: true }).click();
          await page.waitForFunction(() => Number(document.querySelector('#track-map').dataset.zoom) <= 7);
          await ready(page);
        }
        if (phase === 'selected') {
          // Use the same reference point and selected facility for both maps.
          await page.goto(`${base}/?lat=35.6896&lng=139.6917&track=tokyo-metropolitan-gymnasium-track`);
          await ready(page);
        }
        if (phase === 'english') {
          await page.locator('#track-map').evaluate(el => { el.__originalPane = el.querySelector('.leaflet-map-pane'); });
          await page.locator('.language-button').click();
          await page.waitForURL(url => url.pathname === '/en/');
          await ready(page);
          if (version === 'new') assert.ok(await page.locator('#track-map').evaluate(el => el.__originalPane === el.querySelector('.leaflet-map-pane')), 'Locale changes must not recreate the map');
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        assert.ok(overflow <= 1, `${version}/${viewport.width}/${phase}: horizontal overflow ${overflow}`);
        await page.locator('#track-map-section').screenshot({ path: `${output}/${version}-${viewport.width}-${phase}.png` });
      }
      if (version === 'new') {
        await page.getByRole('button', { name: 'View all coverage areas', exact: true }).click();
        await ready(page);
        // Keyboard cluster activation must advance the zoom on both viewport sizes.
        for (let attempt = 0; attempt < 7 && await page.locator('.track-marker:not(.track-marker--selected)').count() === 0; attempt++) {
          const previous = Number(await page.locator('#track-map').getAttribute('data-zoom'));
          await page.locator('.track-cluster-shell').first().focus();
          await page.keyboard.press('Enter');
          await page.waitForFunction(previous => Number(document.querySelector('#track-map').dataset.zoom) > previous, previous);
          await page.waitForTimeout(500);
        }
        const marker = page.locator('.track-marker-shell[aria-pressed="false"]').first();
        await marker.waitFor();
        const keyboardTrack = await marker.getAttribute('data-track-id');
        await marker.focus();
        await page.keyboard.press('Enter');
        await page.waitForURL(url => url.searchParams.get('track') === keyboardTrack);
        await page.locator('.track-marker--selected').waitFor();
        await page.locator('#track-map').evaluate(el => { el.__originalPane = el.querySelector('.leaflet-map-pane'); });
        await page.getByRole('button', { name: 'Tomorrow', exact: true }).click();
        await page.waitForTimeout(500);
        assert.ok(await page.locator('#track-map').evaluate(el => el.__originalPane === el.querySelector('.leaflet-map-pane')), 'Changing date must not recreate the map');

      }
      if (version === 'new') assertNoMapTilerRequests(maptilerRequests, `${version}/${viewport.width}/complete`);
      measurements.push({ version, width: viewport.width, initialMs, initialTiles, totalTiles: tileRequests, osmTileRequests, maptilerRequests });
      await page.close();
    }
  }
  // Tile/network outage: date, local geolocation and detail navigation still work, then retry recovers.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let recoveryMaptilerRequests = 0;
  page.on('pageerror', error => errors.push(`recovery: ${error.message.replace(/key=[^&\s]+/g, 'key=REDACTED')}`));
  page.on('request', request => { if (isMapTilerUrl(new URL(request.url()))) recoveryMaptilerRequests++; });
  await page.route(tilePattern, route => route.fulfill({ status: 403, body: 'Forbidden' }));
  await page.addInitScript(() => {
    Object.defineProperty(navigator.geolocation, 'getCurrentPosition', { configurable: true, value: success => success({ coords: { latitude: 35.6896, longitude: 139.6917 } }) });
  });
  await page.goto(newUrl);
  await page.getByRole('button', { name: '地図を再読み込み', exact: true }).waitFor();
  await page.locator('.hero-map-action').click();
  await page.locator('.hero-location-action').click();
  await page.waitForFunction(() => !document.querySelector('#track-map').classList.contains('is-selecting'));
  await page.locator('.distance-results .facility-row').first().waitFor();
  await page.getByRole('button', { name: '明日', exact: true }).click();
  await page.locator('.distance-results .facility-row > button').first().click();
  await page.locator('.detail-card').waitFor();
  await page.unroute(tilePattern);
  await page.getByRole('button', { name: '地図を再読み込み', exact: true }).click();
  await ready(page);
  await assertOsmAttribution(page, 'recovery');
  await page.locator('.search-origin-dot').waitFor();
  await page.locator('.track-marker--selected').waitFor();
  assertNoMapTilerRequests(recoveryMaptilerRequests, 'recovery');
  await page.close();
  assert.deepEqual(errors, []);
  await writeFile(`${output}/measurements.json`, JSON.stringify({ oldUrl, newUrl, note: 'One ad-blocked local run per viewport. Timings include consent interaction and an 800ms settle; these are observations, not a controlled speed benchmark.', measurements, errors }, null, 2));
  console.log(JSON.stringify({ output, measurements, failureRecovery: 'passed' }, null, 2));
} finally { await browser.close(); }
