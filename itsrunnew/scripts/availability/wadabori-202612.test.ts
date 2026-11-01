import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createPdfCollector, pdfSourceConfigs } from './pdf';
import { reviewedWadaboriPdf } from './reviewed-wadabori';

const raw = async (name: string) => readFile(new URL(`./fixtures/${name}`, import.meta.url));
const index = gunzipSync(await raw('wadabori-20261101.html.gz'));
const article = gunzipSync(await raw('wadabori-article-20261101.html.gz'));
const originals = [await raw('wadabori-202612-1.pdf'), await raw('wadabori-202612-2.pdf')];
const hashes = ['sha256:156a991789278e4c4037f290ea955c842027ad24657ff567e53f33b5d808dfd3', 'sha256:106d9f078347467eb07af8863d4f3d1517e9fcedef323567a05e0878a8de9cb1'];
const official = (change = false) => (async (input: string | URL | Request) => {
  const url = String(input);
  if (url.endsWith('/news/index.html')) return new Response(index);
  if (url.endsWith('/news/2026/wada_sch_11_12.html')) return new Response(article);
  const decoded = decodeURIComponent(url);
  if (!decoded.endsWith('12月分_1.pdf')) throw new Error('Unexpected source');
  const b = originals[decoded.includes('第一') ? 0 : 1];
  return new Response(change ? Buffer.concat([b, Buffer.from('\n% changed')]) : b, { headers: { 'content-type': 'application/pdf' } });
}) as typeof fetch;
// Independent transcription from both complete A3 originals, morning/afternoon.
const first = 'AA AA AU UA UU AA AA AA AA AU UA UU UU AA AA AA AU UA AA UU AA AA AA AU UA UU UU AA UU UU UU'.split(' ');
const second = 'AA AA AA AA UU AA UU AA AA AA AA UU UU UU AA AA AA AA AA UU UU AA AA AA AA UU UU UU UU UU UU'.split(' ');

describe('Wadabori reviewed December A3 originals', () => {
  it.each([0, 1])('discovers correct December PDF and preserves every slot/legend for facility %s', async n => {
    const config = pdfSourceConfigs.find(c => c.trackId === (n === 0 ? 'wadabori-park-first-track' : 'wadabori-park-seibiyama-track'))!;
    const collector = createPdfCollector(official());
    const expected = n === 0 ? first : second;
    expect(expected).toHaveLength(31);
    for (let day = 1; day <= 31; day++) {
      const date = `2026-12-${String(day).padStart(2, '0')}`;
      const r = await collector.collect(config, date, new Date('2026-11-01T01:35:00Z'));
      expect(decodeURIComponent(r.pdfUrl)).toContain('12月分_1.pdf');
      expect(r.sourceHash).toBe(hashes[n]);
      expect(r.publishedAt).toBe('2026-10-25');
      expect(r.periods.map(p => p.status === 'available' ? 'A' : 'U').join(''), date).toBe(expected[day - 1]);
      expect(r.periods.map(p => [p.from, p.to])).toEqual([['09:00', '12:00'], ['13:00', '17:00']]);
      expect(r.status).toBe(expected[day - 1] === 'AA' ? 'available' : expected[day - 1] === 'UU' ? 'unavailable' : 'partially_available');
      if (day >= 29) expect(r.warnings.join()).toContain('年末年始休み');
      if (n === 1 && expected[day - 1] === 'AA' && ![2, 6, 9, 16, 19, 23].includes(day)) expect(r.periods.every(p => p.conditions.includes('トラックのみ利用可能。フィールドは対象外。'))).toBe(true);
      if (n === 1 && [12, 13, 27].includes(day)) expect(r.warnings.join()).toContain('12:00〜13:00も含め利用不可');
    }
  });
  it('stops changed PDFs and never applies another facility/month/year review', async () => {
    for (const n of [0, 1]) {
      const config = pdfSourceConfigs.find(c => c.trackId === (n === 0 ? 'wadabori-park-first-track' : 'wadabori-park-seibiyama-track'))!;
      await expect(createPdfCollector(official(true)).collect(config, '2026-12-01', new Date())).rejects.toMatchObject({ reason: 'source_changed' });
      for (const date of ['2026-11-01', '2027-01-01', '2027-12-01']) expect(reviewedWadaboriPdf(hashes[n], date, n === 0 ? 'first' : 'second')).toBeNull();
      expect(reviewedWadaboriPdf(hashes[n], '2026-12-01', n === 0 ? 'second' : 'first')).toBeNull();
    }
  });
});
