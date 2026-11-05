import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { selectViewports } from './test-viewports.mjs';
const base = process.env.ITSRUN_BASE_URL ?? 'http://127.0.0.1:4173';
const manifest = JSON.parse(readFileSync(new URL('../src/data/availability/manifest.json', import.meta.url), 'utf8'));
const data = JSON.parse(readFileSync(new URL(`../src/data/availability/${manifest.startDate}.json`, import.meta.url), 'utf8'));
assert(data.facilities.length && data.facilities.every(record => record.status === 'unknown'), 'Unknown regression requires all-unknown data');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  for (const viewport of selectViewports([{ width: 1440, height: 1000 }, { width: 390, height: 844 }])) for (const prefix of ['', '/en']) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('itsrun.analytics-consent.v1', 'denied'));
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    const loadedDate = page.waitForResponse(response => response.url().endsWith(`/${manifest.startDate}.json`) && response.ok());
    await page.goto(`${base}${prefix}/`, { waitUntil: 'domcontentloaded' });
    await loadedDate;
    await page.waitForFunction(count => Number(document.querySelector('.track-controls .result-count')?.textContent?.match(/\d+/)?.[0]) === count, data.facilities.length);
    assert.equal(await page.locator('.availability--unavailable, .availability--available, .availability--partially-available').count(), 0);
    const loadedSchedule = page.waitForResponse(response => response.url().includes(`/tracks/${data.facilities[0].trackId}.json`) && response.ok());
    await page.goto(`${base}${prefix}/tracks/${data.facilities[0].trackId}`, { waitUntil: 'domcontentloaded' });
    await loadedSchedule;
    await page.locator('.facility-schedule[data-schedule-mode="confirmation"][aria-busy="false"]').waitFor();
    assert.equal(await page.locator('.schedule-list li').count(), 0);
    await page.locator('.date-panel summary').click();
    await page.getByRole('heading', { name: prefix ? 'Needs confirmation' : '要確認', exact: true }).waitFor();
    assert.equal(await page.locator('.related-section--urgent').count(), 0);
    assert.equal(await page.locator('.related-section .alternative-link').count(), 5);
    await page.locator('.date-picker input[type="date"]').fill(manifest.endDate);
    await page.locator('.date-picker input[type="date"]').dispatchEvent('change');
    await page.waitForFunction(date => new URL(location.href).searchParams.get('date') === date, manifest.endDate);
    await page.getByRole('heading', { name: prefix ? 'Needs confirmation' : '要確認', exact: true }).waitFor();
    assert.equal(await page.locator('.schedule-list li').count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  }
} finally { await browser.close(); }
console.log('All-unknown availability remains searchable, requires confirmation and preserves alternatives/date navigation');
