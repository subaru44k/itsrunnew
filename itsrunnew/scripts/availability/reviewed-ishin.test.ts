import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import fixture from './fixtures/ishin-reviewed-20261026-packet.json';
import { digest, type AiPacket } from './ai-runtime';
import { reviewedIshinReading } from './reviewed-ishin';
import { collectAdditionalAvailability } from './additional';
vi.mock('./ai-sources', async importOriginal => ({
  ...(await importOriginal<typeof import('./ai-sources')>()),
  buildAiPacket: vi.fn(async (config: { key: string }) => {
    if (config.key === 'ishin') return activePacket;
    throw new Error('Official source HTTP 503');
  }),
}));
const packet = fixture as AiPacket;
let activePacket = packet;

describe('human-reviewed Ishin October/November official sources', () => {
  it('retains exact explicit openings and closures, without field-only partial status or event-only whole-day closure', () => {
    const result = reviewedIshinReading(packet)!;
    expect(result.rows.size).toBe(62);
    const openings = ['2026-10-01', '2026-10-05', '2026-10-08', '2026-10-13', '2026-10-15', '2026-10-19', '2026-10-22', '2026-10-26', '2026-10-29', '2026-11-02', '2026-11-06', '2026-11-12', '2026-11-16', '2026-11-19', '2026-11-24', '2026-11-26', '2026-11-30'];
    for (const date of packet.dates) {
      const row = result.rows.get(date)!;
      if (openings.includes(date)) {
        expect(row.status).toBe(date === '2026-11-26' ? 'partially_available' : 'available');
        expect(row.periods).toMatchObject([{ start: '08:30', end: '17:00' }]);
        expect(row.conditions.join()).toContain('利用前日');
        expect(row.conditions.join()).toContain('芝生部分は利用不可');
        expect(row.evidence[0].source).toBe(date.startsWith('2026-10') ? 'ishin-2' : 'ishin-3');
      } else if (['2026-10-06', '2026-11-09'].includes(date)) {
        expect(row.status).toBe('unavailable'); expect(row.evidence[0].quote_or_symbol).toContain('清掃・点検日');
      } else {
        expect(row.status).toBe('unknown'); expect(row.periods).toEqual([]);
        expect(row.unknown_reason).toBe(date === '2026-12-01' ? 'outside_published_period' : 'insufficient_information');
      }
    }
    for (const date of ['2026-11-26', '2026-11-27', '2026-11-28']) {
      expect(result.rows.get(date)!.conditions.join()).toContain('5・6・7・8レーンのみ');
      expect(result.rows.get(date)!.conditions.join()).toContain('200m・400m・中長距離');
    }
    expect(result.rows.get('2026-11-29')!.conditions.join()).not.toContain('5・6・7・8');
  });
  it('requires every official source hash and facility identity, and accepts the legitimate month rollover subset', () => {
    for (let index = 0; index < packet.sources.length; index++) {
      expect(reviewedIshinReading({ ...packet, sources: packet.sources.filter((_, i) => i !== index) })).toBeNull();
      expect(reviewedIshinReading({ ...packet, sources: packet.sources.map((s, i) => i === index ? { ...s, hash: 'changed' } : s) })).toBeNull();
    }
    expect(reviewedIshinReading({ ...packet, key: 'other' })).toBeNull();
    expect(reviewedIshinReading({ ...packet, trackId: 'other' })).toBeNull();
    expect(reviewedIshinReading({ ...packet, landingPageUrl: 'https://example.test/' })).toBeNull();
    expect(reviewedIshinReading({ ...packet, sources: [...packet.sources, packet.sources[0]] })).toBeNull();
    const november = { ...packet, dates: packet.dates.filter(d => !d.startsWith('2026-10')), sources: packet.sources.filter(s => !s.url.includes('class_202610')) };
    expect(reviewedIshinReading(november)?.rows.get('2026-11-02')?.status).toBe('available');
    expect(reviewedIshinReading(november)?.rows.get('2026-12-01')?.status).toBe('unknown');
    expect(reviewedIshinReading({ ...november, sources: [...november.sources, { ...packet.sources[1], url: 'https://www.ishin100.com/main/wp-content/uploads/202612.png' }] })).toBeNull();
  });
  it('binds the reviewed records to the actual official monthly and repair images', async () => {
    for (const [index, file] of [[1, 'ishin-202610.png'], [2, 'ishin-202611.png'], [4, 'ishin-repairs-conditions-20261026.png'], [5, 'ishin-repairs-map-20261026.png']] as const) {
      expect(digest(await readFile(new URL(`./fixtures/${file}`, import.meta.url)))).toBe(packet.sources[index].hash);
    }
  });
  it('publishes reviewed rows without AI and stops changed sources without an AI fallback', async () => {
    const apiFetch = vi.fn(async () => { throw new Error('AI must not run for reviewed Ishin'); });
    const options = { now: new Date('2026-10-26T07:00:00Z'), apiKey: 'test', apiFetchImpl: apiFetch as typeof fetch, fetchImpl: (async () => new Response('', { status: 503 })) as typeof fetch };
    const dates = ['2026-10-26', '2026-11-03'];
    const normal = (await collectAdditionalAvailability(dates, options)).filter(r => r.trackId === packet.trackId);
    expect(normal.map(r => r.status)).toEqual(['available', 'unknown']);
    expect(normal[0].evidence.collector).toBe('reviewed-official-ishin');
    expect(normal[1].unknownReason).toBe('insufficient_information');
    activePacket = { ...packet, sources: packet.sources.map((s, i) => i === 1 ? { ...s, hash: 'changed' } : s) };
    try {
      const changed = (await collectAdditionalAvailability(dates, options)).filter(r => r.trackId === packet.trackId);
      expect(changed.every(r => r.status === 'unknown' && r.unknownReason === 'source_changed')).toBe(true);
      expect(apiFetch).not.toHaveBeenCalled();
    } finally { activePacket = packet; }
  });

});
