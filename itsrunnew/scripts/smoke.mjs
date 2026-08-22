import { chromium } from 'playwright-core';

const baseUrl = process.env.ITSRUN_BASE_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath, headless: true });
const requests = [];

try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    page.on('request', request => requests.push(request.url()));

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.getByText('織田フィールド 開放日', { exact: true }).waitFor();
    const noDataIcons = await page.locator('img[alt="no data"]:visible').count();
    if (noDataIcons !== 21) throw new Error(`Expected 21 no-data cells, found ${noDataIcons}`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) throw new Error(`Horizontal overflow at ${viewport.width}px: ${overflow}px`);

    await page.goto(`${baseUrl}/en/pace/marathon`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Lap Time for the Marathon', { exact: true }).waitFor();

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

    await page.goto(`${baseUrl}/manage`, { waitUntil: 'domcontentloaded' });
    await page.getByText('織田フィールド 開放日', { exact: true }).waitFor();
    await page.close();
  }

  if (requests.some(url => /firebase|firestore|googleapis\.com\/identitytoolkit/i.test(url))) {
    throw new Error('A Firebase request was detected');
  }
  console.log('Smoke test passed for desktop/mobile, public routes, /manage removal, and Firebase isolation.');
} finally {
  await browser.close();
}
