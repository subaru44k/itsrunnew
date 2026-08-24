import { describe, expect, it, vi } from 'vitest';
import { addDateDays, createCachedFetch, dateKeys } from './range';

describe('availability range helpers', () => {
  it('builds an inclusive 31-day range across a month boundary', () => {
    const dates = dateKeys('2026-08-24', 31);
    expect(dates).toHaveLength(31);
    expect(dates[0]).toBe('2026-08-24');
    expect(dates.at(-1)).toBe('2026-09-23');
  });

  it('handles a year boundary without UTC date shifting', () => {
    expect(addDateDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(dateKeys('2026-12-30', 4)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });

  it('reuses identical source requests but keeps date-specific POST bodies separate', async () => {
    const underlying = vi.fn(async () => new Response('schedule', { status: 200, headers: { 'content-type': 'text/html' } }));
    const cached = createCachedFetch(underlying as typeof fetch);
    expect(await (await cached.fetch('https://example.test/monthly')).text()).toBe('schedule');
    expect(await (await cached.fetch('https://example.test/monthly')).text()).toBe('schedule');
    await cached.fetch('https://example.test/calendar', { method: 'POST', body: new URLSearchParams({ date: '2026-08-24' }) });
    await cached.fetch('https://example.test/calendar', { method: 'POST', body: new URLSearchParams({ date: '2026-08-25' }) });
    expect(underlying).toHaveBeenCalledTimes(3);
    expect(cached.stats).toEqual({ requests: 3, cacheHits: 1 });
  });
});
