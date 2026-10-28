import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createPdfCollector, pdfSourceConfigs } from './pdf';
import { nerimaGuideUrl, nerimaOctober27PdfHash, reviewedNerimaPdf } from './nerima-reviewed';
const config = pdfSourceConfigs.find(c => c.trackId === 'nerima-general-sports-park')!;
const currentUrl = 'https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/20261027souun_kaihoujoukyou2.pdf';
const fixture = (name: string) => readFile(new URL(`./fixtures/${name}`, import.meta.url));
const fetchImpl = async (input: string | URL | Request) => {
  const url = String(input);
  if (url === config.landingPageUrl) return new Response(await fixture('nerima-20261028.html'));
  if (url !== nerimaGuideUrl && url !== currentUrl) throw new Error(`Unexpected official source: ${url}`);
  return new Response(await fixture(url === nerimaGuideUrl ? 'nerima-opening-guide.pdf' : 'nerima-20261027.pdf'), { headers: { 'content-type': 'application/pdf' } });
};
// Independent transcription of all 21 cells from the original image + legend.
const reviewed = [
  ['2026-10-27', 'partially_available', ['available', 'available', 'available'], ['full_track', 'lane_subset', 'full_track']],
  ['2026-10-28', 'partially_available', ['available', 'available', 'unavailable'], ['lane_subset', 'lane_subset', 'full_track']],
  ['2026-10-29', 'partially_available', ['unavailable', 'available', 'unavailable'], ['full_track', 'lane_subset', 'full_track']],
  ['2026-10-30', 'unavailable', ['unavailable', 'unavailable', 'unavailable'], ['full_track', 'full_track', 'full_track']],
  ['2026-10-31', 'unavailable', ['unavailable', 'unavailable', 'unavailable'], ['full_track', 'full_track', 'full_track']],
  ['2026-11-01', 'unavailable', ['unavailable', 'unavailable', 'unavailable'], ['full_track', 'full_track', 'full_track']],
  ['2026-11-02', 'unavailable', ['unavailable', 'unavailable', 'unavailable'], ['full_track', 'full_track', 'full_track']],
] as const;
describe('Nerima reviewed October 27–November 2 official weekly image', () => {
  it('discovers the current link and preserves every date, time and restriction', async () => {
    const collector = createPdfCollector(fetchImpl as typeof fetch);
    for (const [date, status, statuses, scopes] of reviewed) {
      const result = await collector.collect(config, date, new Date('2026-10-28T01:45:00Z'));
      expect(result).toMatchObject({ pdfUrl: currentUrl, sourceHash: nerimaOctober27PdfHash, publishedAt: '2026-10-27', status, unknownReason: undefined });
      expect(result.periods.map(p => [p.from, p.to])).toEqual([['09:00', '12:00'], ['12:00', '15:00'], ['15:00', '17:00']]);
      expect(result.periods.map(p => p.status)).toEqual(statuses);
      expect(result.periods.map(p => p.scope)).toEqual(scopes);
      expect(result.periods.every(p => p.eligibility === 'public')).toBe(true);
      for (let i = 0; i < 3; i++) {
        const conditions = result.periods[i].conditions.join();
        if (statuses[i] === 'unavailable') expect(conditions).toContain('団体貸切');
        else if (i === 1) {
          expect(conditions).toContain('緑レーンのみ');
          expect(conditions).toContain('陸上競技の練習・幅跳びレーンは利用不可');
        } else if (date === '2026-10-28') expect(conditions).toContain('半面のみ');
        else expect(conditions).toContain('ボール類の使用不可');
      }
      expect(result.warnings.join()).not.toContain('18時');
    }
    for (const date of ['2026-10-26', '2026-11-03', '2027-10-28']) expect(await collector.collect(config, date, new Date())).toMatchObject({ status: 'unknown', periods: [], unknownReason: 'outside_published_period' });
  });
  it('rejects an unreviewed image or legend instead of inheriting the reviewed week', async () => {
    for (const changedUrl of [currentUrl, nerimaGuideUrl]) {
      const collector = createPdfCollector((async input => {
        const response = await fetchImpl(input);
        if (String(input) !== changedUrl) return response;
        return new Response(Buffer.concat([Buffer.from(await response.arrayBuffer()), Buffer.from('\n% changed\n')]), { headers: { 'content-type': 'application/pdf' } });
      }) as typeof fetch);
      await expect(collector.collect(config, '2026-10-28', new Date())).rejects.toMatchObject({ reason: 'source_changed' });
    }
    expect(reviewedNerimaPdf('sha256:unreviewed', '2026-10-28')).toBeNull();
  });
});
