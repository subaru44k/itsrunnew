import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { createPdfCollector, extractPdf, pdfSourceConfigs } from './pdf';
import { digest } from './ai-runtime';
import { kohnodaiDecemberHash, reviewedKohnodaiPdf } from './reviewed-kohnodai';
const config = pdfSourceConfigs.find(c => c.trackId === 'ichikawa-kohnodai-athletic-stadium')!;
const url = 'https://www.city.ichikawa.lg.jp/uploaded/attachment/60729.pdf';
const rawHtml = gunzipSync(await readFile(new URL('./fixtures/kohnodai-20261102.html.gz', import.meta.url)));
const pdf = await readFile(new URL('./fixtures/kohnodai-202612.pdf', import.meta.url));
const fetchImpl = (async input => {
  if (String(input) === config.landingPageUrl) return new Response(rawHtml);
  if (String(input) === url) return new Response(pdf, { headers: { 'content-type': 'application/pdf' } });
  throw new Error(`Unexpected official source: ${input}`);
}) as typeof fetch;
// All 31 rows transcribed from 60729.pdf, not derived from the implementation.
const expected = [
 '09:00-21:00 A', '09:00-21:00 A', '09:00-21:00 A', '09:00-21:00 A',
 '09:00-12:00 X,12:00-17:00 X,17:00-21:00 A', '09:00-17:00 X,17:00-21:00 A',
 '09:00-17:00 A', '09:00-21:00 A', '09:00-21:00 A', '09:00-21:00 A', '09:00-21:00 A',
 '09:00-13:00 X,13:00-14:00 A,14:00-17:00 X,17:00-21:00 A', '09:00-17:00 X,17:00-21:00 A',
 '09:00-17:00 A', '09:00-21:00 A', '09:00-21:00 A', '09:00-21:00 A', '09:00-21:00 A',
 '09:00-12:00 X,12:00-17:00 X,17:00-21:00 A', '09:00-17:00 X,17:00-21:00 A', 'null-null X',
 '09:00-21:00 A', '09:00-21:00 A', '09:00-21:00 A', '09:00-21:00 A',
 '09:00-17:00 X,17:00-21:00 A', '09:00-13:00 X,13:00-17:00 X,17:00-21:00 A',
 'null-null X', 'null-null X', 'null-null X', 'null-null X',
];
describe('Kohnodai December original retrieved November 2', () => {
  it('discovers the new official link and verifies every date, time and closing note', async () => {
    
    expect(`sha256:${digest(pdf)}`).toBe(kohnodaiDecemberHash);
    const extract = vi.fn(extractPdf);
    const collector = createPdfCollector(fetchImpl, extract);
    for (let day = 1; day <= 31; day++) {
      const date = `2026-12-${String(day).padStart(2, '0')}`;
      const result = await collector.collect(config, date, new Date('2026-11-02T01:00:00Z'));
      expect(result.periods.map(p => `${p.from}-${p.to} ${p.status === 'available' ? 'A' : 'X'}`).join(','), date).toBe(expected[day - 1]);
      expect(result.status, date).toBe([21, 28, 29, 30, 31].includes(day) ? 'unavailable' : expected[day - 1].includes('X') ? 'partially_available' : 'available');
      expect(result).toMatchObject({ sourceHash: kohnodaiDecemberHash, pdfUrl: url, confidence: 'high' });
      expect(result.periods.every(p => p.scope === 'full_track' && p.eligibility === 'public')).toBe(true);
    }
    expect(extract).not.toHaveBeenCalled();
  });
  it('rejects unreviewed bytes, a missing official policy/year, and other months', async () => {
    const changed = createPdfCollector((async input => String(input) === config.landingPageUrl ? new Response(rawHtml)
      : new Response(Buffer.concat([pdf, Buffer.from('\n% changed\n')]), { headers: { 'content-type': 'application/pdf' } })) as typeof fetch);
    await expect(changed.collect(config, '2026-12-12', new Date())).rejects.toMatchObject({ reason: 'source_changed' });
    for (const date of ['2026-11-30', '2027-01-01', '2027-12-12', '2026-12-32'])
      expect(reviewedKohnodaiPdf(kohnodaiDecemberHash, date)).toMatchObject({ status: 'unknown', unknownReason: 'outside_published_period', periods: [] });
    for (const html of [rawHtml.toString().replace('更新日：2026年', '更新日：2025年'), rawHtml.toString().replace('「使用時間」以外を一般開放いたします', '')]) {
      const get = vi.fn(async () => new Response(html));
      await expect(createPdfCollector(get as typeof fetch).collect(config, '2026-12-12', new Date())).rejects.toMatchObject({ reason: 'schedule_not_published' });
      expect(get).toHaveBeenCalledTimes(1);
    }
  });
});
