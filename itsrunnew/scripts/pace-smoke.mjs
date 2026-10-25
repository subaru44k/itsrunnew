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
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  page.on('pageerror', error => runtimeErrors.push(`${viewportName}/${localeName}: ${error.message}`));
  return page;
}

async function gotoPace(page, path) {
  await page.goto(new URL(path, baseUrl).href, { waitUntil: 'domcontentloaded' });
  await page.locator('h1').waitFor({ state: 'visible' });
  await page.locator('[data-goal-summary]').waitFor({ state: 'visible' });
}

async function waitForGoal(page, expected) {
  try {
    await page.waitForFunction(value => document.querySelector('[data-goal-summary]')?.textContent?.trim() === value, expected);
  } catch (error) {
    const actual = await page.locator('[data-goal-summary]').textContent();
    throw new Error(`Expected goal ${expected}, got ${actual} at ${page.url()}`, { cause: error });
  }
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

async function verifyTrainingDistances(page) {
  await gotoPace(page, `${new URL(page.url()).pathname}?pace=330`);
  const expected = [['200 m', '0:01:06'], ['250 m', '0:01:22'], ['300 m', '0:01:39'], ['400 m', '0:02:12'], ['800 m', '0:04:24'], ['1 km', '0:05:30'], ['2 km', '0:11:00'], ['5 km', '0:27:30'], ['10 km', '0:55:00']];
  if (await page.locator('.training-times div').count() !== expected.length) throw new Error('Unexpected training distance count');
  for (const [distance, value] of expected) {
    if (await trainingValue(page, distance) !== value) throw new Error(`Incorrect training time for ${distance}`);
  }
  await assertNoDocumentOverflow(page, 'expanded training distances');
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

async function verifyComparison(page) {
  const comparison = page.locator('[data-pace-comparison]');
  await comparison.locator('table').waitFor({ state: 'visible' });
  const headings = await comparison.locator('thead th').allTextContents();
  if (headings.slice(1).join('|') !== '1km|5km|10km|20km|30km') throw new Error(`Unexpected comparison columns: ${headings}`);
  if ((await comparison.locator('table').textContent()).includes('→')) throw new Error('Comparison contains an arrow');
  const goals = await comparison.locator('[data-comparison-goal]').evaluateAll(rows => rows.map(row => Number(row.dataset.comparisonGoal)));
  if (goals.length !== 19 || goals.some((goal, index) => goal !== 7200 + index * 900)) throw new Error('Comparison must contain unique 15-minute goals from 2:00 to 6:30');
  const beforeInput = await page.evaluate(() => document.querySelector('[data-pace-comparison]').compareDocumentPosition(document.querySelector('#pace-detail')) & Node.DOCUMENT_POSITION_FOLLOWING);
  if (!beforeInput) throw new Error('Comparison must precede the calculator');
  await comparison.locator('[data-comparison-goal="13500"] button').focus();
  await page.keyboard.press('Enter');
  await waitForGoal(page, '3:45:00');
  await page.waitForURL(url => url.searchParams.get('goal') === '13500');
  if (!await page.locator('#pace-detail').evaluate(element => element === document.activeElement)) throw new Error('Goal selection did not focus the detail');
  const values = await comparison.locator('[data-comparison-goal="13500"] td').allTextContents();
  if (values.join('|') !== '5:20|0:26:39|0:53:19|1:46:38|2:39:58') throw new Error(`Unexpected comparison values: ${values}`);
  const detail = await page.locator('[data-personal-splits] tbody tr').allTextContents();
  for (const value of values.slice(1)) if (!detail.some(row => row.includes(value))) throw new Error(`Comparison/detail mismatch: ${value}`);
  await comparison.locator('a[href="#goals-6"]').click();
  await page.waitForFunction(() => location.hash === '#goals-6');
  await comparison.locator('[data-comparison-goal="23400"] td').first().click();
  await waitForGoal(page, '6:30:00');
  await page.waitForURL(url => url.searchParams.get('goal') === '23400' && !url.hash);
  await page.waitForFunction(() => { const top = document.querySelector('#pace-detail').getBoundingClientRect().top; return top >= 60 && top < 150; });
  if (await page.locator('[data-pace-hours]').inputValue() !== '6') throw new Error('Row selection did not update input');
  const scroll = comparison.locator('.comparison-scroll');
  await scroll.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  const fixed = await comparison.locator('[data-comparison-goal="13500"] th').boundingBox();
  const region = await scroll.boundingBox();
  if (Math.abs(fixed.x - region.x) > 2) throw new Error('Goal column is not fixed when scrolling');
  await scroll.evaluate(element => { element.scrollLeft = 0; });
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
    await verifyComparison(page);
    await assertNoDocumentOverflow(page, `${viewport.name}/ja`);
    await saveScreenshot(page, `${viewport.name}-ja-comparison`);
    await verifyTrainingDistances(page);
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
    await verifyTrainingDistances(page);
    if (await page.locator('h1').textContent() !== 'Marathon pace table') throw new Error('English pace heading is missing');
    await page.getByRole('heading', { name: 'Split times', exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('heading', { name: 'Training times', exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('heading', { name: 'Compare finish times', exact: true }).waitFor({ state: 'visible' });
    await assertCanonical(page, '/en/pace/marathon');
    await assertNoDocumentOverflow(page, `${viewport.name}/en-collapsed`);
    await saveScreenshot(page, `${viewport.name}-en-planner`);
    await verifyComparison(page);
    await assertNoDocumentOverflow(page, `${viewport.name}/en`);
    await saveScreenshot(page, `${viewport.name}-en-comparison`);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save image', exact: true }).click();
    const download = await downloadPromise;
    if (download.suggestedFilename() !== 'itsrun-goal-23400.png') throw new Error('Selected comparison goal was not used for PNG');
    const imagePath = join(outputDirectory, `${viewport.name}-en-${download.suggestedFilename()}`);
    await download.saveAs(imagePath);
    images.push(await verifyPng(imagePath));
    await page.locator('.language-button').click();
    await page.waitForURL(url => url.pathname === '/pace/marathon' && url.searchParams.get('goal') === '23400');
    await waitForGoal(page, '6:30:00');
    if (await page.locator('[data-comparison-goal="23400"] button').getAttribute('aria-pressed') !== 'true') throw new Error('Locale switch lost comparison selection');
  } finally {
    await page.close();
    await context.close();
  }
}

async function runFacilityTrainingFlow(browser, viewport, locale) {
  const prefix = locale === 'en' ? '/en' : '';
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  // Facility pages include third-party maps; keep this navigation check local.
  await context.route('**/*', route => localRequest(route.request().url()) ? route.continue() : route.abort());
  const page = await openPage(context, viewport.name, `${locale}-facility-training`);
  try {
    await gotoPace(page, `${prefix}/pace/marathon?pace=330`);
    await page.goto(new URL(`${prefix}/tracks/komazawa-olympic-park-track`, baseUrl).href, { waitUntil: 'domcontentloaded' });
    const link = page.locator('.pace-discovery-link');
    await link.waitFor({ state: 'visible' });
    if (await link.getAttribute('href') !== `${prefix}/pace/marathon#pace-detail`) throw new Error('Facility pace link lost locale or input anchor');
    await assertNoDocumentOverflow(page, `${viewport.name}/${locale}-facility`);
    await saveScreenshot(page, `${viewport.name}-${locale}-facility-training`);
    await link.click();
    await page.waitForURL(url => url.pathname === `${prefix}/pace/marathon` && url.hash === '#pace-detail');
    await waitForGoal(page, '3:52:04');
    await page.waitForFunction(() => { const top = document.querySelector('#pace-detail').getBoundingClientRect().top; return top >= 60 && top < 150; });
    await page.locator('.training-help a').click();
    await page.waitForURL(url => url.hash === '#pace-training');
    await page.waitForFunction(() => { const top = document.querySelector('#pace-training').getBoundingClientRect().top; return top >= 60 && top < window.innerHeight - 100; });
    if (await trainingValue(page, '400 m') !== '0:02:12') throw new Error('Facility flow lost saved training pace');
    await page.locator('#pace-training > a[href$="#pace-detail"]').click();
    await page.waitForURL(url => url.hash === '#pace-detail');
    await page.locator('[data-pace-seconds]').fill('0');
    await waitForGoal(page, '3:30:58');
    await page.waitForURL(url => url.searchParams.get('pace') === '300');
    if (JSON.stringify(await savedSettings(page)) !== JSON.stringify({ mode: 'pace', seconds: 300 })) throw new Error('Edited training pace was not saved');
    await page.locator('.training-help a').click();
    await page.waitForURL(url => url.searchParams.get('pace') === '300' && url.hash === '#pace-training');
    if (await trainingValue(page, '400 m') !== '0:02:00') throw new Error('Training times did not reflect edited pace');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForGoal(page, '3:30:58');
    await page.locator('#pace-training').waitFor({ state: 'visible' });
    await assertCanonical(page, `${prefix}/pace/marathon`);
    await assertNoDocumentOverflow(page, `${viewport.name}/${locale}-training`);
    await saveScreenshot(page, `${viewport.name}-${locale}-training`);
    await page.locator('.pace-shortcuts a').click();
    await page.waitForURL(url => url.hash === '#pace-detail');
  } finally {
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
      await runFacilityTrainingFlow(browser, viewport, 'ja');
      await runFacilityTrainingFlow(browser, viewport, 'en');
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
