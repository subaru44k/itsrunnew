import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const baseUrl = process.env.ITSRUN_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDirectory = process.env.ITSRUN_PACE_OUTPUT ?? '/tmp/itsrun-pace-check';
const executablePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const storageKey = 'itsrun.marathon.v1';
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const baseOrigin = new URL(baseUrl).origin;
const runtimeErrors = [];
const externalRequests = [];
const screenshots = [];
const images = [];

async function serverIsAvailable() {
  const url = new URL('/pace/marathon', baseUrl);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
    return { available: response.ok, detail: `HTTP ${response.status}` };
  } catch (error) {
    return { available: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

function localRequest(url) {
  if (/^(?:about|blob|data):/i.test(url)) return true;
  try {
    return new URL(url).origin === baseOrigin;
  } catch {
    return true;
  }
}

function allowedExternalRequest(url) {
  return /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//i.test(url);
}

async function createContext(browser, viewport, { denyStorage = false } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.route('**/*', route => {
    const url = route.request().url();
    if (!localRequest(url)) {
      if (!allowedExternalRequest(url)) externalRequests.push(url);
      return route.abort();
    }
    return route.continue();
  });
  await context.addInitScript(({ deny }) => {
    window.__paceSmokeClipboardFailure = false;
    window.__paceSmokeClipboardText = '';
    const writeText = async text => {
      if (window.__paceSmokeClipboardFailure) throw new Error('clipboard denied');
      window.__paceSmokeClipboardText = text;
    };
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
    } catch {
      // Chromium normally permits the replacement above. If it exposes a
      // non-configurable clipboard, the app's fallback path remains covered.
    }
    if (!deny) return;
    for (const method of ['getItem', 'setItem', 'removeItem', 'clear']) {
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value() { throw new DOMException('Storage access denied', 'SecurityError'); },
      });
    }
  }, { deny: denyStorage });
  return context;
}

async function openPage(context, viewportName, localeName) {
  const page = await context.newPage();
  page.on('pageerror', error => runtimeErrors.push(`${viewportName}/${localeName}: ${error.message}`));
  return page;
}

async function gotoPace(page, path) {
  await page.goto(new URL(path, baseUrl).href, { waitUntil: 'domcontentloaded' });
  await page.locator('h1').waitFor({ state: 'visible' });
  await page.locator('[data-goal-summary]').waitFor({ state: 'visible' });
}

async function waitForGoal(page, expected) {
  await page.waitForFunction(value => document.querySelector('[data-goal-summary]')?.textContent?.trim() === value, expected);
}

async function waitForResults(page, visible) {
  await page.locator('[data-pace-results]').waitFor({ state: visible ? 'visible' : 'hidden' });
}

async function savedSettings(page) {
  return page.evaluate(key => {
    const value = localStorage.getItem(key);
    return value === null ? null : JSON.parse(value);
  }, storageKey);
}

async function assertCanonical(page, expectedPath) {
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  if (canonical !== `https://itsrun.info${expectedPath}`) {
    throw new Error(`Canonical URL mismatch: expected https://itsrun.info${expectedPath}, got ${canonical}`);
  }
  if (canonical.includes('?')) throw new Error(`Canonical URL unexpectedly contains a query: ${canonical}`);
}

async function assertNoDocumentOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) throw new Error(`Horizontal overflow at ${label}: ${overflow}px`);
}

async function trainingValue(page, distance) {
  const rows = await page.locator('.training-times div').evaluateAll(elements => elements.map(element => ({
    distance: element.querySelector('dt')?.textContent?.trim(),
    value: element.querySelector('dd')?.textContent?.trim(),
  })));
  const row = rows.find(item => item.distance === distance);
  if (!row) throw new Error(`Training row ${distance} was not found`);
  return row.value;
}

async function verifyPng(path) {
  const bytes = await readFile(path);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) throw new Error(`Downloaded file is not a PNG: ${path}`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== 1000 || height !== 1160) throw new Error(`Unexpected PNG dimensions at ${path}: ${width}x${height}`);
  return { path, width, height, bytes: bytes.length };
}

async function expandComparison(page) {
  const comparison = page.locator('details[data-pace-comparison]');
  if ((await comparison.getAttribute('open')) === null) await comparison.locator('summary').click();
  await comparison.locator('.comparison-body table:visible').waitFor({ state: 'visible' });
  if (await comparison.locator('.comparison-body tbody tr').count() < 3) throw new Error('Expanded comparison table is missing goal rows');
}

async function switchComparisonBand(page, label) {
  const comparison = page.locator('details[data-pace-comparison]');
  const input = comparison.locator('input[role="combobox"]');
  await input.locator('xpath=..').click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await page.waitForFunction(expected => document.querySelector('details[data-pace-comparison] input[role="combobox"]')?.value === expected, label);
}

