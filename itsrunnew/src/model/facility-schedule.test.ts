import { describe, expect, it } from 'vitest';
import { availabilityForTrack, unknownAvailability, type TrackAvailability, type AvailabilityDataset } from './availability';
import { todayUseSummary, scheduleWarnings, availabilitySourceTimestamp, compactPeriodSummary, mergedAvailablePeriods, visitorConditions, summarizeFacilitySchedule } from './facility-schedule';
const dates = ['2026-10-13', '2026-10-14', '2026-10-15'];
const now = new Date('2026-10-13T12:00:00+09:00');
function record(date: string, status: TrackAvailability['status'], to = '17:00'): TrackAvailability {
  return { ...unknownAvailability('track', date, 'insufficient_information'), status,
    periods: status === 'available' || status === 'partially_available' ? [{ from: '09:00', to, status: 'available', scope: 'full_track', eligibility: 'public', conditions: [] }] : [] };
}
describe('facility schedule quality', () => {
  it('summarizes complete coverage and the next usable period', () => {
    const result = summarizeFacilitySchedule(dates.map(date => record(date, date === dates[0] ? 'unavailable' : 'available')), dates, dates[0], now);
    expect(result.mode).toBe('schedule');
    expect(result.next?.date).toBe(dates[1]);
    expect(result.gaps).toEqual([]);
  });
  it('shows only known dates and preserves gaps inside a partial range', () => {
    const result = summarizeFacilitySchedule([record(dates[0], 'partially_available'), record(dates[1], 'unknown'), record(dates[2], 'unavailable')], dates, dates[0], now);
    expect(result.mode).toBe('partial');
    expect(result.known.map(item => item.date)).toEqual([dates[0], dates[2]]);
    expect(result.gaps).toEqual([dates[1]]);
  });
  it('does not fabricate schedules when all days are unknown or requests fail', () => {
    for (const records of [[], dates.map(date => record(date, 'unknown'))]) {
      const result = summarizeFacilitySchedule(records, dates, dates[0], now);
      expect(result.mode).toBe('confirmation');
      expect(result.known).toEqual([]);
      expect(result.next).toBeUndefined();
    }
  });
  it('skips elapsed slots today and past dates', () => {
    const result = summarizeFacilitySchedule([record('2026-10-12', 'available'), record(dates[0], 'available', '11:00'), record(dates[1], 'available')], dates, dates[0], now);
    expect(result.next?.date).toBe(dates[1]);
    expect(result.known).toHaveLength(2);
  });
  it('does not invent times for a confirmed date without time slots', () => {
    const item = record(dates[1], 'available');
    item.periods = [];
    expect(summarizeFacilitySchedule([item], dates, dates[0], now).next?.date).toBe(dates[1]);
  });
  it('summarizes only remaining slots while keeping the full day in the list', () => {
    const item = record(dates[0], 'partially_available', '11:00');
    item.periods.push({ ...item.periods[0], from: '18:00', to: '20:00' });
    const result = summarizeFacilitySchedule([item], dates, dates[0], now);
    expect(result.next?.periods.map(period => period.from)).toEqual(['18:00']);
    expect(result.known[0].periods).toHaveLength(2);
  });
  it('excludes expired official records from confirmed coverage', () => {
    const item = record(dates[0], 'available');
    item.freshness.expiresAt = '2026-10-13T00:00:00+09:00';
    const dataset = { facilities: [item] } as AvailabilityDataset;
    const result = summarizeFacilitySchedule([availabilityForTrack('track', dates[0], now, dataset)], dates, dates[0], now);
    expect(result.mode).toBe('confirmation');
  });
});

describe('source confirmation timestamps', () => {
  it('never presents generation time as a phone confirmation or fallback check', () => {
    const phone = unknownAvailability('phone', dates[0], 'phone_confirmation_required');
    phone.evidence.collector = 'manual-confirmation';
    expect(availabilitySourceTimestamp(phone)).toBeNull();
    expect(availabilitySourceTimestamp(unknownAvailability('fallback', dates[0], 'fetch_failed'))).toBeNull();
  });
  it('shows actual source fetch time instead of a later parse time', () => {
    const source = record(dates[0], 'available');
    source.evidence.collector = 'calendar';
    source.freshness.fetchedAt = '2026-10-13T00:00:00Z';
    expect(availabilitySourceTimestamp(source)).toBe('2026-10-13T00:00:00Z');
  });
  it('shows an explicit fetch failure attempt without claiming success', () => {
    const failed = unknownAvailability('failed', dates[0], 'fetch_failed');
    failed.evidence.collector = 'calendar';
    expect(availabilitySourceTimestamp(failed)).toBe(failed.freshness.checkedAt);
  });
});


