import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import previous from './fixtures/ishin-20261112-packet.json';
import { digest, type AiPacket } from './ai-runtime';
import { reviewedIshinReading } from './reviewed-ishin';

it('preserves every November/December row after reviewing only adjacent-article navigation changes', () => {
  const packet = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/ishin-20261116-packet.json.gz', import.meta.url))).toString('utf8')) as AiPacket;
  for (const source of packet.sources) {
    expect(digest(source.kind === 'image' ? Buffer.from(source.content, 'base64') : source.content)).toBe(source.hash);
  }
  const rows = reviewedIshinReading(packet)!.rows;
  const before = reviewedIshinReading({ ...previous, dates: packet.dates } as AiPacket)!.rows;
  expect(rows.size).toBe(61);
  for (const date of packet.dates) expect(rows.get(date)).toEqual(before.get(date));
  expect(rows.get('2026-11-15')).toMatchObject({ status: 'unknown', periods: [] });
  expect(rows.get('2026-11-16')).toMatchObject({ status: 'partially_available', periods: [{ start: '13:00', end: '22:00' }] });
  expect(rows.get('2026-11-26')!.conditions.join()).toContain('5・6・7・8レーン');
  for (let index = 0; index < packet.sources.length; index++) {
    expect(reviewedIshinReading({ ...packet, sources: packet.sources.map((s, i) => i === index ? { ...s, hash: 'changed' } : s) })).toBeNull();
    expect(reviewedIshinReading({ ...packet, sources: packet.sources.filter((_, i) => i !== index) })).toBeNull();
  }
  expect(reviewedIshinReading({ ...packet, trackId: 'different-track' })).toBeNull();
  expect(reviewedIshinReading({ ...packet, dates: ['2027-11-16'] })!.rows.get('2027-11-16')).toMatchObject({ status: 'unknown', periods: [] });
});
