// Exercise facility quality differences without relying on a live source's state.
export async function verifyFacilitySchedules(page, baseUrl, tracks) {
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const dates = Array.from({ length: 31 }, (_, index) => {
    const date = new Date(`${today}T12:00:00+09:00`);
    date.setUTCDate(date.getUTCDate() + index);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  });
  let generatedAt = new Date().toISOString();
  let refreshDelay = false;
  let manifestDelay = 180;
  let dateRequests = 0;
  const ids = ['tokyo-metropolitan-gymnasium-track', 'toda-sports-center-track', 'johoku-chuo-park-track'];
  // Choose existing tracks independently of unstable source status.
  const examples = ids.map((id, index) => tracks.find(track => track.id === id) ?? tracks[index]);
  let scenario = 'complete';
  const handler = async route => {
    const path = new URL(route.request().url()).pathname;
    if (refreshDelay) await new Promise(resolve => setTimeout(resolve, path.endsWith('manifest.json') ? manifestDelay : 80));
    if (path.endsWith('manifest.json')) return route.fulfill({ json: { schemaVersion: 1, timezone: 'Asia/Tokyo', generatedAt, startDate: today, endDate: dates.at(-1), dates } });
    dateRequests++;
    const date = path.split('/').at(-1).replace('.json', '');
    const day = dates.indexOf(date);
    if (scenario === 'failed') return route.fulfill({ status: 503, body: 'Unavailable' });
    // Only the three subjects need mocked records; the normal smoke covers the full dataset.
    const facilities = examples.map(track => {
      let status = 'available';
      let reason = null;
      if (scenario === 'partial' && ![0, 2, 20].includes(day)) { status = 'unknown'; reason = 'outside_published_period'; }
      if (scenario === 'phone') { status = 'unknown'; reason = 'phone_confirmation_required'; }
      if (scenario === 'complete' && day === 1) status = 'unavailable';
      return {
        trackId: track.id, date, timezone: 'Asia/Tokyo', status, unknownReason: reason,
        periods: status === 'available' ? Array.from({ length: 14 }, (_, hour) => ({ from: `${String(hour + 9).padStart(2, '0')}:00`, to: `${String(hour + 10).padStart(2, '0')}:00`, status: 'available', scope: 'lane_subset', eligibility: 'local_resident_worker_student', conditions: ['official_general_opening', 'Test condition'] })) : [],
        source: { url: track.urls.official, landingPageUrl: null, type: 'official', publicationFormat: 'html', publishedAt: null, documentId: null },
        freshness: { fetchedAt: scenario === 'phone' ? null : generatedAt, parsedAt: generatedAt, checkedAt: generatedAt, validForDate: date, expiresAt: `${date}T23:59:59+09:00` },
        evidence: { collector: scenario === 'phone' ? 'manual-confirmation' : 'TEST-ONLY', parserVersion: '1', sourceHash: null, confidence: 'high' }, warnings: ['空欄時間はunknown', '公式の日付指定一般開放表', '受付は終了30分前まで'],
      };
    });
    if (scenario === 'stale') for (const item of facilities) item.freshness.expiresAt = '2000-01-01T00:00:00Z';
    return route.fulfill({ json: { schemaVersion: 1, date, timezone: 'Asia/Tokyo', generatedAt, facilities } });
  };
  await page.route('**/availability/*.json', handler);
  for (const locale of ['', '/en']) {
    for (const [state, example] of [['complete', examples[0]], ['partial', examples[1]], ['phone', examples[2]], ['stale', examples[0]], ['failed', examples[0]]]) {
      scenario = state;
      await page.goto(`${baseUrl}${locale}/tracks/${example.id}`, { waitUntil: 'domcontentloaded' });
      const mode = state === 'complete' ? 'schedule' : state === 'partial' ? 'partial' : 'confirmation';
      await page.locator(`.facility-schedule[data-schedule-mode="${mode}"]`).waitFor();
      console.log(`Facility schedule ${locale || 'ja'} ${state}: ${mode}`);
      const rows = page.locator('.schedule-list li');
      const expected = state === 'complete' ? 14 : state === 'partial' ? 3 : 0;
      if (await rows.count() !== expected) throw new Error(`${locale} ${state}: expected ${expected} known rows`);
      if (await page.locator('.availability-result').count()) throw new Error('Date details are duplicated in the initial view');
      await page.waitForFunction(expected => document.querySelector('.related-section').open === expected, !['complete', 'partial'].includes(state));
      if (state === 'complete') {
        const listHeight = await page.locator('.schedule-list').evaluate(element => element.getBoundingClientRect().height);
        if (listHeight > (page.viewportSize().width <= 600 ? 510 : 350)) throw new Error(`Schedule is too tall: ${listHeight}px`);
        if ((await page.locator('.schedule-list').innerText()).includes('Test condition')) throw new Error('Detailed conditions leaked into decision cards');
        if (!(await page.locator('.date-picker input').isVisible())) throw new Error('Date input is hidden');
        if (await page.locator('.date-picker').getByRole('button').count()) throw new Error('Redundant today/tomorrow controls survived');
        await rows.nth(1).getByRole('button').click();
        await page.waitForURL(url => url.searchParams.get('date') === dates[1]);
        await page.locator('.availability-panel.availability--unavailable').waitFor();
        await page.waitForFunction(() => document.activeElement === document.querySelector('#selected-day-details summary'));
        const detailTop = await page.locator('#selected-day-details').evaluate(element => element.getBoundingClientRect().top);
        if (detailTop < 60 || detailTop > 150) throw new Error(`Detail lost scroll position: ${detailTop}`);
        if (await page.locator('.related-date').getAttribute('datetime') !== dates[1]) throw new Error('Alternatives lost their date context');
        if (!(await page.locator('.related-section').evaluate(element => element.open))) throw new Error('Unavailable date did not open alternatives');
        if (!(await page.locator('.related-section').getAttribute('class')).includes('related-section--urgent')) throw new Error('Unavailable date did not emphasize alternatives');
        await rows.nth(2).getByRole('button').click();
        await page.waitForURL(url => url.searchParams.get('date') === dates[2]);
        await page.locator('.availability-result').getByText(/Test condition/).waitFor();
        if (await page.locator('.availability-result li').count() !== 1) throw new Error('Adjacent equivalent hourly slots did not merge');
        if ((await page.locator('.availability-result').innerText()).includes('official_general_opening')) throw new Error('Internal evidence leaked into the UI');
        const guidance = await page.locator('.availability-result').innerText();
        if (/空欄時間|unknown|公式の日付指定一般開放表/.test(guidance)) throw new Error('Collector explanation leaked into visitor guidance');
        if (!guidance.includes('受付は終了30分前まで')) throw new Error('Admission restriction was hidden');
        if (await page.locator('.related-section').evaluate(element => element.open)) throw new Error('Available date did not collapse alternatives');
        // Native selection is accessible while details are collapsed, including
        // dates outside the initial fourteen decision cards.
        await page.locator('.date-panel summary').click();
        await page.locator('.date-picker input').fill(dates[20]);
        await page.locator('.date-picker input').dispatchEvent('change');
        await page.waitForURL(url => url.searchParams.get('date') === dates[20]);
        await page.waitForFunction(() => document.activeElement === document.querySelector('#selected-day-details summary'));
        if (await rows.count() !== 14) throw new Error('Date selection unnecessarily expanded all days');
        // Expire the cache without spending a minute. A same-generation refresh
        // must keep the range; a changed generation must settle before focus.
        await page.evaluate(() => {
          const original = Date.now;
          window.__itsrunClockOffset = 0;
          Date.now = () => original() + window.__itsrunClockOffset;
          window.__itsrunScheduleDisappeared = false;
          new MutationObserver(() => {
            if (!document.querySelector('.schedule-list')) window.__itsrunScheduleDisappeared = true;
          }).observe(document.querySelector('.facility-schedule'), { subtree: true, childList: true });
        });
        for (const changed of [false, true]) {
          refreshDelay = true;
          if (changed) generatedAt = new Date(Date.parse(generatedAt) + 1000).toISOString();
          await page.evaluate(() => { window.__itsrunClockOffset += 61000; });
          const beforeRequests = dateRequests;
          await rows.nth(changed ? 4 : 3).getByRole('button').click();
          await page.waitForURL(url => url.searchParams.get('date') === dates[changed ? 4 : 3]);
          await page.waitForFunction(() => document.activeElement === document.querySelector('#selected-day-details summary'));
          await page.locator('.facility-schedule[data-schedule-mode="schedule"]').waitFor();
          const finalTop = await page.locator('#selected-day-details').evaluate(element => element.getBoundingClientRect().top);
          if (finalTop < 60 || finalTop > 150) throw new Error(`Refresh lost detail scroll position: ${finalTop}`);
          if (await page.evaluate(() => window.__itsrunScheduleDisappeared)) throw new Error('Manifest refresh cleared the schedule');
          if (!changed && dateRequests - beforeRequests > 2) throw new Error('Unchanged manifest reloaded the full range');
          refreshDelay = false;
        }
        refreshDelay = true;
        await page.evaluate(() => { window.__itsrunClockOffset += 61000; });
        await rows.nth(6).getByRole('button').click();
        await rows.nth(5).getByRole('button').click();
        await page.waitForURL(url => url.searchParams.get('date') === dates[5]);
        await page.waitForFunction(() => document.activeElement === document.querySelector('#selected-day-details summary'));
        if (await page.locator('.date-picker input').inputValue() !== dates[5]) throw new Error('Earlier selection overrode the latest date');
        refreshDelay = false;
        await page.locator('.date-panel summary').click();
        await page.locator('.expand-schedule').click();
        if (await rows.count() !== 31) throw new Error('Full confirmed range did not expand');
        // Leave for another facility while an earlier date action is pending.
        // Reusing TrackDetail must not let the earlier action steal its focus.
        refreshDelay = true;
        manifestDelay = 800;
        await page.evaluate(() => { window.__itsrunClockOffset += 61000; });
        await page.locator('.related-section summary').click();
        await rows.nth(7).getByRole('button').click();
        await page.waitForURL(url => url.searchParams.get('date') === dates[7]);
        await page.locator('.related-section[data-availability-loaded="true"]').waitFor();
        const nextFacility = page.locator('.related-section .alternative-link').first();
        const nextPath = await nextFacility.getAttribute('href');
        await nextFacility.click();
        await page.waitForURL(url => url.pathname === nextPath);
        await page.locator('.facility-schedule[data-schedule-mode="schedule"]').waitFor();
        await page.waitForTimeout(100);
        if (await page.evaluate(() => scrollY > 50)) throw new Error('Previous facility action stole the new facility scroll position');
        refreshDelay = false;
        manifestDelay = 180;
      }
      if (state === 'partial') {
        if (await page.locator('.schedule-list .schedule-status').filter({ hasText: locale ? 'Confirm' : '要確認' }).count()) throw new Error('Unknown day leaked into the schedule');
        if (!(await page.locator('.date-picker input').isVisible())) throw new Error('Date input requires expanding details');
        await page.locator('.date-picker input').fill(dates[1]);
        await page.locator('.date-picker input').dispatchEvent('change');
        await page.locator('.availability-panel.availability--unknown').waitFor();
        await page.waitForFunction(() => document.querySelector('.related-section').open);
        if (!(await page.locator('.related-intro').innerText()).includes(locale ? 'not unavailable' : '利用不可ではありません')) throw new Error('Unknown alternatives lost their uncertainty context');
        if ((await page.locator('.related-section').getAttribute('class')).includes('related-section--urgent')) throw new Error('Unknown day was emphasized as closed');
      }
      if (state === 'phone') {
        await page.locator('.facility-schedule').getByText(locale ? /by phone/ : /電話で確認/).waitFor();
        await page.locator('.facility-schedule').getByText(locale ? /Facility information checked/ : /施設情報の確認日/).waitFor();
        if ((await page.locator('.facility-schedule').innerText()).includes(locale ? 'Source fetched' : '最終取得')) throw new Error('Phone-only data fabricated a source fetch');
      }
      if (state === 'stale') await page.locator('.facility-schedule').getByText(locale ? /out of date/ : /有効期限が切れ/).waitFor();
      if (state === 'failed' && (await page.locator('.facility-schedule').innerText()).includes(locale ? 'Source fetched' : '最終取得')) throw new Error('Failed request fabricated a check timestamp');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (overflow > 1) throw new Error(`${state}: horizontal overflow ${overflow}px`);
      if (!locale && ['complete', 'partial', 'phone'].includes(state)) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `/tmp/itsrun-facility-${page.viewportSize().width}-ja-${state}.png`, animations: 'disabled' });
      }
    }
  }
  await page.unroute('**/availability/*.json', handler);
}
