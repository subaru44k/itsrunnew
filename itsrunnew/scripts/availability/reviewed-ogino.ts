import type { TrackAvailability } from '../../src/model/availability';
import type { AiPacket } from './ai-runtime';
import { makeRecord } from './collectors';

const landing = 'https://www.ogino-park.jp/?p=1007';
const schedule = new URL('https://ogino-park.jp/db/wp-content/uploads/2026/11/競技場予定表（11月-12月）_20261120.pdf').href;
const pdfHash = 'e2b55f38becdf7bcf6e8bfde9bf2ef0549714b128aa1b34aa515e21f15c0ce2f';
const yearEndDates = ['2026-12-29', '2026-12-30', '2026-12-31'];

export function reviewedOginoYearEnd(packet: AiPacket, now: Date) {
  const records = new Map<string, TrackAvailability>();
  if (packet.key !== 'ogino' || packet.trackId !== 'ogino-sports-park-track' || packet.landingPageUrl !== landing)
    return records;

  const documents = packet.sources.filter(source => source.kind === 'image' && /\.pdf$/i.test(source.url));
  if (documents.length !== 1 || documents[0].url !== schedule || documents[0].originalPdfHash !== pdfHash)
    return records;

  for (const date of yearEndDates.filter(date => packet.dates.includes(date))) {
    records.set(date, makeRecord({
      trackId: packet.trackId,
      date,
      now,
      status: 'partially_available',
      url: schedule,
      landingPageUrl: landing,
      publicationFormat: 'pdf',
      publishedAt: '2026-11-20',
      fetchedAt: now.toISOString(),
      sourceHash: `sha256:${pdfHash}`,
      collector: 'reviewed-ogino-year-end',
      parserVersion: 'reviewed-ogino-20261120',
      confidence: 'high',
      periods: [{
        from: '09:00',
        to: null,
        status: 'available',
        scope: 'full_track',
        eligibility: 'public',
        conditions: ['09:00〜日没まで', 'track_only', '備品の貸出なし'],
      }],
    }));
  }
  return records;
}
