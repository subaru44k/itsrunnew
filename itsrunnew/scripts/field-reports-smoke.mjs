import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const base = process.env.ITSRUN_BASE_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
const tomorrow = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date(Date.now()+86400000));
const trackId = 'yoyogi-park-athletic-track';
await mkdir('/tmp/itsrun-reports-check',{recursive:true});
try {
  for (const locale of ['ja','en']) for (const width of [390,1440]) {
    const context = await browser.newContext({viewport:{width,height:900}});
    const errors=[]; const posts=[]; let reports=[]; let failure=0; let getFails=false;
    // Also verify restricted-storage browsers can submit without accounts.
    if (width===390) await context.addInitScript(()=>{for(const key of ['getItem','setItem']) Object.defineProperty(Storage.prototype,key,{value(){throw new DOMException('Denied','SecurityError');}});});
    await context.route('**/*', async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.pathname==='/reports') {
        if(request.method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST'}});
        const headers={'access-control-allow-origin':'*','content-type':'application/json'};
        if(request.method()==='POST') {
          const body=request.postDataJSON();posts.push(body);
          if(failure) return route.fulfill({status:failure,headers,body:JSON.stringify({error:failure===429?'rate_limited':'unavailable'})});
          const report={...body,id:'mock-report',createdAt:new Date().toISOString()}; reports=[report];
          return route.fulfill({status:201,headers,body:JSON.stringify({report})});
        }
        return route.fulfill({status:getFails?503:200,headers,body:JSON.stringify(getFails?{error:'unavailable'}:{reports:reports.filter(r=>r.date===url.searchParams.get('date')),count:reports.length})});
      }
      if(url.origin!==new URL(base).origin) return route.abort();
      return route.continue();
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${base}/${locale==='en'?'en/':''}tracks/${trackId}?date=${today}`);
    const section=page.locator('.field-reports');await section.scrollIntoViewIfNeeded();
    await section.locator('.field-reports-empty').waitFor();
    assert.equal(await section.locator('input[type=radio]').count(),3);
    assert(await section.locator('button[type=submit]').isDisabled());
    await section.locator('input[value=partial]').check();
    await section.locator('textarea').fill('1〜2レーン閉鎖');
    failure=429;await section.locator('button[type=submit]').click();
    await section.locator('.field-reports-feedback--error').waitFor();
    assert.equal(await section.locator('textarea').inputValue(),'1〜2レーン閉鎖');
    failure=503;await section.locator('button[type=submit]').click();
    await page.waitForFunction(()=>!document.querySelector('.field-report-form button[type=submit]').disabled);
    assert.equal(await section.locator('textarea').inputValue(),'1〜2レーン閉鎖');
    failure=0;await section.locator('button[type=submit]').click();
    await section.locator('.field-reports-feedback--success').waitFor();
    await section.locator('.field-report-item').waitFor();
    assert.equal(await section.locator('.field-report-comment').textContent(),'1〜2レーン閉鎖');
    assert.equal(posts.length,3); assert.equal(posts[2].date,today);assert.equal(posts[2].trackId,trackId);
    assert.match(posts[2].clientId,/^[a-f0-9-]{36}$/);assert.equal(posts[2].clientId,posts[0].clientId);
    assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),`https://itsrun.info/${locale==='en'?'en/':''}tracks/${trackId}`);
    assert.equal(await page.locator('.availability-panel .official-information-label').count(),1);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    await section.evaluate(element=>window.scrollTo(0,window.scrollY+element.getBoundingClientRect().top-80));
    await page.screenshot({path:`/tmp/itsrun-reports-check/${locale}-${width}.png`});
    await page.locator('.date-actions input[type=date]').fill(tomorrow);
    await page.locator('.date-actions input[type=date]').dispatchEvent('change');
    await section.locator('.field-reports-browse-only').waitFor();assert.equal(await section.locator('form').count(),0);
    await section.locator('.field-reports-browse-only button').click();
    await section.locator('form').waitFor();
    // A failed list fetch must not look like zero reports.
    getFails=true;await page.reload();await section.locator('.field-reports-error').waitFor();
    assert.equal(await section.locator('.field-reports-empty').count(),0);
    getFails=false;await section.locator('.field-reports-error button').click();await section.locator('.field-report-item').waitFor();
    // User text stays text even if a legacy/untrusted API item contains markup.
    reports[0].comment='<img src=x onerror=alert(1)>';
    await page.reload();await section.locator('.field-report-item').waitFor();
    assert.equal(await section.locator('.field-report-comment img').count(),0);
    assert.match(await section.locator('.field-report-comment').textContent(),/<img/);
    if(locale==='ja' && width===390) {
      await page.clock.install({time:new Date(`${today}T14:59:30Z`)});
      await page.reload();await section.locator('form').waitFor();
      await section.locator('input[value=available]').check();
      await page.clock.runFor(61_000);
      await section.locator('.field-reports-browse-only').waitFor();
      assert.equal(await section.locator('form').count(),0);
      assert.equal(posts.length,3);
    }
    assert.deepEqual(errors,[]);
    await context.close();console.log(`PASS field reports ${locale} ${width}px: save, errors, storage, dates, canonical, text safety`);
  }
} finally {await browser.close();}
