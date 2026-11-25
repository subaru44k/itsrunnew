import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { collectAdditionalAvailability } from './additional';
import { aiFacilities, buildAiPacket } from './ai-sources';
import { reviewedSetagayaReading } from './reviewed-setagaya';

const config = aiFacilities.find(facility => facility.key === 'setagaya')!;
describe.each([
  { article: '23438', date: '2026-11-22', nextDate: '2026-11-23' },
  { article: '23447', date: '2026-11-24', nextDate: '2026-11-25' },
  { article: '23492', date: '2026-11-25', nextDate: '2026-11-26' },
])('reviewed Setagaya notice for $date', ({ article, date, nextDate }) => {
  const noticeUrl = `https://www.se-sports.or.jp/news/${article}/`;
  const now = new Date(`${date}T01:30:00Z`);
  const fixture = (name: string) =>
    gunzipSync(readFileSync(new URL(`./fixtures/setagaya-${date.replaceAll('-', '')}-${name}.html.gz`, import.meta.url))).toString();
  const notice = fixture('notice');
  const front = fixture('facility');

  function official(article = notice): typeof fetch {
    return async (input) => {
      switch (String(input)) {
        case config.landing: return new Response(front);
        case noticeUrl: return new Response(article);
        case 'https://www.se-sports.or.jp/facilityinfo/sougou-athletics-stadium/':
        case 'https://www.se-sports.or.jp/news/10334/':
          return new Response('<main>総合運動場陸上競技場の個人利用条件。対象の公式利用案内です。</main>');
        default: return new Response(null, {status: 404});
      }
    };
  }

  it('publishes the explicitly excluded track as unavailable only on its official date without an API call', async () => {
    const apiFetchImpl = vi.fn<typeof fetch>();
    const records = (await collectAdditionalAvailability([date, nextDate], {
      now, fetchImpl: official(), apiFetchImpl, apiKey: '',
    })).filter(record => record.trackId === config.trackId);
    expect(records).toMatchObject([
      {date, status: 'unavailable', unknownReason: null, periods: [], source: {url: noticeUrl}},
      {date: nextDate, status: 'unknown', unknownReason: 'outside_published_period', periods: []},
    ]);
    expect(records[0].warnings.join()).toMatch(/陸上競技場.*個人利用.*できません/);
    expect(apiFetchImpl).not.toHaveBeenCalled();
  });

  it('does not reuse the reviewed decision after a notice edit or for another date', async () => {
    const edited = await buildAiPacket(config, [date], now, official(notice.replace('上記以外の室場および時間帯は個人利用はできません。', '陸上競技場は個人利用できます。')));
    expect(reviewedSetagayaReading(edited)).toBeNull();
    const current = await buildAiPacket(config, [date], now, official());
    expect(reviewedSetagayaReading({...current, dates: [nextDate]})).toBeNull();
  });
});
