import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { selectViewports } from './test-viewports.mjs';
import { verifyArchives } from './archive-smoke.mjs';
import { verifyFacilitySchedules } from './facility-schedule-smoke.mjs';

const suite = process.argv[2];
if (!['archives', 'schedule'].includes(suite)) throw new Error(`Unknown feature suite: ${suite}`);
const base = process.env.ITSRUN_BASE_URL ?? 'http://127.0.0.1:4173';
const tracks = JSON.parse(readFileSync(new URL('../src/data/tracks.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  for (const viewport of selectViewports([{ width: 1440, height: 1000 }, { width: 390, height: 844 }])) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('itsrun.analytics-consent.v1', 'denied'));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/reports') return route.fulfill({ json: { reports: [], count: 0 }, headers: { 'access-control-allow-origin': '*' } });
      return url.origin === new URL(base).origin ? route.continue() : route.abort();
    });
    if (suite === 'archives') await verifyArchives(page, base);
    else await verifyFacilitySchedules(page, base, tracks);
    if (errors.length) throw new Error(errors.join('\n'));
    await page.close();
  }
  console.log(`${suite} passed for ${process.env.ITSRUN_TEST_VIEWPORT ?? 'all'}`);
} finally {
  await browser.close();
}
