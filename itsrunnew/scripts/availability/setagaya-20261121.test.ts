import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, it, vi } from 'vitest';
import { aiFacilities, buildAiPacket } from './ai-sources';

const config = aiFacilities.find(facility => facility.key === 'setagaya')!;
const listingUrl = 'https://www.se-sports.or.jp/news/?category=facility&childCat=facility-sougou#news';
const noticeUrl = 'https://www.se-sports.or.jp/news/23433/';
const fixture = (name: string) => gunzipSync(readFileSync(new URL(`./fixtures/setagaya-20261121-${name}.html.gz`, import.meta.url))).toString();
const landing = fixture('after-0800');
const listing = fixture('facility-news');
const notice = fixture('notice');
const now = new Date('2026-11-20T23:05:00Z');

function official({ front = landing, news = listing, article = notice } = {}) {
  return vi.fn(async (input: string | URL | Request) => {
    switch (String(input)) {
      case config.landing: return new Response(front);
      case listingUrl: return new Response(news);
      case noticeUrl: return new Response(article);
      case 'https://www.se-sports.or.jp/facilityinfo/sougou-athletics-stadium/':
      case 'https://www.se-sports.or.jp/news/10334/':
        return new Response('<main>総合運動場陸上競技場の個人利用条件。対象の公式利用案内です。</main>');
      default: return new Response(null, {status: 404});
    }
  });
}
const requested = ['2026-11-21','2026-11-22','2026-12-21'];

it('discovers the real notice from the linked facility news when pinned entries fill the front page', async () => {
  const fetchImpl = official();
  const packet = await buildAiPacket(config, requested, now, fetchImpl);
  const calls = fetchImpl.mock.calls.map(([url]) => url);
  expect(calls.slice(0,3)).toEqual([config.landing, listingUrl, noticeUrl]);
  expect(packet.dates).toEqual(['2026-11-21']);
  const current = packet.sources.find(source => source.url === noticeUrl)!;
  expect(current.content).toContain('17：00～19：00、19：00～21：00');
  expect(packet.sources.some(source => source.url === listingUrl)).toBe(false);
});

it('uses an eligible full-width date on the front page without fetching the news list', async () => {
  const fetchImpl = official({ front: `<main><a href="${noticeUrl}">総合運動場　本日の個人開放のお知らせ（１１月２１日）</a></main>` });
  const packet = await buildAiPacket(config, requested, now, fetchImpl);
  expect(packet.sources[0].url).toBe(noticeUrl);
  expect(fetchImpl.mock.calls.some(([url]) => url === listingUrl)).toBe(false);
});

it('does not reuse a past or ambiguous notice or a same-month/day link from an earlier year', async () => {
  const past = official();
  await expect(buildAiPacket(config, ['2026-11-22'], new Date('2026-11-21T23:05:00Z'), past)).rejects.toThrow('not found or ambiguous');
  expect(past.mock.calls.some(([url]) => url === noticeUrl)).toBe(false);

  const duplicate = official({ news: listing.replace('</body>', '<a href="/news/23434/">総合運動場 本日の個人開放のお知らせ（11月21日）</a></body>') });
  await expect(buildAiPacket(config, requested, now, duplicate)).rejects.toThrow('not found or ambiguous');
  expect(duplicate.mock.calls.some(([url]) => url === noticeUrl)).toBe(false);

  const wrongYear = official({ article: notice.replaceAll('2026/11/21', '2025/11/21') });
  await expect(buildAiPacket(config, requested, now, wrongYear)).rejects.toThrow('date mismatch');
});
