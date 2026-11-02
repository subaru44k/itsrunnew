import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import chitaFixture from './fixtures/chita-20261102-packet.json';
import hakataFixture from './fixtures/hakata-20261102-packet.json';
import ishinFixture from './fixtures/ishin-20261102-packet.json';
import { digest, type AiPacket } from './ai-runtime';
import { fullMonths } from './ai-sources';
import { sourceInputs } from './ai-source-utils';
import { reviewedChitaReading } from './reviewed-chita';
import { reviewedHakataReading } from './reviewed-hakata';
import { reviewedIshinReading } from './reviewed-ishin';
import { collectAdditionalAvailability } from './additional';
const packets: Record<string, AiPacket> = { chita: chitaFixture as AiPacket, hakata: hakataFixture as AiPacket, ishin: ishinFixture as AiPacket };
let changed = false;
vi.mock('./ai-sources', async original => ({
  ...(await original<typeof import('./ai-sources')>()),
  buildAiPacket: vi.fn(async (c: { key: string }, dates: string[]) => {
    const p = packets[c.key]; if (!p) throw new Error('Official source HTTP 503');
    return { ...p, dates, sources: p.sources.map((s, i) => changed && i === p.sources.length - 1 ? { ...s, hash: 'changed' } : s) };
  }),
}));
const bytes = (name: string) => readFile(new URL(`./fixtures/${name}`, import.meta.url));
const dates = fullMonths(['2026-11-01', '2026-12-01']);

