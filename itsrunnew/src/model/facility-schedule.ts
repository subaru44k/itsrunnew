import type { TrackAvailability } from './availability';

// Unknown days are gaps, never closures or usable schedule entries.
export function summarizeFacilitySchedule(records: TrackAvailability[], dates: string[], today: string, now = new Date()) {
  const relevant = records.filter(record => dates.includes(record.date) && record.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const known = relevant.filter(record => record.status !== 'unknown');
  const gaps = dates.filter(date => date >= today && !known.some(record => record.date === date));
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const nextRecord = known.find(record => ['available', 'partially_available'].includes(record.status)
    && (record.periods.length === 0 || record.periods.some(period => period.status === 'available' && (record.date > today || !period.to || period.to > time))));
  const next = nextRecord ? {
    ...nextRecord,
    periods: nextRecord.periods.filter(period => period.status === 'available'
      && (nextRecord.date > today || !period.to || period.to > time)),
  } : undefined;
  return { known, gaps, next, mode: known.length === 0 ? 'confirmation' : gaps.length === 0 ? 'schedule' : 'partial' };
}

// Manual-confirmation records are regenerated daily without fetching a schedule.
// Their checkedAt is not a phone call or an official-source confirmation.
export function availabilitySourceTimestamp(record: TrackAvailability | null | undefined) {
  if (!record || record.evidence.collector === 'runtime-fallback') return null;
  const timestamp = record.freshness.fetchedAt
    ?? (record.unknownReason === 'fetch_failed' ? record.freshness.checkedAt : null);
  return timestamp && Number.isFinite(Date.parse(timestamp)) ? timestamp : null;
}

// Merge only adjacent slots with identical restrictions; never bridge a closed gap.
export function mergedAvailablePeriods(record: TrackAvailability) {
  const periods: TrackAvailability['periods'] = [];
  for (const period of record.periods.filter(item => item.status === 'available')
    .sort((a, b) => (a.from ?? '').localeCompare(b.from ?? ''))) {
    const previous = periods.at(-1);
    if (previous?.to && previous.to === period.from && previous.scope === period.scope
      && previous.eligibility === period.eligibility
      && JSON.stringify(previous.conditions) === JSON.stringify(period.conditions)) previous.to = period.to;
    else periods.push({ ...period, conditions: [...period.conditions] });
  }
  return periods;
}

export function compactPeriodSummary(record: TrackAvailability, english: boolean) {
  const periods = mergedAvailablePeriods(record);
  if (periods.length > 1) return english ? `${periods.length} time slots` : `${periods.length}枠`;
  const period = periods[0];
  return period?.from && period.to ? `${period.from}–${period.to}` : english ? 'Confirm times' : '時間は要確認';
}

// Keep collector diagnostics in the dataset, but exclude them from visitor guidance.
const collectorNotes = new Set([
  '公式の日付指定一般開放表', '公式の当日更新情報', '公式行事予定表の休場日',
  '公式PDFの利用中止期間', 'PDF凡例が空欄を開放と明示', '早朝地域開放規則とPDF変更欄を結合',
  '公開範囲は当日から1週間', '直近1週間の公開範囲外', '短期更新のお知らせ', '短期更新範囲外',
  '陸上競技場欄だけを判定', '○だけを一般開放と判定',
  '空欄や他施設の予定は個人利用可の根拠にしない', '空欄は予約可能日であり個人利用可とは判定しない',
  'Official static facility rules explicitly do not accept individual use.',
]);

// Preserve unrecognized prose: new admission rules must not disappear by default.
export function visitorConditions(conditions: string[], english: boolean) {
  const restrictions: Record<string, [string, string]> = {
    annual_pass_required_for_individual_use: ['個人利用は年間定期利用者のみ', 'Annual pass holders only'],
    equipment_not_allowed: ['用具の使用不可', 'Equipment use is not allowed'],
    track_only: ['トラックのみ利用可', 'Track only'],
    track_only_available: ['トラックのみ利用可', 'Track only'],
    blank_defined_as_track_only_opening: ['トラックのみ利用可', 'Track only'],
  };
  return [...new Set(conditions.flatMap(condition => {
    if (/^対象施設は|^\d{4}[/年-].*当日告知で|^陸上競技場の個人利用$/.test(condition)) return [];
    if (collectorNotes.has(condition) || /unknown|collector|parser|日別status|安全に特定|安全な判定対象外/i.test(condition)
      || /^(?:No PDF published|PDF contains no extractable text|Operating hours missing or ambiguous|Availability source researched|Facility identity is verified)/.test(condition)) return [];
    if (condition === '12:00〜13:00は判定対象外') return [english ? 'Confirm use between 12:00 and 13:00 with the facility' : '12:00〜13:00の利用は施設にご確認ください'];
    if (condition === 'Bは外周ジョギングのみ') return [english ? 'Outer jogging course only' : '外周ジョギングのみ'];
    const translation = restrictions[condition];
    if (translation) return [translation[english ? 1 : 0]];
    return /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/i.test(condition) ? [] : [condition];
  }))];
}

// A day can have confirmed slots without being usable at the current time.
export function todayUseSummary(record: TrackAvailability | null | undefined, today: string, now: Date, english: boolean) {
  if (!record || record.date !== today || record.status === 'unknown'
    || !Number.isFinite(Date.parse(record.freshness.expiresAt)) || now.getTime() >= Date.parse(record.freshness.expiresAt)) {
    return english ? 'Needs confirmation' : '要確認';
  }
  if (record.status === 'unavailable') return english ? 'Unavailable' : '利用不可';
  const periods = mergedAvailablePeriods(record);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  if (periods.length && periods.every(period => period.to && period.to <= time)) return english ? "Today's confirmed periods have ended" : '本日の確認済み枠は終了';
  return periods.length && periods.every(period => period.from && period.to)
    ? (english ? 'Confirmed periods today' : '本日の利用枠あり')
    : (english ? 'Opening date confirmed; check times' : '開放日確認済み・時間は要確認');
}

export function scheduleWarnings(record: TrackAvailability | null | undefined, english: boolean) {
  if (!record || (record.status === 'unknown' && record.unknownReason !== 'insufficient_information')) return [];
  const periodConditions = record.periods.flatMap(period => period.conditions);
  const shownWithTimes = record.periods.filter(period => period.status === 'available').flatMap(period => visitorConditions(period.conditions, english));
  let warnings = [...record.warnings, ...(record.status === 'unavailable' ? periodConditions : [])];
  if (record.trackId.startsWith('wadabori-park-') && record.status === 'unavailable') {
    warnings = warnings.filter(value => value !== '12:00〜13:00は判定対象外');
    warnings.push(english ? 'During all-day maintenance or exclusive use, 12:00–13:00 is also unavailable.' : '終日の整備・貸切日は12:00〜13:00も利用できません。');
  }
  return visitorConditions(warnings, english).filter(value => !shownWithTimes.includes(value));
}
