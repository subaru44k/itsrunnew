import { createHash } from 'node:crypto';
import type { AvailabilityPeriod, TrackAvailability, UnknownReason } from '../../src/model/availability';
import { expansionFallbackSources, PARSER_VERSION, sourceUrls } from './config';
import { createPdfCollector, PdfCollectorError, pdfSourceConfigs } from './pdf';
import { tracks } from '../../src/model/tracks';

type FetchLike = typeof fetch;
type PublicationFormat = 'structured_html' | 'calendar_html' | 'weekly_notice' | 'fixed_schedule' | 'pdf' | 'reservation_system' | 'phone_only' | 'no_schedule_found';

interface CollectorContext {
  date: string;
  now: Date;
  fetchImpl: FetchLike;
}

interface RecordOptions {
  trackId: string;
  date: string;
  now: Date;
  status: TrackAvailability['status'];
  periods?: AvailabilityPeriod[];
  unknownReason?: UnknownReason | null;
  url: string;
  landingPageUrl?: string | null;
  publicationFormat: PublicationFormat;
  collector: string;
  fetchedAt?: string | null;
  publishedAt?: string | null;
  sourceHash?: string | null;
  confidence?: TrackAvailability['evidence']['confidence'];
  warnings?: string[];
  documentId?: string | null;
  parserVersion?: string;
}

const toIso = (date: Date) => date.toISOString();

export function dateParts(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error(`Invalid date: ${dateKey}`);
  const [, year, month, day] = match;
  const date = new Date(`${dateKey}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${dateKey}`);
  return { year: Number(year), month: Number(month), day: Number(day), date };
}

