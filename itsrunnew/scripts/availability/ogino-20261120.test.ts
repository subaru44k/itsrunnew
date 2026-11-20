import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { collectAdditionalAvailability } from './additional';
import { digest, readWithLuna } from './ai-runtime';
import { aiFacilities } from './ai-sources';

vi.mock('./ai-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ai-runtime')>()),
  readWithLuna: vi.fn(),
}));

// The fixture exercises official link selection and raw PDF verification.
// Rasterization itself is covered by the production collector.
vi.mock('./ai-source-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ai-source-utils')>();
  return {
    ...actual,
    sourceInputs: async (name: string, url: string, data: Buffer) =>
      url.endsWith('.pdf')
        ? [{ name, url, kind: 'image', content: 'rendered-page', hash: digest('rendered-page') }]
        : actual.sourceInputs(name, url, data),
  };
});

const config = aiFacilities.find(facility => facility.key === 'ogino')!;
const landing = gunzipSync(readFileSync(new URL('./fixtures/ogino-20261120-landing.html.gz', import.meta.url)));
const schedule = new URL('https://ogino-park.jp/db/wp-content/uploads/2026/11/競技場予定表（11月-12月）_20261120.pdf').href;
const pdf = readFileSync(new URL('./fixtures/ogino-20261120.pdf', import.meta.url));
const specialDates = ['2026-12-29', '2026-12-30', '2026-12-31'];
const dates = ['2026-12-28', ...specialDates, '2027-01-01'];
const now = new Date('2026-12-28T00:00:00Z');

async function collect(document = pdf) {
  const fetchImpl: typeof fetch = async url => {
    if (String(url) === config.landing) return new Response(new Uint8Array(landing));
    if (String(url) === schedule) return new Response(new Uint8Array(document));
    return new Response(null, { status: 404 });
  };
  return (await collectAdditionalAvailability(dates, { now, fetchImpl })).filter(record => record.trackId === config.trackId);
}

describe('荻野の確認済み年末特別開場', () => {
  it('keeps all three sunset periods and sends only the other dates to Luna', async () => {
    const read = vi.mocked(readWithLuna);
    read.mockReset().mockResolvedValue({
      key: 'ordinary-schedule',
      cacheHit: false,
      usage: null,
      rows: new Map([['2026-12-28', {
        id: 'ogino-2026-12-28', date: '2026-12-28', status: 'unavailable',
        periods: [], conditions: ['休場日'], evidence: [], unknown_reason: null,
      }]]),
    });

    const records = await collect();
    expect(records.map(record => record.date)).toEqual(dates);
    expect(records.map(record => record.status)).toEqual([
      'unavailable', 'partially_available', 'partially_available', 'partially_available', 'unknown',
    ]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0][0].dates).toHaveLength(59);
    for (const record of records.slice(1, 4)) {
      expect(read.mock.calls[0][0].dates).not.toContain(record.date);
      expect(record.periods).toEqual([{
        from: '09:00', to: null, status: 'available', scope: 'full_track', eligibility: 'public',
        conditions: ['09:00〜日没まで', 'track_only', '備品の貸出なし'],
      }]);
      expect(record.source).toMatchObject({ url: schedule, publishedAt: '2026-11-20' });
      expect(record.evidence.sourceHash).toBe(`sha256:${digest(pdf)}`);
    }
  });

  it('keeps the verified dates through a reading failure and rejects changed PDF bytes at the same URL', async () => {
    const read = vi.mocked(readWithLuna);
    read.mockReset().mockRejectedValue(new Error('AI request failed'));

    const records = await collect();
    expect(records.filter(record => record.status === 'partially_available').map(record => record.date)).toEqual(specialDates);

    const changed = await collect(Buffer.concat([pdf, Buffer.from('\n% revised')]));
    expect(changed.every(record => record.status === 'unknown')).toBe(true);
    expect(read.mock.calls[1][0].dates).toEqual(expect.arrayContaining(specialDates));
  });
});
