import { chromium } from 'playwright-core';
import { selectViewports } from './test-viewports.mjs';
const base = process.env.ITSRUN_BASE_URL;
if (!base) throw new Error('ITSRUN_BASE_URL is required');
const origin = new URL(base).origin;
async function get(path, options) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(10000), ...options });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response;
}
const manifest = await (await get('/availability/manifest.json')).json();
if (manifest.schemaVersion !== 1 || !/^[a-f0-9]{24}$/.test(manifest.generation)) throw new Error('Release requires published generation data');
const day = await (await get(`/availability/generations/${manifest.generation}/dates/${manifest.startDate}.json`)).json();
const track = day.facilities[0]?.trackId;
if (!/^[a-z0-9-]+$/.test(track ?? '')) throw new Error('No facility in published data');
const bundle = await (await get(`/availability/generations/${manifest.generation}/tracks/${track}.json`)).json();
if (bundle.generation !== manifest.generation || bundle.trackId !== track || bundle.records?.length !== 31) throw new Error('Published facility bundle is invalid');
const html = await (await get('/')).text();
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]).filter(path => path.startsWith('/assets/'));
if (!scripts.length) throw new Error('No application entry asset');
for (const path of scripts) await get(path);
const redirect = await fetch(new URL(`/oda-field?date=${manifest.startDate}`, base), { redirect: 'manual', signal: AbortSignal.timeout(10000) });
if (redirect.status !== 301 || redirect.headers.get('location') !== `/tracks/yoyogi-park-athletic-track?date=${manifest.startDate}`) throw new Error('Legacy routing failed');
if ((await fetch(new URL('/release-check-missing-page', base), { signal: AbortSignal.timeout(10000) })).status !== 404) throw new Error('Missing route must return HTTP 404');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  for (const viewport of selectViewports([{ width: 1440, height: 1000 }, { width: 390, height: 844 }])) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('itsrun.analytics-consent.v1', 'denied'));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const loadedDate = page.waitForResponse(response => response.url().endsWith(`/${manifest.startDate}.json`) && response.ok());
    await page.goto(new URL(`/?date=${manifest.startDate}`, base).href, { waitUntil: 'domcontentloaded' });
    await loadedDate;
    await page.locator('.track-hero').waitFor();
    const expectedCount = day.facilities.filter(record => record.status !== 'unavailable' || Date.now() >= Date.parse(record.freshness.expiresAt)).length;
    await page.waitForFunction(expected => Number(document.querySelector('.track-controls .result-count')?.textContent?.match(/\d+/)?.[0]) === expected, expectedCount);
    for (const prefix of ['', '/en']) {
      await page.goto(`${base}${prefix}/tracks/${track}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.facility-schedule[aria-busy="false"]').waitFor();
      await page.locator('h1').waitFor();
    }
    if (errors.length) throw new Error(errors.join('\n'));
    await page.close();
  }
} finally { await browser.close(); }
console.log('Published release routing, entry assets and desktop/mobile startup verified');
