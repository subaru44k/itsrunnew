import type { PdfParseResult } from './pdf';

export const kamiyugiClosureUrl = 'https://kamiyugi-park.jp/wp/wp-content/uploads/2026/10/2ed3e2579058a0ccecb8392ae2fff84f-4.pdf';
export const kamiyugiClosureHash = 'sha256:98187ee6335192e6a005a6397dad0d4e87b072fd145a7b97e67ab20c9a5f962a';
export const kamiyugiNovemberClosureUrl = 'https://kamiyugi-park.jp/wp/wp-content/uploads/2026/11/2ed3e2579058a0ccecb8392ae2fff84f.pdf';
export const kamiyugiNovemberClosureHash = 'sha256:ecd62c7be2a1ba469fe7f1c47fc17aaad419f125953440af7cee1ff92f8c8bd5';
export const inKamiyugiClosure = (date: string) => {
  if (!/^(?:2026-(?:11|12)|2027-(?:01|02))-\d{2}$/.test(date) || date < '2026-11-02' || date > '2027-02-28') return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
};

// The reviewed PDF overlays an explicit, year-bearing closure notice on the
// monthly grid. Dashes alone remain unknown; reopening is never inferred.
export function reviewedKamiyugiPdf(hash: string, date: string): PdfParseResult | null {
  if (![kamiyugiClosureHash, kamiyugiNovemberClosureHash].includes(hash) || !inKamiyugiClosure(date)) return null;
  return {
    status: 'unavailable',
    periods: [{ from: null, to: null, status: 'unavailable', scope: 'full_track', eligibility: 'public', conditions: ['2026年11月2日〜2027年2月28日（予定）は第二種公認陸上競技場の公認更新工事のため休場。'] }],
    publishedAt: hash === kamiyugiNovemberClosureHash ? '2026-11-09' : '2026-10-23', confidence: 'high',
    warnings: ['工事期間は予定です。再開日や最新の利用状況は公式情報をご確認ください。'],
  };
}
