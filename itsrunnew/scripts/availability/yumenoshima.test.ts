import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collectAvailability, parseYumenoshima } from './collectors';
import { sourceUrls } from './config';
const html = readFileSync(new URL('./fixtures/yumenoshima-two-week.html', import.meta.url), 'utf8');
const now = new Date('2026-10-25T03:00:00Z');
const parse = (date: string, text = html) => parseYumenoshima(text, { date, now });
describe('Yumenoshima official two-week schedule', () => {
  it('expands merged cells and distinguishes full, partial and closed days', () => {
    expect(parse('2026-10-28').status).toBe('available');
    expect(parse('2026-10-25').status).toBe('unavailable');
    expect(parse('2026-10-26').status).toBe('unavailable');
    expect(parse('2026-10-27')).toMatchObject({ status: 'partially_available', periods: [
      { from: '09:00', to: '13:00', status: 'available' },
      { from: '13:00', to: '17:00', status: 'unavailable' },
      { from: '17:00', to: '21:00', status: 'available' },
    ] });
    expect(parse('2026-10-29').periods.map(p => p.status)).toEqual(['unavailable', 'unavailable', 'available']);
  });
  it('keeps special events and unpublished dates unknown', () => {
    expect(parse('2026-11-03')).toMatchObject({ status: 'unknown', unknownReason: 'insufficient_information' });
    expect(parse('2026-11-07')).toMatchObject({ status: 'unknown', unknownReason: 'outside_published_period' });
    expect(parseYumenoshima(html, { date: '2026-11-07', now: new Date('2026-11-07T03:00:00Z') })).toMatchObject({ status: 'unknown', unknownReason: 'source_stale' });
  });
  it('validates table structure, duplicate dates and weekdays', () => {
    for (const broken of [html.replace('colspan="3"', 'colspan="4"'), html.replace('10/25(日)', '10/24(土)'), html.replace('10/25(日)', '10/25(月)'), html.replace('9:00-13:00', '8:00-13:00'), html.replace('colspan="3"', 'rowspan="2"'), html + html]) {
      expect(() => parse('2026-10-25', broken)).toThrow();
    }
  });
  it('resolves year rollover from collection date and validates calendar dates', () => {
    const table = '<h3>夢の島競技場</h3><table class="schedule-order__table"><tr><td></td><td>9:00-13:00</td><td>13:00-17:00</td><td>17:00-21:00</td></tr><tr><td>12/31(木)</td><td colspan="3">個人</td></tr><tr><td>1/1(金)</td><td colspan="3">休場日</td></tr></table>';
    expect(parseYumenoshima(table, { date: '2027-01-01', now: new Date('2026-12-31T03:00:00Z') }).status).toBe('unavailable');
    expect(parseYumenoshima(table, { date: '2027-01-01', now: new Date('2027-01-01T03:00:00Z') }).status).toBe('unavailable');
  });
  it('integrates one source record with provenance and handles fetch/parse failure', async () => {
    for (const mode of ['ok', 'network', 'broken']) {
      const fetchImpl = (async (url: string | URL | Request) => {
        if (String(url) === sourceUrls.yumenoshima) {
          if (mode === 'network') throw new TypeError('network unavailable');
          return new Response(mode === 'ok' ? html : '<p>missing schedule</p>');
        }
        throw new TypeError('unrelated source');
      }) as typeof fetch;
      const rows = (await collectAvailability('2026-10-27', { now, fetchImpl })).filter(r => r.trackId === 'koto-yumenoshima-athletic-stadium');
      expect(rows).toHaveLength(1);
      expect(rows[0].source.url).toBe(sourceUrls.yumenoshima);
      if (mode === 'ok') {
        expect(rows[0].status).toBe('partially_available');
        expect(rows[0].evidence.sourceHash).toMatch(/^sha256:/);
        expect(rows[0].freshness.fetchedAt).toBe(now.toISOString());
      } else expect(rows[0].unknownReason).toBe(mode === 'network' ? 'fetch_failed' : 'parse_failed');
    }
  });
});
