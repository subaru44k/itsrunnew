import { createHash } from 'node:crypto';
import type { AvailabilityPeriod, TrackAvailability, UnknownReason } from '../../src/model/availability';
import { expansionFallbackSources, PARSER_VERSION, sourceUrls } from './config';
import { createPdfCollector, PdfCollectorError, pdfSourceConfigs } from './pdf';
import { tracks } from '../../src/model/tracks';
import { parseChigasakiNotice, parseNishikyogokuNotice, parseYamashiroNotice, type NoticeParseResult } from './notices';

type FetchLike = typeof fetch;
type PublicationFormat = 'structured_html' | 'calendar_html' | 'calendar_json' | 'weekly_notice' | 'fixed_schedule' | 'pdf' | 'reservation_system' | 'phone_only' | 'no_schedule_found';

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

export type NissanTrackId = 'nissan-stadium-track' | 'nissan-field-kozukue';

const nissanTrackIds: NissanTrackId[] = ['nissan-stadium-track', 'nissan-field-kozukue'];

const nissanTrackLabels: Record<NissanTrackId, string> = {
  'nissan-stadium-track': '日産スタジアム個人利用（一般）',
  'nissan-field-kozukue': '日産フィールド小机個人利用（一般）',
};

interface NissanApplicationStart {
  year: number;
  month: number;
}

interface NissanEvent {
  month: number;
  day: number;
  from: string;
  to: string;
  explicitYear: number | null;
  hrefYear: number | null;
  hrefMonth: number | null;
  hrefDay: number | null;
  applicationStarts: NissanApplicationStart[];
}

function compactText(text: string) {
  return stripHtml(text).replace(/\s+/g, '');
}

function nissanWarnings(text: string) {
  const warnings: string[] = [];
  const sentences = [
    ...text.matchAll(/(?:完全予約制|事前(?:申込|登録)|利用\d+日前)[^。！？]*(?:[。！？]|$)/g),
    ...text.matchAll(/(?:先着|定員)[^。！？]*(?:[。！？]|$)/g),
    ...text.matchAll(/(?:急きょ[^。！？]{0,30}中止|キャンセル|中止|休止|閉鎖)[^。！？]*(?:[。！？]|$)/g),
  ].map(match => match[0].trim()).filter(Boolean);
  for (const sentence of sentences) {
    if (!warnings.includes(sentence)) warnings.push(sentence);
  }
  return warnings;
}

