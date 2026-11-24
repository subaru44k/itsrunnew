import { digest, type AiPacket, type AiRow } from './ai-runtime';

const landing = 'https://www.se-sports.or.jp/facility/sougou/';
const reviewedNotices = [
  {
    date: '2026-11-22',
    url: 'https://www.se-sports.or.jp/news/23438/',
    hash: 'c5538d076b271e2282d53ba7ae8c336a6f2a4aabcaf925365fa04ffe9fc824a3',
    condition: '当日の個人開放はエアーライフル場と洋弓場のみで、陸上競技場は個人利用できません。',
    location: '11月22日 個人利用可能時間帯',
  },
  {
    date: '2026-11-24',
    url: 'https://www.se-sports.or.jp/news/23447/',
    hash: '4d26bde7e580a89a844fc31f95fdcf0e7e2d456d71dcbf8e9340f72574cd1201',
    condition: '当日の公式案内では、陸上競技場の個人利用はできません。',
    location: '11月24日 個人利用可能時間帯',
  },
];

export function reviewedSetagayaReading(packet: AiPacket) {
  if (
    packet.key !== 'setagaya' ||
    packet.trackId !== 'setagaya-general-sports-track' ||
    packet.landingPageUrl !== landing ||
    packet.dates.length !== 1
  ) return null;
  const date = packet.dates[0];
  const reviewed = reviewedNotices.find((item) => item.date === date);
  if (!reviewed) return null;
  const notice = packet.sources.find((source) => source.url === reviewed.url);
  if (notice?.kind !== 'text' || notice.hash !== reviewed.hash || digest(notice.content) !== reviewed.hash) return null;

  const row: AiRow = {
    id: `setagaya-${date}`,
    date,
    status: 'unavailable',
    periods: [],
    conditions: [reviewed.condition],
    evidence: [{
      source: notice.name,
      location: reviewed.location,
      quote_or_symbol: '上記以外の室場および時間帯は個人利用はできません。',
    }],
    unknown_reason: null,
  };
  return { rows: new Map([[date, row]]), key: `reviewed-setagaya-${date.replaceAll('-', '')}-${reviewed.hash}`, cacheHit: true, usage: null };
}
