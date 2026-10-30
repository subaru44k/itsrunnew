import type { PdfParseResult } from './pdf';
import type { AvailabilityPeriod } from '../../src/model/availability';

// Official October/November originals, reviewed against every date, event and closing note.
// The landing page must still affirm that hours outside events are public.
export const kohnodaiOctoberHash = 'sha256:d7821db1027230dae579b01b7cb17ca9ee50a715b428e0897a554853be686058';
export const kohnodaiOctober26Hash = 'sha256:1f7b4efafa26c4f9d6cb0ba1701408d7d978b05e76705896737a730f9d8b65d9';
export const kohnodaiOctober30Hash = 'sha256:410adf2e83c2b32039ad648a85ad1d6368f7a5a30c1a2d781b900b0ee1a6015c';
export const kohnodaiNovemberReviewedHash = 'sha256:cb0da1895e9a30ad935d0ec56b7b9663baa501a114f4ebb482e801d286809a76';
const events: Record<number, Array<[string, string]>> = {
  1: [['14:00', '16:00']], 2: [['09:00', '15:00']],
  3: [['09:00', '12:00'], ['12:00', '17:00']], 4: [['09:00', '17:00']],
  5: [['09:00', '16:00']], 9: [['09:00', '16:00']],
  10: [['09:00', '12:00'], ['12:00', '17:00']], 11: [['09:00', '17:00']],
  12: [['09:00', '14:00'], ['14:00', '17:00']],
  17: [['09:00', '19:00']], 18: [['09:00', '19:00']],
  20: [['09:00', '15:00']], 21: [['09:00', '16:00']], 22: [['09:00', '16:00']],
  23: [['09:00', '13:00']], 24: [['09:00', '17:00']], 25: [['09:00', '17:00']],
  27: [['09:00', '13:00']], 30: [['09:00', '17:00']], 31: [['09:00', '17:00']],
};
export function reviewedKohnodaiPdf(hash: string, date: string): PdfParseResult | null {
  if (![kohnodaiOctoberHash, kohnodaiOctober26Hash, kohnodaiOctober30Hash, kohnodaiNovemberReviewedHash].includes(hash)) return null;
  const november = hash === kohnodaiNovemberReviewedHash;
  if (!(november ? /^2026-11-(?:0[1-9]|[12]\d|30)$/ : /^2026-10-(?:0[1-9]|[12]\d|3[01])$/).test(date))
    return { status: 'unknown', periods: [], unknownReason: 'outside_published_period' };
  const day = Number(date.slice(8));
  const slot = (from: string | null, to: string | null, status: AvailabilityPeriod['status']): AvailabilityPeriod => ({
    from, to, status, scope: 'full_track', eligibility: 'public',
    conditions: [status === 'unavailable' ? '大会・イベント中の個人利用はできません。' : '公式案内に基づき使用時間以外を一般開放。'],
  });
  if (day === (november ? 30 : 26)) return {
    status: 'unavailable', periods: [{ ...slot(null, null, 'unavailable'), conditions: ['公式予定表の休場日。'] }],
    confidence: 'high', warnings: ['公式予定は変更される場合があります。'],
  };
  const earlyClosing = november ? [2, 4, 9, 16, 18, 24] : [5, 13, 19];
  const end = earlyClosing.includes(day) ? '17:00' : '21:00';
  const periods: AvailabilityPeriod[] = [];
  let cursor = '09:00';
  // October 26 revision removes the 22nd/27th bookings and shortens
  // the 18th/25th. Never apply these cancellations to the older scan.
  const revisedEvents: Record<number, Array<[string, string]>> = {
    18: [['09:00', '17:00']], 22: [], 25: [['09:00', '13:00']], 27: [],
  };
  // The October 30 packet shortens the 30th booking to 16:00.
  const novemberEvents: Record<number, Array<[string, string]>> = {
    1: [['09:00', '17:00']], 3: [['09:00', '17:00']],
    5: [['09:00', '16:00']], 6: [['09:00', '16:00']],
    7: [['09:00', '17:00']], 8: [['09:00', '17:00']],
    14: [['09:00', '12:00'], ['12:00', '17:00']], 15: [['09:00', '17:00']],
    17: [['09:00', '17:00']], 18: [['09:00', '16:00']], 19: [['09:00', '16:00']],
    20: [['09:00', '17:00']], 21: [['09:00', '12:00']],
    22: [['09:00', '17:00']], 23: [['09:00', '17:00']],
    24: [['09:00', '15:00']], 25: [['09:00', '15:00']],
    28: [['09:00', '17:00']], 29: [['09:00', '17:00']],
  };
  const bookings = november ? novemberEvents[day]
    : hash === kohnodaiOctober30Hash && day === 30 ? [['09:00', '16:00']]
    : hash === kohnodaiOctober26Hash || hash === kohnodaiOctober30Hash ? revisedEvents[day] ?? events[day] : events[day];
  for (const [from, to] of bookings ?? []) {
    if (cursor < from) periods.push(slot(cursor, from, 'available'));
    periods.push(slot(from, to, 'unavailable'));
    cursor = to;
  }
  if (cursor < end) periods.push(slot(cursor, end, 'available'));
  return {
    status: periods.every(p => p.status === 'available') ? 'available' : 'partially_available',
    periods, confidence: 'high', warnings: ['公式予定は変更される場合があります。'],
  };
}