function nissanHrefDate(attributes: string) {
  const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1];
  if (!href) return null;
  const match = /(?:^|\/)(20\d{2})[-_]?(\d{2})[-_]?(\d{2})(?:[_?#/]|$)/.exec(href);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function nissanTime(hour: string, minute: string | undefined) {
  const hourNumber = Number(hour);
  const minuteNumber = minute == null ? 0 : Number(minute);
  if (hourNumber > 23 || minuteNumber > 59) throw new Error('Nissan event has an invalid time');
  return `${hour.padStart(2, '0')}:${String(minuteNumber).padStart(2, '0')}`;
}

function parseNissanEvent(body: string, attributes: string, label: string): NissanEvent | null {
  const text = compactText(body);
  const labelIndex = text.indexOf(label);
  if (labelIndex < 0) return null;
  const afterLabel = text.slice(labelIndex + label.length);
  const applicationMarker = afterLabel.search(/申込開始/);
  const eventText = applicationMarker >= 0 ? afterLabel.slice(0, applicationMarker) : afterLabel;

  // A link can remain in the form while its date is intentionally unpublished.
  // Such text is evidence for neither availability nor unavailability.
  if (/開催予定(?:が)?ございません|開催予定なし|調整中|空欄|未定/.test(eventText)) return null;

  const eventDateMatch = /(?:^|[^0-9年])(?:(20\d{2})年)?(\d{1,2})月(\d{1,2})日/.exec(eventText);
  const eventLike = /link_border|ns-entry|surl/i.test(attributes) || eventDateMatch != null;
  if (!eventDateMatch) {
    if (!eventLike || /予約|申込|受付|定員/.test(eventText)) return null;
    throw new Error(`Nissan event date missing for ${label}`);
  }
  const explicitYear = eventDateMatch[1] ? Number(eventDateMatch[1]) : null;
  const month = Number(eventDateMatch[2]);
  const day = Number(eventDateMatch[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) throw new Error('Nissan event has an invalid date');
  const eventTextAfterDate = eventText.slice(eventDateMatch.index + eventDateMatch[0].length);
  const timeMatch = /(\d{1,2})(?:時|:)(\d{2})?[〜～~\-−–—](\d{1,2})(?:時|:)(\d{2})?/.exec(eventTextAfterDate);
  if (!timeMatch) {
    if (/予約|申込|受付|定員|開催予定/.test(eventText)) return null;
    throw new Error(`Nissan event time missing for ${label}`);
  }
  const from = nissanTime(timeMatch[1], timeMatch[2]);
  const to = nissanTime(timeMatch[3], timeMatch[4]);
  if (from >= to) throw new Error('Nissan event time range is not increasing');

  const hrefDate = nissanHrefDate(attributes);
  const applicationStarts = [...afterLabel.matchAll(/(20\d{2})年(\d{1,2})月\d{1,2}日.{0,60}?申込開始/g)]
    .map(match => ({ year: Number(match[1]), month: Number(match[2]) }));
  return {
    month,
    day,
    from,
    to,
    explicitYear,
    hrefYear: hrefDate?.year ?? null,
    hrefMonth: hrefDate?.month ?? null,
    hrefDay: hrefDate?.day ?? null,
    applicationStarts,
  };
}

function nissanYearIsSafe(event: NissanEvent, requestedYear: number) {
  if (event.hrefYear !== null && event.hrefYear !== requestedYear) return false;
  if (event.explicitYear !== null && event.explicitYear !== requestedYear) return false;
  const priorYearApplicationAllowed = event.month <= 2
    && event.applicationStarts.length > 0
    && event.applicationStarts.every(start => start.year === requestedYear - 1 && start.month >= 11);
  const allowedApplicationYears = new Set([requestedYear, ...(priorYearApplicationAllowed ? [requestedYear - 1] : [])]);
  if (event.applicationStarts.some(start => !allowedApplicationYears.has(start.year))) return false;

  // The visible event date has no year, so do not infer a year from a bare
  // month/day. At least one explicit year-bearing source must agree.
  if (event.hrefYear === null && event.explicitYear === null
    && !event.applicationStarts.some(start => start.year === requestedYear)) return false;
  return true;
}

function nissanUnknown(
  trackId: NissanTrackId,
  context: Omit<CollectorContext, 'fetchImpl'> & { fetchedAt?: string; sourceHash?: string },
  unknownReason: UnknownReason,
  warnings: string[],
) {
  return unknownRecord({
    trackId,
    date: context.date,
    now: context.now,
    unknownReason,
    url: sourceUrls.nissan,
    publicationFormat: 'structured_html',
    collector: 'nissan-track-html',
    fetchedAt: context.fetchedAt,
    sourceHash: context.sourceHash,
    confidence: 'low',
    warnings,
  });
}

export function parseNissanTrack(
  html: string,
  context: Omit<CollectorContext, 'fetchImpl' | 'now'> & { now: Date; fetchedAt?: string; sourceHash?: string },
  trackId: NissanTrackId,
) {
  const pageText = stripHtml(html);
  if (!pageText.includes('トラック個人利用') || !pageText.includes('トラック個人利用エントリーフォーム')) {
    throw new Error('Expected Nissan track page anchors not found');
  }
  if (!pageText.includes('日産スタジアム') || !pageText.includes('日産フィールド小机')) {
    throw new Error('Expected Nissan venue anchors not found');
  }

  const { year, month, day } = dateParts(context.date);
  const label = nissanTrackLabels[trackId];
  const warnings = nissanWarnings(pageText);
  const events: NissanEvent[] = [];
  const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  for (const anchor of anchors) {
    const event = parseNissanEvent(anchor[2], anchor[1], label);
    if (event) events.push(event);
  }

  const dateEvents = events.filter(event => event.month === month && event.day === day);
  const matchingEvents = dateEvents.filter(event => {
    if (event.hrefMonth !== null && (event.hrefMonth !== month || event.hrefDay !== day)) return false;
    return nissanYearIsSafe(event, year);
  });
  if (matchingEvents.length > 1) throw new Error(`Multiple Nissan events found for ${label} on ${context.date}`);
  if (matchingEvents.length === 1) {
    const event = matchingEvents[0];
    return makeRecord({
      trackId,
      date: context.date,
      now: context.now,
      status: 'partially_available',
      periods: [publicPeriod(event.from, event.to, 'full_track', ['explicit_individual_use_event'], 'public')],
      url: sourceUrls.nissan,
      publicationFormat: 'structured_html',
      collector: 'nissan-track-html',
      fetchedAt: context.fetchedAt,
      sourceHash: context.sourceHash,
      confidence: 'high',
      warnings,
    });
  }

  const hasStaleYear = dateEvents.some(event => {
    const explicitYears = [event.explicitYear, event.hrefYear, ...event.applicationStarts.map(start => start.year)]
      .filter((value): value is number => value !== null);
    return explicitYears.length > 0 && explicitYears.every(value => value !== year);
  });
  return nissanUnknown(trackId, context, hasStaleYear ? 'source_stale' : 'outside_published_period', warnings);
}

// Keep the parser discoverable under the source-oriented name used by the
// other collectors while retaining a facility-specific exported name.
export const parseNissan = parseNissanTrack;

const MACHIDA_PARSER_VERSION = '1.0.0';
const MACHIDA_COLLECTOR = 'machida-gion-eventorganiser-json';
const MACHIDA_SCHEDULE_WARNING = '※町田GIONスタジアム（町田市立陸上競技場）等の利用予定は変更する場合がございます。';
const MACHIDA_TRACK_ID = 'machida-gion-stadium';

type MachidaEventKind = 'personal' | 'dedicated' | 'break';

interface MachidaIsoDateTime {
  dateKey: string;
  timestamp: number;
}

interface MachidaParsedEvent {
  kind: MachidaEventKind;
  start: MachidaIsoDateTime;
  end: MachidaIsoDateTime;
  from: string | null;
  to: string | null;
}

type MachidaParseContext = Omit<CollectorContext, 'fetchImpl'> & {
  fetchedAt?: string;
  sourceHash?: string;
  sourceUrl?: string;
};

function strictDateKey(dateKey: string) {
  const { year, month, day } = dateParts(dateKey);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) throw new Error(`Invalid calendar date: ${dateKey}`);
  return dateKey;
}

function machidaMonthBounds(dateKey: string) {
  const { year, month } = dateParts(strictDateKey(dateKey));
  const startMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return { start: startMonth, end: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01` };
}

export function machidaGionCalendarUrl(dateKey: string) {
  const bounds = machidaMonthBounds(dateKey);
  const url = new URL(sourceUrls.machidaGion);
  url.searchParams.set('start', bounds.start);
  url.searchParams.set('end', bounds.end);
  return url.toString();
}

function parseMachidaIsoDateTime(value: unknown, field: string): MachidaIsoDateTime {
  if (typeof value !== 'string') throw new Error(`Machida event ${field} is not an ISO date`);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (!match) throw new Error(`Machida event ${field} is not an ISO date`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? '0');
  const millisecond = Number((match[7] ?? '').padEnd(3, '0') || '0');
  if (hour > 23 || minute > 59 || second > 59) throw new Error(`Machida event ${field} has an invalid time`);
  if (match[8]) {
    const offset = /[+-](\d{2}):(\d{2})/.exec(match[8]);
    if (offset && (Number(offset[1]) > 23 || Number(offset[2]) > 59)) throw new Error(`Machida event ${field} has an invalid timezone`);
  }
  const timestamp = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const parsed = new Date(timestamp);
  if (Number.isNaN(timestamp) || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`Machida event ${field} has an invalid calendar date`);
  }
  return { dateKey: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, timestamp };
}

function normalizeMachidaDigits(text: string) {
  return text
    .replace(/[０-９]/g, value => String(value.charCodeAt(0) - '０'.charCodeAt(0)))
    .replace(/：/g, ':')
    .replace(/〜|～|−|–|—/g, '-');
}

function machidaClock(hour: string, minute?: string) {
  const hourNumber = Number(hour);
  const minuteNumber = minute == null ? 0 : Number(minute);
  if (hourNumber > 23 || minuteNumber > 59) throw new Error('Machida event has an invalid time range');
  return `${hour.padStart(2, '0')}:${String(minuteNumber).padStart(2, '0')}`;
}

function machidaTimeRanges(description: string) {
  const text = normalizeMachidaDigits(description);
  const clock = '(\\d{1,2})\\s*(?::|時)\\s*(\\d{2})?';
  const range = new RegExp(`${clock}\\s*(?:-|から)\\s*${clock}`, 'g');
  return [...text.matchAll(range)].map(match => {
    const from = machidaClock(match[1], match[2]);
    const to = machidaClock(match[3], match[4]);
    if (from >= to) throw new Error('Machida event time range is not increasing');
    return { from, to };
  });
}

function machidaCategories(value: unknown) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) && value.every(category => typeof category === 'string')) return value as string[];
  return null;
}

function parseMachidaEvent(value: unknown): MachidaParsedEvent | null {
  if (typeof value !== 'object' || value === null) return null;
  const event = value as Record<string, unknown>;
  const title = event.title;
  if (typeof title !== 'string' || !['個人利用日', '専用利用日', '休場日'].includes(title)) return null;
  const categories = machidaCategories(event.category);
  if (!categories) throw new Error(`Machida event ${title} has malformed category`);
  const declaredKinds = [...new Set(categories.filter(category => ['personal', 'rikujyou', 'break'].includes(category)))];
  if (declaredKinds.length > 1) throw new Error(`Machida event ${title} has contradictory categories`);
  const categoryKinds: MachidaEventKind[] = [];
  if (title === '個人利用日' && categories.includes('personal')) categoryKinds.push('personal');
  if (title === '専用利用日' && categories.includes('rikujyou')) categoryKinds.push('dedicated');
  if (title === '休場日' && categories.includes('break')) categoryKinds.push('break');
  if (categoryKinds.length === 0) return null;
  if (categoryKinds.length !== 1) throw new Error(`Machida event ${title} has contradictory categories`);
  const kind = categoryKinds[0];
  if (event.allDay !== true) throw new Error(`Machida event ${title} is not an all-day event`);
  if (typeof event.description !== 'string') throw new Error(`Machida event ${title} has no description`);
  const description = stripHtml(event.description);
  if (kind === 'personal' && !/スタジアムの個人利用が可能(?:です|となります|になります)?(?=$|[。！、,\s　])/.test(description)) {
    throw new Error('Machida personal event has no explicit stadium-use wording');
  }
  if (kind === 'dedicated' && !/スタジアムは(?:終日)?専用利用日(?:となります|です)?(?=$|[。！、,\s　])/.test(description)) {
    throw new Error('Machida dedicated event has no explicit dedicated-use wording');
  }
  if (kind === 'break' && !/スタジアム(?:は)?休場日(?:となります|です)?(?=$|[。！、,\s　])/.test(description)) {
    throw new Error('Machida break event has no explicit closure wording');
  }
  const start = parseMachidaIsoDateTime(event.start, 'start');
  const end = parseMachidaIsoDateTime(event.end, 'end');
  if (end.timestamp <= start.timestamp || end.dateKey <= start.dateKey) throw new Error(`Machida event ${title} has an invalid end-exclusive range`);
  const ranges = machidaTimeRanges(description);
  if (kind === 'personal' && ranges.length !== 1) throw new Error('Machida personal event must have one explicit time range');
  if (kind !== 'personal' && ranges.length > 1) throw new Error(`Machida ${kind} event has contradictory time ranges`);
  return { kind, start, end, from: ranges[0]?.from ?? null, to: ranges[0]?.to ?? null };
}

function machidaUnknown(context: MachidaParseContext, sourceUrl: string, unknownReason: UnknownReason, warnings: string[] = []) {
  return unknownRecord({
    trackId: MACHIDA_TRACK_ID,
    date: context.date,
    now: context.now,
    unknownReason,
    url: sourceUrl,
    landingPageUrl: sourceUrls.machidaCalendar,
    publicationFormat: 'calendar_json',
    collector: MACHIDA_COLLECTOR,
    parserVersion: MACHIDA_PARSER_VERSION,
    fetchedAt: context.fetchedAt,
    sourceHash: context.sourceHash,
    confidence: 'low',
    warnings: [MACHIDA_SCHEDULE_WARNING, ...warnings],
  });
}

function machidaRecord(
  context: MachidaParseContext,
  sourceUrl: string,
  status: TrackAvailability['status'],
  periods: AvailabilityPeriod[],
  warnings: string[] = [],
) {
  return makeRecord({
    trackId: MACHIDA_TRACK_ID,
    date: context.date,
    now: context.now,
    status,
    periods,
    url: sourceUrl,
    landingPageUrl: sourceUrls.machidaCalendar,
    publicationFormat: 'calendar_json',
    collector: MACHIDA_COLLECTOR,
    parserVersion: MACHIDA_PARSER_VERSION,
    fetchedAt: context.fetchedAt,
    sourceHash: context.sourceHash,
    confidence: 'high',
    warnings: [MACHIDA_SCHEDULE_WARNING, ...warnings],
  });
}

function parseMachidaPayload(payload: string | unknown) {
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload.replace(/^\uFEFF/, ''));
    } catch (error) {
      throw new Error(`Machida Event Organiser JSON is invalid: ${String(error)}`);
    }
  }
  if (!Array.isArray(payload)) throw new Error('Machida Event Organiser response is not an event array');
  return payload;
}

export function parseMachidaGion(
  payload: string | unknown,
  context: MachidaParseContext,
) {
  const sourceUrl = context.sourceUrl ?? machidaGionCalendarUrl(context.date);
  try {
    const source = new URL(sourceUrl);
    const officialEndpoint = new URL(sourceUrls.machidaGion);
    const bounds = machidaMonthBounds(context.date);
    if (source.origin !== officialEndpoint.origin
      || source.pathname !== officialEndpoint.pathname
      || source.searchParams.get('action') !== 'eventorganiser-fullcal'
      || source.searchParams.get('start') !== bounds.start
      || source.searchParams.get('end') !== bounds.end) {
      return machidaUnknown(context, sourceUrl, 'parse_failed', ['Event Organiser request range did not match the requested month.']);
    }
  } catch (error) {
    return machidaUnknown(context, sourceUrl, 'parse_failed', [String(error)]);
  }
  const requestedDate = strictDateKey(context.date);
  const requestedBounds = machidaMonthBounds(requestedDate);
  let events: unknown[];
  try {
    events = parseMachidaPayload(payload);
  } catch (error) {
    return machidaUnknown(context, sourceUrl, 'parse_failed', [String(error)]);
  }
  const parsedEvents: MachidaParsedEvent[] = [];
  try {
    for (const event of events) {
      const parsed = parseMachidaEvent(event);
      if (parsed) parsedEvents.push(parsed);
    }
  } catch (error) {
    return machidaUnknown(context, sourceUrl, 'parse_failed', [String(error)]);
  }

  const dateEvents = parsedEvents.filter(event => event.start.dateKey <= requestedDate && requestedDate < event.end.dateKey);
  if (dateEvents.some(event => event.start.dateKey < requestedBounds.start || event.start.dateKey >= requestedBounds.end)) {
    return machidaUnknown(context, sourceUrl, 'parse_failed', ['A relevant event started outside the requested month.']);
  }
  for (let index = 0; index < dateEvents.length; index += 1) {
    for (const other of dateEvents.slice(index + 1)) {
      if (dateEvents[index].start.timestamp < other.end.timestamp && other.start.timestamp < dateEvents[index].end.timestamp) {
        return machidaUnknown(context, sourceUrl, 'parse_failed', ['Overlapping personal, dedicated-use, or closure events were rejected.']);
      }
    }
  }
  if (dateEvents.length === 0) return machidaUnknown(context, sourceUrl, 'outside_published_period');
  if (dateEvents.length !== 1) return machidaUnknown(context, sourceUrl, 'parse_failed', ['Multiple relevant events matched the requested date.']);
  const event = dateEvents[0];
  if (event.kind === 'personal') {
    return machidaRecord(context, sourceUrl, 'partially_available', [publicPeriod(event.from, event.to, 'full_track', ['explicit_personal_use_event'], 'public')]);
  }
  const conditions = event.kind === 'dedicated' ? ['explicit_dedicated_use_event'] : ['explicit_facility_closure'];
  return machidaRecord(context, sourceUrl, 'unavailable', [unavailablePeriod(event.from, event.to, conditions)]);
}

export const parseMachidaGionEvents = parseMachidaGion;
export const parseMachidaCalendar = parseMachidaGion;

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
      if (date >= '2026-12-01') return { status: 'unknown', unknownReason: 'insufficient_information', warnings: ['工事後の利用再開は公式の最新案内を確認'] };
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

async function collectNissan(context: CollectorContext) {
  let source: { html: string; sourceHash: string };
  try {
    source = await request(sourceUrls.nissan, context.fetchImpl);
  } catch (error) {
    const reason: UnknownReason = error instanceof TypeError || /HTTP|fetch|abort|network/i.test(String(error)) ? 'fetch_failed' : 'parse_failed';
    return nissanTrackIds.map(trackId => unknownRecord({
      trackId,
      date: context.date,
      now: context.now,
      unknownReason: reason,
      url: sourceUrls.nissan,
      publicationFormat: 'structured_html',
      collector: 'nissan-track-html',
      confidence: 'low',
      warnings: [String(error)],
    }));
  }

  return nissanTrackIds.map(trackId => {
    try {
      return parseNissanTrack(source.html, {
        date: context.date,
        now: context.now,
        fetchedAt: toIso(context.now),
        sourceHash: source.sourceHash,
      }, trackId);
    } catch (error) {
      return unknownRecord({
        trackId,
        date: context.date,
        now: context.now,
        unknownReason: 'parse_failed',
        url: sourceUrls.nissan,
        publicationFormat: 'structured_html',
        collector: 'nissan-track-html',
        fetchedAt: toIso(context.now),
        sourceHash: source.sourceHash,
        confidence: 'low',
        warnings: [String(error)],
      });
    }
  });
}

async function collectMachida(context: CollectorContext) {
  const sourceUrl = machidaGionCalendarUrl(context.date);
  try {
    const source = await request(sourceUrl, context.fetchImpl);
    return parseMachidaGion(source.html, {
      date: context.date,
      now: context.now,
      fetchedAt: toIso(context.now),
      sourceHash: source.sourceHash,
      sourceUrl,
    });
  } catch (error) {
    const reason: UnknownReason = error instanceof TypeError || /HTTP|fetch|abort|network/i.test(String(error)) ? 'fetch_failed' : 'parse_failed';
    return unknownRecord({
      trackId: MACHIDA_TRACK_ID,
      date: context.date,
      now: context.now,
      unknownReason: reason,
      url: sourceUrl,
      landingPageUrl: sourceUrls.machidaCalendar,
      publicationFormat: 'calendar_json',
      collector: MACHIDA_COLLECTOR,
      parserVersion: MACHIDA_PARSER_VERSION,
      confidence: 'low',
      warnings: [MACHIDA_SCHEDULE_WARNING, String(error)],
    });
  }
}

interface NoticeCollectorConfig {
  trackId: string;
  url: string;
  landingPageUrl: string;
  publicationFormat: 'structured_html' | 'weekly_notice';
  collector: string;
  parser: (body: string, date: string, sourceUrl: string) => NoticeParseResult;
}

const noticeCollectorConfigs: NoticeCollectorConfig[] = [
  {
    trackId: 'nishikyogoku-auxiliary-athletics-stadium',
    url: sourceUrls.nishikyogoku,
    landingPageUrl: sourceUrls.nishikyogokuLanding,
    publicationFormat: 'structured_html',
    collector: 'nishikyogoku-wordpress-monthly-notice',
    parser: parseNishikyogokuNotice,
  },
  {
    trackId: 'chigasaki-yanagishima-athletic-stadium',
    url: sourceUrls.chigasaki,
    landingPageUrl: sourceUrls.chigasakiLanding,
    publicationFormat: 'structured_html',
    collector: 'chigasaki-wordpress-monthly-notice',
    parser: parseChigasakiNotice,
  },
  {
    trackId: 'yamashiro-general-sports-park-athletics-stadium',
    url: sourceUrls.yamashiro,
    landingPageUrl: sourceUrls.yamashiro,
    publicationFormat: 'weekly_notice',
    collector: 'yamashiro-rolling-html-notice',
    parser: parseYamashiroNotice,
  },
];

async function collectNotice(config: NoticeCollectorConfig, context: CollectorContext) {
  try {
    const source = await request(config.url, context.fetchImpl);
    const parsed = config.parser(source.html, context.date, config.url);
    return makeRecord({
      trackId: config.trackId,
      date: context.date,
      now: context.now,
      status: parsed.status,
      periods: parsed.periods,
      unknownReason: parsed.unknownReason ?? null,
      url: parsed.sourceUrl,
      landingPageUrl: config.landingPageUrl,
      publicationFormat: config.publicationFormat,
      collector: config.collector,
      fetchedAt: toIso(context.now),
      publishedAt: parsed.publishedAt,
      sourceHash: source.sourceHash,
      confidence: parsed.status === 'unknown' ? 'low' : 'high',
      warnings: parsed.warnings,
    });
  } catch (error) {
    const reason: UnknownReason = error instanceof TypeError || /HTTP|fetch|abort|network/i.test(String(error)) ? 'fetch_failed' : 'parse_failed';
    return unknownRecord({
      trackId: config.trackId,
      date: context.date,
      now: context.now,
      unknownReason: reason,
      url: config.url,
      landingPageUrl: config.landingPageUrl,
      publicationFormat: config.publicationFormat,
      collector: config.collector,
      confidence: 'low',
      warnings: [error instanceof Error ? error.message : String(error)],
    });
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
    await collectMachida(context),
    ...(await collectNissan(context)),
    await collectHtml('hikarigaoka-park-track', sourceUrls.hikarigaoka, 'structured_html', 'hikarigaoka-html', context, parseHikarigaoka),
    await collectHtml('musashino-athletic-track', sourceUrls.musashino, 'structured_html', 'musashino-html', context, parseMusashino),
    await collectHtml('tokyo-metropolitan-gymnasium-track', sourceUrls.tokyoGymnasium, 'calendar_html', 'tokyo-gymnasium-calendar', context, parseTokyoGymnasium, true),
    await collectHtml('komazawa-olympic-park-track', sourceUrls.komazawa, 'calendar_html', 'komazawa-tef-calendar', context, parseKomazawa, true),
    await collectHtml('edogawa-athletic-stadium', sourceUrls.edogawa, 'calendar_html', 'edogawa-weekly-table', context, parseEdogawaWeekly),
    await collectHtml('koshigaya-shirakobato-track', sourceUrls.koshigaya, 'structured_html', 'koshigaya-today-status', context, parseKoshigayaToday),
  ];
  for (const config of noticeCollectorConfigs) supported.push(await collectNotice(config, context));
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
      'nissan-stadium-track',
      'nissan-field-kozukue',
      'machida-gion-stadium',
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
    .map(track => track.individualUse.status === 'unavailable'
      ? makeRecord({
        trackId: track.id,
        date,
        now: context.now,
        status: 'unavailable',
        periods: [unavailablePeriod(null, null, ['individual_use_unavailable'])],
        url: track.urls.individualUse ?? track.urls.official,
        publicationFormat: 'no_schedule_found',
        collector: 'static-individual-use-eligibility',
        confidence: 'high',
        warnings: ['Official static facility rules explicitly do not accept individual use.'],
      })
      : unknownRecord({
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
