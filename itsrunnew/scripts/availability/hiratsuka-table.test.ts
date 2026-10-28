import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { buildAiPacket, aiFacilities } from './ai-sources';
import { htmlText } from './ai-source-utils';
import { digest, type AiPacket } from './ai-runtime';
import { readHiratsukaTable } from './hiratsuka-table';
import { collectAdditionalAvailability } from './additional';
const config = aiFacilities.find(c => c.key === 'hiratsuka')!;
const dates = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
const now = new Date('2026-10-28T02:00:00Z');
const html = await readFile(new URL('./fixtures/hiratsuka-20261028.html', import.meta.url), 'utf8');
const fetchImpl = (async (input: string | URL | Request) => String(input) === config.landing ? new Response(html) : new Response('', { status: 503 })) as typeof fetch;
const packet = await buildAiPacket(config, dates, now, fetchImpl);
function changed(content: string): AiPacket {
  return { ...packet, sources: [{ ...packet.sources[0], content, hash: digest(content) }] };
}
describe('Hiratsuka explicit official rolling HTML table', () => {
  it('reads the first row, every cross-month date, reserves and Friday hours from the actual source', () => {
    const rows = readHiratsukaTable(packet)!.rows;
    const expected = [
      ['2026-10-28', 'partially_available', [['08:00', '12:00']]],
      ['2026-10-29', 'unavailable', []],
      ['2026-10-30', 'available', [['08:00', '12:00'], ['12:00', '13:00'], ['13:00', '20:00']]],
      ['2026-10-31', 'unavailable', []], ['2026-11-01', 'unavailable', []],
      ['2026-11-02', 'partially_available', [['13:00', '19:00']]],
      ['2026-11-03', 'unavailable', []],
      ['2026-11-04', 'available', [['08:00', '12:00'], ['12:00', '13:00'], ['13:00', '19:00']]],
      ['2026-11-05', 'available', [['08:00', '12:00'], ['12:00', '13:00'], ['13:00', '19:00']]],
      ['2026-11-06', 'available', [['08:00', '12:00'], ['12:00', '13:00'], ['13:00', '20:00']]],
    ];
    for (const [date, status, times] of expected) {
      const row = rows.get(String(date))!;
      expect(row.status).toBe(status); expect(row.periods.map(p => [p.start, p.end])).toEqual(times);
    }
    expect(rows.get('2026-11-02')!.conditions.join()).toContain('予備日の時間帯は利用可否未定');
    expect(rows.get('2026-11-04')!.conditions.join()).toContain('スパイク・器具貸出');
    expect(rows.get('2026-10-27')!.unknown_reason).toBe('outside_published_period');
    expect(rows.get('2026-11-07')!.unknown_reason).toBe('outside_published_period');
  });
  it('rejects wrong identity, inconsistent dates, missing slots, new symbols and changed rules', () => {
    const text = packet.sources[0].content;
    for (const content of [
      text.replace('2026年10月28日', '2025年10月28日'),
      text.replace('10月/11月', '10月/12月'),
      text.replace('28日(水曜日)', '28日(木曜日)'),
      text.replace('29日(木曜日)', '30日(金曜日)'),
      text.replace('可\n不可\n不可', '可\n不可'),
      text.replace('可\n不可\n不可', '△\n不可\n不可'),
      text.replace('8時～12時', '9時～12時'),
      text.replace('金曜日は20時まで', '金曜日は21時まで'),
      text.replace('共用利用には、以下の事務所で申請手続きが必要です。', '変更'),
      text.replace('ご利用できます。', '利用可否は未定です。'),
      text.replace('利用の可否については、当日お問い合わせください。', '変更'),
      text.replace('スパイクの使用、器具の貸出、シャワー・ロッカー・更衣室の利用はできません。', '変更'),
    ]) expect(readHiratsukaTable(changed(content))).toBeNull();
    expect(readHiratsukaTable({ ...packet, trackId: 'other' })).toBeNull();
    expect(readHiratsukaTable({ ...packet, sources: [{ ...packet.sources[0], hash: 'changed' }] })).toBeNull();
    expect(htmlText(html)).toBe(packet.sources[0].content);
  });
  it('resolves December–January from the publication year and checks every weekday', () => {
    let text = packet.sources[0].content.replace('2026年10月28日', '2026年12月28日').replace('10月/11月', '12月/1月');
    const newDates: string[] = [];
    let index = 0;
    text = text.replace(/\d{1,2}日\([日月火水木金土]曜日\)/g, () => {
      const date = new Date(Date.UTC(2026, 11, 28 + index++));
      newDates.push(date.toISOString().slice(0, 10));
      return `${date.getUTCDate()}日(${'日月火水木金土'[date.getUTCDay()]}曜日)`;
    });
    const result = readHiratsukaTable({ ...changed(text), dates: newDates })!;
    expect(result.rows.get('2027-01-02')).toMatchObject({ status: 'partially_available', periods: [{ start: '13:00', end: '19:00' }] });
    expect(result.rows.get('2027-01-01')!.status).toBe('unavailable');
    expect(result.rows.size).toBe(10);
  });
  it('keeps an entirely reserved day unknown and a fully unavailable day known', () => {
    const text = packet.sources[0].content.replace('28日(水曜日)\n可\n不可\n不可', '28日(水曜日)\n予備日\n予備日\n予備日');
    const rows = readHiratsukaTable(changed(text))!.rows;
    expect(rows.get('2026-10-28')).toMatchObject({ status: 'unknown', periods: [], unknown_reason: 'insufficient_information' });
    expect(rows.get('2026-10-29')!.status).toBe('unavailable');
  });
  it('publishes direct official results without an API key, and never falls back to AI for changed tables', async () => {
    const apiFetch = vi.fn(async () => { throw new Error('Hiratsuka must not use AI'); });
    for (const changedSource of [false, true]) {
      const sourceFetch = (async (input: string | URL | Request) => String(input) === config.landing
        ? new Response(changedSource ? html.replace('28日(水曜日)', '28日(木曜日)') : html)
        : new Response('', { status: 503 })) as typeof fetch;
      const result = (await collectAdditionalAvailability(['2026-10-28', '2026-11-02'], { now, fetchImpl: sourceFetch, apiFetchImpl: apiFetch as typeof fetch, apiKey: '' })).filter(r => r.trackId === config.trackId);
      expect(result.map(r => r.status)).toEqual(changedSource ? ['unknown', 'unknown'] : ['partially_available', 'partially_available']);
      expect(result.every(r => r.evidence.collector === 'hiratsuka-official-table')).toBe(true);
      if (changedSource) expect(result.every(r => r.unknownReason === 'source_changed')).toBe(true);
    }
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
