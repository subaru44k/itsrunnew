import { digest, type AiPacket, type AiRow } from './ai-runtime';

const root = 'https://www.ishin100.com/main/';
const notice = `${root}info_mirasta_kojin_20261005/`;
const repair = `${root}info_hojyo_track_syuzzen_kouji_20261019/`;
const october = `${root}wp-content/uploads/info_hojyoriku_class_202610_230261013_1.png`;
const november = `${root}wp-content/uploads/info_hojyoriku_202611_20261005.png`;
const repairText = `${root}wp-content/uploads/info_hojyo_track_syuzzen_kouji_20261019-content.png`;
const repairMap = `${root}wp-content/uploads/info_hojyo_track_syuzzen_kouji_20261019.png`;
const reviewed = new Map([
  [notice, '4dc92cf0453923b76d1086a9184c12340b406d9e1860956c5101b7d5c7736a7a'],
  [october, '79cf1a09a92c59cfb24e08e4efd4689c8283fdb97b89a771e80912b306c4c2a7'],
  [november, '8e2c1eaf45400f9a5735a1381bd717dad1ba8403c757dbaa57f0e256af73ab41'],
  [repair, '2f48ce6508efb216837c21d6506c8abc15b1b3a5dfa5e3d9c4be79af02d0a3a8'],
  [repairText, '3fce558458d3c018a3a723ad71aa889512abfb31c9bd28b78fab9c6fc5f3ef39'],
  [repairMap, '58fe55b009b85330c4b4acb9e4e65df2d7909490dcf6fa8e67024aa45f5a9a5e'],
]);
const repairConditions = [
  '11月26〜28日は100m・110mスタートの一部修繕。直線練習は逆走コースの5・6・7・8レーンのみ。200m・400m・中長距離の練習は通常どおり。',
];
const novemberNotice = `${root}info_mirasta_kojin_20261102/`;
const revisedNovember = `${root}wp-content/uploads/info_hojyoriku_202611_20261102.png`;
const december = `${root}wp-content/uploads/info_hojyoriku_202612_20261102.png`;
const novemberReviewed = new Map([
  [novemberNotice, 'c9f64c31eaa696c03a7811a529a3c7e14505dd92ce3abeceb5698e0fb652bfcb'],
  [revisedNovember, '4ed87a8b277994c2522980a8cbd60ed5b53c13108cbca79ea7d8b0c648a4de48'],
  [december, '8c27eb69fb616ad355f0809b9c65447463421edbee02ffbffc1ad265b6ce7486'],
  [repair, 'ca87efc603301134c4cd07e33f6828ab8d0b65c0770066672856f170b0970bb8'],
  [repairText, reviewed.get(repairText)!],
  [repairMap, reviewed.get(repairMap)!],
]);

