import type { PdfParseResult } from './pdf';
import type { AvailabilityPeriod } from '../../src/model/availability';

export const nerimaReviewedPdfHash = 'sha256:b76afbae515b271ce8b99b477e8669f9825acb70a3d1a40f0700d8fc5f2a1e5f';
export const nerimaGuideUrl = 'https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/kakuninnhouhou_kaihoujoukyou.pdf';
export const nerimaReviewedGuideHash = 'sha256:464257780a924b091241d55a04d062addbb507d535316a043a14b0c2524a4ffb';

// Finite correction for the reviewed raster table. No OCR inference or date extrapolation.
export function reviewedNerimaPdf(sourceHash: string, date: string): PdfParseResult | null {
  if (sourceHash !== nerimaReviewedPdfHash) return null;
  if (date < '2026-10-13' || date > '2026-10-19')
    return {status: 'unknown', periods: [], unknownReason: 'outside_published_period', publishedAt: '2026-10-13', warnings: ['直近1週間の公開範囲外']};
  const first = date === '2026-10-13';
  const periods: AvailabilityPeriod[] = [
    {from:'09:00',to:'12:00',status:first?'available':'unavailable',scope:first?'lane_subset':'full_track',eligibility:'public',conditions:first?['陸上競技場の半面のみ一般開放。団体利用区画には入れません。']:['団体貸切のため個人利用不可。']},
    {from:'12:00',to:'15:00',status:first?'available':'unavailable',scope:first?'lane_subset':'full_track',eligibility:'public',conditions:first?['人工芝グラウンド優先。陸上トラック端の緑レーンのみジョギング・ウォーキング可。陸上競技の練習・幅跳びレーンは利用不可。']:['団体貸切のため個人利用不可。']},
    {from:'15:00',to:'17:00',status:'unavailable',scope:'full_track',eligibility:'public',conditions:['団体貸切のため個人利用不可。']},
    {from:'17:00',to:'18:00',status:'unknown',scope:'unknown',eligibility:'unknown',conditions:['10月の施設案内は18時までですが、週間予定表は17時までの掲載です。この時間帯は公式情報をご確認ください。']},
  ];
  return {status:first?'partially_available':'unknown',periods,unknownReason:first?undefined:'insufficient_information',publishedAt:'2026-10-13',confidence:'high',warnings:['混雑状況により利用人数・利用時間の制限や予定変更があります。','週間表と施設案内の終了時刻に差があるため、17時以降を利用不可と断定しません。']};
}