describe('compact facility decisions', () => {
  it('merges adjacent equivalent slots without changing source data', () => {
    const item = record(dates[1], 'available', '10:00');
    item.periods.push({ ...item.periods[0], from: '10:00', to: '11:00' });
    expect(compactPeriodSummary(item, false)).toBe('09:00–11:00');
    expect(mergedAvailablePeriods(item)).toHaveLength(1);
    expect(item.periods[0].to).toBe('10:00');
  });
  it('does not imply that gaps or different restrictions are continuously usable', () => {
    const item = record(dates[1], 'partially_available', '10:00');
    item.periods.push({ ...item.periods[0], from: '12:00', to: '13:00' });
    expect(compactPeriodSummary(item, false)).toBe('2枠');
    expect(compactPeriodSummary(item, true)).toBe('2 time slots');
    item.periods[1].from = '10:00';
    item.periods[1].eligibility = 'local_resident_worker_student';
    expect(mergedAvailablePeriods(item)).toHaveLength(2);
    item.periods[1].eligibility = 'public';
    item.periods[1].conditions = ['受付が必要'];
    expect(mergedAvailablePeriods(item)).toHaveLength(2);
  });
  it('keeps visitor restrictions and hides machine evidence identifiers', () => {
    const conditions = ['official_general_opening', 'equipment_not_allowed', 'annual_pass_required_for_individual_use', '受付は終了30分前まで', 'unknown_internal_code'];
    expect(visitorConditions(conditions, false)).toEqual(['用具の使用不可', '個人利用は年間定期利用者のみ', '受付は終了30分前まで']);
    expect(visitorConditions(conditions, true)[0]).toBe('Equipment use is not allowed');
    expect(visitorConditions(['blank_defined_as_track_only_opening'], false)).toEqual(['トラックのみ利用可']);
  });
});

 describe('visitor-facing guidance', () => {
  it('hides collector explanations while retaining practical restrictions and unfamiliar prose', () => {
    expect(visitorConditions(['空欄時間はunknown', '空欄はunknown', '陸上競技場欄だけを判定',
      '公式の日付指定一般開放表', 'PDF凡例が空欄を開放と明示', '早朝地域開放規則とPDF変更欄を結合',
      '公式Xの追加個人利用日はcollector対象外', '日別statusがtextではなくvector図形のため、安全な判定対象外',
      'No PDF published for 2026-11-01', '当日変更の可能性あり', 'トラック第1レーンは個人使用禁止',
      '利用3日前までにお申込みください。', '受付は終了30分前まで', '初めての方は登録が必要です。'], false))
      .toEqual(['当日変更の可能性あり', 'トラック第1レーンは個人使用禁止', '利用3日前までにお申込みください。',
        '受付は終了30分前まで', '初めての方は登録が必要です。']);
  });
  it('rewrites meaningful time and area caveats instead of discarding them', () => {
    expect(visitorConditions(['12:00〜13:00は判定対象外', 'Bは外周ジョギングのみ'], false))
      .toEqual(['12:00〜13:00の利用は施設にご確認ください', '外周ジョギングのみ']);
    expect(visitorConditions(['12:00〜13:00は判定対象外'], true))
      .toEqual(['Confirm use between 12:00 and 13:00 with the facility']);
  });
});


describe('today decision and visitor restrictions', () => {
  function fresh(status: TrackAvailability['status'] = 'available') {
    const item = record(dates[0], status);
    item.freshness.expiresAt = '2026-10-13T23:59:59+09:00';
    return item;
  }
  it('distinguishes ended slots, later slots, missing times and unconfirmed dates', () => {
    const item = fresh();
    expect(todayUseSummary(item, dates[0], now, false)).toBe('本日の利用枠あり');
    item.periods[0].to = '11:00';
    expect(todayUseSummary(item, dates[0], now, false)).toBe('本日の確認済み枠は終了');
    item.periods.push({ ...item.periods[0], from: '18:00', to: '19:00' });
    expect(todayUseSummary(item, dates[0], now, true)).toBe('Confirmed periods today');
    item.periods = [{ ...item.periods[0], from: null, to: null }];
    expect(todayUseSummary(item, dates[0], now, false)).toBe('開放日確認済み・時間は要確認');
    expect(todayUseSummary(fresh('unavailable'), dates[0], now, false)).toBe('利用不可');
    expect(todayUseSummary(fresh('unknown'), dates[0], now, false)).toBe('要確認');
    expect(todayUseSummary(item, dates[1], now, false)).toBe('要確認');
    expect(todayUseSummary(undefined, dates[0], now, false)).toBe('要確認');
    item.freshness.expiresAt = now.toISOString();
    expect(todayUseSummary(item, dates[0], now, false)).toBe('要確認');
  });
  it('preserves closure reasons and removes duplicated conditions, not restrictions', () => {
    const item = fresh('unavailable');
    item.periods = [{ from: null, to: null, status: 'unavailable', scope: 'full_track', eligibility: 'public', conditions: ['2026年11月2日〜2027年2月28日（予定）は公認更新工事のため休場。'] }];
    expect(scheduleWarnings(item, false)).toContain(item.periods[0].conditions[0]);
    item.status = 'available'; item.periods[0].status = 'available';
    item.periods[0].conditions = ['受付は20:10まで', '屋外施設のため天候変更あり'];
    item.warnings = ['受付は20:10まで', '屋外施設のため天候変更あり', '芝生立ち入り不可'];
    expect(scheduleWarnings(item, false)).toEqual(['芝生立ち入り不可']);
  });
  it('does not suggest lunch access during a full-day Wadabori closure', () => {
    const item = fresh('unavailable'); item.trackId = 'wadabori-park-seibiyama-track';
    item.warnings = ['12:00〜13:00は判定対象外'];
    expect(scheduleWarnings(item, false)).toEqual(['終日の整備・貸切日は12:00〜13:00も利用できません。']);
    item.status = 'available';
    expect(scheduleWarnings(item, false)).toEqual(['12:00〜13:00の利用は施設にご確認ください']);
    item.status = 'unknown'; item.unknownReason = 'source_stale';
    expect(scheduleWarnings(item, false)).toEqual([]);
  });
});
