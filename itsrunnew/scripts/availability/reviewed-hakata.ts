import { digest, type AiPacket, type AiRow } from './ai-runtime';

// Human-reviewed 2026-10 official monthly table and general-use guide.
// Source changes disable this finite correction; never extrapolate to a new month.
export const hakataReviewedSourceHash =
  '1fc3e105beccbabe7e5fd776867352ce9b0bed5daad786411e0ce31d4b8cb0f2';
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
    packet.trackId !== 'hakata-no-mori-auxiliary-athletic-stadium'
  )
    return null;
  const hash = digest(
    JSON.stringify(
      packet.sources.map((source) => ({ url: source.url, hash: source.hash })),
    ),
  );
  const schedule = packet.sources.find((source) => source.url === scheduleUrl);
  const guide = packet.sources.find(
    (source) =>
      source.url === 'https://www.midorimachi.jp/higashihirao/guides/',
  );
  if (hash !== hakataReviewedSourceHash || !schedule || !guide) return null;
  const rows = new Map<string, AiRow>();
  for (const date of packet.dates) {
    const day = Number(date.slice(8));
    const inMonth = /^2026-10-\d{2}$/.test(date) && day >= 1 && day <= 31;
    const closed = inMonth && noOpening.has(day);
    const start = eventEnd[day] ?? '09:00';
    rows.set(date, {
      id: `hakata-${date}`,
      date,
      status: !inMonth
        ? 'unknown'
        : closed
          ? 'unavailable'
          : eventEnd[day]
            ? 'partially_available'
            : 'available',
      periods:
        !inMonth || closed
          ? []
          : [
              {
                start,
                end: '18:30',
                scope: '補助競技場トラック',
                last_entry: null,
              },
            ],
      conditions: !inMonth
        ? []
        : [
            '一般利用は有料。当日受付・支払い。事前予約不可。',
            'フィールド中央の天然芝部分は一般利用不可。',
            ...(eventEnd[day] && !closed
              ? [
                  '一般開放は大会終了後。開始時刻は大会の終了予定時刻に基づき、実際の終了状況で変わるため公式情報を確認してください。',
                ]
              : []),
          ],
      evidence: !inMonth
        ? []
        : [
            {
              source: schedule.name,
              location: `令和8年10月・補助競技場欄・${day}日`,
              quote_or_symbol: closed
                ? '一般開放はありません'
                : eventEnd[day]
                  ? `大会予定終了 ${start}／大会の終了後から`
                  : '一般（有料）開放 9:00〜18:30・対象日の大会欄は空欄',
            },
            {
              source: guide.name,
              location: '補助競技場 一般開放利用・利用時間',
              quote_or_symbol:
                '10月 9:00〜18:30／大会終了まで一般開放はいたしません',
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
