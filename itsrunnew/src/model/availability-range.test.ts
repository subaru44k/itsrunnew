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
