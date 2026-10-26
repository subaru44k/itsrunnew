import type { PdfParseResult } from './pdf';
import type { AvailabilityPeriod } from '../../src/model/availability';

// Official October scan, reviewed against every date, event and closing note.
// The landing page must still affirm that hours outside events are public.
export const kohnodaiOctoberHash = 'sha256:d7821db1027230dae579b01b7cb17ca9ee50a715b428e0897a554853be686058';
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
  if (hash !== kohnodaiOctoberHash) return null;
  if (!/^2026-10-(?:0[1-9]|[12]\d|3[01])$/.test(date))
    return { status: 'unknown', periods: [], unknownReason: 'outside_published_period' };
  const day = Number(date.slice(8));
  const slot = (from: string | null, to: string | null, status: AvailabilityPeriod['status']): AvailabilityPeriod => ({
    from, to, status, scope: 'full_track', eligibility: 'public',
    conditions: [status === 'unavailable' ? '大会・イベント中の個人利用はできません。' : '公式案内に基づき使用時間以外を一般開放。'],
  });
  if (day === 26) return {
    status: 'unavailable', periods: [{ ...slot(null, null, 'unavailable'), conditions: ['公式予定表の休場日。'] }],
    confidence: 'high', warnings: ['公式予定は変更される場合があります。'],
  };
  const end = [5, 13, 19].includes(day) ? '17:00' : '21:00';
  const periods: AvailabilityPeriod[] = [];
  let cursor = '09:00';
  for (const [from, to] of events[day] ?? []) {
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
