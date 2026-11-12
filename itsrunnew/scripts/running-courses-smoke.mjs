import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';

const courses = JSON.parse(await readFile(new URL('../src/data/running-courses.json', import.meta.url), 'utf8'));
const tracks = JSON.parse(await readFile(new URL('../src/data/tracks.json', import.meta.url), 'utf8'));

export async function checkRunningCourses(page, base, date) {
  const output = '/tmp/itsrun-running-courses';
  await mkdir(output, { recursive: true });
  const endpoint='**/availability/running-courses.json';
  let statusMode='mixed';
  const snapshot=()=>{
    const now=new Date(),stamp=now.toISOString(),expiresAt=new Date(+now+8*86400000).toISOString();
    return {schemaVersion:1,timezone:'Asia/Tokyo',fixture:true,generatedAt:stamp,expiresAt:statusMode==='expired'?new Date(+now-1).toISOString():expiresAt,nextCheckAt:new Date(+now+7*86400000).toISOString(),configHash:'0'.repeat(64),generation:'0'.repeat(24),courses:courses.map(course=>({courseId:course.id,checkedAt:stamp,attemptedAt:stamp,expiresAt,normalUse:!course.id.includes('tokorozawa'),unknownReason:course.id.includes('tokorozawa')?'notice_review_required':null,evidence:[{url:course.urls.official,hash:'0'.repeat(64)}],pending:[],restrictions:course.id.includes('komazawa')||course.id.includes('misato')?[{from:date,to:null,status:course.id.includes('komazawa')?'unavailable':'partially_available',reason:{ja:course.id.includes('komazawa')?'コース工事で全面閉鎖':'日没〜日の出は立入不可',en:course.id.includes('komazawa')?'Entire course closed for construction':'No entry from sunset to sunrise'},sourceUrl:course.urls.official,reopenConfirmed:false}]:[]}))};
  };
  await page.route(endpoint,route=>statusMode==='failed'?route.fulfill({status:503,body:'Unavailable'}):route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(snapshot())}));
  const wako = courses.find(course => course.id === 'wako-jurin-jogging');
  const oizumi = tracks.find(track => track.id.includes('oizumi'));
  for (const language of ['ja', 'en']) {
    const prefix = language === 'en' ? '/en' : '';
    await page.goto(`${base}${prefix}/?kind=course&date=${date}&lat=35.77740&lng=139.59868`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(count => document.querySelectorAll('.facility-row').length === count, courses.length-1);
    assert.equal(await page.locator('[data-place-id="komazawa-jogging"]').count(),0,'Explicitly closed courses are hidden by default');
    await page.locator('.track-controls input[type="checkbox"]').check();
    await page.waitForFunction(count => document.querySelectorAll('.facility-row').length === count, courses.length);
    assert.equal(await page.locator('.date-controls').count(), 1);
    assert.equal(await page.getByLabel(language === 'en' ? 'Lap distance' : '一周の距離', { exact:true }).count(),0,'Lap distance filtering was removed');
    assert.equal(await page.locator('.course-badge--unavailable').count(),1);
    assert.equal(await page.locator('.course-badge--partially_available').count(),1);
    assert.equal(await page.locator('.course-badge--unknown').count(),1);
    assert.equal(await page.locator('.facility-row .availability-badge').count(), 0);
    assert.equal(await page.locator('.facility-row .course-badge').count(), courses.length);
    assert.equal(await page.locator('.facility-row').first().getAttribute('data-place-id'), wako.id);
    const kind = page.getByLabel(language === 'en' ? 'Place type' : '場所の種類', { exact: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const overlaps = await page.locator('.facility-row').evaluateAll(rows => rows.flatMap(row => {
      const elements = ['.course-badge', '.facility-main', '.facility-distance', '.map-action'].map(selector => ({ selector, rect: row.querySelector(selector)?.getBoundingClientRect() })).filter(item => item.rect);
      return elements.flatMap((a, index) => elements.slice(index + 1).filter(b => Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > 1 && Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > 1).map(b => `${row.dataset.placeId}: ${a.selector} overlaps ${b.selector}`));
    }));
    assert.deepEqual(overlaps, [], 'Course badges, names, distances and map actions must not overlap');
    await page.screenshot({ path: `${output}/${language}-${page.viewportSize().width}-search.png`, fullPage: true });
    const row = page.locator(`[data-place-id="${wako.id}"]`);
    assert.match(await row.innerText(), language === 'en' ? /No speed running/ : /スピード走/);
    await row.locator('button').click();
    await page.locator('.detail-card .course-facts').waitFor();
    await page.locator('.detail-card .course-status--available').waitFor();
    assert.equal(await page.locator('.detail-card .today-availability').count(), 0);
    await page.locator(`#track-map button[data-track-id="${wako.id}"] .track-marker--course`).waitFor();
    const detailLink = page.locator('.detail-card a').filter({ hasText: language === 'en' ? 'Course page' : 'コース詳細' });
    assert.equal(await detailLink.getAttribute('href'), `${prefix}/courses/${wako.id}`);
    await detailLink.click();
    await page.waitForURL(url => url.pathname === `${prefix}/courses/${wako.id}` && url.searchParams.get('date') === date && url.searchParams.get('lat') === '35.77740');
    await page.getByRole('heading', { name: wako.name[language], exact: true }).waitFor();
    await page.locator('.course-status--available').waitFor();
    assert.match(await page.locator('.course-facts').innerText(), /800 \/ 1,000 m/);
    assert.equal(await page.locator('.facility-schedule, .availability-result, .field-reports').count(), 0);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://itsrun.info${prefix}/courses/${wako.id}`);
    const metadata = await page.locator('#track-structured-data').textContent();
    assert.equal(JSON.parse(metadata).url, `https://itsrun.info${prefix}/courses/${wako.id}`);
    const mapLink = page.getByRole('link', { name: language === 'en' ? 'Official course map' : '公式のコース図' });
    assert.equal(await mapLink.getAttribute('href'), wako.urls.map);
    assert.equal(await mapLink.getAttribute('target'), '_blank');
    assert.ok(await page.getByRole('link', { name: language === 'en' ? 'Directions to park' : '公園への経路' }).getAttribute('href'));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `${output}/${language}-${page.viewportSize().width}-course.png`, fullPage: true });
    // Native language switching must retain the course route and date/origin context.
    await page.locator('.language-button').click();
    await page.waitForURL(url => url.pathname === `${language === 'en' ? '' : '/en'}/courses/${wako.id}` && url.searchParams.get('date') === date);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.course-facts').waitFor();

    // Existing track pages expose local loops separately from the five schedule-ranked tracks.
    await page.goto(`${base}${prefix}/tracks/${oizumi.id}?date=${date}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-nearby-courses]').waitFor({ state: 'attached' });
    const related = page.locator('.related-section');
    if (!(await related.evaluate(element => element.open))) await related.locator('summary').click();
    const localLoop = page.locator(`[data-nearby-courses] a[href="${prefix}/courses/${wako.id}"]`);
    await localLoop.click();
    await page.waitForURL(url => url.pathname === `${prefix}/courses/${wako.id}` && url.searchParams.get('date') === date);
    await page.locator('.breadcrumbs a').click();
    await page.waitForURL(url => url.pathname === `${prefix}/` && url.searchParams.get('kind') === 'course' && url.searchParams.get('date') === date);
    await kind.selectOption('track');
    await page.locator('.date-controls').waitFor();
    assert.equal(await page.locator('.facility-row .course-badge').count(),0);
  }
  await page.goto(`${base}/courses/misato-park-jogging?date=${date}`);
  await page.locator('.course-status--partially_available').waitFor();
  assert.match(await page.locator('.course-status').innerText(),/日没〜日の出は立入不可/);
  for(const mode of ['expired','failed']){
    statusMode=mode;
    await page.goto(`${base}/courses/${wako.id}?date=${date}`);
    await page.locator('.course-status--unknown').waitFor();
    assert.equal(await page.locator('.course-status--available').count(),0,`${mode} must not show availability`);
  }
  await page.unroute(endpoint);
}
