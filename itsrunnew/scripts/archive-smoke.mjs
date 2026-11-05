// Archive behavior is independent of availability collection.
export async function verifyArchives(page, baseUrl) {
    await page.goto(`${baseUrl}/nozomiantena/index`, { waitUntil: 'domcontentloaded' });
    await page.getByText('4:06.14', { exact: true }).waitFor();
    await page.getByText('32:41.54', { exact: true }).waitFor();
    await page.getByRole('link', { name: '2020', exact: true }).first().click();
    await page.waitForFunction(() => {
      const target = document.getElementById('2020');
      const top = target?.getBoundingClientRect().top ?? -1;
      return location.hash === '#2020' && top >= 48 && top <= 80;
    });

    await page.goto(`${baseUrl}/ryuji-miura/index`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '三浦龍司選手の記録集', exact: true }).waitFor();
    await page.getByRole('link', { name: '2020', exact: true }).first().click();
    await page.waitForFunction(() => {
      const target = document.getElementById('2020');
      const top = target?.getBoundingClientRect().top ?? -1;
      return location.hash === '#2020' && top >= 48 && top <= 80;
    });

    for (const [slug, name, firstYear] of [
      ['ojiro-honda', '本田桜二郎', '2022'],
      ['yota-mashiko', '増子陽太', '2022'],
      ['haruki-niizuma', '新妻遼己', '2021'],
    ]) {
      await page.goto(`${baseUrl}/${slug}/index`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: `${name}選手の記録集`, exact: true }).waitFor();
      if ((await page.locator('link[rel="canonical"]').getAttribute('href')) !== `https://itsrun.info/${slug}/index`) throw new Error(`${slug}: incorrect canonical`);
      await page.getByRole('link', { name: firstYear, exact: true }).click();
      await page.waitForFunction(year => {
        const top = document.getElementById(year)?.getBoundingClientRect().top ?? -1;
        const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
        return location.hash === `#${year}` && top >= 48 && (top <= 140 || (atBottom && top < window.innerHeight / 2));
      }, firstYear);
      await page.getByLabel('年度', { exact: true }).selectOption(firstYear);
      if (await page.locator('.year-section').count() !== 1) throw new Error(`${slug}: year filter failed`);
      await page.getByLabel('年度', { exact: true }).selectOption('all');
      await page.getByLabel('大会名・種目', { exact: true }).fill('5000m');
      await page.waitForFunction(() => [...document.querySelectorAll('tbody tr')].length > 0 && [...document.querySelectorAll('tbody tr')].every(row => row.children[2].textContent.includes('5000m')));
      await page.getByLabel('大会名・種目', { exact: true }).fill('no-matching-race');
      await page.getByText('条件に合う記録がありません。', { exact: true }).waitFor();
      await page.getByLabel('大会名・種目', { exact: true }).fill('');
      await page.getByLabel('種類', { exact: true }).selectOption('ekiden');
      if (!await page.locator('tbody tr[data-ekiden="true"]').count() || await page.locator('tbody tr:not([data-ekiden="true"])').count()) throw new Error(`${slug}: ekiden filter failed`);
      const ekidenExpectations = {
        'ojiro-honda': ['駅伝 1区（9.5km）', '27:47', '区間2位'],
        'yota-mashiko': ['駅伝 2区（11.1km）', '30:51', '区間1位（同順位）'],
        'haruki-niizuma': ['駅伝 3区（11.9km）', '32:45', '区間1位'],
      };
      const [stage, mark, rank] = ekidenExpectations[slug];
      const latestEkiden = page.locator('tbody tr').filter({ hasText: '第58回全日本大学駅伝対校選手権大会' });
      await latestEkiden.getByText(stage, { exact: true }).waitFor();
      await latestEkiden.getByText(rank, { exact: true }).waitFor();
      if (!(await latestEkiden.locator('.mark').innerText()).startsWith(mark)) throw new Error(`${slug}: wrong stage time`);
      if (slug === 'yota-mashiko') {
        await page.getByLabel('年度', { exact: true }).selectOption('2025');
        await page.getByLabel('大会名・種目', { exact: true }).fill('伊那');
        await page.getByText('区間75位', { exact: true }).waitFor();
        await page.getByLabel('年度', { exact: true }).selectOption('all');
        await page.getByLabel('大会名・種目', { exact: true }).fill('');
      }
      await page.getByLabel('種類', { exact: true }).selectOption('local');
      const regionalChecks = {
        'ojiro-honda': ['福岡県南部ブロック', '4:26.38'],
        'yota-mashiko': ['第71回福島県高等学校体育大会陸上競技大会', '14:13.88'],
        'haruki-niizuma': ['第78回兵庫県高等学校陸上競技対校選手権大会', '3:49.45'],
      };
      const [regionalQuery, regionalMark] = regionalChecks[slug];
      await page.getByLabel('大会名・種目', { exact: true }).fill(regionalQuery);
      await page.locator('tbody .mark').filter({ hasText: regionalMark }).waitFor();
      await page.getByLabel('大会名・種目', { exact: true }).fill('');
      await page.getByLabel('種類', { exact: true }).selectOption('road');
      if (!await page.locator('tbody tr').count()) throw new Error(`${slug}: road filter empty`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (overflow > 1) throw new Error(`${slug}: page overflow ${overflow}`);
      await page.locator('.language-button').click();
      await page.waitForURL(url => url.pathname === `/en/${slug}/index`);
      await page.getByRole('heading', { name: `${name}選手の記録集`, exact: true }).waitFor();
    }

}
