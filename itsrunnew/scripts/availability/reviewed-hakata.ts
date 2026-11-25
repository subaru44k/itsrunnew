import { digest, type AiPacket, type AiRow } from './ai-runtime';

// Human-reviewed October through December 2026 tables and general-use guide.
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
const winterSchedules = [
  {
    url: 'https://www.midorimachi.jp/higashihirao/images/park/261120131059121.pdf',
    hash: 'e565c9a2a573aa5cb100e89d990061044217c07100f6818d725ff40c7142a3c7',
    novemberUnknown: new Set([7, 8, 13, 14, 15, 21, 22]),
    novemberClosures: new Set([1, 29]),
    novemberEvents: { 3: '13:00', 6: '15:00', 28: '14:00' } as Record<number, string>,
  },
  {
    url: 'https://www.midorimachi.jp/higashihirao/images/park/261122085032540.pdf',
    hash: '7360ac239f7b865d6bebedc6fccb963173df87b464aa1e7f43040ee0d8ef6dfa',
    novemberUnknown: new Set<number>(),
    novemberClosures: new Set([1, 13, 21, 29]),
    novemberEvents: { 3: '13:00', 6: '15:00', 8: '15:00', 14: '14:00', 15: '15:00', 28: '14:00' } as Record<number, string>,
  },
  {
    url: 'https://www.midorimachi.jp/higashihirao/images/park/261124164542522.pdf',
    hash: '7a8d800b631c1d4d140119a5cac92e2ef41f0d2177ed21f0df0ec3f4e03cfc49',
    // The current packet reuses an older November page that conflicts with the prior packet.
    novemberUnknown: new Set([7, 8, 13, 14, 15, 21]),
    novemberClosures: new Set([1, 29]),
    novemberEvents: { 3: '13:00', 6: '15:00', 28: '14:00' } as Record<number, string>,
    revisedDecember: true,
  },
];
const winterGuideHash = '7edfd87f6470e1e0055a6ffb3027a9247de10f2c11594ba58d8e8059683d78ed';
const rulesUrl = 'https://www.midorimachi.jp/higashihirao/images/parknews/260512133125820.pdf';
const rulesHash = 'd378a27f5c0e3a3f5a37a43a54ed632519edee78cedf0dffd577bbb3978f9f44';
const decemberClosures = new Map([
  [7, '駅伝大会のため一般開放なし。'],
  [8, '停電・断水のため一般開放なし。'],
  [12, '強化合宿のため一般開放なし。'],
  [19, '駅伝大会のため一般開放なし。'],
  [20, '大会の予定終了が通常開放の終了時刻のため、一般利用できる時間帯はありません。'],
  ...[29, 30, 31].map(day => [day, '年末年始の休業日。'] as const),
]);
const decemberEvents: Record<number, string> = { 5: '13:00', 13: '15:00', 25: '13:00', 26: '12:00' };

