import { describe, expect, it, vi } from 'vitest';
import { aiFacilities, buildAiPacket, fullMonths } from './ai-sources';

describe('AI source dates', () => {
  it('uses whole calendar months for stable cache inputs across year and leap-day boundaries', () => {
    expect(fullMonths(['2026-12-31', '2027-01-01'])).toHaveLength(62);
    expect(fullMonths(['2028-02-28']).at(-1)).toBe('2028-02-29');
    expect(fullMonths(['2026-09-22', '2026-10-22'])).toEqual(fullMonths(['2026-09-23', '2026-10-23']));
  });
  it('discovers Chita next-year January as well as December, excluding older schedules', async () => {
    const fetchImpl = vi.fn(async (url: unknown) => new Response(String(url).endsWith('/info/105/')
      ? '<main>一般開放のご案内<a href="/dec.pdf">2026年12月の一般開放</a><a href="/jan.pdf">2027年1月の一般開放</a><a href="/old.pdf">2025年12月の一般開放</a><a href="/old-jan.pdf">2026年1月の一般開放</a></main>'
      : '公式資料の内容。掲載された対象日と時間の開放のみ。'));
    const packet = await buildAiPacket(aiFacilities.find(c => c.key === 'chita')!, ['2026-12-31', '2027-01-01'], new Date('2026-12-31T00:00:00Z'), fetchImpl as typeof fetch);
    expect(packet.sources.map(s => new URL(s.url).pathname)).toEqual(['/info/105/', '/dec.pdf', '/jan.pdf']);
  });
  it('includes Ishin October hozyoriku alongside September hojyoriku in the AI source packet', async () => {
    const notice = 'https://www.ishin100.com/main/info_mirasta_kojin_20260928/';
    const september = 'https://www.ishin100.com/main/wp-content/uploads/info_hojyoriku_202609_20260907.png';
    const october = 'https://www.ishin100.com/main/wp-content/uploads/info_hozyoriku_202610_20260928.png';
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const fetchImpl = vi.fn(async (url: unknown) => {
      if (String(url) === notice) return new Response(`<main>補助陸上競技場利用予定。大会行事等の専用利用がない場合は個人利用可能です。前日にお問い合わせください。<a href="${september}"><img src="${september}"></a><img src="${october}"><img src="/main/wp-content/uploads/info_hozyoriku_202608_20260801.png"><img src="/main/wp-content/uploads/main_stadium_202610.png"></main>`);
      if (String(url).endsWith('/main/')) return new Response(`<main><a href="${notice}">補助陸上競技場利用予定について</a></main>`);
      return new Response(png);
    });
    const packet = await buildAiPacket(aiFacilities.find(c => c.key === 'ishin')!, ['2026-09-29', '2026-10-29'], new Date('2026-09-29T02:34:19Z'), fetchImpl as typeof fetch);
    expect(packet.sources.map(s => s.url)).toEqual([notice, september, october]);
    expect(packet.sources.filter(s => s.kind === 'image')).toHaveLength(2);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual(['https://www.ishin100.com/main/', notice, september, october]);
  });
  it('includes the updated Ishin class calendar but excludes other months and main stadiums', async () => {
    const root = 'https://www.ishin100.com/main/';
    const notice = `${root}info_mirasta_kojin_20261005/`;
    const october = `${root}wp-content/uploads/info_hojyoriku_class_202610_230261013_1.png`;
    const november = `${root}wp-content/uploads/info_hojyoriku_202611_20261005.png`;
    const fetchImpl = vi.fn(async (url: unknown) => {
      if (String(url) === root) return new Response(`<a href="${notice}">補助陸上競技場利用予定について</a>`);
      if (String(url) === notice) return new Response(`<main>大会行事等の専用利用がない場合は個人利用可能です。前日にお問い合わせください。<a href="${october}"><img src="${october}"></a><img src="${november}"><img src="${root}wp-content/uploads/info_hojyoriku_class_202609_20261013.png"><img src="${root}wp-content/uploads/info_main_202610.png"></main>`);
      return new Response(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]));
    });
    const packet = await buildAiPacket(aiFacilities.find(c => c.key === 'ishin')!, ['2026-10-15', '2026-11-14'], new Date('2026-10-15T05:00:00Z'), fetchImpl as typeof fetch);
    expect(packet.sources.map(s => s.url)).toEqual([notice, october, november]);
    expect(fetchImpl.mock.calls).toHaveLength(4);
  });
  it.each([false, true])('finds Hiroshima personal-use notices on the homepage or linked index (index=%s)', async (useIndex) => {
    const root = 'https://www.sports-or.city.hiroshima.jp/facilities/kouiki';
    const notice = `${root}/info/october-opening`;
    const index = `${root}/info`;
    const octoberLink = `<li><time datetime="2016-00-00">2026年09月23日</time><a href="${notice}">10月補助競技場個人利用可能日のお知らせ</a></li>`;
    const image = 'https://www.sports-or.city.hiroshima.jp/application/files/1817/9014/4139/2.png';
    const fetchImpl = vi.fn(async (url: unknown) => {
      if (String(url) === root) return new Response(`<main><a href="${index}">新着情報一覧へ</a>${useIndex ? '' : octoberLink}</main>`);
      if (String(url) === index) return new Response(`<main>${octoberLink}${octoberLink}<a href="${root}/info/august">８月補助競技場個人利用可能日のお知らせ</a></main>`);
      if (String(url) === notice) return new Response(`<section class="contents editor"><h3><img src="${image}"></h3><h4>個人利用の日程は、インスタグラムにも掲載中です。</h4><img src="/application/files/irrelevant.png"></section>`);
      if (String(url) === image) return new Response(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]));
      return new Response('<main>補助競技場の個人利用方法と開場時間を掲載します。</main>');
    });
    const packet = await buildAiPacket(aiFacilities.find(c => c.key === 'hiroshima')!, ['2026-10-15', '2026-11-14'], new Date('2026-10-15T05:00:00Z'), fetchImpl as typeof fetch);
    expect(packet.sources.map(s => s.url)).toEqual([`${root}/use/senyo-2`, notice, image, useIndex ? index : root]);
    const publication = packet.sources.at(-1)!;
    expect(publication.name).toBe('hiroshima-notice-publication.txt');
    expect(publication.content).toContain('2026年09月23日');
    expect(publication.content).not.toContain('2016');
    expect(publication.content).not.toContain('８月');
    expect(fetchImpl.mock.calls.some(([url]) => String(url) === index)).toBe(useIndex);
    expect(fetchImpl.mock.calls.filter(([url]) => String(url) === notice)).toHaveLength(1);
  });
  it('fails safely when the Hiroshima index has no matching current-month notice', async () => {
    const root = 'https://www.sports-or.city.hiroshima.jp/facilities/kouiki';
    const fetchImpl = vi.fn(async (url: unknown) => new Response(String(url) === root
      ? `<a href="${root}/info">新着情報一覧へ</a>`
      : '<main>９月補助競技場個人利用可能日のお知らせのみ掲載。</main>'));
    await expect(buildAiPacket(aiFacilities.find(c => c.key === 'hiroshima')!, ['2026-10-15'], new Date(), fetchImpl as typeof fetch)).rejects.toThrow('Auxiliary personal-use notice not found');
  });

});
