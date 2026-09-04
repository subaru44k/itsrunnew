import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  collectAvailability,
  enforceFreshness,
  makeRecord,
  parseHikarigaoka,
  parseEdogawaWeekly,
  parseKomazawa,
  parseKoshigayaToday,
  parseMachidaGion,
  parseMusashino,
  parseNissanTrack,
  parseTokyoGymnasium,
} from './collectors';
import { sourceUrls } from './config';
import { collectAvailabilityRange } from './range';

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`fixtures/${name}`, import.meta.url)), 'utf8');
const now = new Date('2026-08-24T03:00:00.000Z');

describe('availability collectors', () => {
  it('parses structured HTML without treating missing periods as unavailable', () => {
    const result = parseMusashino(fixture('musashino-success.html'), { date: '2026-08-24', now });
    expect(result.status).toBe('partially_available');
    expect(result.periods.map(period => period.status)).toEqual(['available', 'available', 'unavailable']);
    expect(result.periods[1].scope).toBe('jogging_course_only');

    const noInformation = parseMusashino(fixture('musashino-success.html'), { date: '2026-08-25', now });
    expect(noInformation.status).toBe('unknown');
    expect(noInformation.unknownReason).toBe('outside_published_period');
  });

  it('uses explicit closure as negative evidence', () => {
    const result = parseHikarigaoka(fixture('hikarigaoka-closure.html'), { date: '2026-08-24', now });
    expect(result.status).toBe('unavailable');
    expect(result.periods[0].conditions).toContain('facility_renovation');
  });

  it('parses a course-specific calendar as partial availability', () => {
    const result = parseTokyoGymnasium(fixture('tokyo-calendar.html'), { date: '2026-08-24', now });
    expect(result.status).toBe('partially_available');
    expect(result.periods).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: '09:00', status: 'available', scope: 'lane_subset' }),
      expect.objectContaining({ from: '10:00', status: 'unavailable' }),
    ]));
  });

  it('reuses the TEF calendar adapter with facility-specific rows and time ranges', () => {
    const result = parseKomazawa(fixture('komazawa-calendar.html'), { date: '2026-08-24', now });
    expect(result.status).toBe('partially_available');
    expect(result.periods).toEqual([
      expect.objectContaining({ from: '09:00', to: '12:30', status: 'unavailable' }),
      expect.objectContaining({ from: '13:00', to: '17:00', status: 'available' }),
    ]);
    const closed = parseKomazawa(fixture('komazawa-calendar.html').replace('○ 一般開放', '× 整備'), { date: '2026-08-24', now });
    expect(closed.status).toBe('unavailable');
    expect(() => parseKomazawa("<input name='h_targetDate' value=2026年08月24日><p>一般開放</p>", { date: '2026-08-24', now })).toThrow(/table/);
    expect(parseKomazawa("<input name='h_targetDate' value=2026年09月20日><p>一般開放予定は準備中</p>", { date: '2026-09-20', now })).toMatchObject({ status: 'unknown', unknownReason: 'schedule_not_published' });
  });

  it('parses a fresh weekly table and rejects dates outside its published week', () => {
    const html = fixture('edogawa-weekly.html');
    expect(parseEdogawaWeekly(html, { date: '2026-08-24', now }).status).toBe('available');
    const partial = parseEdogawaWeekly(html, { date: '2026-08-26', now });
    expect(partial.status).toBe('partially_available');
    expect(partial.periods.map(period => period.status)).toEqual(['available', 'unavailable', 'unavailable']);
    expect(parseEdogawaWeekly(html, { date: '2026-09-02', now })).toMatchObject({ status: 'unknown', unknownReason: 'outside_published_period' });
    expect(parseEdogawaWeekly(html, { date: '2026-08-24', now: new Date('2026-08-25T03:00:00Z') })).toMatchObject({ status: 'unknown', unknownReason: 'source_stale' });
  });

  it('uses only the explicitly dated Koshigaya current-status block', () => {
    const html = fixture('koshigaya-today.html');
    expect(parseKoshigayaToday(html, { date: '2026-08-24', now })).toMatchObject({
      status: 'partially_available', periods: [expect.objectContaining({ from: '09:00', to: '17:00', status: 'available' })],
    });
    expect(parseKoshigayaToday(html, { date: '2026-08-25', now })).toMatchObject({ status: 'unknown', unknownReason: 'outside_published_period' });
    expect(parseKoshigayaToday(html.replace('個人利用できます。（9時～17時）', '予定は施設へ確認'), { date: '2026-08-24', now })).toMatchObject({ status: 'unknown', unknownReason: 'insufficient_information' });
  });

  it('parses Nissan events for the exact facility label and preserves registration warnings', () => {
    const html = fixture('nissan-track.html');
    const stadium = parseNissanTrack(html, { date: '2026-09-11', now }, 'nissan-stadium-track');
    expect(stadium).toMatchObject({
      trackId: 'nissan-stadium-track',
      status: 'partially_available',
      source: { url: 'https://www.nissan-stadium.jp/track/index.php' },
      periods: [{ from: '17:00', to: '21:00', status: 'available', scope: 'full_track', eligibility: 'public' }],
    });
    expect(stadium.warnings.join(' ')).toMatch(/完全予約制|利用3日前/);
    expect(stadium.warnings.join(' ')).toMatch(/先着|定員/);
    expect(stadium.warnings.join(' ')).toMatch(/中止|閉鎖/);

    const field = parseNissanTrack(html, { date: '2026-09-21', now }, 'nissan-field-kozukue');
    expect(field).toMatchObject({
      trackId: 'nissan-field-kozukue',
      status: 'partially_available',
      periods: [{ from: '09:00', to: '12:00', status: 'available', scope: 'full_track', eligibility: 'public' }],
    });
  });

  it('does not cross-match Nissan venues and keeps unlisted or stale dates unknown', () => {
    const html = fixture('nissan-track.html');
    expect(parseNissanTrack(html, { date: '2026-09-11', now }, 'nissan-field-kozukue')).toMatchObject({
      status: 'unknown', unknownReason: 'outside_published_period', periods: [],
    });
    expect(parseNissanTrack(html, { date: '2026-09-12', now }, 'nissan-stadium-track')).toMatchObject({
      status: 'unknown', unknownReason: 'outside_published_period', periods: [],
    });
    const stale = html.replaceAll('2026', '2025');
    expect(parseNissanTrack(stale, { date: '2026-09-11', now }, 'nissan-stadium-track')).toMatchObject({
      status: 'unknown', unknownReason: 'source_stale', periods: [],
    });
    expect(parseNissanTrack(html.replace('17時～21時', '開催予定なし'), { date: '2026-09-11', now }, 'nissan-stadium-track')).toMatchObject({
      status: 'unknown', periods: [],
    });
    expect(() => parseNissanTrack(html.replace('17時～21時', '17時'), { date: '2026-09-11', now }, 'nissan-stadium-track')).toThrow(/time/);
    expect(() => parseNissanTrack('<h1>トラック個人利用</h1>', { date: '2026-09-11', now }, 'nissan-stadium-track')).toThrow(/anchors/);
  });

  it('fetches the shared Nissan source once and represents each facility once', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url === sourceUrls.nissan) return new Response(fixture('nissan-track.html'));
      return new Response('source');
    }) as typeof fetch;
    const result = await collectAvailability('2026-09-11', { now, fetchImpl });
    const nissan = result.filter(item => item.trackId === 'nissan-stadium-track' || item.trackId === 'nissan-field-kozukue');
    expect(nissan).toHaveLength(2);
    expect(nissan.map(item => item.trackId).sort()).toEqual(['nissan-field-kozukue', 'nissan-stadium-track']);
    expect(calls.filter(url => url === sourceUrls.nissan)).toHaveLength(1);
  });

  it('parses Machida Event Organiser personal, dedicated, and closure events', () => {
    const html = fixture('machida-gion-events.json');
    expect(parseMachidaGion(html, { date: '2026-09-01', now })).toMatchObject({
      trackId: 'machida-gion-stadium',
      status: 'partially_available',
      source: {
        publicationFormat: 'calendar_json',
        landingPageUrl: 'https://www.nozuta-park.com/calender.html',
      },
      periods: [{ from: '09:00', to: '18:00', status: 'available', scope: 'full_track', eligibility: 'public' }],
    });
    expect(parseMachidaGion(html, { date: '2026-09-06', now }).periods[0]).toMatchObject({ from: '09:00', to: '18:00' });
    expect(parseMachidaGion(html, { date: '2026-09-13', now })).toMatchObject({
      status: 'unavailable',
      periods: [{ from: '09:00', to: '18:00', status: 'unavailable', conditions: ['explicit_dedicated_use_event'] }],
    });
    expect(parseMachidaGion(html, { date: '2026-09-14', now })).toMatchObject({
      status: 'unavailable',
      periods: [{ from: null, to: null, status: 'unavailable', conditions: ['explicit_facility_closure'] }],
    });
    expect(parseMachidaGion(html, { date: '2026-09-08', now })).toMatchObject({
      status: 'unknown', unknownReason: 'outside_published_period', periods: [],
    });
    expect(parseMachidaGion(html, { date: '2026-09-01', now }).warnings.join(' ')).toContain('変更する場合がございます');
  });

  it('fails closed for malformed or contradictory Machida events', () => {
    const events = JSON.parse(fixture('machida-gion-events.json')) as Array<Record<string, unknown>>;
    events[0].end = 'not-an-iso-date';
    expect(parseMachidaGion(JSON.stringify(events), { date: '2026-09-01', now })).toMatchObject({
      status: 'unknown', unknownReason: 'parse_failed', periods: [],
    });

    const contradictory = JSON.parse(fixture('machida-gion-events.json')) as Array<Record<string, unknown>>;
    contradictory.push({
      ...contradictory[0],
      url: 'https://www.nozuta-park.com/events/event/personal-0901-duplicate',
      description: 'この日はスタジアムの個人利用が可能です。【利用時間】10:00-12:00',
    });
    expect(parseMachidaGion(JSON.stringify(contradictory), { date: '2026-09-01', now })).toMatchObject({
      status: 'unknown', unknownReason: 'parse_failed', periods: [],
    });

    const wrongDescription = JSON.parse(fixture('machida-gion-events.json')) as Array<Record<string, unknown>>;
    wrongDescription[0].description = 'この日はスタジアムの個人利用について確認が必要です。【利用時間】9:00-18:00';
    expect(parseMachidaGion(JSON.stringify(wrongDescription), { date: '2026-09-01', now })).toMatchObject({
      status: 'unknown', unknownReason: 'parse_failed', periods: [],
    });
  });

  it('uses a month-bounded Machida endpoint and represents the facility once', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.startsWith(sourceUrls.machidaGion)) return new Response(fixture('machida-gion-events.json'));
      return new Response('source');
    }) as typeof fetch;
    const single = await collectAvailability('2026-09-01', { now, fetchImpl });
    expect(single.filter(item => item.trackId === 'machida-gion-stadium')).toHaveLength(1);
    expect(single.find(item => item.trackId === 'machida-gion-stadium')).toMatchObject({ status: 'partially_available' });
    calls.length = 0;
    const ranged = await collectAvailabilityRange('2026-09-29', 5, { now, fetchImpl });
    const machidaUrls = calls.filter(url => url.startsWith(sourceUrls.machidaGion));
    expect(machidaUrls).toHaveLength(2);
    expect(new Set(machidaUrls).size).toBe(2);
    expect(machidaUrls.filter(url => url.includes('start=2026-09-01') && url.includes('end=2026-10-01'))).toHaveLength(1);
    expect(machidaUrls.filter(url => url.includes('start=2026-10-01') && url.includes('end=2026-11-01'))).toHaveLength(1);
    expect(ranged.datasets.every(dataset => dataset.facilities.filter(item => item.trackId === 'machida-gion-stadium').length === 1)).toBe(true);
  });

  it('downgrades stale records to unknown', () => {
    const record = makeRecord({
      trackId: 'example', date: '2026-08-24', now, status: 'available', url: 'https://example.test',
      publicationFormat: 'fixed_schedule', collector: 'test',
    });
    const stale = enforceFreshness(record, new Date('2026-08-25T00:00:00+09:00'));
    expect(stale.status).toBe('unknown');
    expect(stale.unknownReason).toBe('source_stale');
  });

  it('returns unknown for fixed non-match and partial for a fixed match', async () => {
    const sourceText = [
      '貸切利用不可日 定期一般公開日 毎週水曜日 第1日曜日 第3土曜日',
      '個人無料開放 祝日を除く毎週火曜日 第2・4土曜日',
      '貸切使用可能日 毎月第２日曜日 第４日曜日',
      '一般開放日 毎週水曜日 夜間のみ',
      '第一・第三木曜日が一般有料開放 利用時間 9:00〜17:00',
      '毎月第1日曜日 毎月第3土曜日 毎週水曜日 午前9時～午後9時',
      '利用日 月曜日・水曜日・金曜日 午前9時から午後9時まで',
      '一般公開日について 毎週水曜日と第一日曜日、第三土曜日 無料にてお使いになれます',
    ].join(' ');
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url === sourceUrls.hikarigaoka) return new Response(fixture('hikarigaoka-closure.html'));
      if (url === sourceUrls.musashino) return new Response(fixture('musashino-success.html'));
      if (url === sourceUrls.tokyoGymnasium) return new Response(fixture('tokyo-calendar.html'));
      if (url === sourceUrls.komazawa) return new Response(fixture('komazawa-calendar.html'));
      if (url === sourceUrls.edogawa) return new Response(fixture('edogawa-weekly.html'));
      if (url === sourceUrls.koshigaya) return new Response(fixture('koshigaya-today.html'));
      return new Response(sourceText);
    }) as typeof fetch;
    const monday = await collectAvailability('2026-08-24', { now, fetchImpl });
    expect(monday.find(item => item.trackId === 'oizumi-chuo-park-track')?.status).toBe('unknown');
    expect(monday.find(item => item.trackId === 'oizumi-chuo-park-track')?.status).not.toBe('unavailable');

    const tuesday = await collectAvailability('2026-08-25', { now, fetchImpl });
    const asaka = tuesday.find(item => item.trackId === 'asaka-chuo-park-track');
    expect(asaka?.status).toBe('partially_available');
    expect(asaka?.periods[0]).toMatchObject({ from: '17:15', to: '19:00', status: 'available' });

    const holiday = await collectAvailability('2026-11-03', { now, fetchImpl });
    expect(holiday.find(item => item.trackId === 'asaka-chuo-park-track')).toMatchObject({ status: 'unknown', unknownReason: 'insufficient_information' });

    const closureEnd = await collectAvailability('2026-11-30', { now, fetchImpl });
    expect(closureEnd.find(item => item.trackId === 'yoyogi-park-athletic-track')).toMatchObject({ status: 'unavailable' });
    const afterPlannedClosure = await collectAvailability('2026-12-01', { now, fetchImpl });
    expect(afterPlannedClosure.find(item => item.trackId === 'yoyogi-park-athletic-track')).toMatchObject({ status: 'unknown', unknownReason: 'insufficient_information' });

    const wednesday = await collectAvailability('2026-08-26', { now, fetchImpl });
    expect(wednesday.find(item => item.trackId === 'toneri-park-athletic-track')?.status).toBe('available');
    expect(wednesday.find(item => item.trackId === 'okudo-sports-center-track')?.status).toBe('available');
    expect(wednesday.find(item => item.trackId === 'akirudai-park-athletic-track')?.status).toBe('available');

    const firstThursday = await collectAvailability('2026-09-03', { now, fetchImpl });
    expect(firstThursday.find(item => item.trackId === 'oi-central-seaside-park-track')).toMatchObject({ status: 'partially_available' });
    expect(monday.find(item => item.trackId === 'oi-central-seaside-park-track')).toMatchObject({ status: 'unknown', unknownReason: 'insufficient_information' });
    expect(monday.find(item => item.trackId === 'setagaya-general-sports-track')).toMatchObject({ status: 'unknown', unknownReason: 'unsupported_source_type' });
    expect(monday.find(item => item.trackId === 'chiba-general-sports-center-track')).toMatchObject({
      status: 'unavailable',
      unknownReason: null,
      evidence: { collector: 'static-individual-use-eligibility' },
    });
  });

  it('distinguishes fetch and parse failures and keeps both unknown', async () => {
    const fetchFailure = (async () => { throw new TypeError('network failed'); }) as typeof fetch;
    const failed = await collectAvailability('2026-08-24', { now, fetchImpl: fetchFailure });
    expect(failed.filter(item => item.evidence.collector.endsWith('-fixed')).every(item => item.status === 'unknown')).toBe(true);
    expect(failed.find(item => item.trackId === 'hikarigaoka-park-track')?.unknownReason).toBe('fetch_failed');
    expect(failed.find(item => item.trackId === 'nerima-general-sports-park')).toMatchObject({ status: 'unknown', unknownReason: 'fetch_failed' });

    const invalidHtml = (async (input: string | URL | Request) => new Response(
      String(input) === sourceUrls.musashino
        ? '<h3>8月24日（月）の陸上競技場開放状況</h3>'
        : '<p>source changed</p>',
    )) as typeof fetch;
    const parsed = await collectAvailability('2026-08-24', { now, fetchImpl: invalidHtml });
    expect(parsed.find(item => item.trackId === 'musashino-athletic-track')).toMatchObject({ status: 'unknown', unknownReason: 'parse_failed' });
    expect(parsed.find(item => item.trackId === 'oizumi-chuo-park-track')).toMatchObject({ status: 'unknown', unknownReason: 'source_changed' });
  });
});
