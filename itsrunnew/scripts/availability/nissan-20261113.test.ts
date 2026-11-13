import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseNissanTrack } from './collectors';
const html = gunzipSync(readFileSync(new URL('./fixtures/nissan-20261113.html.gz', import.meta.url))).toString();
const now = new Date('2026-11-13T02:00:00Z');
const stadium = 'nissan-stadium-track';
const field = 'nissan-field-kozukue';
it('reads every reviewed November date from the correct venue table, with winter hours', () => {
  for (const id of [stadium, field] as const) for (let day = 1; day <= 30; day++) {
    const date = `2026-11-${String(day).padStart(2, '0')}`;
    const row = parseNissanTrack(html, { date, now }, id);
    const known = (id === stadium ? [9, 27] : [23, 28]).includes(day);
    expect(row.status, `${id} ${date}`).toBe(known ? 'partially_available' : 'unknown');
    expect(row.periods.map(p => [p.from, p.to])).toEqual(known ? [id === stadium ? ['17:00', '21:00'] : ['13:00', '16:00']] : []);
    if (known) {
      expect(row.warnings.join()).toContain('事前申し込み不要・当日受付');
      expect(row.warnings.join()).toContain('終了1時間前');
      expect(row.warnings.join()).toContain('先着200名');
      expect(row.warnings.join()).not.toMatch(/利用3日前|完全予約制|当日の参加はできません/);
      expect(row.warnings.join()).toContain(id === stadium ? '6〜9レーン' : '6〜8レーン');
    }
  }
});
it('never carries bare month/day into a different year or unpublished future month', () => {
  for (const date of ['2025-11-23', '2027-11-23', '2037-11-23', '2026-12-23', '2027-01-23']) {
    expect(parseNissanTrack(html, { date, now }, field)).toMatchObject({status:'unknown', periods:[]});
  }
});
it('stops changed tables, facility labels, times and conditions even with the former sourceHash', () => {
  for (const changed of [html.replace('23日(', '22日('), html.replaceAll('track_kozukue', 'changed_field').replaceAll('track_stadium', 'changed_stadium'), html.replace('13時-16時', '13時-17時'), html.replace('当日受付', '受付中止')]) {
    expect(parseNissanTrack(changed, {date:'2026-11-23', now, sourceHash:'sha256:225478a5a00d22f2aeba985add74d59d0adc556d3363c5c757d8cde8213e66f4'}, field)).toMatchObject({status:'unknown',unknownReason:'source_changed',periods:[]});
  }
});
