import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseNissanTrack } from './collectors';

const html = gunzipSync(readFileSync(new URL('./fixtures/nissan-20261121.html.gz', import.meta.url))).toString();
const now = new Date('2026-11-21T00:00:00Z');
const stadium = 'nissan-stadium-track';
const field = 'nissan-field-kozukue';
const expected = {
  [stadium]: {
    '2026-11-09': [['17:00', '21:00']],
    '2026-11-27': [['17:00', '21:00']],
    '2026-12-04': [['17:00', '21:00']],
    '2026-12-07': [['17:00', '21:00']],
    '2026-12-14': [['17:00', '21:00']],
    '2026-12-28': [['17:00', '21:00']],
  },
  [field]: {
    '2026-11-23': [['13:00', '16:00']],
    '2026-11-28': [['13:00', '16:00']],
    '2026-12-12': [['09:00', '12:00'], ['13:00', '16:00']],
    '2026-12-19': [['13:00', '16:00']],
    '2026-12-26': [['09:00', '12:00'], ['13:00', '16:00']],
  },
} satisfies Record<string, Record<string, string[][]>>;

it('matches both venue tables, preserving two separate winter sessions and admission rules', () => {
  for (const trackId of [stadium, field] as const) {
    const slots: Record<string, string[][]> = expected[trackId];
    for (const month of [11, 12]) {
      for (let day = 1; day <= (month === 11 ? 30 : 31); day++) {
        const date = `2026-${month}-${String(day).padStart(2, '0')}`;
        const record = parseNissanTrack(html, { date, now }, trackId);
        expect(record.status, `${trackId} ${date}`).toBe(slots[date] ? 'partially_available' : 'unknown');
        expect(record.periods.map(period => [period.from, period.to])).toEqual(slots[date] ?? []);
        if (slots[date]) {
          expect(record.warnings.join()).toContain('事前申し込み不要・当日受付');
          expect(record.warnings.join()).toContain('終了1時間前');
          expect(record.warnings.join()).toContain(trackId === stadium ? '6〜9レーン' : '6〜8レーン');
        }
      }
    }
  }
});

it('keeps January and other years unknown and rejects changed tables or admission rules', () => {
  for (const date of ['2025-12-12', '2027-01-12', '2027-12-12'])
    expect(parseNissanTrack(html, { date, now }, field)).toMatchObject({ status: 'unknown', unknownReason: 'outside_published_period', periods: [] });
  for (const altered of [html.replace('28日(月)', '29日(火)'), html.replace('13時-16時', '13時-17時'), html.replace('当日受付', '受付中止')]) {
    expect(parseNissanTrack(altered, {date: '2026-12-12', now}, field)).toMatchObject({status: 'unknown', unknownReason: 'source_changed', periods: []});
  }
});
