import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { buildAiPacket, aiFacilities } from './ai-sources';
import { digest } from './ai-runtime';
import { readHiratsukaTable } from './hiratsuka-table';
import { collectAdditionalAvailability } from './additional';

const config = aiFacilities.find(c => c.key === 'hiratsuka')!;
const now = new Date('2026-10-30T01:30:00Z');
const dates = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, 9, 29 + i)).toISOString().slice(0, 10));
const html = gunzipSync(await readFile(new URL('./fixtures/hiratsuka-20261030.html.gz', import.meta.url))).toString('utf8');
const fetchImpl = (async (input: string | URL | Request) => String(input) === config.landing ? new Response(html) : new Response('', { status: 503 })) as typeof fetch;
const packet = await buildAiPacket(config, dates, now, fetchImpl);
function timed(value: string) {
  const content = packet.sources[0].content.replace('15時～可', value);
  return { ...packet, sources: [{ ...packet.sources[0], content, hash: digest(content) }] };
}

describe('Hiratsuka October 30 official timed opening', () => {
  it('reads all 30 actual slots while retaining the November 8 afternoon start', () => {
    const result = readHiratsukaTable(packet)!;
    expect(result.publishedAt).toBe('2026-10-30');
    const expected = [
      ['2026-10-30', 'available', [['08:00', '12:00'], ['12:00', '13:00'], ['13:00', '20:00']]],
      ['2026-10-31', 'unavailable', []], ['2026-11-01', 'unavailable', []],
      ['2026-11-02', 'partially_available', [['13:00', '19:00']]],
      ['2026-11-03', 'unavailable', []],
      ['2026-11-04', 'available', [['08:00', '12:00'], ['12:00', '13:00'], ['13:00', '19:00']]],
      ['2026-11-05', 'available', [['08:00', '12:00'], ['12:00', '13:00'], ['13:00', '19:00']]],
      ['2026-11-06', 'available', [['08:00', '12:00'], ['12:00', '13:00'], ['13:00', '20:00']]],
      ['2026-11-07', 'unavailable', []],
      ['2026-11-08', 'partially_available', [['15:00', '19:00']]],
    ];
    for (const [date, status, times] of expected) {
      const row = result.rows.get(String(date))!;
      expect(row.status).toBe(status);
      expect(row.periods.map(p => [p.start, p.end])).toEqual(times);
    }
    expect(result.rows.get('2026-11-02')!.conditions.join()).toContain('予備日の時間帯は利用可否未定');
    expect(result.rows.get('2026-11-04')!.conditions.join()).toContain('スパイク・器具貸出');
    expect(result.rows.get('2026-11-08')!.conditions.join()).not.toContain('無料開放');
    for (const date of ['2026-10-29', '2026-11-09']) expect(result.rows.get(date)!.unknown_reason).toBe('outside_published_period');
  });
  it('accepts explicit minutes but rejects ambiguous, invalid or out-of-slot openings', () => {
    expect(readHiratsukaTable(timed('15時30分～可'))!.rows.get('2026-11-08')!.periods[0].start).toBe('15:30');
    for (const value of ['15時頃～可', '15時～', '15時～不可', '15時60分～可', '24時～可', '12時59分～可', '19時～可', '20時～可']) {
      expect(readHiratsukaTable(timed(value))).toBeNull();
    }
  });
  it('keeps a day partial when only its afternoon begins late and keeps Friday closing time', () => {
    const text = packet.sources[0].content;
    const content = text.replace('30日(金曜日)\n可\n可\n可', '30日(金曜日)\n可\n可\n15時30分～可');
    const result = readHiratsukaTable({ ...packet, sources: [{ ...packet.sources[0], content, hash: digest(content) }] })!;
    expect(result.rows.get('2026-10-30')).toMatchObject({ status: 'partially_available', periods: [{ start: '08:00' }, { start: '12:00' }, { start: '15:30', end: '20:00' }] });
  });
  it('publishes the actual timed result without an API call and rejects an out-of-slot change', async () => {
    const apiFetch = vi.fn(async () => { throw new Error('Hiratsuka must not use AI'); });
    for (const invalid of [false, true]) {
      const sourceFetch = (async (input: string | URL | Request) => String(input) === config.landing
        ? new Response(invalid ? html.replace('15時～可', '19時～可') : html)
        : new Response('', { status: 503 })) as typeof fetch;
      const rows = (await collectAdditionalAvailability(['2026-11-08'], { now, fetchImpl: sourceFetch, apiFetchImpl: apiFetch as typeof fetch, apiKey: '' })).filter(r => r.trackId === config.trackId);
      expect(rows).toHaveLength(1);
      expect(rows[0].evidence.parserVersion).toBe('hiratsuka-table-v2');
      if (invalid) expect(rows[0]).toMatchObject({ status: 'unknown', unknownReason: 'source_changed', periods: [] });
      else expect(rows[0]).toMatchObject({ status: 'partially_available', periods: [{ from: '15:00', to: '19:00' }] });
    }
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
