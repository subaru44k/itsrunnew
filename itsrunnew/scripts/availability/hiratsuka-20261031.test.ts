import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { buildAiPacket, aiFacilities } from './ai-sources';
import { digest, type AiPacket } from './ai-runtime';
import { readHiratsukaTable } from './hiratsuka-table';
import { collectAdditionalAvailability } from './additional';

const config = aiFacilities.find(c => c.key === 'hiratsuka')!;
const now = new Date('2026-10-31T06:08:42Z');
const dates = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, 9, 29 + i)).toISOString().slice(0, 10));
const raw = gunzipSync(await readFile(new URL('./fixtures/hiratsuka-20261031.html.gz', import.meta.url)));
const html = raw.toString('utf8');
const fetchImpl = (async (input: string | URL | Request) => String(input) === config.landing ? new Response(html) : new Response('', { status: 503 })) as typeof fetch;
const packet = await buildAiPacket(config, dates, now, fetchImpl);
function changed(content: string): AiPacket {
  return { ...packet, sources: [{ ...packet.sources[0], content, hash: digest(content) }] };
}

describe('Hiratsuka October 31 revision retains the October 30 table start', () => {
  it('retains all 30 official slots and adopts the explicit November 2 opening', () => {
    expect(digest(raw)).toBe('b07bb349577626515642f70bfb7cc3d36d9ef37c70b6389e9970628b8d53828f');
    const result = readHiratsukaTable(packet)!;
    expect(result.publishedAt).toBe('2026-10-31');
    const expected = [
      ['2026-10-30', 'available', [['08:00', '12:00'], ['12:00', '13:00'], ['13:00', '20:00']]],
      ['2026-10-31', 'unavailable', []], ['2026-11-01', 'unavailable', []],
      ['2026-11-02', 'available', [['08:00', '12:00'], ['12:00', '13:00'], ['13:00', '19:00']]],
      ['2026-11-03', 'unavailable', []],
      ['2026-11-04', 'available', [['08:00', '12:00'], ['12:00', '13:00'], ['13:00', '19:00']]],
      ['2026-11-05', 'available', [['08:00', '12:00'], ['12:00', '13:00'], ['13:00', '19:00']]],
      ['2026-11-06', 'available', [['08:00', '12:00'], ['12:00', '13:00'], ['13:00', '20:00']]],
      ['2026-11-07', 'unavailable', []],
      ['2026-11-08', 'partially_available', [['15:00', '19:00']]],
    ];
    for (const [date, status, times] of expected) {
      const row = result.rows.get(String(date))!;
      expect(row.status, String(date)).toBe(status);
      expect(row.periods.map(p => [p.start, p.end]), String(date)).toEqual(times);
    }
    expect(result.rows.get('2026-11-02')!.conditions.join()).not.toContain('予備日');
    expect(result.rows.get('2026-11-02')!.conditions.join()).toContain('スパイク・器具貸出');
    for (const date of ['2026-10-29', '2026-11-09']) expect(result.rows.get(date)!.unknown_reason).toBe('outside_published_period');
  });

  it('requires a valid update date inside the table, correct month and contiguous weekdays', () => {
    const text = packet.sources[0].content;
    for (const content of [
      text.replace('2026年10月31日', '2025年10月31日'),
      text.replace('2026年10月31日', '2026年10月29日'),
      text.replace('2026年10月31日', '2026年11月9日'),
      text.replace('2026年10月31日', '2026年10月32日'),
      text.replace('10月/11月', '11月/12月'),
      text.replace('30日(金曜日)', '31日(土曜日)'),
      text.replace('1日(日曜日)', '1日(月曜日)'),
      text.replace('2日(月曜日)', '3日(火曜日)'),
    ]) expect(readHiratsukaTable(changed(content))).toBeNull();
    expect(readHiratsukaTable(changed(text.replace('2026年10月31日', '2026年11月8日')))).not.toBeNull();
  });

  it('anchors a retained December row to the previous year after a January update', () => {
    let text = packet.sources[0].content.replace('2026年10月31日', '2027年1月1日').replace('10月/11月', '12月/1月');
    const nextDates: string[] = [];
    let index = 0;
    text = text.replace(/\d{1,2}日\([日月火水木金土]曜日\)/g, () => {
      const date = new Date(Date.UTC(2026, 11, 28 + index++));
      nextDates.push(date.toISOString().slice(0, 10));
      return `${date.getUTCDate()}日(${'日月火水木金土'[date.getUTCDay()]}曜日)`;
    });
    const result = readHiratsukaTable({ ...changed(text), dates: nextDates })!;
    expect(result.publishedAt).toBe('2027-01-01');
    expect([...result.rows.keys()]).toEqual(nextDates);
    expect(result.rows.get('2026-12-28')!.status).toBe('available');
    expect(result.rows.get('2027-01-06')!.periods).toMatchObject([{ start: '15:00', end: '19:00' }]);
  });

  it('publishes corrected dates and conditions with no AI fallback', async () => {
    const apiFetch = vi.fn(async () => { throw new Error('Hiratsuka must not use AI'); });
    const result = (await collectAdditionalAvailability(['2026-10-31', '2026-11-02', '2026-11-08', '2026-11-09'], { now, fetchImpl, apiFetchImpl: apiFetch as typeof fetch, apiKey: '' })).filter(r => r.trackId === config.trackId);
    expect(result.map(r => r.status)).toEqual(['unavailable', 'available', 'partially_available', 'unknown']);
    expect(result[1].evidence.parserVersion).toBe('hiratsuka-table-v3');
    expect(result[2].periods).toMatchObject([{ from: '15:00', to: '19:00' }]);
    expect(result[3].unknownReason).toBe('outside_published_period');
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
