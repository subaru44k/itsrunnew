import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { assertOfficialPageAvailable } from './source-availability';
import { parseTokyoGymnasium, parseKomazawa, collectAvailability } from './collectors';
import { officialFetch } from './ai-source-utils';
import { collectAdditionalAvailability } from './additional';

const now = new Date('2026-10-23T05:13:29Z');
const tef = readFileSync(new URL('./fixtures/tef-maintenance-20261023.html', import.meta.url), 'utf8');
const ishin = readFileSync(new URL('./fixtures/ishin-maintenance-20261023.html', import.meta.url), 'utf8');

describe('official website outages', () => {
  it('rejects HTTP-200 outage pages before treating missing dates as unpublished', async () => {
    for (const date of ['2026-10-23', '2026-11-22']) {
      for (const parse of [parseTokyoGymnasium, parseKomazawa])
        expect(() => parse(tef, { date, now })).toThrow(/maintenance page/);
    }
    const records = await collectAvailability('2026-10-23', { now, fetchImpl: (async () => new Response(tef)) as typeof fetch });
    for (const id of ['tokyo-metropolitan-gymnasium-track', 'komazawa-olympic-park-track'])
      expect(records.find(r => r.trackId === id)).toMatchObject({ status: 'unknown', unknownReason: 'fetch_failed', periods: [] });
  });

  it('keeps AI source HTTP errors and maintenance separate from extraction failures, without inference', async () => {
    await expect(officialFetch('https://www.ishin100.com/main/', ['www.ishin100.com'], (async () => new Response(ishin)) as typeof fetch))
      .rejects.toThrow(/maintenance page/);
    for (const response of [() => new Response(ishin), () => new Response('Service unavailable', { status: 503 })]) {
      const apiFetch = vi.fn();
      const records = await collectAdditionalAvailability(['2026-10-23'], { now, fetchImpl: (async () => response()) as typeof fetch, apiFetchImpl: apiFetch });
      expect(records.find(r => r.trackId === 'ishin-centennial-park-auxiliary-stadium'))
        .toMatchObject({ status: 'unknown', unknownReason: 'fetch_failed', periods: [] });
      expect(apiFetch).not.toHaveBeenCalled();
    }
  });

  it('allows ordinary schedule headings and maintenance notices within a working schedule', () => {
    expect(() => assertOfficialPageAvailable('<title>一般開放状況</title><h1>陸上競技場</h1><p>設備メンテナンス中の時間は利用不可</p>')).not.toThrow();
    expect(() => assertOfficialPageAvailable('<h1>10月の設備メンテナンス予定</h1>')).not.toThrow();
  });
});
