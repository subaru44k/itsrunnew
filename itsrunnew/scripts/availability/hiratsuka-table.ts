import { digest, type AiPacket, type AiRow } from './ai-runtime';
const landing = 'https://www.city.hiratsuka.kanagawa.jp/koen/page-c_00824.html';
const weekdays = '日月火水木金土';

/** Read only the city's explicit rolling three-slot table; never fill blank days. */
export function readHiratsukaTable(packet: AiPacket) {
  if (packet.key !== 'hiratsuka' || packet.trackId !== 'lemon-gas-stadium-hiratsuka-track' || packet.landingPageUrl !== landing || packet.sources.length !== 1) return null;
  const source = packet.sources[0];
  if (source.url !== landing || source.kind !== 'text' || source.hash !== digest(source.content)) return null;
  const text = source.content.normalize('NFKC').replace(/～/g, '~');
  if (!text.includes('レモンガススタジアム平塚共用利用予定表')) return null;
  const updated = /最終更新日\s*:\s*(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(text);
  const tables = [...text.matchAll(/(?:^|\n)共用利用予定表\n([\s\S]*?)\n【凡例】/g)];
  if (!updated || tables.length !== 1) return null;
  const publishedAt = `${updated[1]}-${updated[2].padStart(2, '0')}-${updated[3].padStart(2, '0')}`;
  const table = tables[0][1];
  const header = /^(\d{1,2})月(?:\/(\d{1,2})月)?\n午前\n8時~12時\n昼\n12時~13時\n午後\n13時~19時\n\(金曜日は20時まで\)\n/.exec(table);
  if (!header) return null;
  // A changed legend or usage rule requires a new parser review, not an AI fallback.
  if (!text.includes('不可\n大会・保守点検等によりご利用いただけません。') || !text.includes('可\nご利用できます。') || !text.includes('利用の可否については、当日お問い合わせください。') || !text.includes('12時から13時の開放時間帯は無料です。') || !text.includes('スパイクの使用、器具の貸出、シャワー・ロッカー・更衣室の利用はできません。')) return null;
  if (!text.includes('開放しています(陸上競技のみ)。') || !text.includes('共用利用には、以下の事務所で申請手続きが必要です。') || !text.includes('貸し出し器具は、午前・午後ともに利用終了時間の15分前を目安に返却してください。')) return null;
  const entries = table.slice(header[0].length).split('\n');
  if (entries.length % 4 || entries.length < 4 || entries.length > 31 * 4) return null;
  // The page may be revised without moving the rolling table's first row.
  // Resolve that row from its printed month/day, requiring the publication date
  // to lie inside the table. This also anchors December–January to the right year.
  const publication = new Date(`${publishedAt}T00:00:00Z`);
  if (!Number.isFinite(publication.getTime()) || publication.toISOString().slice(0, 10) !== publishedAt) return null;
  const firstDay = /^(\d{1,2})日\([日月火水木金土]曜日\)$/.exec(entries[0]);
  if (!firstDay) return null;
  const starts = [-1, 0, 1].map(offset => new Date(Date.UTC(Number(updated[1]) + offset, Number(header[1]) - 1, Number(firstDay[1]))))
    .filter(date => date.getUTCMonth() + 1 === Number(header[1]) && date.getUTCDate() === Number(firstDay[1])
      && date <= publication && publication.getTime() < date.getTime() + entries.length / 4 * 86400000);
  if (starts.length !== 1) return null;
  const parsed = new Map<string, AiRow>();
  const months: number[] = [];
  for (let index = 0; index < entries.length; index += 4) {
    const day = /^(\d{1,2})日\(([日月火水木金土])曜日\)$/.exec(entries[index]);
    const values = entries.slice(index + 1, index + 4);
    if (!day) return null;
    const date = new Date(starts[0]);
    date.setUTCDate(date.getUTCDate() + index / 4);
    if (!Number.isFinite(date.getTime()) || date.getUTCDate() !== Number(day[1]) || weekdays[date.getUTCDay()] !== day[2]) return null;
    const month = date.getUTCMonth() + 1;
    if (!months.includes(month)) months.push(month);
    const dateKey = date.toISOString().slice(0, 10);
    const conditions = ['共用利用には受付での申請が必要。貸出器具は利用終了15分前を目安に返却してください。'];
    if (values.includes('予備日')) conditions.push('予備日の時間帯は利用可否未定です。当日施設へお問い合わせください。');
    const times = [['08:00', '12:00'], ['12:00', '13:00'], ['13:00', date.getUTCDay() === 5 ? '20:00' : '19:00']];
    const periods: AiRow['periods'] = [];
    for (const [slot, value] of values.entries()) {
      if (value === '不可' || value === '予備日') continue;
      let start = times[slot][0];
      if (value !== '可') {
        const opening = /^(\d{1,2})時(?:(\d{1,2})分)?~可$/.exec(value);
        if (!opening || Number(opening[1]) > 23 || Number(opening[2] ?? 0) > 59) return null;
        start = `${opening[1].padStart(2, '0')}:${(opening[2] ?? '0').padStart(2, '0')}`;
        // A timed opening may shorten its own slot, never extend into another slot.
        if (start < times[slot][0] || start >= times[slot][1]) return null;
      }
      periods.push({ start, end: times[slot][1], scope: '陸上競技の共用利用', last_entry: null });
    }
    if (periods.some(period => period.start >= '12:00' && period.end <= '13:00')) conditions.push('12〜13時は無料開放。スパイク・器具貸出・シャワー・ロッカー・更衣室は利用不可。');
    const fullDay = periods.length === 3 && periods.every((period, slot) => period.start === times[slot][0]);
    const status = fullDay ? 'available' : periods.length ? 'partially_available' : values.every(value => value === '不可') ? 'unavailable' : 'unknown';
    parsed.set(dateKey, { id: `hiratsuka-${dateKey}`, date: dateKey, status, periods, conditions, evidence: [{ source: source.name, location: `共用利用予定表 ${dateKey}`, quote_or_symbol: values.join('／') }], unknown_reason: status === 'unknown' ? 'insufficient_information' : null });
  }
  if (JSON.stringify(months) !== JSON.stringify(header.slice(1).filter(Boolean).map(Number))) return null;
  const rows = new Map<string, AiRow>();
  for (const date of packet.dates) rows.set(date, parsed.get(date) ?? { id: `hiratsuka-${date}`, date, status: 'unknown', periods: [], conditions: [], evidence: [], unknown_reason: 'outside_published_period' });
  return { rows, publishedAt, key: `structured-hiratsuka-${digest(source.content)}`, cacheHit: false, usage: null };
}