function reviewedWinterCalendar(packet: AiPacket) {
  const documents = packet.sources.filter(source => source.url !== packet.landingPageUrl);
  const guide = documents.find(source => source.url === 'https://www.midorimachi.jp/higashihirao/guides/');
  if (documents.length !== 5 || guide?.kind !== 'text' || guide.hash !== winterGuideHash || digest(guide.content) !== winterGuideHash)
    return null;
  const verifiedPage = (url: string, hash: string, page: number) => documents.find(source =>
    source.url === url && source.kind === 'image' && source.originalPdfHash === hash && source.name.endsWith(`-page-${page}.png`));
  const schedule = winterSchedules.find(({ url, hash }) =>
    verifiedPage(url, hash, 1) && verifiedPage(url, hash, 2));
  if (!schedule) return null;
  const november = verifiedPage(schedule.url, schedule.hash, 1);
  const december = verifiedPage(schedule.url, schedule.hash, 2);
  if (!november || !december || ![1, 2].every(page => verifiedPage(rulesUrl, rulesHash, page))) return null;
  const rows = new Map<string, AiRow>();
  for (const date of packet.dates) {
    const day = Number(date.slice(8));
    const isNovember = /^2026-11-(?:0[1-9]|[12]\d|30)$/.test(date);
    const isDecember = /^2026-12-(?:0[1-9]|[12]\d|3[01])$/.test(date);
    const uncertain = (isNovember && schedule.novemberUnknown.has(day)) || (isDecember && day === 27);
    const outageOpening = isDecember && schedule.revisedDecember && day === 8;
    const ordinaryOpening = isDecember && schedule.revisedDecember && day === 20;
    const closed = isNovember && schedule.novemberClosures.has(day) ? '大会のため一般開放なし。'
      : isDecember && !outageOpening && !ordinaryOpening ? decemberClosures.get(day) : undefined;
    const event = isNovember ? schedule.novemberEvents[day] : decemberEvents[day];
    const known = (isNovember || isDecember) && !uncertain;
    const start = outageOpening ? '14:00' : event ?? '09:00';
    rows.set(date, {
      id: `hakata-${date}`,
      date,
      status: !known ? 'unknown' : closed ? 'unavailable' : event || outageOpening ? 'partially_available' : 'available',
      periods: !known || closed ? [] : [{ start, end: '17:00', scope: '補助競技場トラック', last_entry: null }],
      conditions: !known ? [] : [
        '一般利用は有料。当日受付・支払い。事前予約不可。',
        'フィールド中央の天然芝部分は一般利用不可。',
        ...(closed ? [closed] : outageOpening ? ['停電・断水のため一般開放は14:00から。'] : event
          ? ['一般開放は大会終了後。開始時刻は大会の終了予定時刻に基づき、実際の終了状況で変わるため公式情報を確認してください。']
          : []),
      ],
      evidence: !known ? [] : [{
        source: (isNovember ? november : december).name,
        location: `令和8年${isNovember ? 11 : 12}月・補助競技場欄・${day}日`,
        quote_or_symbol: closed ?? (outageOpening ? '停電・断水のため一般開放14時から' : event ? `大会予定終了 ${event}／大会の終了後から` : '補助競技場の大会欄は空欄・冬季一般開放9:00〜17:00'),
      }],
      unknown_reason: known ? null : uncertain ? 'insufficient_information' : 'outside_published_period',
    });
  }
  return { rows, key: `reviewed-hakata-winter-${schedule.hash}`, cacheHit: true, usage: null };
}

export function reviewedHakataReading(packet: AiPacket) {
  if (
    packet.key !== 'hakata' ||
    packet.trackId !== 'hakata-no-mori-auxiliary-athletic-stadium' ||
    packet.landingPageUrl !== 'https://www.midorimachi.jp/higashihirao/'
  )
    return null;
  const winter = reviewedWinterCalendar(packet);
  if (winter) return winter;
  const hash = digest(
    JSON.stringify(
      packet.sources
        .filter((source) => source.url !== packet.landingPageUrl)
        .map((source) => ({ url: source.url, hash: source.hash })),
    ),
  );
  const current = hash === hakataOctober21SourceHash;
  const novemberOnly = hash === '8ad5e2c49c323f49e69d057d498b0b65891beb55d06d321ecc4958fa57737a93';
  const schedule = packet.sources.find((source) => source.url === (novemberOnly
    ? 'https://www.midorimachi.jp/higashihirao/images/park/261101151155895.pdf' : current
    ? 'https://www.midorimachi.jp/higashihirao/images/park/26102110584262.pdf' : scheduleUrl)
    && (!current || source.name.endsWith('-page-1.png')));
  const novemberSchedule = novemberOnly ? schedule : current ? packet.sources.find(source => source.url === schedule?.url && source.name.endsWith('-page-2.png')) : null;
  const guide = packet.sources.find(
    (source) =>
      source.url === 'https://www.midorimachi.jp/higashihirao/guides/',
  );
  if ((!current && !novemberOnly && hash !== hakataReviewedSourceHash) || !schedule || !guide || ((current || novemberOnly) && !novemberSchedule)) return null;
  const rows = new Map<string, AiRow>();
  for (const date of packet.dates) {
    const day = Number(date.slice(8));
    const november = (current || novemberOnly) && /^2026-11-\d{2}$/.test(date) && day >= 1 && day <= 30;
    const inMonth = november || (!novemberOnly && /^2026-10-\d{2}$/.test(date) && day >= 1 && day <= 31);
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
