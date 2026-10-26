import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Real gtag.js runs, but every collection request is intercepted before transmission.
const baseUrl = process.env.ITSRUN_BASE_URL ?? 'https://itsrun.info';
const enabled = process.env.ITSRUN_EXPECT_ANALYTICS !== 'false';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
try {
  for (const choice of ['granted', 'denied']) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const hits = [];
    const tags = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (/\/(?:g\/)?collect(?:\/|$)/.test(url.pathname)) {
        hits.push({ url: url.href, body: route.request().postData() ?? '' });
        await route.abort();
      } else if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtag/js') {
        tags.push(url.href);
        await route.continue();
      } else if (/googlesyndication|doubleclick|googleadservices|fundingchoices/.test(url.hostname)) {
        await route.abort();
      } else if (process.env.ITSRUN_ASSET_URL && url.origin === new URL(baseUrl).origin) {
        const response = await route.fetch({ url: `${process.env.ITSRUN_ASSET_URL}${url.pathname}${url.search}` });
        await route.fulfill({ response });
      } else {
        await route.continue();
      }
    });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    assert.equal(tags.length, 0, 'no tag before consent');
    assert.equal(hits.length, 0, 'no collection before consent');
    await page.getByRole('button', { name: choice === 'granted' ? '解析に同意する' : '同意しない', exact: true }).click();
    const pageViews = () => hits.flatMap(hit => {
      const query = new URL(hit.url).searchParams;
      return (hit.body ? hit.body.split('\n') : ['']).map(line => {
        const params = new URLSearchParams(query);
        for (const [key, value] of new URLSearchParams(line)) params.set(key, value);
        return params;
      });
    }).filter(params => params.get('en') === 'page_view' && params.get('tid') === 'G-YNLS7KQXYW');
    if (choice === 'granted' && enabled) {
      await page.waitForFunction(() => document.querySelector('script[data-itsrun-analytics]'));
      await page.waitForTimeout(8000);
      assert(pageViews().some(params => params.get('dl') === 'https://itsrun.info/'), 'consent generates canonical page_view');
      const count = pageViews().length;
      await page.locator('a[href="/privacy"]').last().click();
      await page.waitForURL('**/privacy');
      await page.waitForTimeout(8000);
      assert(pageViews().length > count, 'SPA navigation generates page_view');
      assert(pageViews().some(params => params.get('dl') === 'https://itsrun.info/privacy'));
      const beforeReload = pageViews().length;
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(8000);
      assert(pageViews().length > beforeReload, 'saved consent generates page_view on revisit');
      console.log(JSON.stringify({ baseUrl, choice, tags: tags.length, interceptedPageViews: pageViews().map(params => ({ tid: params.get('tid'), en: params.get('en'), dl: params.get('dl') })) }));
    } else {
      await page.waitForTimeout(3000);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      assert.equal(tags.length, 0, 'no tag for denied consent or nonproduction runtime');
      assert.equal(hits.length, 0, 'no collection for denied consent or nonproduction runtime');
      console.log(JSON.stringify({ baseUrl, choice, tags: 0, collectionRequests: 0 }));
    }
    await context.close();
  }
} finally {
  await browser.close();
}