async function saveScreenshot(page, name) {
  const path = join(outputDirectory, `${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  screenshots.push(path);
}

async function runJapaneseFlow(browser, viewport) {
  const context = await createContext(browser, viewport);
  const page = await openPage(context, viewport.name, 'ja');
  try {
    await gotoPace(page, '/pace/marathon');
    if (await page.locator('h1').textContent() !== 'マラソンペース表') throw new Error('Japanese pace heading is missing');
    await waitForGoal(page, '4:00:00');
    if (await page.locator('[data-pace-hours]').inputValue() !== '4') throw new Error('Initial goal hours are not four');
    await assertCanonical(page, '/pace/marathon');

    await page.locator('[data-pace-hours]').fill('3');
    await page.locator('[data-pace-minutes]').fill('59');
    await page.locator('[data-pace-seconds]').fill('0');
    await waitForGoal(page, '3:59:00');
    await page.waitForURL(url => url.searchParams.get('goal') === '14340');
    if (JSON.stringify(await savedSettings(page)) !== JSON.stringify({ mode: 'goal', seconds: 14340 })) {
      throw new Error('Custom 3:59:00 goal was not persisted');
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForGoal(page, '3:59:00');
    await page.goto(new URL('/pace/marathon', baseUrl).href, { waitUntil: 'domcontentloaded' });
    await waitForGoal(page, '3:59:00');
    await assertCanonical(page, '/pace/marathon');

    await page.getByRole('button', { name: '1kmペースから', exact: true }).click();
    await page.locator('[data-pace-minutes]').fill('5');
    await page.locator('[data-pace-seconds]').fill('30');
    await waitForGoal(page, '3:52:04');
    await page.getByRole('button', { name: '目標タイムから', exact: true }).click();
    await waitForGoal(page, '3:59:00');

    await page.goto(new URL('/pace/marathon?goal=12600', baseUrl).href, { waitUntil: 'domcontentloaded' });
    await waitForGoal(page, '3:30:00');
    if (JSON.stringify(await savedSettings(page)) !== JSON.stringify({ mode: 'goal', seconds: 12600 })) {
      throw new Error('Explicit goal query did not override the saved setting');
    }
    await assertCanonical(page, '/pace/marathon');

    await page.goto(new URL('/pace/marathon?pace=330', baseUrl).href, { waitUntil: 'domcontentloaded' });
    await waitForGoal(page, '3:52:04');
    if (await trainingValue(page, '400 m') !== '0:02:12') throw new Error('Pace 5:30 training 400m time is incorrect');
    if (await trainingValue(page, '5 km') !== '0:27:30') throw new Error('Pace 5:30 training 5km time is incorrect');
    await assertCanonical(page, '/pace/marathon');

    await page.locator('[data-pace-seconds]').fill('');
    await waitForResults(page, false);
    await page.locator('[data-pace-seconds]').fill('30');
    await waitForResults(page, true);
    await page.locator('[data-pace-seconds]').fill('60');
    await waitForResults(page, false);
    await page.locator('[data-pace-seconds]').fill('30');
    await waitForResults(page, true);

    await page.getByRole('button', { name: '設定をリセット', exact: true }).click();
    await page.waitForURL(url => !url.searchParams.has('goal') && !url.searchParams.has('pace'));
    await waitForGoal(page, '4:00:00');
    if (await savedSettings(page) !== null) throw new Error('Reset did not remove persisted settings');

    await page.goto(new URL('/pace/marathon?goal=12600', baseUrl).href, { waitUntil: 'domcontentloaded' });
    await waitForGoal(page, '3:30:00');
    await page.goto(new URL('/pace/marathon?goal=invalid', baseUrl).href, { waitUntil: 'domcontentloaded' });
    await waitForGoal(page, '3:30:00');
    await page.getByText('リンクの設定を読み取れなかったため', { exact: false }).waitFor({ state: 'visible' });
    if (JSON.stringify(await savedSettings(page)) !== JSON.stringify({ mode: 'goal', seconds: 12600 })) {
      throw new Error('Malformed query poisoned the saved setting');
    }
    await page.goto(new URL('/pace/marathon?goal=12600&pace=330', baseUrl).href, { waitUntil: 'domcontentloaded' });
    await waitForGoal(page, '3:30:00');
    await page.getByText('リンクの設定を読み取れなかったため', { exact: false }).waitFor({ state: 'visible' });
    if (JSON.stringify(await savedSettings(page)) !== JSON.stringify({ mode: 'goal', seconds: 12600 })) {
      throw new Error('Ambiguous query poisoned the saved setting');
    }
    await page.goto(new URL('/pace/marathon', baseUrl).href, { waitUntil: 'domcontentloaded' });
    await waitForGoal(page, '3:30:00');

    await page.evaluate(() => { window.__paceSmokeClipboardFailure = false; });
    await page.getByRole('button', { name: 'リンクをコピー', exact: true }).click();
    await page.getByText('この設定のリンクをコピーしました。', { exact: true }).waitFor({ state: 'visible' });
    const copied = await page.evaluate(() => window.__paceSmokeClipboardText);
    if (!copied.includes('goal=12600')) throw new Error(`Clipboard mock received the wrong URL: ${copied}`);
    await page.evaluate(() => { window.__paceSmokeClipboardFailure = true; });
    await page.getByRole('button', { name: 'リンクをコピー', exact: true }).click();
    await page.locator('.action-status').filter({ hasText: 'リンクを選択してコピーしてください。' }).waitFor({ state: 'visible' });
    await page.locator('.manual-link input').waitFor({ state: 'visible' });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '画像で保存', exact: true }).click();
    const download = await downloadPromise;
    const imagePath = join(outputDirectory, `${viewport.name}-ja-${download.suggestedFilename()}`);
    await download.saveAs(imagePath);
    images.push(await verifyPng(imagePath));

    await assertNoDocumentOverflow(page, `${viewport.name}/ja-collapsed`);
    await saveScreenshot(page, `${viewport.name}-ja-planner`);
    await expandComparison(page);
    await switchComparisonBand(page, '5時間〜6時間半');
    await assertNoDocumentOverflow(page, `${viewport.name}/ja`);
    await saveScreenshot(page, `${viewport.name}-ja-comparison`);
  } finally {
    await page.close();
    await context.close();
  }
}

async function runEnglishFlow(browser, viewport) {
  const context = await createContext(browser, viewport);
  const page = await openPage(context, viewport.name, 'en');
  try {
    await gotoPace(page, '/en/pace/marathon');
    if (await page.locator('h1').textContent() !== 'Marathon pace table') throw new Error('English pace heading is missing');
    await page.getByRole('heading', { name: 'Your split times', exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('heading', { name: 'Training times', exact: true }).waitFor({ state: 'visible' });
    await page.locator('details[data-pace-comparison] > summary').filter({ hasText: 'Compare finish times' }).waitFor({ state: 'visible' });
    await assertCanonical(page, '/en/pace/marathon');
    await assertNoDocumentOverflow(page, `${viewport.name}/en-collapsed`);
    await saveScreenshot(page, `${viewport.name}-en-planner`);
    await expandComparison(page);
    await switchComparisonBand(page, '5 hours - 6 hours and a half');
    await assertNoDocumentOverflow(page, `${viewport.name}/en`);
    await saveScreenshot(page, `${viewport.name}-en-comparison`);
  } finally {
    await page.close();
    await context.close();
  }
}

async function runDeniedStorageFlow(browser, viewport) {
  const context = await createContext(browser, viewport, { denyStorage: true });
  const page = await openPage(context, viewport.name, 'denied-storage');
  try {
    await gotoPace(page, '/pace/marathon');
    await waitForGoal(page, '4:00:00');
    await page.getByText('このブラウザでは設定を保存できません。', { exact: false }).waitFor({ state: 'visible' });
    await page.locator('[data-pace-hours]').fill('3');
    await page.locator('[data-pace-minutes]').fill('59');
    await page.locator('[data-pace-seconds]').fill('0');
    await waitForGoal(page, '3:59:00');
    await assertNoDocumentOverflow(page, `${viewport.name}/denied-storage`);
  } finally {
    await page.close();
    await context.close();
  }
}

const server = await serverIsAvailable();
if (!server.available) {
  throw new Error(`Pace smoke server unavailable: ${baseUrl} (${server.detail}). Start the local server first.`);
} else {
  await mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const viewport of viewports) {
      await runJapaneseFlow(browser, viewport);
      await runEnglishFlow(browser, viewport);
      await runDeniedStorageFlow(browser, viewport);
    }
    if (externalRequests.length > 0) throw new Error(`External requests were attempted: ${externalRequests.join(', ')}`);
    if (runtimeErrors.length > 0) throw new Error(`Runtime errors detected:\n${runtimeErrors.join('\n')}`);
    console.log(JSON.stringify({
      baseUrl,
      viewports: viewports.map(viewport => `${viewport.name} ${viewport.width}px`),
      screenshots,
      images,
      message: 'Pace smoke passed for Japanese/English, persistence/query/input behavior, clipboard fallback, image export, and responsive layout.',
    }, null, 2));
  } finally {
    await browser.close();
  }
}
