import type { PdfParseResult } from './pdf';

const hashes = {
  first: 'sha256:156a991789278e4c4037f290ea955c842027ad24657ff567e53f33b5d808dfd3',
  second: 'sha256:106d9f078347467eb07af8863d4f3d1517e9fcedef323567a05e0878a8de9cb1',
};

/** Both A3 December originals and every cell/legend reviewed on 2026-11-01. */
export function reviewedWadaboriPdf(hash: string, date: string, facility: 'first' | 'second'): PdfParseResult | null {
  if (hash !== hashes[facility] || !/^2026-12-(?:0[1-9]|[12]\d|3[01])$/.test(date)) return null;
  const day = Number(date.slice(8));
  const holiday = day >= 29;
  const maintenance = (facility === 'first' ? [4, 11, 18, 25] : [7, 14, 21, 28]).includes(day);
  const dedicated = [5, 12, 13, 20, 26, 27].includes(day);
  const afternoon = facility === 'first' && [3, 10, 17, 24].includes(day);
  const closed = holiday || dedicated || (facility === 'second' && maintenance);
  const periods = [['09:00', '12:00'], ['13:00', '17:00']].map(([from, to], index) => {
    const blocked = closed || (facility === 'first' && maintenance && index === 0) || (afternoon && index === 1);
    return { from, to, status: blocked ? 'unavailable' as const : 'available' as const,
      scope: 'full_track' as const, eligibility: 'public' as const,
      conditions: [blocked ? holiday ? '年末年始休場' : maintenance ? '整備のため利用不可' : '団体貸切のため利用不可'
        : facility === 'second' && ![2, 6, 9, 16, 19, 23].includes(day) ? 'トラックのみ利用可能。フィールドは対象外。' : 'トラック・フィールドとも利用可能。'],
    };
  });
  return {
    status: periods.every(p => p.status === 'unavailable') ? 'unavailable' : periods.every(p => p.status === 'available') ? 'available' : 'partially_available',
    periods, confidence: 'high', publishedAt: '2026-10-25',
    warnings: [
      'PDF凡例が空欄を開放と明示', '夜間のご利用はお控えください。', '予定変更の可能性あり',
      ...(facility === 'second' ? ['空欄はトラックのみ利用可能。'] : []),
      ...(holiday ? ['12月29日〜1月3日は年末年始休み。1月の日別予定は別途確認してください。']
        : facility === 'second' && ([12, 13, 27].includes(day) || maintenance) ? ['12:00〜13:00も含め利用不可。'] : ['12:00〜13:00は判定対象外']),
    ],
  };
}