function nextDayStart(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

export function makeRecord(options: RecordOptions): TrackAvailability {
  const timestamp = toIso(options.now);
  return {
    trackId: options.trackId,
    date: options.date,
    timezone: 'Asia/Tokyo',
    status: options.status,
    periods: options.periods ?? [],
    unknownReason: options.unknownReason ?? null,
    source: {
      url: options.url,
      landingPageUrl: options.landingPageUrl ?? null,
      type: 'official',
      publicationFormat: options.publicationFormat,
      publishedAt: options.publishedAt ?? null,
      documentId: options.documentId ?? null,
    },
    freshness: {
      fetchedAt: options.fetchedAt ?? null,
      parsedAt: timestamp,
      checkedAt: timestamp,
      validForDate: options.date,
      expiresAt: nextDayStart(options.date),
    },
    evidence: {
      collector: options.collector,
      parserVersion: options.parserVersion ?? PARSER_VERSION,
      sourceHash: options.sourceHash ?? null,
      confidence: options.confidence ?? 'medium',
    },
    warnings: options.warnings ?? [],
  };
}

export function unknownRecord(options: Omit<RecordOptions, 'status'> & { unknownReason: UnknownReason }) {
  return makeRecord({ ...options, status: 'unknown', periods: [] });
}

export function enforceFreshness(record: TrackAvailability, now: Date) {
  if (now.getTime() < new Date(record.freshness.expiresAt).getTime()) return record;
  return { ...record, status: 'unknown' as const, periods: [], unknownReason: 'source_stale' as const };
}

function hash(text: string) {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

function stripHtml(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&times;/gi, '×')
    .replace(/&hellip;/gi, '…')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTime(text: string) {
  const match = /(\d{1,2})\s*(?:時|:)\s*(\d{2})?/.exec(text);
  if (!match) throw new Error(`Time not found: ${text}`);
  return `${match[1].padStart(2, '0')}:${match[2] ?? '00'}`;
}

function nthWeekday(date: Date) {
  return Math.floor((Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Tokyo', day: 'numeric' }).format(date)) - 1) / 7) + 1;
}

function weekday(date: Date) {
  const label = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', weekday: 'short' }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(label);
}

function tokyoDateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function publicPeriod(from: string | null, to: string | null, scope: AvailabilityPeriod['scope'] = 'full_track', conditions: string[] = [], eligibility: AvailabilityPeriod['eligibility'] = 'public'): AvailabilityPeriod {
  return { from, to, status: 'available', scope, eligibility, conditions };
}

function unavailablePeriod(from: string | null, to: string | null, conditions: string[]): AvailabilityPeriod {
  return { from, to, status: 'unavailable', scope: 'full_track', eligibility: 'public', conditions };
}

async function request(url: string, fetchImpl: FetchLike, init?: RequestInit) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(30000), ...init });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  return { html, sourceHash: hash(html) };
}

export function parseHikarigaoka(html: string, context: Omit<CollectorContext, 'fetchImpl' | 'now'> & { now: Date; fetchedAt?: string; sourceHash?: string }) {
  const text = stripHtml(html);
  if (!text.includes('陸上競技場') || !text.includes('８月から第二期工事') || !text.includes('８月～今年度末まで')) throw new Error('Expected closure notice not found');
  const inClosure = context.date >= '2026-08-01' && context.date <= '2027-03-31';
  if (!inClosure) return unknownRecord({ trackId: 'hikarigaoka-park-track', date: context.date, now: context.now, unknownReason: 'outside_published_period', url: sourceUrls.hikarigaoka, publicationFormat: 'structured_html', collector: 'hikarigaoka-html', fetchedAt: context.fetchedAt, sourceHash: context.sourceHash });
  return makeRecord({
    trackId: 'hikarigaoka-park-track', date: context.date, now: context.now, status: 'unavailable',
    periods: [unavailablePeriod(null, null, ['facility_renovation'])], url: sourceUrls.hikarigaoka,
    publicationFormat: 'structured_html', collector: 'hikarigaoka-html', fetchedAt: context.fetchedAt,
    publishedAt: '2026-07-23', sourceHash: context.sourceHash, confidence: 'high', warnings: ['2026年度末まで改修予定'],
  });
}

export function parseMusashino(html: string, context: Omit<CollectorContext, 'fetchImpl' | 'now'> & { now: Date; fetchedAt?: string; sourceHash?: string }) {
  const { month, day } = dateParts(context.date);
  const heading = new RegExp(`${month}月${day}日（[^）]+）の陸上競技場開放状況`);
  const start = html.search(heading);
  if (start < 0) return unknownRecord({ trackId: 'musashino-athletic-track', date: context.date, now: context.now, unknownReason: 'outside_published_period', url: sourceUrls.musashino, publicationFormat: 'structured_html', collector: 'musashino-html', fetchedAt: context.fetchedAt, sourceHash: context.sourceHash });
  const section = html.slice(start, html.indexOf('</table>', start) + 8);
  if (!section.includes('</table>')) throw new Error('Athletics table not found');
  const headers = [...section.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(match => stripHtml(match[1]));
  const cells = [...section.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => stripHtml(match[1]));
  if (headers.length < 1 || headers.length !== cells.length) throw new Error('Unexpected athletics table shape');
  const periods = headers.map((header, index) => {
    const [fromText, toText] = header.split(/～|〜/);
    const value = cells[index].replace(/\s/g, '');
    const from = normalizeTime(fromText);
    const to = normalizeTime(toText);
    if (value === 'A') return publicPeriod(from, to, 'track_and_jogging_course');
    if (value === 'B') return publicPeriod(from, to, 'jogging_course_only', ['track_unavailable']);
    if (value === '貸切' || value === '×') return unavailablePeriod(from, to, ['exclusive_use']);
    return { from, to, status: 'unknown' as const, scope: 'unknown' as const, eligibility: 'public' as const, conditions: ['conditional_or_unpublished'] };
  });
  const available = periods.filter(period => period.status === 'available');
  const fullTrack = available.filter(period => period.scope !== 'jogging_course_only');
  let status: TrackAvailability['status'] = 'unknown';
  if (available.length > 0) status = fullTrack.length === periods.length ? 'available' : 'partially_available';
  else if (periods.every(period => period.status === 'unavailable')) status = 'unavailable';
  return makeRecord({
    trackId: 'musashino-athletic-track', date: context.date, now: context.now, status, periods,
    unknownReason: status === 'unknown' ? 'insufficient_information' : null, url: sourceUrls.musashino,
    publicationFormat: 'structured_html', collector: 'musashino-html', fetchedAt: context.fetchedAt,
    sourceHash: context.sourceHash, confidence: 'high', warnings: ['当日変更・天候中止の可能性あり', 'Bは外周ジョギングのみ'],
  });
}

interface TefCalendarConfig {
  trackId: string;
  url: string;
  collector: string;
  rowLabel: string;
  scope: AvailabilityPeriod['scope'];
}

function headerRange(header: string) {
  const values = [...header.matchAll(/(\d{1,2})\s*[：:]\s*(\d{2})/g)]
    .map(match => `${match[1].padStart(2, '0')}:${match[2]}`);
  if (!values.length) throw new Error(`Time not found: ${header}`);
  const from = values[0];
  const to = values[1] ?? `${String(Number(from.slice(0, 2)) + 1).padStart(2, '0')}:00`;
  return { from, to };
}

export function parseTefCalendar(html: string, context: Omit<CollectorContext, 'fetchImpl' | 'now'> & { now: Date; fetchedAt?: string; sourceHash?: string }, config: TefCalendarConfig) {
  const { year, month, day } = dateParts(context.date);
  const expected = `${year}年${String(month).padStart(2, '0')}月${String(day).padStart(2, '0')}日`;
  if (!html.includes(`name='h_targetDate' value=${expected}`) && !html.includes(`name="h_targetDate" value="${expected}"`)) {
    return unknownRecord({ trackId: config.trackId, date: context.date, now: context.now, unknownReason: 'outside_published_period', url: config.url, publicationFormat: 'calendar_html', collector: config.collector, fetchedAt: context.fetchedAt, sourceHash: context.sourceHash });
  }
  const tables = [...html.matchAll(/<table class="opening-table[^>]*>([\s\S]*?)<\/table>/gi)].map(match => match[1]);
  const table = tables.find(value => stripHtml(value).includes(config.rowLabel));
  if (!table && context.date > tokyoDateKey(context.now)) {
    return unknownRecord({ trackId: config.trackId, date: context.date, now: context.now, unknownReason: 'schedule_not_published', url: config.url, publicationFormat: 'calendar_html', collector: config.collector, fetchedAt: context.fetchedAt, sourceHash: context.sourceHash });
  }
  if (!table) throw new Error('Opening table or target facility row not found');
  const headers = [...table.matchAll(/<th scope="col">([\s\S]*?)<\/th>/gi)].map(match => stripHtml(match[1]));
  const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)]
    .map(match => match[1])
    .filter(row => new RegExp(`<th scope="row">[\\s\\S]*?${config.rowLabel}`).test(row))
    .map(row => [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => stripHtml(cell[1])));
  if (headers.length === 0 || rows.length !== 1 || rows[0].length !== headers.length) throw new Error('Unexpected opening table shape');
  const periods: AvailabilityPeriod[] = headers.map((header, index) => {
    const values = rows.map(row => row[index]);
    const { from, to } = headerRange(header);
    if (values.some(value => value.includes('一般開放'))) return publicPeriod(from, to, config.scope, ['official_general_opening']);
    if (values.every(value => /貸切|休館|閉館|整備|利用不可/.test(value))) return unavailablePeriod(from, to, ['explicit_official_unavailable']);
    return { from, to, status: 'unknown', scope: config.scope, eligibility: 'public', conditions: ['unrecognized_status'] };
  });
  const hasAvailable = periods.some(period => period.status === 'available');
  const status: TrackAvailability['status'] = hasAvailable
    ? periods.every(period => period.status === 'available') ? 'available' : 'partially_available'
    : periods.every(period => period.status === 'unavailable') ? 'unavailable' : 'unknown';
  return makeRecord({
    trackId: config.trackId, date: context.date, now: context.now, status, periods,
    unknownReason: status === 'unknown' ? 'insufficient_information' : null, url: config.url,
    publicationFormat: 'calendar_html', collector: config.collector, fetchedAt: context.fetchedAt,
    sourceHash: context.sourceHash, confidence: 'high', warnings: ['公式の日付指定一般開放表', '当日変更の可能性あり'],
  });
}

export function parseTokyoGymnasium(html: string, context: Omit<CollectorContext, 'fetchImpl' | 'now'> & { now: Date; fetchedAt?: string; sourceHash?: string }) {
  return parseTefCalendar(html, context, { trackId: 'tokyo-metropolitan-gymnasium-track', url: sourceUrls.tokyoGymnasium, collector: 'tokyo-gymnasium-calendar', rowLabel: '50m 第1コース', scope: 'lane_subset' });
}

export function parseKomazawa(html: string, context: Omit<CollectorContext, 'fetchImpl' | 'now'> & { now: Date; fetchedAt?: string; sourceHash?: string }) {
  return parseTefCalendar(html, context, { trackId: 'komazawa-olympic-park-track', url: sourceUrls.komazawa, collector: 'komazawa-tef-calendar', rowLabel: '陸上競技場', scope: 'full_track' });
}

export function parseEdogawaWeekly(html: string, context: Omit<CollectorContext, 'fetchImpl' | 'now'> & { now: Date; fetchedAt?: string; sourceHash?: string }) {
  const text = stripHtml(html);
  if (!text.includes('一週間の利用予定表') || !text.includes('一般利用') || !text.includes('貸切利用')) throw new Error('Expected weekly schedule anchors not found');
  const todayMatch = /本日【\s*(\d{1,2})月(\d{1,2})日（[^）]+）\s*】/.exec(text);
  if (!todayMatch) throw new Error('Published week start not found');
  const currentKey = tokyoDateKey(context.now);
  if (`${currentKey.slice(5, 7)}/${currentKey.slice(8, 10)}` !== `${todayMatch[1].padStart(2, '0')}/${todayMatch[2].padStart(2, '0')}`) {
    return unknownRecord({ trackId: 'edogawa-athletic-stadium', date: context.date, now: context.now, unknownReason: 'source_stale', url: sourceUrls.edogawa, publicationFormat: 'calendar_html', collector: 'edogawa-weekly-table', fetchedAt: context.fetchedAt, sourceHash: context.sourceHash });
  }
  const requested = dateParts(context.date).date;
  const current = dateParts(currentKey).date;
  const dayDistance = Math.round((requested.getTime() - current.getTime()) / 86400000);
  if (dayDistance < 0 || dayDistance > 6) return unknownRecord({ trackId: 'edogawa-athletic-stadium', date: context.date, now: context.now, unknownReason: 'outside_published_period', url: sourceUrls.edogawa, publicationFormat: 'calendar_html', collector: 'edogawa-weekly-table', fetchedAt: context.fetchedAt, sourceHash: context.sourceHash });
  const { month, day } = dateParts(context.date);
  const articles = [...html.matchAll(/<article\b[^>]*class="[^"]*konzatsuguid[^"]*"[\s\S]*?<\/article>/gi)].map(match => match[0]);
  const article = articles.find(value => new RegExp(`${String(month).padStart(2, '0')}\s*[／/]\s*${String(day).padStart(2, '0')}`).test(stripHtml(value)));
  if (!article) return unknownRecord({ trackId: 'edogawa-athletic-stadium', date: context.date, now: context.now, unknownReason: 'outside_published_period', url: sourceUrls.edogawa, publicationFormat: 'calendar_html', collector: 'edogawa-weekly-table', fetchedAt: context.fetchedAt, sourceHash: context.sourceHash });
  const cells = [...article.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => stripHtml(match[1]));
  if (cells.length !== 5) throw new Error('Unexpected weekly row shape');
  const slots = [['09:00', '13:00'], ['13:00', '17:00'], ['17:00', '21:00']] as const;
  const periods = slots.map(([from, to], index) => {
    const value = cells[index + 2];
    if (value.includes('一般利用')) return publicPeriod(from, to);
    if (value.includes('貸切利用')) return unavailablePeriod(from, to, ['exclusive_use']);
    return { from, to, status: 'unknown' as const, scope: 'full_track' as const, eligibility: 'public' as const, conditions: ['unrecognized_status'] };
  });
  const status: TrackAvailability['status'] = periods.every(value => value.status === 'available') ? 'available'
    : periods.every(value => value.status === 'unavailable') ? 'unavailable'
      : periods.some(value => value.status === 'available') ? 'partially_available' : 'unknown';
  return makeRecord({ trackId: 'edogawa-athletic-stadium', date: context.date, now: context.now, status, periods, unknownReason: status === 'unknown' ? 'insufficient_information' : null, url: sourceUrls.edogawa, publicationFormat: 'calendar_html', collector: 'edogawa-weekly-table', fetchedAt: context.fetchedAt, sourceHash: context.sourceHash, confidence: 'high', warnings: ['公開範囲は当日から1週間', '大型大会等で変更される可能性あり'] });
}

export function parseKoshigayaToday(html: string, context: Omit<CollectorContext, 'fetchImpl' | 'now'> & { now: Date; fetchedAt?: string; sourceHash?: string }) {
  const text = stripHtml(html);
  if (!text.includes('本日の使用状況') || !text.includes('陸上競技場') || !text.includes('第2競技場')) throw new Error('Expected current-status anchors not found');
  const dateMatch = /(\d{4})年(\d{1,2})月(\d{1,2})日\s*本日の使用状況/.exec(text);
  if (!dateMatch) throw new Error('Current-status date missing');
  const publishedDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
  if (publishedDate !== context.date) return unknownRecord({ trackId: 'koshigaya-shirakobato-track', date: context.date, now: context.now, unknownReason: 'outside_published_period', url: sourceUrls.koshigaya, publicationFormat: 'structured_html', collector: 'koshigaya-today-status', fetchedAt: context.fetchedAt, sourceHash: context.sourceHash });
  const start = text.indexOf('陸上競技場', text.indexOf('本日の使用状況'));
  const end = text.indexOf('第2競技場', start);
  const section = text.slice(start, end);
  const available = /個人利用できます。?[（(]([^）)]+)[）)]/.exec(section);
  if (available) {
    const matches = [...available[1].matchAll(/(\d{1,2})時\s*[～〜~-]\s*(\d{1,2})時/g)];
    if (matches.length !== 1) throw new Error('Individual-use time range missing');
    return makeRecord({ trackId: 'koshigaya-shirakobato-track', date: context.date, now: context.now, status: 'partially_available', periods: [publicPeriod(`${matches[0][1].padStart(2, '0')}:00`, `${matches[0][2].padStart(2, '0')}:00`)], url: sourceUrls.koshigaya, publicationFormat: 'structured_html', collector: 'koshigaya-today-status', fetchedAt: context.fetchedAt, sourceHash: context.sourceHash, confidence: 'high', warnings: ['公式の当日更新情報', '天候による当日変更の可能性あり'] });
  }
  if (/個人利用できません|利用休止|終日貸切/.test(section)) return makeRecord({ trackId: 'koshigaya-shirakobato-track', date: context.date, now: context.now, status: 'unavailable', periods: [unavailablePeriod(null, null, ['explicit_official_unavailable'])], url: sourceUrls.koshigaya, publicationFormat: 'structured_html', collector: 'koshigaya-today-status', fetchedAt: context.fetchedAt, sourceHash: context.sourceHash, confidence: 'high' });
  return unknownRecord({ trackId: 'koshigaya-shirakobato-track', date: context.date, now: context.now, unknownReason: 'insufficient_information', url: sourceUrls.koshigaya, publicationFormat: 'structured_html', collector: 'koshigaya-today-status', fetchedAt: context.fetchedAt, sourceHash: context.sourceHash, warnings: ['陸上競技場欄に明示的な個人利用可否なし'] });
}

interface FixedConfig {
  trackId: string;
  url: string;
  collector: string;
  evidence: string[];
  evaluate: (date: string) => { status: TrackAvailability['status']; periods?: AvailabilityPeriod[]; unknownReason?: UnknownReason; warnings?: string[] };
}

function fullDayFixed(date: string, weekdays: number[], nth?: number[]) {
  const { date: parsed } = dateParts(date);
  const day = weekday(parsed);
  return weekdays.includes(day) && (!nth || nth.includes(nthWeekday(parsed)));
}

const fixedConfigs: FixedConfig[] = [
  {
    trackId: 'oizumi-chuo-park-track', url: sourceUrls.oizumi, collector: 'oizumi-fixed',
    evidence: ['貸切利用不可日', '定期一般公開日', '毎週水曜日'],
    evaluate: date => {
      if ((date.slice(5) >= '12-29') || (date.slice(5) <= '01-03')) return { status: 'unavailable', periods: [unavailablePeriod(null, null, ['year_end_closure'])] };
      const open = fullDayFixed(date, [3]) || fullDayFixed(date, [0], [1]) || fullDayFixed(date, [6], [3]);
      return open ? { status: 'available', periods: [publicPeriod(null, null)] } : { status: 'unknown', unknownReason: 'insufficient_information' };
    },
  },
  {
    trackId: 'akatsuka-park-track', url: sourceUrls.akatsuka, collector: 'akatsuka-fixed',
    evidence: ['貸切利用不可日', '毎週水曜日', '第1日曜日'],
    evaluate: date => {
      if ((date.slice(5) >= '12-29') || (date.slice(5) <= '01-03')) return { status: 'unavailable', periods: [unavailablePeriod(null, null, ['year_end_closure'])] };
      const open = fullDayFixed(date, [3]) || fullDayFixed(date, [0], [1]) || fullDayFixed(date, [6], [3]);
      return open ? { status: 'available', periods: [publicPeriod(null, null)] } : { status: 'unknown', unknownReason: 'insufficient_information' };
    },
  },
  {
    trackId: 'inokashira-park-track', url: sourceUrls.inokashira, collector: 'inokashira-fixed',
    evidence: ['貸切使用可能日', '毎月第２日曜日', '第４日曜日'],
    evaluate: date => {
      const { date: parsed } = dateParts(date);
      const day = weekday(parsed);
      const reservable = day === 3 || (day === 0 && [2, 4].includes(nthWeekday(parsed)));
      return reservable
        ? { status: 'unknown', unknownReason: 'insufficient_information' }
        : { status: 'available', periods: [publicPeriod(null, null)], warnings: ['公的行事・管理都合による変更の可能性あり'] };
    },
  },
  {
    trackId: 'asaka-chuo-park-track', url: sourceUrls.asaka, collector: 'asaka-fixed',
    evidence: ['個人無料開放', '祝日を除く毎週火曜日', '第2・4土曜日'],
    evaluate: date => {
      if (date < '2026-04-01' || date > '2027-03-31') return { status: 'unknown', unknownReason: 'outside_published_period' };
      if (['2026-05-05', '2026-08-11', '2026-09-22', '2026-11-03', '2027-02-23'].includes(date)) {
        return { status: 'unknown', unknownReason: 'insufficient_information', warnings: ['祝日は定期個人無料開放の対象外'] };
      }
      const { date: parsed } = dateParts(date);
      const day = weekday(parsed);
      const nth = nthWeekday(parsed);
      const common = ['市内在住・在勤・在学者限定', '大会・天候で中止の可能性あり'];
      if (day === 2) {
        const period = [1, 3, 5].includes(nth)
          ? publicPeriod('19:15', '21:00', 'full_track', common, 'local_resident_worker_student')
          : publicPeriod('17:15', '19:00', 'full_track', common, 'local_resident_worker_student');
        return { status: 'partially_available', periods: [period], warnings: common };
      }
      if (day === 6 && [2, 4].includes(nth)) return { status: 'partially_available', periods: [publicPeriod('09:00', '12:45', 'full_track', common, 'local_resident_worker_student')], warnings: common };
      return { status: 'unknown', unknownReason: 'insufficient_information' };
    },
  },
  {
    trackId: 'yoyogi-park-athletic-track', url: sourceUrls.yoyogi, collector: 'yoyogi-fixed',
    evidence: ['一般開放日', '毎週水曜日', '夜間のみ'],
    evaluate: date => {
      if (date >= '2026-07-01' && date <= '2026-11-30') return { status: 'unavailable', periods: [unavailablePeriod(null, null, ['certification_renewal_construction'])], warnings: ['工事期間は延長される可能性あり'] };
      if ((date.slice(5) >= '12-29') || (date.slice(5) <= '01-03')) return { status: 'unavailable', periods: [unavailablePeriod(null, null, ['year_end_closure'])] };
      if (fullDayFixed(date, [3]) || fullDayFixed(date, [0], [1]) || fullDayFixed(date, [6], [3])) return { status: 'available', periods: [publicPeriod('09:00', '21:00')] };
      const { date: parsed } = dateParts(date);
      if ([2, 5, 6].includes(weekday(parsed))) return { status: 'partially_available', periods: [publicPeriod('18:00', '21:00')], warnings: ['貸切・整備・臨時変更を公式告知で確認'] };
      return { status: 'unknown', unknownReason: 'insufficient_information' };
    },
  },
  {
    trackId: 'oi-central-seaside-park-track', url: sourceUrls.oi, collector: 'oi-first-third-thursday-fixed',
    evidence: ['第一・第三木曜日が一般有料開放', '利用時間', '9:00〜17:00'],
    evaluate: date => {
      if (['12-31', '01-01'].includes(date.slice(5))) return { status: 'unavailable', periods: [unavailablePeriod(null, null, ['annual_closure'])] };
      const open = fullDayFixed(date, [4], [1, 3]);
      return open
        ? { status: 'partially_available', periods: [publicPeriod('09:00', '17:00')], warnings: ['大会等による変更は公式施設へ要確認'] }
        : { status: 'unknown', unknownReason: 'insufficient_information' };
    },
  },
  {
    trackId: 'toneri-park-athletic-track', url: sourceUrls.toneri, collector: 'toneri-fixed-general-opening',
    evidence: ['毎月第1日曜日', '毎月第3土曜日', '毎週水曜日', '午前9時～午後9時'],
    evaluate: date => {
      if ((date.slice(5) >= '12-29') || (date.slice(5) <= '01-03')) return { status: 'unavailable', periods: [unavailablePeriod(null, null, ['year_end_closure'])] };
      const open = fullDayFixed(date, [3]) || fullDayFixed(date, [0], [1]) || fullDayFixed(date, [6], [3]);
      return open
        ? { status: 'available', periods: [publicPeriod('09:00', '21:00', 'full_track', ['track_only'])], warnings: ['用具を使用する場合や当日変更は施設へ確認'] }
        : { status: 'unknown', unknownReason: 'insufficient_information', warnings: ['公式Xの追加個人利用日はcollector対象外'] };
    },
  },
  {
    trackId: 'okudo-sports-center-track', url: sourceUrls.okudo, collector: 'okudo-mwf-fixed',
    evidence: ['利用日', '月曜日・水曜日・金曜日', '午前9時から午後9時まで'],
    evaluate: date => {
      const { date: parsed } = dateParts(date);
      const open = [1, 3, 5].includes(weekday(parsed));
      return open
        ? { status: 'available', periods: [publicPeriod('09:00', '21:00')], warnings: ['事業・大会・グラウンド不良等で利用不可の場合あり'] }
        : { status: 'unknown', unknownReason: 'insufficient_information', warnings: ['他曜日は3日前時点の貸切有無を電話確認'] };
    },
  },
  {
    trackId: 'akirudai-park-athletic-track', url: sourceUrls.akirudai, collector: 'akirudai-fixed-general-opening',
    evidence: ['一般公開日について', '毎週水曜日と第一日曜日、第三土曜日', '無料にてお使いになれます'],
    evaluate: date => {
      const open = fullDayFixed(date, [3]) || fullDayFixed(date, [0], [1]) || fullDayFixed(date, [6], [3]);
      return open
        ? { status: 'available', periods: [publicPeriod(null, null, 'full_track', ['equipment_not_allowed'])], warnings: ['用具を使用しない陸上競技練習のみ', '臨時変更は公式Xまたはサービスセンターで確認'] }
        : { status: 'unknown', unknownReason: 'insufficient_information', warnings: ['追加開放・貸切状況は公式Xまたは電話確認'] };
    },
  },
];

async function collectFixed(config: FixedConfig, context: CollectorContext) {
  try {
    const source = await request(config.url, context.fetchImpl);
    const text = stripHtml(source.html);
    if (config.evidence.some(value => !text.includes(value))) throw new Error('Fixed schedule evidence changed');
    const result = config.evaluate(context.date);
    return makeRecord({
      trackId: config.trackId, date: context.date, now: context.now, status: result.status,
      periods: result.periods, unknownReason: result.unknownReason ?? null, url: config.url,
      publicationFormat: 'fixed_schedule', collector: config.collector, fetchedAt: toIso(context.now),
      sourceHash: source.sourceHash, confidence: 'medium', warnings: result.warnings,
    });
  } catch (error) {
    const reason: UnknownReason = error instanceof TypeError || /HTTP|fetch|abort|network/i.test(String(error)) ? 'fetch_failed' : 'source_changed';
    return unknownRecord({ trackId: config.trackId, date: context.date, now: context.now, unknownReason: reason, url: config.url, publicationFormat: 'fixed_schedule', collector: config.collector, warnings: [String(error)] });
  }
}

async function collectHtml(trackId: string, url: string, publicationFormat: 'structured_html' | 'calendar_html', collector: string, context: CollectorContext, parser: typeof parseHikarigaoka, datePost = false) {
  try {
    const body = datePost
      ? new URLSearchParams({ h_targetDate: `${context.date.slice(0, 4)}年${context.date.slice(5, 7)}月${context.date.slice(8, 10)}日` })
      : undefined;
    const source = await request(url, context.fetchImpl, body ? { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body } : undefined);
    return parser(source.html, { date: context.date, now: context.now, fetchedAt: toIso(context.now), sourceHash: source.sourceHash });
  } catch (error) {
    const reason: UnknownReason = error instanceof TypeError || /HTTP|fetch|abort|network/i.test(String(error)) ? 'fetch_failed' : 'parse_failed';
    return unknownRecord({ trackId, date: context.date, now: context.now, unknownReason: reason, url, publicationFormat, collector, warnings: [String(error)] });
  }
}

async function collectPdf(config: (typeof pdfSourceConfigs)[number], context: CollectorContext, collector = createPdfCollector(context.fetchImpl)) {
  try {
    const result = await collector.collect(config, context.date, context.now);
    return makeRecord({
      trackId: config.trackId,
      date: context.date,
      now: context.now,
      status: result.status,
      periods: result.periods,
      unknownReason: result.unknownReason ?? null,
      url: result.pdfUrl,
      landingPageUrl: result.landingPageUrl,
      publicationFormat: 'pdf',
      collector: result.parser,
      parserVersion: result.parserVersion,
      fetchedAt: result.fetchedAt,
      publishedAt: result.publishedAt,
      sourceHash: result.sourceHash,
      documentId: result.documentId,
      confidence: result.confidence,
      warnings: result.warnings,
    });
  } catch (error) {
    const reason: UnknownReason = error instanceof PdfCollectorError ? error.reason : 'parse_failed';
    return unknownRecord({
      trackId: config.trackId,
      date: context.date,
      now: context.now,
      unknownReason: reason,
      url: error instanceof PdfCollectorError && error.sourceUrl ? error.sourceUrl : config.landingPageUrl,
      landingPageUrl: config.landingPageUrl,
      publicationFormat: 'pdf',
      collector: config.parser,
      parserVersion: config.parserVersion,
      confidence: 'low',
      warnings: [error instanceof Error ? error.message : String(error)],
    });
  }
}

export async function collectAvailability(date: string, options: { now?: Date; fetchImpl?: FetchLike; pdfCollector?: ReturnType<typeof createPdfCollector> } = {}) {
  dateParts(date);
  const context: CollectorContext = { date, now: options.now ?? new Date(), fetchImpl: options.fetchImpl ?? fetch };
  // Official sources are intentionally fetched sequentially to avoid bursts to the same operator.
  const supported = [
    await collectHtml('hikarigaoka-park-track', sourceUrls.hikarigaoka, 'structured_html', 'hikarigaoka-html', context, parseHikarigaoka),
    await collectHtml('musashino-athletic-track', sourceUrls.musashino, 'structured_html', 'musashino-html', context, parseMusashino),
    await collectHtml('tokyo-metropolitan-gymnasium-track', sourceUrls.tokyoGymnasium, 'calendar_html', 'tokyo-gymnasium-calendar', context, parseTokyoGymnasium, true),
    await collectHtml('komazawa-olympic-park-track', sourceUrls.komazawa, 'calendar_html', 'komazawa-tef-calendar', context, parseKomazawa, true),
    await collectHtml('edogawa-athletic-stadium', sourceUrls.edogawa, 'calendar_html', 'edogawa-weekly-table', context, parseEdogawaWeekly),
    await collectHtml('koshigaya-shirakobato-track', sourceUrls.koshigaya, 'structured_html', 'koshigaya-today-status', context, parseKoshigayaToday),
  ];
  for (const config of fixedConfigs) supported.push(await collectFixed(config, context));
  const pdfCollector = options.pdfCollector ?? createPdfCollector(context.fetchImpl);
  for (const config of pdfSourceConfigs) supported.push(await collectPdf(config, context, pdfCollector));
  const unsupported: TrackAvailability[] = [
    unknownRecord({ trackId: 'johoku-chuo-park-track', date, now: context.now, unknownReason: 'phone_confirmation_required', url: sourceUrls.johoku, publicationFormat: 'phone_only', collector: 'manual-confirmation' }),
    unknownRecord({ trackId: 'niiza-general-sports-park-track', date, now: context.now, unknownReason: 'reservation_system_unsupported', url: sourceUrls.niiza, publicationFormat: 'reservation_system', collector: 'unsupported-reservation-system' }),
    ...expansionFallbackSources.filter(source => source.publicationFormat !== 'pdf' && ![
      'komazawa-olympic-park-track',
      'oi-central-seaside-park-track',
      'toneri-park-athletic-track',
      'edogawa-athletic-stadium',
      'okudo-sports-center-track',
      'koshigaya-shirakobato-track',
      'akirudai-park-athletic-track',
    ].includes(source.trackId)).map(source => unknownRecord({
      trackId: source.trackId,
      date,
      now: context.now,
      unknownReason: source.unknownReason,
      url: source.url,
      publicationFormat: source.publicationFormat,
      collector: `expansion-${source.publicationFormat}-pending`,
      confidence: 'low',
      warnings: ['Availability source researched; facility-specific collector is not implemented in the dataset expansion phase.'],
    })),
  ];
  const represented = new Set([...supported, ...unsupported].map(item => item.trackId));
  const researchedButUnsupported = tracks
    .filter(track => !represented.has(track.id))
    .map(track => unknownRecord({
      trackId: track.id,
      date,
      now: context.now,
      unknownReason: 'web_schedule_unavailable',
      url: track.urls.schedule ?? track.urls.individualUse ?? track.urls.official,
      publicationFormat: 'no_schedule_found',
      collector: 'official-source-manual-confirmation',
      confidence: 'low',
      warnings: ['Facility identity is verified; date-specific availability is not automated yet.'],
    }));
  return [...supported, ...unsupported, ...researchedButUnsupported].sort((a, b) => a.trackId.localeCompare(b.trackId));
}

export const fixedCollectorConfigs = fixedConfigs;