describe('November 2 official source revisions', () => {
  it('binds reviewed packets to the complete original HTML, PDF pages and condition images', async () => {
    const inputs: Array<[string, number, string]> = [
      ['chita', 0, 'chita-20261102.html.gz'], ['hakata', 1, 'hakata-guide-20261102.html.gz'],
      ['hakata', 2, 'hakata-rules-20261102.pdf'], ['hakata', 4, 'hakata-20261101.pdf'],
      ['ishin', 0, 'ishin-0-20261102.html.gz'], ['ishin', 1, 'ishin-nov-20261102.png'],
      ['ishin', 2, 'ishin-dec-20261102.png'], ['ishin', 3, 'ishin-3-20261102.html.gz'],
      ['ishin', 4, 'ishin-repairs-conditions-20261026.png'], ['ishin', 5, 'ishin-repairs-map-20261026.png'],
    ];
    for (const [key, index, file] of inputs) {
      const source = packets[key].sources[index]; const data = await bytes(file);
      const actual = await sourceInputs(source.name.replace(/-page-\d+\.png$/, ''), source.url, file.endsWith('.gz') ? gunzipSync(data) : data);
      for (let i = 0; i < actual.length; i++) expect(actual[i].hash, `${key} ${file} page ${i}`).toBe(packets[key].sources[index + i].hash);
    }
  });
  it('keeps the exact renovation interval and leaves the removed Nov 1 notice and Nov 2 unknown', () => {
    const rows = reviewedChitaReading({ ...packets.chita, dates: [...fullMonths(['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01']), '2027-04-01'] })!.rows;
    expect([...rows.values()].filter(r => r.status === 'unavailable')).toHaveLength(149);
    for (const date of ['2026-11-01', '2026-11-02', '2027-04-01']) expect(rows.get(date)).toMatchObject({ status: 'unknown', periods: [], evidence: [] });
    expect(rows.get('2026-11-03')?.conditions.join()).toContain('2027年3月31日');
    const s = packets.chita.sources[0];
    const content = s.content.replace('令和９年３月３１日', '令和９年２月２８日');
    expect(reviewedChitaReading({ ...packets.chita, sources: [{ ...s, content, hash: digest(content) }] })).toBeNull();
  });
  it('checks every November Hakata date, event end, winter closing and no-opening note', () => {
    const rows = reviewedHakataReading({ ...packets.hakata, dates: [...dates, '2026-10-31', '2027-11-02'] })!.rows;
    const after: Record<number, string> = { 3: '13:00', 6: '15:00', 8: '15:00', 14: '14:00', 15: '15:00', 28: '14:00' };
    for (let d = 1; d <= 30; d++) {
      const r = rows.get(`2026-11-${String(d).padStart(2, '0')}`)!;
      if ([1, 13, 21, 29].includes(d)) expect(r).toMatchObject({ status: 'unavailable', periods: [] });
      else {
        expect(r.status).toBe(after[d] ? 'partially_available' : 'available');
        expect(r.periods).toMatchObject([{ start: after[d] ?? '09:00', end: '17:00' }]);
        expect(r.conditions.join()).toContain('天然芝部分は一般利用不可');
        if (after[d]) expect(r.conditions.join()).toContain('実際の終了状況');
      }
    }
    for (const date of ['2026-12-01', '2026-12-31', '2026-10-31', '2027-11-02']) expect(rows.get(date)).toMatchObject({ status: 'unknown', periods: [], evidence: [] });
  });
  it('checks all 61 Ishin dates, keeps event-only and blank dates unknown, and retains repair restrictions', () => {
    const rows = reviewedIshinReading({ ...packets.ishin, dates: [...dates, '2026-10-06', '2027-01-01'] })!.rows;
    for (const date of dates) {
      const day = Number(date.slice(8)), nov = date.startsWith('2026-11');
      const opening = (nov ? [2, 6, 12, 16, 19, 24, 26, 30] : [3, 7, 10, 17, 21, 24, 28]).includes(day);
      const closed = nov ? day === 9 : day === 14;
      const r = rows.get(date)!;
      expect(r.status, date).toBe(closed ? 'unavailable' : opening ? date === '2026-11-26' ? 'partially_available' : 'available' : 'unknown');
      expect(r.periods, date).toEqual(opening ? [{ start: '08:30', end: '17:00', scope: '補助陸上競技場トラック（芝生部分を除く）', last_entry: null }] : []);
      if (!opening && !closed) expect(r.unknown_reason, date).toBe('insufficient_information');
    }
    for (const date of ['2026-11-26', '2026-11-27', '2026-11-28']) expect(rows.get(date)?.conditions.join()).toContain('5・6・7・8レーンのみ');
    for (const date of ['2026-10-06', '2027-01-01']) expect(rows.get(date)).toMatchObject({ status: 'unknown', evidence: [], periods: [] });
  });
  it('rejects every unreviewed source, missing document, extra document and wrong identity', () => {
    for (const [key, read] of [['chita', reviewedChitaReading], ['hakata', reviewedHakataReading], ['ishin', reviewedIshinReading]] as const) {
      const p = packets[key];
      for (let i = key === 'hakata' ? 1 : 0; i < p.sources.length; i++) {
        expect(read({ ...p, sources: p.sources.map((s, j) => i === j ? { ...s, hash: 'changed' } : s) })).toBeNull();
        expect(read({ ...p, sources: p.sources.filter((_, j) => i !== j) })).toBeNull();
      }
      expect(read({ ...p, trackId: 'other' })).toBeNull();
      expect(read({ ...p, landingPageUrl: 'https://example.com/' })).toBeNull();
      expect(read({ ...p, sources: [...p.sources, p.sources.at(-1)!] })).toBeNull();
    }
  });
  it('publishes corrected records with provenance and stops changed documents without external AI', async () => {
    const api = vi.fn(async () => { throw new Error('No AI fallback'); });
    const options = { now: new Date('2026-11-02T01:00:00Z'), apiKey: '', apiFetchImpl: api as typeof fetch, fetchImpl: (async () => new Response('', { status: 503 })) as typeof fetch };
    const selected = ['2026-11-02', '2026-11-03', '2026-11-26', '2026-12-01'];
    const result = await collectAdditionalAvailability(selected, options);
    for (const [key, read] of [['chita', reviewedChitaReading], ['hakata', reviewedHakataReading], ['ishin', reviewedIshinReading]] as const) {
      const expected = read({ ...packets[key], dates: selected })!;
      for (const r of result.filter(r => r.trackId === packets[key].trackId)) {
        expect(r.status).toBe(expected.rows.get(r.date)!.status);
        expect(r.evidence.sourceHash).toMatch(/^sha256:/);
      }
    }
    changed = true;
    try {
      const result = await collectAdditionalAvailability(selected, options);
      expect(result.filter(r => Object.values(packets).some(p => p.trackId === r.trackId)).every(r => r.status === 'unknown' && r.unknownReason === 'source_changed')).toBe(true);
    } finally { changed = false; }
    expect(api).not.toHaveBeenCalled();
  });
});
