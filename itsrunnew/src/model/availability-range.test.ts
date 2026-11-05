import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDateOnlyDays, availabilityManifest, loadAvailabilityDate, loadAvailabilityManifest, nextWeekdayDate, normalizeSelectedDate, type AvailabilityManifest } from './availability-range';

afterEach(() => vi.unstubAllGlobals());

const manifest: AvailabilityManifest = {
  schemaVersion: 1,
  timezone: 'Asia/Tokyo',
  generatedAt: '2026-08-24T00:00:00.000Z',
  startDate: '2026-08-24',
  endDate: '2026-09-23',
  dates: ['2026-08-24', '2026-08-25', '2026-08-29', '2026-08-30', '2026-09-23'],
};

describe('availability date selection', () => {
  it('defaults invalid and out-of-range values to today', () => {
    expect(normalizeSelectedDate(undefined, '2026-08-24', manifest)).toBe('2026-08-24');
    expect(normalizeSelectedDate('invalid', '2026-08-24', manifest)).toBe('2026-08-24');
    expect(normalizeSelectedDate('2026-10-01', '2026-08-24', manifest)).toBe('2026-08-24');
  });

  it('keeps a valid generated future date and handles Japan date-only arithmetic', () => {
    expect(normalizeSelectedDate('2026-08-29', '2026-08-24', manifest)).toBe('2026-08-29');
    expect(addDateOnlyDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('uses today for a same-day weekend shortcut and otherwise the next occurrence', () => {
    expect(nextWeekdayDate('2026-08-29', 6)).toBe('2026-08-29');
    expect(nextWeekdayDate('2026-08-24', 6)).toBe('2026-08-29');
    expect(nextWeekdayDate('2026-08-24', 0)).toBe('2026-08-30');
  });

  it('loads the published manifest and date JSON from stable URLs', async () => {
    const dates = Array.from({ length: 31 }, (_, index) => addDateOnlyDays('2026-09-24', index));
    const published = { ...manifest, startDate: dates[0], endDate: dates.at(-1), dates };
    const dataset = { schemaVersion: 1, date: dates[0], timezone: 'Asia/Tokyo', generatedAt: published.generatedAt, facilities: [] };
    const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('manifest.json') ? published : dataset }));
    vi.stubGlobal('fetch', fetchMock);
    await loadAvailabilityManifest();
    expect(availabilityManifest.startDate).toBe('2026-09-24');
    expect(await loadAvailabilityDate(dates[0])).toEqual(dataset);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/availability/manifest.json', '/availability/2026-09-24.json']);
  });

  it('shares an in-flight date request and reuses it until a new manifest generation arrives', async () => {
    const dates = Array.from({ length: 31 }, (_, index) => addDateOnlyDays('2026-10-01', index));
    let generation = '2026-10-01T00:00:00Z';
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.endsWith('manifest.json')
        ? { ...manifest, generatedAt: generation, startDate: dates[0], endDate: dates.at(-1), dates }
        : { schemaVersion: 1, date: dates[0], timezone: 'Asia/Tokyo', generatedAt: generation, facilities: [] },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await loadAvailabilityManifest();
    const [first, second] = await Promise.all([loadAvailabilityDate(dates[0]), loadAvailabilityDate(dates[0])]);
    expect(first).toBe(second);
    expect(await loadAvailabilityDate(dates[0])).toBe(first);
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith(`${dates[0]}.json`))).toHaveLength(1);

    generation = '2026-10-01T01:00:00Z';
    await loadAvailabilityManifest();
    expect((await loadAvailabilityDate(dates[0])).generatedAt).toBe(generation);
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith(`${dates[0]}.json`))).toHaveLength(2);
  });

  it('accepts a newer deployed date file and refreshes an older manifest', async () => {
    const dates = Array.from({ length: 31 }, (_, index) => addDateOnlyDays('2026-11-01', index));
    const oldGeneration = '2026-11-01T00:00:00Z';
    const newGeneration = '2026-11-01T01:00:00Z';
    let manifestGeneration = oldGeneration;
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.endsWith('manifest.json')
        ? { ...manifest, generatedAt: manifestGeneration, startDate: dates[0], endDate: dates.at(-1), dates }
        : { schemaVersion: 1, date: dates[0], timezone: 'Asia/Tokyo', generatedAt: newGeneration, facilities: [] },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await loadAvailabilityManifest();
    manifestGeneration = newGeneration;
    expect((await loadAvailabilityDate(dates[0])).generatedAt).toBe(newGeneration);
    await vi.waitFor(() => expect(availabilityManifest.generatedAt).toBe(newGeneration));
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith(`${dates[0]}.json`))).toHaveLength(1);
  });
});

