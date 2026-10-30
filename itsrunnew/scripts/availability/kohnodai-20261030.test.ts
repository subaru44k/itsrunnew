import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { createPdfCollector, extractPdf, parseIchikawaKohnodaiPdf, pdfSourceConfigs } from './pdf';
import { digest } from './ai-runtime';
import { kohnodaiOctober30Hash, kohnodaiNovemberReviewedHash, reviewedKohnodaiPdf } from './reviewed-kohnodai';
const config = pdfSourceConfigs.find(c => c.trackId === 'ichikawa-kohnodai-athletic-stadium')!;
const base = 'https://www.city.ichikawa.lg.jp';
const fixture = async (name: string) => {
  const bytes = await readFile(new URL(`./fixtures/${name}`, import.meta.url));
  return name.endsWith('.gz') ? gunzipSync(bytes) : bytes;
};
// Independent transcription of all 61 rows, including both bookings on split rows.
// A = public under the landing policy; X = booked or explicit closure.
const octoberExpected = [
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
  '09:00-16:00 X,16:00-21:00 A',
  '09:00-17:00 X,17:00-21:00 A',
];
const novemberExpected = [
  '09:00-17:00 X,17:00-21:00 A', '09:00-17:00 A',
  '09:00-17:00 X,17:00-21:00 A', '09:00-17:00 A',
  '09:00-16:00 X,16:00-21:00 A', '09:00-16:00 X,16:00-21:00 A',
  '09:00-17:00 X,17:00-21:00 A', '09:00-17:00 X,17:00-21:00 A',
  '09:00-17:00 A', '09:00-21:00 A', '09:00-21:00 A', '09:00-21:00 A', '09:00-21:00 A',
  '09:00-12:00 X,12:00-17:00 X,17:00-21:00 A',
  '09:00-17:00 X,17:00-21:00 A', '09:00-17:00 A',
  '09:00-17:00 X,17:00-21:00 A', '09:00-16:00 X,16:00-17:00 A',
  '09:00-16:00 X,16:00-21:00 A', '09:00-17:00 X,17:00-21:00 A',
  '09:00-12:00 X,12:00-21:00 A', '09:00-17:00 X,17:00-21:00 A',
  '09:00-17:00 X,17:00-21:00 A', '09:00-15:00 X,15:00-17:00 A',
  '09:00-15:00 X,15:00-21:00 A', '09:00-21:00 A', '09:00-21:00 A',
  '09:00-17:00 X,17:00-21:00 A', '09:00-17:00 X,17:00-21:00 A', 'null-null X',
];
const packets = [
  ['2026-10', 'kohnodai-20261030-october.pdf', '/uploaded/attachment/60693.pdf', kohnodaiOctober30Hash, octoberExpected, 26],
  ['2026-11', 'kohnodai-20261030-november.pdf', '/uploaded/attachment/60681.pdf', kohnodaiNovemberReviewedHash, novemberExpected, 30],
] as const;
const fetchImpl = (async input => {
  const url = String(input);
  if (url === config.landingPageUrl) return new Response(await fixture('kohnodai-20261030.html.gz'));
  const packet = packets.find(p => base + p[2] === url);
  if (!packet) throw new Error(`Unexpected official source: ${url}`);
  return new Response(await fixture(packet[1]), { headers: { 'content-type': 'application/pdf' } });
}) as typeof fetch;
describe('Kohnodai current October and November originals on October 30', () => {
  it('reproduces the October row failure and checks the November split row', async () => {
    const october = await extractPdf(new Uint8Array(await fixture(packets[0][1])));
    expect(() => parseIchikawaKohnodaiPdf(october, '2026-10-30')).toThrow('Operating hours');
    const november = await extractPdf(new Uint8Array(await fixture(packets[1][1])));
    // A regression must preserve the first booking, which prior layouts lost.
    expect(november.text).toContain('市民スポーツ教室');
    expect(reviewedKohnodaiPdf(kohnodaiNovemberReviewedHash, '2026-11-14')!.periods[0]).toMatchObject({ from: '09:00', to: '12:00', status: 'unavailable' });
  });
  it('discovers both real links and matches all 61 days without the unstable text parser', async () => {
    const extract = vi.fn(extractPdf);
    const collector = createPdfCollector(fetchImpl, extract);
    for (const [month, name, url, hash, expected, closed] of packets) {
      expect(`sha256:${digest(await fixture(name))}`).toBe(hash);
      for (let day = 1; day <= expected.length; day++) {
        const date = `${month}-${String(day).padStart(2, '0')}`;
        const result = await collector.collect(config, date, new Date());
        expect(result.periods.map(p => `${p.from}-${p.to} ${p.status === 'available' ? 'A' : 'X'}`).join(','), date).toBe(expected[day - 1]);
        expect(result.status, date).toBe(day === closed ? 'unavailable' : expected[day - 1].includes('X') ? 'partially_available' : 'available');
        expect(result).toMatchObject({ sourceHash: hash, pdfUrl: base + url, confidence: 'high' });
        expect(result.periods.every(p => p.scope === 'full_track' && p.eligibility === 'public')).toBe(true);
      }
    }
    expect(extract).not.toHaveBeenCalled();
  });
  it('keeps exact source/month/year and official opening policy boundaries', async () => {
    expect(reviewedKohnodaiPdf('sha256:changed', '2026-10-30')).toBeNull();
    for (const [hash, dates] of [
      [kohnodaiOctober30Hash, ['2026-11-01', '2027-10-30']],
      [kohnodaiNovemberReviewedHash, ['2026-10-30', '2026-12-01', '2027-11-01']],
    ] as const) for (const date of dates)
      expect(reviewedKohnodaiPdf(hash, date)).toMatchObject({ status: 'unknown', periods: [], unknownReason: 'outside_published_period' });
    for (const [, , url] of packets) {
      const collector = createPdfCollector((async input => {
        const response = await fetchImpl(input);
        if (String(input) !== base + url) return response;
        return new Response(Buffer.concat([Buffer.from(await response.arrayBuffer()), Buffer.from('\n% changed\n')]), { headers: { 'content-type': 'application/pdf' } });
      }) as typeof fetch);
      await expect(collector.collect(config, url === packets[0][2] ? '2026-10-30' : '2026-11-14', new Date())).rejects.toMatchObject({ reason: 'source_changed' });
    }
    const rawHtml = await fixture('kohnodai-20261030.html.gz');
    expect(digest(rawHtml)).toBe('3c59115890f90bcc7d2d89ac7d9f8b5e47d5dbd6b62cb7adaf50356821d846be');
    const html = rawHtml.toString();
    for (const changed of [html.replace('更新日：2026年', '更新日：2025年'), html.replace('「使用時間」以外を一般開放いたします', '')]) {
      const get = vi.fn(async () => new Response(changed));
      await expect(createPdfCollector(get as typeof fetch).collect(config, '2026-11-14', new Date())).rejects.toMatchObject({ reason: 'schedule_not_published' });
      expect(get).toHaveBeenCalledTimes(1);
    }
  });
});
