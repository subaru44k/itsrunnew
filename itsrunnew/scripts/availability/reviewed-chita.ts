import { digest, type AiPacket, type AiRow } from './ai-runtime';

const landing = 'https://www.chita-sports.com/info/105/';
const reviewedHash = 'be3626cfa127a3f392e12f83f93da5974803c6c57f333264ad929af90be5bd9c';
// November 1's expired dedicated-use notice and October PDF were removed.
// The renovation dates are unchanged; removed dates have no current evidence.
const renovationOnlyHash = '40d8627554afaff8de9d7919f280b763c978518719b97f5f4b476a4267da3e1b';

/** Exact official notice reviewed on 2026-11-01. No opening or reopening inferred. */
export function reviewedChitaReading(packet: AiPacket) {
  if (packet.key !== 'chita' || packet.trackId !== 'b-food-science-1969-chita-stadium' || packet.landingPageUrl !== landing) return null;
  if (packet.sources.length !== 1) return null;
  const source = packet.sources[0];
  if (source.url !== landing || source.kind !== 'text' || ![reviewedHash, renovationOnlyHash].includes(source.hash) || digest(source.content) !== source.hash) return null;
  const rows = new Map<string, AiRow>();
  for (const date of packet.dates) {
    const renovation = /^2026-(?:11|12)-\d{2}$|^2027-0[123]-\d{2}$/.test(date) && date >= '2026-11-03' && date <= '2027-03-31';
    const dedicated = source.hash === reviewedHash && date === '2026-11-01';
    const closed = renovation || dedicated;
    const condition = renovation
      ? '2026年11月3日〜2027年3月31日は陸上競技場改修工事のため利用できません。工事終了後の再開は公式情報をご確認ください。'
      : '2026年11月1日は専用利用のため一般開放での利用はできません。';
    rows.set(date, {
      id: `chita-${date}`, date, status: closed ? 'unavailable' : 'unknown', periods: [],
      conditions: closed ? [condition] : [],
      evidence: closed ? [{ source: source.name, location: '一般開放予定・陸上競技場改修工事のお知らせ', quote_or_symbol: renovation
        ? '令和８年１１月３日（火）から 令和９年３月３１日（水）まで／期間中は陸上競技場をご利用いただくことが出来ません。'
        : '１１月１日(日)は専用利用のため一般開放での利用はできません。' }] : [],
      unknown_reason: closed ? null : date === '2026-11-02' ? 'insufficient_information' : 'outside_published_period',
    });
  }
  return { rows, key: `reviewed-chita-20261101-${source.hash}`, cacheHit: true, usage: null };
}
