import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const oldBaseUrl = process.env.ITSRUN_OLD_URL ?? 'http://127.0.0.1:4172';
const newBaseUrl = process.env.ITSRUN_NEW_URL ?? 'http://127.0.0.1:4173';
const outputDirectory = process.env.ITSRUN_VISUAL_OUTPUT ?? '/tmp/itsrun-visual-comparison';
const executablePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const adPattern = /googlesyndication|doubleclick|googletagmanager|google-analytics|googleadservices/i;
const targets = [
  { name: 'oda-field', path: '/oda-field', readyText: '織田フィールド 開放日' },
  { name: 'yumenoshima', path: '/yumenoshima', readyText: '夢の島陸上競技場 開放日' },
  { name: 'komazawa', path: '/komazawa', readyText: '駒沢オリンピック公園陸上競技場 開放日' },
  { name: 'todoroki', path: '/todoroki', readyText: '等々力陸上競技場 開放日' },
  { name: 'marathon', path: '/pace/marathon', readyText: 'マラソンのラップタイム' },
  { name: 'records', path: '/nozomiantena/index', readyText: '田中希実選手の記録集' },
];
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const measurements = [];
const runtimeErrors = [];

try {
  for (const version of [
    { name: 'old', baseUrl: oldBaseUrl },
    { name: 'new', baseUrl: newBaseUrl },
  ]) {
    for (const viewport of viewports) {
      for (const target of targets) {
        const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
        page.on('pageerror', error => {
          if (!adPattern.test(error.message)) runtimeErrors.push(`${version.name}/${target.name}/${viewport.name}: ${error.message}`);
        });
        await page.route('**/*', route => adPattern.test(route.request().url()) ? route.abort() : route.continue());
        await page.goto(`${version.baseUrl}${target.path}`, { waitUntil: 'domcontentloaded' });
        await page.getByText(target.readyText, { exact: true }).waitFor();
        await page.addStyleTag({ content: `
          .adsbygoogle, iframe[id^="google_ads"], [id^="google_ads"] {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        ` });
        await page.waitForTimeout(250);

        const layout = await page.evaluate(() => {
          const rect = selector => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const bounds = element.getBoundingClientRect();
            return {
              top: Math.round(bounds.top + window.scrollY),
              left: Math.round(bounds.left),
              width: Math.round(bounds.width),
              height: Math.round(bounds.height),
              display: getComputedStyle(element).display,
            };
          };
          const footer = document.querySelector('footer, .v-footer');
          return {
            documentHeight: document.documentElement.scrollHeight,
            horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
            header: rect('header, .v-toolbar'),
            main: rect('main, .v-content'),
            footer: rect('footer, .v-footer'),
            footerText: footer?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          };
        });
        measurements.push({ version: version.name, viewport: viewport.name, page: target.name, ...layout });
        await page.screenshot({
          path: `${outputDirectory}/${version.name}-${target.name}-${viewport.name}.png`,
          fullPage: true,
          animations: 'disabled',
        });
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(measurements, null, 2));

for (const measurement of measurements) {
  if (!measurement.footer || !measurement.footerText.includes('2019')) {
    throw new Error(`Footer missing from ${measurement.version}/${measurement.page}/${measurement.viewport}`);
  }
  if (measurement.horizontalOverflow > 1) {
    throw new Error(`Horizontal overflow in ${measurement.version}/${measurement.page}/${measurement.viewport}: ${measurement.horizontalOverflow}px`);
  }

  if (measurement.version === 'new') {
    const baseline = measurements.find(candidate =>
      candidate.version === 'old' &&
      candidate.page === measurement.page &&
      candidate.viewport === measurement.viewport
    );
    if (!baseline) throw new Error(`Baseline missing for ${measurement.page}/${measurement.viewport}`);
    if (Math.abs(measurement.documentHeight - baseline.documentHeight) > 100) {
      throw new Error(`Full-page height drift in ${measurement.page}/${measurement.viewport}: old=${baseline.documentHeight}px new=${measurement.documentHeight}px`);
    }
    if (Math.abs(measurement.footer.height - baseline.footer.height) > 1) {
      throw new Error(`Footer height drift in ${measurement.page}/${measurement.viewport}: old=${baseline.footer.height}px new=${measurement.footer.height}px`);
    }
  }
}

if (runtimeErrors.length > 0) {
  throw new Error(`Runtime errors detected:\n${runtimeErrors.join('\n')}`);
}
