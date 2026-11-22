import { digest, type AiPacket, type AiRow } from './ai-runtime';

const landing = 'https://www.se-sports.or.jp/facility/sougou/';
const reviewedNotice = 'https://www.se-sports.or.jp/news/23438/';
const reviewedHash = 'c5538d076b271e2282d53ba7ae8c336a6f2a4aabcaf925365fa04ffe9fc824a3';
const date = '2026-11-22';

export function reviewedSetagayaReading(packet: AiPacket) {
  if (
    packet.key !== 'setagaya' ||
    packet.trackId !== 'setagaya-general-sports-track' ||
    packet.landingPageUrl !== landing ||
    packet.dates.length !== 1 ||
    packet.dates[0] !== date
  ) return null;
  const notice = packet.sources.find((source) => source.url === reviewedNotice);
  if (notice?.kind !== 'text' || notice.hash !== reviewedHash || digest(notice.content) !== reviewedHash) return null;

  const row: AiRow = {
    id: `setagaya-${date}`,
    date,
    status: 'unavailable',
    periods: [],
    conditions: ['当日の個人開放はエアーライフル場と洋弓場のみで、陸上競技場は個人利用できません。'],
    evidence: [{
      source: notice.name,
      location: '11月22日 個人利用可能時間帯',
      quote_or_symbol: '上記以外の室場および時間帯は個人利用はできません。',
    }],
    unknown_reason: null,
  };
  return { rows: new Map([[date, row]]), key: `reviewed-setagaya-20261122-${reviewedHash}`, cacheHit: true, usage: null };
}
