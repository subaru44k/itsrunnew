import type { PdfParseResult } from './pdf';
import type { AvailabilityPeriod } from '../../src/model/availability';

export const nerimaReviewedPdfHash = 'sha256:b76afbae515b271ce8b99b477e8669f9825acb70a3d1a40f0700d8fc5f2a1e5f';
export const nerimaOctober16PdfHash = 'sha256:2bb147e1a314fe7517e8a33b3ab670470065c326f0105ebf93cdd07ffd9768f0';
export const nerimaOctober20PdfHash = 'sha256:635046cef4cf10eccc7d765c02b325a3e456abd41b815d4aa4362f7a94c5ddd1';
export const nerimaOctober23PdfHash = 'sha256:f1a4d6d0c0077c1581ef813fc72d3c65c83dba252af1a2e4ed8399cd1e1734c9';
export const nerimaOctober27PdfHash = 'sha256:ebc422b517fd3dc18f90a8672d85b15073fe77b1cfa2a51cdc46bbf4572a692f';
export const isReviewedNerimaPdf = (hash: string) => hash === nerimaReviewedPdfHash || hash === nerimaOctober16PdfHash || hash === nerimaOctober20PdfHash || hash === nerimaOctober23PdfHash || hash === nerimaOctober27PdfHash;
export const nerimaGuideUrl = 'https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/kakuninnhouhou_kaihoujoukyou.pdf';
export const nerimaReviewedGuideHash = 'sha256:464257780a924b091241d55a04d062addbb507d535316a043a14b0c2524a4ffb';

// Finite corrections for reviewed raster tables. No OCR inference or date extrapolation.
export function reviewedNerimaPdf(sourceHash: string, date: string): PdfParseResult | null {
  if (!isReviewedNerimaPdf(sourceHash)) return null;
  const october16 = sourceHash === nerimaOctober16PdfHash;
  const october20 = sourceHash === nerimaOctober20PdfHash;
  const october23 = sourceHash === nerimaOctober23PdfHash;
  const october27 = sourceHash === nerimaOctober27PdfHash;
  const publishedAt = october27 ? '2026-10-27' : october23 ? '2026-10-23' : october20 ? '2026-10-20' : october16 ? '2026-10-16' : '2026-10-13';
  const endDate = october27 ? '2026-11-02' : october23 ? '2026-10-29' : october20 ? '2026-10-26' : october16 ? '2026-10-22' : '2026-10-19';
  if (date < publishedAt || date > endDate) {
    return {
      status: 'unknown', periods: [], unknownReason: 'outside_published_period',
      publishedAt, warnings: ['直近1週間の公開範囲外'],
    };
  }
  const halfMorning = october27 || october23 ? date === '2026-10-28' : october20 || october16 ? date === '2026-10-21' : date === '2026-10-13';
  const halfNoon = (october20 || october16) && date === '2026-10-21';
  const greenNoon = october27 ? ['2026-10-27', '2026-10-28', '2026-10-29'].includes(date) : october23 ? ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'].includes(date) : october20 ? ['2026-10-20', '2026-10-22', '2026-10-26'].includes(date) : october16 ? date === '2026-10-22' : date === '2026-10-13';
  const fullTrack = october27 || october23 ? date === '2026-10-27' : october20 && date === '2026-10-20';
  const trackConditions = ['陸上トラック優先利用時間。ボール類の使用不可。'];
  const hasAvailability = fullTrack || halfMorning || halfNoon || greenNoon;
  const halfConditions = ['陸上競技場の半面のみ一般開放。団体利用区画には入れません。'];
  const closedConditions = ['団体貸切のため個人利用不可。'];
  const periods: AvailabilityPeriod[] = [
    {
      from: '09:00', to: '12:00', status: fullTrack || halfMorning ? 'available' : 'unavailable',
      scope: halfMorning ? 'lane_subset' : 'full_track', eligibility: 'public',
      conditions: fullTrack ? trackConditions : halfMorning ? halfConditions : closedConditions,
    },
    {
      from: '12:00', to: '15:00', status: halfNoon || greenNoon ? 'available' : 'unavailable',
      scope: halfNoon || greenNoon ? 'lane_subset' : 'full_track', eligibility: 'public',
      conditions: halfNoon ? halfConditions : greenNoon
        ? ['人工芝グラウンド優先。陸上トラック端の緑レーンのみジョギング・ウォーキング可。陸上競技の練習・幅跳びレーンは利用不可。']
        : closedConditions,
    },
    {
      from: '15:00', to: '17:00', status: fullTrack ? 'available' : 'unavailable', scope: 'full_track',
      eligibility: 'public', conditions: fullTrack ? trackConditions : closedConditions,
    },
    // The October 27 table and current facility hours both end at 17:00.
    // Keep the historical uncertainty only for the older reviewed packets.
    ...(!october27 ? [{
      from: '17:00', to: '18:00', status: 'unknown' as const, scope: 'unknown' as const, eligibility: 'unknown' as const,
      conditions: ['10月の施設案内は18時までですが、週間予定表は17時までの掲載です。この時間帯は公式情報をご確認ください。'],
    }] : []),
  ];
  return {
    status: hasAvailability ? 'partially_available' : october27 ? 'unavailable' : 'unknown', periods,
    unknownReason: hasAvailability || october27 ? undefined : 'insufficient_information',
    publishedAt, confidence: 'high',
    warnings: [
      '混雑状況により利用人数・利用時間の制限や予定変更があります。',
      ...(!october27 ? ['週間表と施設案内の終了時刻に差があるため、17時以降を利用不可と断定しません。'] : []),
    ],
  };
}