describe('generation publication loading', () => {
  async function setup(generation = 'a'.repeat(24)) {
    vi.resetModules();
    const range = await import('./availability-range');
    const { unknownAvailability } = await import('./availability');
    const dates = Array.from({ length: 31 }, (_, index) => addDateOnlyDays('2026-11-05', index));
    const published = { ...manifest, partitionVersion: 1, generation, startDate: dates[0], endDate: dates.at(-1), dates };
    const records = dates.map(date => unknownAvailability('track-a', date, 'phone_confirmation_required'));
    const bundle = { schemaVersion: 1, timezone: 'Asia/Tokyo', generatedAt: published.generatedAt, generation, trackId: 'track-a', dates, records };
    const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => url === '/availability/manifest.json' ? published : url.includes('/tracks/') ? bundle : {
      schemaVersion: 1, timezone: 'Asia/Tokyo', generatedAt: published.generatedAt, generation: published.generation, date: dates[0], facilities: [records[0]],
    } }));
    vi.stubGlobal('fetch', fetchMock);
    await range.loadAvailabilityManifest();
    return { range, published, bundle, fetchMock, dates };
  }

  it('loads detail in one request and shares the immutable facility bundle', async () => {
    const { range, bundle, fetchMock, dates, published } = await setup();
    const results = await Promise.all([range.loadAvailabilityTrack('track-a'), range.loadAvailabilityTrack('track-a')]);
    expect(results[0]).toBe(results[1]);
    expect(results[0]).toEqual(bundle);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/availability/manifest.json', `/availability/generations/${published.generation}/tracks/track-a.json`,
    ]);
    await range.loadAvailabilityDate(dates[0]);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(`/availability/generations/${published.generation}/dates/${dates[0]}.json`);
  });

  it.each(['generation', 'trackId', 'dates', 'record'])('fails closed for a mismatched facility %s and permits retry', async fault => {
    const { range, bundle, fetchMock } = await setup();
    const original = structuredClone(bundle);
    if (fault === 'generation') bundle.generation = 'b'.repeat(24);
    if (fault === 'trackId') bundle.trackId = 'other';
    if (fault === 'dates') bundle.dates = [];
    if (fault === 'record') bundle.records[0].date = bundle.dates[1];
    await expect(range.loadAvailabilityTrack('track-a')).rejects.toThrow('Invalid published');
    Object.assign(bundle, original);
    expect(await range.loadAvailabilityTrack('track-a')).toEqual(original);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not reuse a previous generation even when generatedAt is unchanged', async () => {
    const { range, bundle, published, fetchMock } = await setup();
    await range.loadAvailabilityTrack('track-a');
    bundle.generation = published.generation = 'b'.repeat(24);
    await range.loadAvailabilityManifest();
    await range.loadAvailabilityTrack('track-a');
    expect(fetchMock.mock.calls.filter(([url]) => url.includes('/tracks/'))).toHaveLength(2);
  });

  it('clears optional generation when a legacy manifest is restored', async () => {
    const { range, published } = await setup();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ...published, generation: undefined, partitionVersion: undefined }) })));
    await range.loadAvailabilityManifest();
    expect(range.availabilityManifest.generation).toBeUndefined();
    expect(() => range.loadAvailabilityTrack('track-a')).toThrow('unavailable');
  });

  it('rejects an old facility response after the public pointer changes', async () => {
    const { range, bundle } = await setup();
    let release!: () => void;
    vi.stubGlobal('fetch', vi.fn(async () => { await new Promise<void>(resolve => { release = resolve; }); return { ok: true, json: async () => bundle }; }));
    const request = range.loadAvailabilityTrack('track-a');
    range.availabilityManifest.generation = 'c'.repeat(24);
    release();
    await expect(request).rejects.toThrow('changed while loading');
  });
});
