import { digest, type AiPacket, type AiRow } from './ai-runtime';

// Human-reviewed October and November 2026 tables and general-use guide.
// The homepage discovers the current PDF; only the schedule and usage sources
// are review inputs. Unrelated homepage news must not invalidate this reading.
// Source changes disable this finite correction; never extrapolate to a new month.
export const hakataReviewedSourceHash =
  '2581cddafdae7bca4b993962382fc1e74e4bcfc1d56047b018b78991c7d1e8b1';
export const hakataOctober21SourceHash =
  'fde1a30a3b006619bae161741eee8b95b68b8ca0743488098c0bc8298f012325';
const scheduleUrl =
  'https://www.midorimachi.jp/higashihirao/images/park/261002141825533.pdf';
const eventEnd: Record<number, string> = {
  3: '18:00',
  4: '18:00',
  17: '17:00',
  18: '15:00',
  21: '15:00',
  24: '17:00',
  25: '17:00',
  31: '17:00',
};
const noOpening = new Set([8, 9, 10, 11]);
export function reviewedHakataReading(packet: AiPacket) {
  if (
    packet.key !== 'hakata' ||
    packet.trackId !== 'hakata-no-mori-auxiliary-athletic-stadium' ||
    packet.landingPageUrl !== 'https://www.midorimachi.jp/higashihirao/'
  )
    return null;
  const hash = digest(
    JSON.stringify(
      packet.sources
        .filter((source) => source.url !== packet.landingPageUrl)
        .map((source) => ({ url: source.url, hash: source.hash })),
    ),
  );
  const current = hash === hakataOctober21SourceHash;
  const schedule = packet.sources.find((source) => source.url === (current
    ? 'https://www.midorimachi.jp/higashihirao/images/park/26102110584262.pdf' : scheduleUrl)
    && (!current || source.name.endsWith('-page-1.png')));
  const novemberSchedule = current ? packet.sources.find(source => source.url === schedule?.url && source.name.endsWith('-page-2.png')) : null;
  const guide = packet.sources.find(
    (source) =>
      source.url === 'https://www.midorimachi.jp/higashihirao/guides/',
  );
  if ((!current && hash !== hakataReviewedSourceHash) || !schedule || !guide || (current && !novemberSchedule)) return null;
  const rows = new Map<string, AiRow>();
  for (const date of packet.dates) {
    const day = Number(date.slice(8));
    const november = current && /^2026-11-\d{2}$/.test(date) && day >= 1 && day <= 30;
    const inMonth = november || (/^2026-10-\d{2}$/.test(date) && day >= 1 && day <= 31);
    const closed = inMonth && (november ? [1, 13, 21, 29].includes(day) : noOpening.has(day));
    const event = november ? ({ 3: '13:00', 6: '15:00', 8: '15:00', 14: '14:00', 15: '15:00', 28: '14:00' } as Record<number, string>)[day] : eventEnd[day];
    const start = event ?? '09:00';
    const end = november ? '17:00' : '18:30';
    rows.set(date, {
      id: `hakata-${date}`,
      date,
      status: !inMonth
        ? 'unknown'
        : closed
          ? 'unavailable'
          : event
            ? 'partially_available'
            : 'available',
      periods:
        !inMonth || closed
          ? []
          : [
              {
                start,
                end,
                scope: '補助競技場トラック',
                last_entry: null,
              },
            ],
      conditions: !inMonth
        ? []
        : [
            '一般利用は有料。当日受付・支払い。事前予約不可。',
            'フィールド中央の天然芝部分は一般利用不可。',
            ...(event && !closed
              ? [
                  '一般開放は大会終了後。開始時刻は大会の終了予定時刻に基づき、実際の終了状況で変わるため公式情報を確認してください。',
                ]
              : []),
          ],
      evidence: !inMonth
        ? []
        : [
            {
              source: (november ? novemberSchedule! : schedule).name,
              location: `令和8年${november ? 11 : 10}月・補助競技場欄・${day}日`,
              quote_or_symbol: closed
                ? november ? '一般開放なし' : '一般開放はありません'
                : event
                  ? `大会予定終了 ${start}／大会の終了後から`
                  : `一般（有料）開放 9:00〜${end}・対象日の大会欄は空欄`,
            },
            {
              source: guide.name,
              location: '補助競技場 一般開放利用・利用時間',
              quote_or_symbol:
                `${november ? '11月 9:00〜17:00' : '10月 9:00〜18:30'}／大会終了まで一般開放はいたしません`,
            },
          ],
      unknown_reason: inMonth ? null : 'outside_published_period',
    });
  }
  return {
    rows,
    key: `reviewed-hakata-202610-${hash}`,
    cacheHit: true,
    usage: null,
  };
}
