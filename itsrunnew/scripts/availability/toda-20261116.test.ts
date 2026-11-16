import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPdfCollector, extractPdf, parseTodaPdf, pdfSourceConfigs } from './pdf';

const original = () => readFile(new URL('./fixtures/toda-202612.pdf', import.meta.url));
const expected: Record<number, string[]> = {
  5: ['13:00-17:00'], 6: ['13:00-17:00'], 12: ['13:00-17:00'],
  13: ['09:00-13:00', '13:00-17:00'], 19: ['13:00-17:00'],
  20: ['13:00-17:00'], 26: ['13:00-17:00'], 27: ['13:00-17:00'],
};

describe('Toda December 2026 original PDF', () => {
  it('reads all 31 days without borrowing other facilities or inventing winter openings', async () => {
    const raw = await original();
    expect(createHash('sha256').update(raw).digest('hex')).toBe('ff6bc5b9deaeb81fa22917d83f26b4d3831c47e87f30bb5d1b8d2404d8fec8d5');
    const pdf = await extractPdf(new Uint8Array(raw), { tableRules: true });
    for (let day = 1; day <= 31; day++) {
      const result = parseTodaPdf(pdf, `2026-12-${String(day).padStart(2, '0')}`);
      if ([9, 10, 30, 31].includes(day)) {
        expect(result).toMatchObject({ status: 'unavailable', periods: [{ from: null, to: null, conditions: ['facility_closed'] }] });
      } else {
        expect(result.status).toBe('unknown');
        expect(result.unknownReason).toBe('insufficient_information');
        expect(result.periods.map(p => `${p.from}-${p.to}`)).toEqual(expected[day] ?? []);
        expect(result.periods.every(p => p.status === 'unavailable' && p.conditions.includes('exclusive_track_event'))).toBe(true);
      }
    }
  });

  it('rejects missing, ambiguous, and distant time cells instead of borrowing a nearby event', async () => {
    const pdf = await extractPdf(new Uint8Array(await original()), { tableRules: true });
    const time = pdf.items.find(i => i.text === '13:00~17:00' && Math.abs(i.y - 577.66) < 0.01)!;
    expect(time).toBeDefined();
    const without = pdf.items.filter(i => i !== time);
    expect(() => parseTodaPdf({ ...pdf, items: without }, '2026-12-06')).toThrow('hours ambiguous or missing');
    expect(() => parseTodaPdf({ ...pdf, items: [...without, { ...time, y: 575 }] }, '2026-12-06')).toThrow('hours ambiguous or missing');
    expect(() => parseTodaPdf({ ...pdf, items: [...pdf.items, { ...time, text: '14:00~17:00', y: time.y + 0.1 }] }, '2026-12-06')).toThrow('hours ambiguous or missing');
    expect(() => parseTodaPdf({ ...pdf, horizontalRules: [] }, '2026-12-06')).toThrow('boundaries missing');
    expect(() => parseTodaPdf(pdf, '2027-12-06')).toThrow();
  });

  it('discovers and publishes the repaired parsed slot with original source evidence', async () => {
    const config = pdfSourceConfigs.find(c => c.trackId === 'toda-sports-center-track')!;
    const raw = new Uint8Array(await original());
    const landing = await readFile(new URL('./fixtures/toda-20261116-landing.html.gz', import.meta.url));
    const { gunzipSync } = await import('node:zlib');
    const collector = createPdfCollector((async input => String(input) === config.landingPageUrl
      ? new Response(gunzipSync(landing).toString('utf8'))
      : new Response(raw.slice(), { headers: { 'content-type': 'application/pdf' } })) as typeof fetch);
    const result = await collector.collect(config, '2026-12-06', new Date('2026-11-16T01:30:00Z'));
    expect(result).toMatchObject({
      status: 'unknown', unknownReason: 'insufficient_information', parserVersion: '1.2.0',
      pdfUrl: 'https://toda-zaidan.org/wp-content/uploads/2026.12.pdf',
      sourceHash: 'sha256:ff6bc5b9deaeb81fa22917d83f26b4d3831c47e87f30bb5d1b8d2404d8fec8d5',
      periods: [{ from: '13:00', to: '17:00', status: 'unavailable', conditions: ['exclusive_track_event'] }],
    });
  });
});