/** Finite human review: exact current official inputs, never an AI/cache fallback. */
export function reviewedIshinReading(packet: AiPacket) {
  if (packet.key !== 'ishin' || packet.trackId !== 'ishin-centennial-park-auxiliary-stadium' || packet.landingPageUrl !== root) return null;
  const urls = new Set(packet.sources.map(s => s.url));
  const november11Notice = `${root}info_mirasta_kojin_20261111/`;
  const november11Image = `${root}wp-content/uploads/info_hojyoriku_202611_20261111.png`;
  const november11 = urls.has(november11Notice);
  const activeNotice = november11 ? november11Notice : novemberNotice;
  const activeNovember = november11 ? november11Image : revisedNovember;
  const revised = november11 || urls.has(novemberNotice);
  const expected = revised ? novemberReviewed : reviewed;
  const currentNoticeHash = 'ff39cb297dd973d0d334d16aef28ebdafac7fd01b559eddf12f81df7aa3ab48a';
  const matches = (s: AiPacket['sources'][number]) => (november11 && s.url === november11Image ? s.hash === 'ecacb225bef98759fd26401b21752909640a9df2a115768038557f140c351ad9' : expected.get(s.url) === s.hash) || (revised && s.url === activeNotice && s.hash === currentNoticeHash);
  if (urls.size !== packet.sources.length || packet.sources.some(s => !matches(s))) return null;
  if ([revised ? activeNotice : notice, repair, repairText, repairMap].some(url => !urls.has(url))) return null;
  // Source discovery legitimately omits October after the horizon moves into
  // November. Require every reviewed month requested, including its own image.
  for (const [month, url] of revised ? [['2026-11', activeNovember], ['2026-12', december]] : [['2026-10', october], ['2026-11', november]]) {
    if (packet.dates.some(date => date.startsWith(month)) && !urls.has(url)) return null;
  }
  if (revised ? !urls.has(activeNovember) && !urls.has(december) : !urls.has(october) && !urls.has(november)) return null;
  const rows = new Map<string, AiRow>();
  for (const date of packet.dates) {
    const month = date.slice(0, 7);
    const day = Number(date.slice(8));
    const inMonth = (revised ? /^2026-12-(?:0[1-9]|[12]\d|3[01])$/ : /^2026-10-(?:0[1-9]|[12]\d|3[01])$/).test(date) || /^2026-11-(?:0[1-9]|[12]\d|30)$/.test(date);
    const closed = inMonth && (date === '2026-10-06' || date === '2026-11-09' || date === '2026-12-14');
    const opening = inMonth && (month === '2026-10'
      ? [1, 5, 8, 13, 15, 19, 22, 26, 29]
      : month === '2026-12' ? [3, 7, 10, 17, 21, 24, 28] : [2, 6, 12, 16, 19, 24, 26, 30]).includes(day);
    const revisedSixteen = november11 && date === '2026-11-16';
    const repairing = month === '2026-11' && day >= 26 && day <= 28;
    const source = packet.sources.find(s => s.url === (month === '2026-10' ? october : month === '2026-12' ? december : revised ? activeNovember : november));
    const conditions = inMonth ? [
      '急きょ芝生管理作業や専用利用が入る場合があります。個人利用希望者は利用前日に管理事務所へお問い合わせください。',
      ...(revisedSixteen ? ['8:30〜13:00は薬剤散布作業のため使用不可。13:00〜22:00は芝生部分を除き使用可（11/11追記）。'] : []),
      ...(opening ? ['芝生部分は利用不可。陸上トラックの利用枠です。'] : []),
      ...(repairing ? repairConditions : []),
    ] : [];
    rows.set(date, {
      id: `ishin-${date}`, date,
      status: closed ? 'unavailable' : opening ? repairing || revisedSixteen ? 'partially_available' : 'available' : 'unknown',
      periods: opening ? [{ start: revisedSixteen ? '13:00' : '08:30', end: revisedSixteen ? '22:00' : '17:00', scope: '補助陸上競技場トラック（芝生部分を除く）', last_entry: null }] : [],
      conditions,
      evidence: inMonth && source && (closed || opening) ? [{
        source: source.name, location: `${month}行事予定・${day}日`,
        quote_or_symbol: closed ? '清掃・点検日のため使用できません' : revisedSixteen ? '8:30〜13:00 薬剤散布作業のため使用できません／13:00〜22:00 芝生部分を除き使用できます' : '8:30〜17:00 芝生部分を除き使用できます',
      }, ...(repairing ? [{ source: packet.sources.find(s => s.url === repairText)!.name, location: '修繕工事期間と利用条件', quote_or_symbol: '令和8年11月26日〜11月28日／逆走コースは5・6・7・8レーンのみ' }] : [])] : [],
      // Dedicated event hours alone do not prove a whole-day closure. Empty
      // rows and dates outside these reviewed months also never become open.
      unknown_reason: closed || opening ? null : inMonth ? 'insufficient_information' : 'outside_published_period',
    });
  }
  return { rows, key: `reviewed-ishin-20261026-${digest(JSON.stringify(packet.sources.map(s => ({ url: s.url, hash: s.hash }))))}`, cacheHit: true, usage: null };
}
