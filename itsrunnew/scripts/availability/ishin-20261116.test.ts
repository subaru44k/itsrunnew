import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import previous from './fixtures/ishin-20261112-packet.json';
import { digest, type AiPacket } from './ai-runtime';
import { sourceInputs } from './ai-source-utils';
import { reviewedIshinReading } from './reviewed-ishin';

const november16 = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/ishin-20261116-packet.json.gz', import.meta.url))).toString('utf8')) as AiPacket;

it('preserves every November/December row after reviewing only adjacent-article navigation changes', () => {
  const packet = november16;
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

it('accepts the November 23 notice after the next article loses its New badge', async () => {
  const [priorNotice, ...unchangedSources] = november16.sources;
  const html = gunzipSync(readFileSync(new URL('./fixtures/ishin-20261123-notice.html.gz', import.meta.url)));
  const [notice] = await sourceInputs(priorNotice.name, priorNotice.url, html);
  expect(notice.content).toBe(priorNotice.content.replace('New!!\n2026年11月16日', '2026年11月16日'));
  expect(notice.hash).not.toBe(priorNotice.hash);
  const packet = { ...november16, sources: [notice, ...unchangedSources] };
  const baseline = reviewedIshinReading(november16)!.rows;
  const recovered = reviewedIshinReading(packet)!.rows;
  expect(recovered.size).toBe(61);
  expect(recovered).toEqual(baseline);
  for (const source of packet.sources) {
    expect(reviewedIshinReading({
      ...packet,
      sources: packet.sources.map(item => item === source ? { ...item, hash: 'changed' } : item),
    })).toBeNull();
  }
  expect(reviewedIshinReading({ ...packet, sources: unchangedSources })).toBeNull();
});
