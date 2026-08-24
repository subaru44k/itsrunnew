import { describe, expect, it } from 'vitest';
import { addDateOnlyDays, nextWeekdayDate, normalizeSelectedDate, type AvailabilityManifest } from './availability-range';

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
});
