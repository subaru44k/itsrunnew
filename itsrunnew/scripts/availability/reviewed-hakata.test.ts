import { describe, it, expect } from 'vitest';
import fixture from './fixtures/hakata-reviewed-packet.json';
import { reviewedHakataReading } from './reviewed-hakata';
import type { AiPacket } from './ai-runtime';
const packet = fixture as AiPacket;
describe('human-reviewed Hakata October 2026 official table', () => {
  it('recovers seven ordinary days and four post-event openings with real-end caveats', () => {
    const result = reviewedHakataReading(packet)!;
    expect(result.rows.size).toBe(32);
    for (const day of [19, 22, 26, 27, 28, 29, 30]) {
      const row = result.rows.get(`2026-10-${day}`)!;
      expect(row.status).toBe('available');
      expect(row.periods).toMatchObject([{ start: '09:00', end: '18:30' }]);
      expect(row.evidence[0].source).toBe('hakata-5-page-1.png');
    }
    for (const [day, start] of [
      [17, '17:00'],
      [18, '15:00'],
      [21, '15:00'],
      [24, '17:00'],
      [25, '17:00'],
      [31, '17:00'],
    ] as const) {
      const row = result.rows.get(`2026-10-${day}`)!;
      expect(row.status).toBe('partially_available');
      expect(row.periods).toMatchObject([{ start, end: '18:30' }]);
      expect(row.conditions.join(' ')).toContain('実際の終了状況');
    }
    for (const day of [8, 9, 10, 11]) {
      const row = result.rows.get(`2026-10-${String(day).padStart(2, '0')}`)!;
      expect(row.status).toBe('unavailable');
      expect(row.periods).toEqual([]);
      expect(row.evidence[0].quote_or_symbol).toBe('一般開放はありません');
    }
    expect(result.rows.get('2026-11-01')).toMatchObject({
      status: 'unknown',
      periods: [],
      evidence: [],
    });
  });
  it('retains the reviewed reading when only homepage news changes', () => {
    const sources = packet.sources.map((source, i) => i === 0 ? { ...source, hash: 'new-homepage-news' } : source);
    expect(reviewedHakataReading({ ...packet, sources })?.rows.get('2026-10-19')?.status).toBe('available');
  });
  it('rejects removed, additional or replaced schedule/usage documents', () => {
    expect(reviewedHakataReading({ ...packet, sources: packet.sources.slice(0, -1) })).toBeNull();
    expect(reviewedHakataReading({ ...packet, sources: [...packet.sources, { ...packet.sources.at(-1)!, url: 'https://www.midorimachi.jp/new.pdf' }] })).toBeNull();
    expect(reviewedHakataReading({ ...packet, sources: packet.sources.map((s, i) => i === 4 ? { ...s, url: 'https://www.midorimachi.jp/new.pdf' } : s) })).toBeNull();
  });
  it('does not reuse a reviewed calendar after schedule, usage-source or facility identity changes', () => {
    expect(reviewedHakataReading({ ...packet, key: 'other' })).toBeNull();
    expect(reviewedHakataReading({ ...packet, trackId: 'other' })).toBeNull();
    expect(reviewedHakataReading({ ...packet, landingPageUrl: 'https://example.com/' })).toBeNull();
    for (let index = 1; index < packet.sources.length; index++) {
      const sources = packet.sources.map((source, i) =>
        i === index ? { ...source, hash: 'changed' } : source,
      );
      expect(reviewedHakataReading({ ...packet, sources })).toBeNull();
    }
  });
});
