import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createPdfCollector, extractPdf, parseTodaPdf, parseIchikawaKohnodaiPdf, pdfSourceConfigs } from './pdf';
import { kohnodaiOctoberHash, reviewedKohnodaiPdf } from './reviewed-kohnodai';
import { reviewedHakataReading } from './reviewed-hakata';
import { aiFacilities, buildAiPacket } from './ai-sources';
import fixture from './fixtures/hakata-reviewed-20261021-packet.json';
import { digest, type AiPacket } from './ai-runtime';
const bytes = async (file: string) => new Uint8Array(await readFile(new URL(`./fixtures/${file}`, import.meta.url)));

describe('official October 26 source recovery', () => {
  it('reads winter Toda boundaries without borrowing adjacent events or inventing summer openings', async () => {
    const pdf = await extractPdf(await bytes('toda-202611.pdf'), { tableRules: true });
    const expected: Record<number, string[]> = { 1: ['09:00-13:00'], 3: ['09:00-17:00'], 7: ['09:00-13:00', '13:00-17:00'], 8: ['09:00-17:00'], 12: ['09:00-17:00'], 13: ['09:00-17:00'], 15: ['09:00-17:00'], 28: ['09:00-17:00'], 29: ['09:00-17:00'] };
    for (let day = 1; day <= 30; day++) {
      const r = parseTodaPdf(pdf, `2026-11-${String(day).padStart(2, '0')}`);
      expect(r.status).toBe(day === 11 ? 'unavailable' : 'unknown');
      if (day !== 11) {
        expect(r.periods.map(p => `${p.from}-${p.to}`)).toEqual(expected[day] ?? []);
        expect(r.periods.every(p => p.status === 'unavailable')).toBe(true);
      }
    }
    expect(() => parseTodaPdf({ ...pdf, horizontalRules: [] }, '2026-11-01')).toThrow('boundaries missing');
    expect(() => parseTodaPdf(pdf, '2027-11-01')).toThrow();
    const summer = await extractPdf(await bytes('toda-202610.pdf'), { tableRules: true });
    expect(parseTodaPdf(summer, '2026-10-31')).toMatchObject({ status: 'available', periods: [{ from: '17:00', to: '18:00', status: 'available' }] });
  });

  it('uses the reviewed Kohnodai scan only for its exact content, facility and month', async () => {
    const config = pdfSourceConfigs.find(c => c.trackId === 'ichikawa-kohnodai-athletic-stadium')!;
    const raw = await bytes('kohnodai-202610-scan.pdf');
    await expect(extractPdf(raw.slice())).rejects.toMatchObject({ reason: 'extraction_failed' });
    const extract = vi.fn(extractPdf);
    const fetchImpl = vi.fn(async (input: unknown) => String(input) === config.landingPageUrl
      ? new Response('更新日：2026年10月 「使用時間」以外を一般開放いたします<a href="/uploaded/attachment/60241.pdf">10月使用予定表</a>')
      : new Response(raw, { headers: { 'content-type': 'application/pdf' } }));
    const collector = createPdfCollector(fetchImpl as typeof fetch, extract);
    for (let day = 26; day <= 31; day++) {
      const r = await collector.collect(config, `2026-10-${day}`, new Date());
      expect(r.status).toBe(day === 26 ? 'unavailable' : [28, 29].includes(day) ? 'available' : 'partially_available');
      if (day === 27) expect(r.periods).toMatchObject([{ from: '09:00', to: '13:00', status: 'unavailable' }, { from: '13:00', to: '21:00', status: 'available' }]);
      if ([30, 31].includes(day)) expect(r.periods).toMatchObject([{ from: '09:00', to: '17:00', status: 'unavailable' }, { from: '17:00', to: '21:00', status: 'available' }]);
    }
    expect(extract).not.toHaveBeenCalled();
    expect(reviewedKohnodaiPdf('sha256:changed', '2026-10-26')).toBeNull();
    expect(reviewedKohnodaiPdf(kohnodaiOctoberHash, '2026-11-01')).toMatchObject({ status: 'unknown' });
    expect(reviewedKohnodaiPdf(kohnodaiOctoberHash, '2027-10-26')).toMatchObject({ status: 'unknown' });
    const november = await extractPdf(await bytes('kohnodai-202611.pdf'));
    expect(parseIchikawaKohnodaiPdf(november, '2026-11-01').status).toBe('partially_available');
    const changed = createPdfCollector((async input => String(input) === config.landingPageUrl ? fetchImpl(input) : new Response('%PDF-changed', { headers: { 'content-type': 'application/pdf' } })) as typeof fetch);
    await expect(changed.collect(config, '2026-10-26', new Date())).rejects.toMatchObject({ reason: 'extraction_failed' });
  });

  it('checks the reviewed Hakata PDF identity, closures and seasonal times', async () => {
    const packet = fixture as AiPacket;
    expect(digest(await bytes('hakata-20261021.pdf'))).toBe('d6cf4db43ba14630ddb13ab56120ba5a7b3af1810687787cba177851fe926df4');
    const rows = reviewedHakataReading(packet)!.rows;
    for (let day = 1; day <= 30; day++) {
      const row = rows.get(`2026-11-${String(day).padStart(2, '0')}`)!;
      const end: Record<number, string> = { 3: '13:00', 6: '15:00', 8: '15:00', 14: '14:00', 15: '15:00', 28: '14:00' };
      if ([1, 13, 21, 29].includes(day)) {
        expect(row.status).toBe('unavailable'); expect(row.periods).toEqual([]);
      } else {
        expect(row.status).toBe(end[day] ? 'partially_available' : 'available');
        expect(row.periods).toMatchObject([{ start: end[day] ?? '09:00', end: '17:00' }]);
        if (end[day]) expect(row.conditions.join()).toContain('実際の終了状況');
      }
      expect(row.evidence[0].source).toBe('hakata-5-page-2.png');
    }
    expect(rows.get('2026-10-31')).toMatchObject({ status: 'partially_available', periods: [{ start: '17:00', end: '18:30' }] });
    expect(rows.get('2026-12-01')).toMatchObject({ status: 'unknown', periods: [] });
    for (let i = 1; i < packet.sources.length; i++) {
      expect(reviewedHakataReading({ ...packet, sources: packet.sources.map((s, j) => i === j ? { ...s, hash: 'changed' } : s) })).toBeNull();
    }
  });

  it('finds Ishin on its linked notice index and includes repair conditions while excluding thumbnails', async () => {
    const root = 'https://www.ishin100.com/main/';
    const notice = `${root}info_mirasta_kojin_20261005/`;
    const repairs = `${root}info_hojyo_track_syuzzen_kouji_20261019/`;
    const image = `${root}wp-content/uploads/info_hojyoriku_class_202610_230261013_1.png`;
    const repairImage = `${root}wp-content/uploads/info_hojyo_track_syuzzen_kouji_20261019-content.png`;
    const fetchImpl = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url === root) return new Response(await readFile(new URL('./fixtures/ishin-restored-home-20261026.html', import.meta.url), 'utf8'));
      if (url.endsWith('/category/notice/')) return new Response(await readFile(new URL('./fixtures/ishin-notice-index-20261026.html', import.meta.url), 'utf8'));
      if (url === notice) return new Response(`<main>補助陸上競技場の公式利用予定です。個人利用前には事務所へお問い合わせください。<img src="${image}"></main>`);
      if (url === repairs) return new Response(`<main>補助陸上競技場の修繕工事に伴う利用条件を掲載します。<img src="${repairImage}"><img src="${repairImage.replace('.png', '-300x128.png')}"></main>`);
      return new Response(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]));
    });
    const packet = await buildAiPacket(aiFacilities.find(c => c.key === 'ishin')!, ['2026-10-26'], new Date(), fetchImpl as typeof fetch);
    expect(packet.sources.map(s => s.url)).toEqual([notice, image, repairs, repairImage]);
    expect(fetchImpl.mock.calls).toHaveLength(6);
    const missing = async (input: unknown) => String(input).endsWith('/category/notice/') ? new Response('<main>対象予定なし</main>') : fetchImpl(input);
    await expect(buildAiPacket(aiFacilities.find(c => c.key === 'ishin')!, ['2026-10-26'], new Date(), missing as typeof fetch)).rejects.toThrow('notice not found');
  });
});
