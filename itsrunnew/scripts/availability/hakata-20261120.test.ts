import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, it, vi } from 'vitest';
import { collectAdditionalAvailability } from './additional';
import { digest } from './ai-runtime';
import { aiFacilities } from './ai-sources';

vi.mock('./ai-source-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ai-source-utils')>();
  return {
    ...actual,
    sourceInputs: (name: string, url: string, data: Buffer) => url.endsWith('.pdf')
      ? [1, 2].map(page => ({ name: `${name}-page-${page}.png`, url, kind: 'image', content: 'image', hash: digest('image') }))
      : actual.sourceInputs(name, url, data),
  };
});

const config = aiFacilities.find(facility => facility.key === 'hakata')!;
const guide = `${config.landing}guides/`;
const schedule = `${config.landing}images/park/261120131059121.pdf`;
const rules = `${config.landing}images/parknews/260512133125820.pdf`;
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const sources = new Map([
  [config.landing, gunzipSync(fixture('hakata-20261120.html.gz'))],
  [guide, gunzipSync(fixture('hakata-guide-20261120.html.gz'))],
  [schedule, fixture('hakata-20261120.pdf')],
  [rules, fixture('hakata-rules-20261102.pdf')],
]);
const dates = [
  ...[11, 12].flatMap(month => Array.from({length: month === 11 ? 30 : 31}, (_, index) => `2026-${month}-${String(index + 1).padStart(2, '0')}`)),
  '2027-01-01',
];
const now = new Date('2026-11-21T00:00:00Z');

async function collect(selectedDates: string[], changeUrl?: string) {
  const fetchImpl: typeof fetch = async input => {
    const url = String(input);
    const source = sources.get(url);
    if (!source) return new Response(null, {status: 404});
    const changed = url === guide
      ? Buffer.from(source.toString().replace('一般開放はいたしません', '一般開放します'))
      : Buffer.concat([source, Buffer.from('\n改版')]);
    const data = url === changeUrl ? changed : source;
    return new Response(new Uint8Array(data));
  };
  return (await collectAdditionalAvailability(selectedDates, { now, fetchImpl, apiKey: '' }))
    .filter(record => record.trackId === config.trackId);
}

it('reads both exact winter pages, preserving conflicting November dates and the reserve date as unknown', async () => {
  const november = ['X','9','13','9','9','15','?','?','9','9','9','9','?','?','?','9','9','9','9','9','?','?','9','9','9','9','9','14','X','9'];
  const december = ['9','9','9','9','13','9','X','X','9','9','9','X','15','9','9','9','9','9','X','X','9','9','9','9','13','12','?','9','X','X','X'];
  const expected = [...november, ...december, '-'];
  const records = await collect(dates);
  expect(records.map(record => record.date)).toEqual(dates);
  for (const [index, record] of records.entries()) {
    const mark = expected[index];
    const status = mark === 'X' ? 'unavailable' : mark === '9' ? 'available' : mark === '?' || mark === '-' ? 'unknown' : 'partially_available';
    expect(record.status, record.date).toBe(status);
    expect(record.unknownReason).toBe(mark === '?' ? 'insufficient_information' : mark === '-' ? 'outside_published_period' : null);
    if (status === 'available' || status === 'partially_available') {
      expect(record.source.url).toBe(schedule);
      expect(record.periods.map(period => [period.from, period.to])).toEqual([[`${mark.padStart(2, '0')}:00`, '17:00']]);
      expect(record.periods[0].conditions.join()).toContain('当日受付・支払い');
      if (status === 'partially_available') expect(record.periods[0].conditions.join()).toContain('大会終了後');
    } else {
      expect(record.periods).toEqual([]);
    }
  }
});

it.each([schedule, guide, rules])('rejects a changed official input at %s', async url => {
  const [record] = await collect(['2026-12-05'], url);
  expect(record).toMatchObject({status: 'unknown', unknownReason: 'source_changed', periods: []});
});
