import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { createPdfCollector, extractPdf, pdfSourceConfigs } from './pdf';
import { digest } from './ai-runtime';
import { kohnodaiNovemberNovember18Hash, kohnodaiNovemberNovember17Hash, kohnodaiNovemberNovember19Hash, reviewedKohnodaiPdf } from './reviewed-kohnodai';
const config = pdfSourceConfigs.find(c => c.trackId === 'ichikawa-kohnodai-athletic-stadium')!;
const url = 'https://www.city.ichikawa.lg.jp/uploaded/attachment/61442.pdf';
const rawHtml = gunzipSync(await readFile(new URL('./fixtures/kohnodai-20261118.html.gz', import.meta.url)));
const pdf = await readFile(new URL('./fixtures/kohnodai-20261118.pdf', import.meta.url));
const fetchImpl = (async input => {
  if (String(input) === config.landingPageUrl) return new Response(rawHtml);
  if (String(input) === url) return new Response(pdf, { headers: { 'content-type': 'application/pdf' } });
  throw new Error(`Unexpected official source: ${input}`);
}) as typeof fetch;
// All 30 rows transcribed from 61442.pdf, not derived from the implementation.
const expected = [
  '09:00-17:00 X,17:00-21:00 A', '09:00-17:00 A',
  '09:00-17:00 X,17:00-21:00 A', '09:00-17:00 A',
  '09:00-21:00 A', '09:00-15:00 X,15:00-21:00 A',
  '09:00-17:00 X,17:00-21:00 A', '09:00-17:00 X,17:00-21:00 A',
  '09:00-17:00 A', '09:00-21:00 A', '09:00-21:00 A', '09:00-21:00 A', '09:00-21:00 A',
  '09:00-12:00 X,12:00-17:00 X,17:00-21:00 A',
  '09:00-21:00 A', '09:00-17:00 A',
  '09:00-17:00 X,17:00-21:00 A', '09:00-17:00 A',
  '09:00-21:00 A', '09:00-21:00 A',
  '09:00-12:00 X,12:00-21:00 A', '09:00-17:00 X,17:00-21:00 A',
  '09:00-17:00 X,17:00-21:00 A', '09:00-15:00 X,15:00-17:00 A',
  '09:00-15:00 X,15:00-21:00 A', '09:00-21:00 A', '09:00-21:00 A',
  '09:00-17:00 X,17:00-21:00 A', '09:00-17:00 X,17:00-21:00 A', 'null-null X',
];
describe('Kohnodai November original retrieved November 18', () => {
  it('discovers the new official link and verifies every date, time and closing note', async () => {
    expect(`sha256:${digest(pdf)}`).toBe(kohnodaiNovemberNovember18Hash);
    const extract = vi.fn(extractPdf);
    const collector = createPdfCollector(fetchImpl, extract);
    for (let day = 1; day <= 30; day++) {
      const date = `2026-11-${String(day).padStart(2, '0')}`;
      const result = await collector.collect(config, date, new Date('2026-11-18T01:49:00Z'));
      expect(result.periods.map(p => `${p.from}-${p.to} ${p.status === 'available' ? 'A' : 'X'}`).join(','), date).toBe(expected[day - 1]);
      expect(result.status, date).toBe(day === 30 ? 'unavailable' : expected[day - 1].includes('X') ? 'partially_available' : 'available');
      expect(result).toMatchObject({ sourceHash: kohnodaiNovemberNovember18Hash, pdfUrl: url, confidence: 'high' });
      expect(result.periods.every(p => p.scope === 'full_track' && p.eligibility === 'public')).toBe(true);
    }
    expect(extract).not.toHaveBeenCalled();
  });
  it('removes only the tournament and reserve bookings without changing the old original', () => {
    for (let day = 1; day <= 30; day++) {
      const date = `2026-11-${String(day).padStart(2, '0')}`;
      const old = reviewedKohnodaiPdf(kohnodaiNovemberNovember17Hash, date)!;
      const current = reviewedKohnodaiPdf(kohnodaiNovemberNovember18Hash, date)!;
      if (day !== 18 && day !== 19) expect(current, date).toEqual(old);
      else {
        const close = day === 18 ? '17:00' : '21:00';
        expect(old.periods).toMatchObject([
          { from: '09:00', to: '16:00', status: 'unavailable' },
          { from: '16:00', to: close, status: 'available' },
        ]);
        expect(current).toMatchObject({
          status: 'available', periods: [{ from: '09:00', to: close, status: 'available' }],
        });
      }
    }
  });
  it('discovers 61446 and extends only November 18 to 21:00 on the new original', async () => {
    const updatedUrl = 'https://www.city.ichikawa.lg.jp/uploaded/attachment/61446.pdf';
    const updatedHtml = gunzipSync(await readFile(new URL('./fixtures/kohnodai-20261119.html.gz', import.meta.url)));
    const updatedPdf = await readFile(new URL('./fixtures/kohnodai-20261119.pdf', import.meta.url));
    expect(`sha256:${digest(updatedPdf)}`).toBe(kohnodaiNovemberNovember19Hash);
    const extract = vi.fn(extractPdf);
    const collector = createPdfCollector((async input => {
      if (String(input) === config.landingPageUrl) return new Response(updatedHtml);
      if (String(input) === updatedUrl) return new Response(updatedPdf, { headers: { 'content-type': 'application/pdf' } });
      throw new Error(`Unexpected official source: ${input}`);
    }) as typeof fetch, extract);
    for (let day = 1; day <= 30; day++) {
      const date = `2026-11-${String(day).padStart(2, '0')}`;
      const previous = reviewedKohnodaiPdf(kohnodaiNovemberNovember18Hash, date)!;
      const result = await collector.collect(config, date, new Date('2026-11-19T01:32:00Z'));
      expect(result, date).toMatchObject({
        ...previous,
        periods: day === 18 ? [{ ...previous.periods[0], to: '21:00' }] : previous.periods,
        sourceHash: kohnodaiNovemberNovember19Hash,
        pdfUrl: updatedUrl,
      });
    }
    expect(extract).not.toHaveBeenCalled();
  });
  it('rejects unreviewed bytes, a missing official policy/year, and other months', async () => {
    const changed = createPdfCollector((async input => String(input) === config.landingPageUrl ? new Response(rawHtml)
      : new Response(Buffer.concat([pdf, Buffer.from('\n% changed\n')]), { headers: { 'content-type': 'application/pdf' } })) as typeof fetch);
    await expect(changed.collect(config, '2026-11-15', new Date())).rejects.toMatchObject({ reason: 'source_changed' });
    for (const hash of [kohnodaiNovemberNovember18Hash, kohnodaiNovemberNovember19Hash]) {
      for (const date of ['2026-10-31', '2026-12-01', '2027-11-15', '2026-11-31'])
        expect(reviewedKohnodaiPdf(hash, date)).toMatchObject({ status: 'unknown', unknownReason: 'outside_published_period', periods: [] });
    }
    for (const html of [rawHtml.toString().replace('更新日：2026年', '更新日：2025年'), rawHtml.toString().replace('「使用時間」以外を一般開放いたします', '')]) {
      const get = vi.fn(async () => new Response(html));
      await expect(createPdfCollector(get as typeof fetch).collect(config, '2026-11-15', new Date())).rejects.toMatchObject({ reason: 'schedule_not_published' });
      expect(get).toHaveBeenCalledTimes(1);
    }
  });
});
