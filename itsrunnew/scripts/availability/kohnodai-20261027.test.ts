import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { createPdfCollector, extractPdf, parseIchikawaKohnodaiPdf, pdfSourceConfigs } from './pdf';
import { digest } from './ai-runtime';
import { kohnodaiOctober26Hash, kohnodaiOctoberHash, reviewedKohnodaiPdf } from './reviewed-kohnodai';

const config = pdfSourceConfigs.find(c => c.trackId === 'ichikawa-kohnodai-athletic-stadium')!;
const pdfUrl = 'https://www.city.ichikawa.lg.jp/uploaded/attachment/60360.pdf';
const landing = '更新日：2026年10月26日 「使用時間」以外を一般開放いたします<a href="/uploaded/attachment/60360.pdf">10月使用予定表</a>';
// Independently transcribed from every row of the October 26 original.
// A = public; X = booked. Day 26 explicitly closes without operating hours.
const expected = [
  '09:00-14:00 A,14:00-16:00 X,16:00-21:00 A',
  '09:00-15:00 X,15:00-21:00 A',
  '09:00-12:00 X,12:00-17:00 X,17:00-21:00 A',
  '09:00-17:00 X,17:00-21:00 A',
  '09:00-16:00 X,16:00-17:00 A',
  '09:00-21:00 A', '09:00-21:00 A', '09:00-21:00 A',
  '09:00-16:00 X,16:00-21:00 A',
  '09:00-12:00 X,12:00-17:00 X,17:00-21:00 A',
  '09:00-17:00 X,17:00-21:00 A',
  '09:00-14:00 X,14:00-17:00 X,17:00-21:00 A',
  '09:00-17:00 A', '09:00-21:00 A', '09:00-21:00 A', '09:00-21:00 A',
  '09:00-19:00 X,19:00-21:00 A',
  '09:00-17:00 X,17:00-21:00 A',
  '09:00-17:00 A',
  '09:00-15:00 X,15:00-21:00 A',
  '09:00-16:00 X,16:00-21:00 A',
  '09:00-21:00 A',
  '09:00-13:00 X,13:00-21:00 A',
  '09:00-17:00 X,17:00-21:00 A',
  '09:00-13:00 X,13:00-21:00 A',
  'null-null X',
  '09:00-21:00 A', '09:00-21:00 A', '09:00-21:00 A',
  '09:00-17:00 X,17:00-21:00 A',
  '09:00-17:00 X,17:00-21:00 A',
];

describe('Kohnodai October 26 revision', () => {
  it('reproduces shifted text rows and uses the exact reviewed original for all 31 days', async () => {
    const raw = new Uint8Array(await readFile(new URL('./fixtures/kohnodai-20261026.pdf', import.meta.url)));
    expect(`sha256:${digest(raw)}`).toBe(kohnodaiOctober26Hash);
    const extracted = await extractPdf(raw.slice());
    expect(() => parseIchikawaKohnodaiPdf(extracted, '2026-10-28')).toThrow('Operating hours');
    // The old text parser also omitted the first booking on multi-event rows.
    expect(parseIchikawaKohnodaiPdf(extracted, '2026-10-03').periods[0].status).toBe('available');
    const extract = vi.fn(extractPdf);
    const collector = createPdfCollector((async input => String(input) === config.landingPageUrl
      ? new Response(landing) : new Response(raw, { headers: { 'content-type': 'application/pdf' } })) as typeof fetch, extract);
    for (let day = 1; day <= 31; day++) {
      const result = await collector.collect(config, `2026-10-${String(day).padStart(2, '0')}`, new Date());
      expect(result.periods.map(p => `${p.from}-${p.to} ${p.status === 'available' ? 'A' : 'X'}`).join(','), `day ${day}`).toBe(expected[day - 1]);
      expect(result.status).toBe(day === 26 ? 'unavailable' : expected[day - 1].includes('X') ? 'partially_available' : 'available');
      expect(result).toMatchObject({ sourceHash: kohnodaiOctober26Hash, pdfUrl, parserVersion: '1.2.0' });
    }
    expect(extract).not.toHaveBeenCalled();
  });

  it('keeps source, year, month, facility and landing policy guards', async () => {
    expect(reviewedKohnodaiPdf('sha256:changed', '2026-10-28')).toBeNull();
    for (const date of ['2026-11-01', '2027-10-28'])
      expect(reviewedKohnodaiPdf(kohnodaiOctober26Hash, date)).toMatchObject({ status: 'unknown', periods: [], unknownReason: 'outside_published_period' });
    expect(reviewedKohnodaiPdf(kohnodaiOctoberHash, '2026-10-27')!.periods[0]).toMatchObject({ from: '09:00', to: '13:00', status: 'unavailable' });
    expect(reviewedKohnodaiPdf(kohnodaiOctober26Hash, '2026-10-27')!.status).toBe('available');
    for (const html of [landing.replace('2026年', '2025年'), landing.replace('「使用時間」以外を一般開放いたします', '')]) {
      const fetchImpl = vi.fn(async () => new Response(html));
      await expect(createPdfCollector(fetchImpl as typeof fetch).collect(config, '2026-10-28', new Date())).rejects.toMatchObject({ reason: 'schedule_not_published' });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
    const other = pdfSourceConfigs.find(c => c.trackId === 'nerima-general-sports-park')!;
    const raw = new Uint8Array(await readFile(new URL('./fixtures/kohnodai-20261026.pdf', import.meta.url)));
    const wrongFacility = createPdfCollector((async input => String(input) === other.landingPageUrl
      ? new Response(`<a href="${pdfUrl}">陸上競技場の開放状況（直近1週間分）</a>`)
      : new Response(raw, { headers: { 'content-type': 'application/pdf' } })) as typeof fetch);
    await expect(wrongFacility.collect(other, '2026-10-28', new Date())).rejects.toMatchObject({ reason: 'source_changed' });
  });
});
