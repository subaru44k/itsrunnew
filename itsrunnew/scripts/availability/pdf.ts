import { createHash } from 'node:crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { AvailabilityPeriod, AvailabilityStatus, UnknownReason } from '../../src/model/availability';

type FetchLike = typeof fetch;

export interface PdfTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  page: number;
}

export interface ExtractedPdf {
  pageCount: number;
  items: PdfTextItem[];
  text: string;
}

export interface PdfParseResult {
  status: AvailabilityStatus;
  periods: AvailabilityPeriod[];
  unknownReason?: UnknownReason;
  publishedAt?: string | null;
  warnings?: string[];
  confidence?: 'high' | 'medium' | 'low';
}

export interface PdfSourceConfig {
  trackId: string;
  name: string;
  landingPageUrl: string;
  discovery: 'latest_pdf_discovery' | 'monthly_pdf_discovery' | 'static_pdf_url' | 'annual_pdf_discovery';
  parser: string;
  parserVersion: string;
}

export interface PdfCollectionResult extends PdfParseResult {
  pdfUrl: string;
  landingPageUrl: string;
  sourceHash: string;
  documentId: string;
  fetchedAt: string;
  parser: string;
  parserVersion: string;
}

export class PdfCollectorError extends Error {
  constructor(public readonly reason: UnknownReason, message: string, public readonly sourceUrl?: string) {
    super(message);
  }
}

const normalize = (value: string) => value.normalize('NFKC').replace(/[\u00a0\s]+/g, ' ').trim();
const compact = (value: string) => normalize(value).replace(/\s/g, '');
const sha256 = (value: Uint8Array) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const fullDayScope = 'full_track' as const;
const publicEligibility = 'public' as const;

function period(from: string | null, to: string | null, status: AvailabilityPeriod['status'], conditions: string[] = []): AvailabilityPeriod {
  return { from, to, status, scope: fullDayScope, eligibility: publicEligibility, conditions };
}

function aggregate(periods: AvailabilityPeriod[]): AvailabilityStatus {
  if (!periods.length) return 'unknown';
  if (periods.every(item => item.status === 'available')) return 'available';
  if (periods.every(item => item.status === 'unavailable')) return 'unavailable';
  if (periods.some(item => item.status === 'available')) return 'partially_available';
  return 'unknown';
}

function assertAnchors(pdf: ExtractedPdf, anchors: string[]) {
  const value = compact(pdf.text);
  const missing = anchors.find(anchor => !value.includes(compact(anchor)));
  if (missing) throw new PdfCollectorError('source_changed', `Expected PDF anchor not found: ${missing}`);
}

function pageItems(pdf: ExtractedPdf, page = 1) {
  return pdf.items.filter(item => item.page === page);
}

function uniqueItems(items: PdfTextItem[]) {
  const result: PdfTextItem[] = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    if (result.some(other => other.page === item.page && other.text === item.text && Math.abs(other.x - item.x) < 0.8 && Math.abs(other.y - item.y) < 1.2)) continue;
    result.push(item);
  }
  return result;
}

function dateRows(items: PdfTextItem[], matcher: (text: string) => number | null, xMax: number) {
  return uniqueItems(items)
    .map(item => ({ item, day: item.x <= xMax ? matcher(compact(item.text)) : null }))
    .filter((value): value is { item: PdfTextItem; day: number } => value.day != null)
    .sort((a, b) => b.item.y - a.item.y);
}

function itemsForDay(items: PdfTextItem[], day: number, matcher: (text: string) => number | null, xMax: number) {
  const rows = dateRows(items, matcher, xMax);
  const index = rows.findIndex(row => row.day === day);
  if (index < 0) return null;
  const current = rows[index].item.y;
  const upper = index === 0 ? current + 30 : (rows[index - 1].item.y + current) / 2;
  const lower = index === rows.length - 1 ? current - 30 : (rows[index + 1].item.y + current) / 2;
  return uniqueItems(items.filter(item => item.y <= upper && item.y >= lower));
}

function cellText(items: PdfTextItem[], minX: number, maxX: number) {
  return compact(items.filter(item => item.x >= minX && item.x < maxX).sort((a, b) => b.y - a.y || a.x - b.x).map(item => item.text).join(''));
}

function parseTimeRange(value: string) {
  const matches = [...normalize(value).matchAll(/(\d{1,2})[:：](\d{2})\s*[~〜～-]\s*(\d{1,2})[:：](\d{2})/g)];
  return matches.map(match => ({ from: `${match[1].padStart(2, '0')}:${match[2]}`, to: `${match[3].padStart(2, '0')}:${match[4]}` }));
}

function reiwaYear(year: number) {
  return year - 2018;
}

function dateParts(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid date: ${date}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export async function extractPdf(bytes: Uint8Array): Promise<ExtractedPdf> {
  try {
    const task = getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true });
    const document = await task.promise;
    const items: PdfTextItem[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      for (const raw of content.items) {
        if (!('str' in raw) || !normalize(raw.str)) continue;
        items.push({ text: normalize(raw.str), x: raw.transform[4], y: raw.transform[5], width: raw.width, page: pageNumber });
      }
    }
    const cleaned = uniqueItems(items);
    if (!cleaned.length) throw new PdfCollectorError('extraction_failed', 'PDF contains no extractable text');
    return { pageCount: document.numPages, items: cleaned, text: cleaned.map(item => item.text).join('\n') };
  } catch (error) {
    if (error instanceof PdfCollectorError) throw error;
    throw new PdfCollectorError('extraction_failed', `PDF extraction failed: ${String(error)}`);
  }
}

export function parseNerimaPdf(pdf: ExtractedPdf, date: string): PdfParseResult {
  assertAnchors(pdf, ['練馬総合運動場公園陸上競技場の開放状況', '1枠目', '2枠目', '3枠目', '陸上トラック優先利用時間', '人工芝 優先利用時間']);
  const { month, day } = dateParts(date);
  const rows = itemsForDay(pageItems(pdf), day, text => {
    const match = /^(\d{1,2})\/(\d{1,2})$/.exec(text);
    return match && Number(match[1]) === month ? Number(match[2]) : null;
  }, 80);
  if (!rows) return { status: 'unknown', periods: [], unknownReason: 'outside_published_period', warnings: ['直近1週間の公開範囲外'] };
  const slots = [
    { from: '09:00', to: '12:00', minX: 80, maxX: 220 },
    { from: '12:00', to: '15:00', minX: 220, maxX: 380 },
    { from: '15:00', to: '18:00', minX: 380, maxX: 570 },
  ];
  const periods = slots.map(slot => {
    const value = cellText(rows, slot.minX, slot.maxX);
    if (value.includes('陸上トラック優先利用時間')) return period(slot.from, slot.to, 'available', ['athletics_track_priority']);
    if (value.includes('人工芝') && value.includes('陸上競技の練習不可')) return period(slot.from, slot.to, 'unavailable', ['artificial_turf_priority_track_training_unavailable']);
    return period(slot.from, slot.to, 'unknown', ['not_explicitly_published']);
  });
  const update = /(\d{4})\/(\d{1,2})\/(\d{1,2})更新/.exec(compact(pdf.text));
  return {
    status: aggregate(periods), periods,
    unknownReason: aggregate(periods) === 'unknown' ? 'insufficient_information' : undefined,
    publishedAt: update ? `${update[1]}-${update[2].padStart(2, '0')}-${update[3].padStart(2, '0')}` : null,
    warnings: ['空欄はunknown', '混雑・予定変更の可能性あり'], confidence: 'high',
  };
}

export function parseTodaPdf(pdf: ExtractedPdf, date: string): PdfParseResult {
  const { year, month, day } = dateParts(date);
  assertAnchors(pdf, ['戸田市スポーツセンター行事予定表', `令和${reiwaYear(year)}年 ${month}月`, '陸上競技場', '17:00~18:00']);
  const rows = itemsForDay(pageItems(pdf), day, text => /^(\d{1,2})$/.test(text) ? Number(text) : null, 55);
  if (!rows) throw new PdfCollectorError('source_changed', 'Target date row missing from monthly schedule');
  if (rows.some(item => compact(item.text).includes('休場日'))) {
    return { status: 'unavailable', periods: [period(null, null, 'unavailable', ['facility_closed'])], warnings: ['公式行事予定表の休場日'], confidence: 'high' };
  }
  const periods: AvailabilityPeriod[] = [];
  const trackLabels = rows.filter(item => compact(item.text) === '陸上競技場');
  for (const label of trackLabels) {
    const sameLine = rows.filter(item => Math.abs(item.y - label.y) < 1.5);
    const ranges = parseTimeRange(sameLine.map(item => item.text).join(' '));
    for (const range of ranges) periods.push(period(range.from, range.to, 'unavailable', ['exclusive_track_event']));
  }
  if (rows.some(item => item.x > 520 && /[〇○]/.test(item.text))) periods.push(period('17:00', '18:00', 'available', ['explicit_summer_individual_slot']));
  if (!periods.length) return { status: 'unknown', periods: [], unknownReason: 'insufficient_information', warnings: ['空欄や他施設の予定は個人利用可の根拠にしない'] };
  return { status: aggregate(periods), periods, warnings: ['陸上競技場欄だけを判定', '空欄時間はunknown'], confidence: 'high' };
}

export function parseFuchuPdf(pdf: ExtractedPdf, date: string): PdfParseResult {
  const { year, month } = dateParts(date);
  assertAnchors(pdf, [`令和${reiwaYear(year)}年度`, '市民陸上競技場', `${month}月`, '×印は休場日', '〇印は一般公開日', '◇印は17時以降を一般公開']);
  return {
    status: 'unknown', periods: [], unknownReason: 'unsupported_pdf_graphics', confidence: 'low',
    warnings: ['日別statusがtextではなくvector図形のため、安全な判定対象外'],
  };
}

export function parseWadaboriPdf(pdf: ExtractedPdf, date: string, facility: 'first' | 'second'): PdfParseResult {
  const { year, month, day } = dateParts(date);
  const title = facility === 'first' ? '第1競技場(和田堀公園)' : '第2競技場(済美山運動公園)';
  assertAnchors(pdf, [title, `${month}月`, '午前(9:00~12:00)', '午後(13:00~17:00)', '一般開放', '貸切', '整備日']);
  if (!compact(pdf.text).includes(`${year}年`)) throw new PdfCollectorError('outside_published_period', 'PDF publication year does not match requested year');
  const rows = itemsForDay(pageItems(pdf), day, text => /^(\d{1,2})$/.test(text) ? Number(text) : null, 55);
  if (!rows) throw new PdfCollectorError('source_changed', 'Target date row missing from Wada schedule');
  const cells = [
    { from: '09:00', to: '12:00', value: cellText(rows, 140, 420) },
    { from: '13:00', to: '17:00', value: cellText(rows, 420, 760) },
  ];
  const periods = cells.map(cell => {
    if (cell.value.includes('一般開放') || cell.value === '') return period(cell.from, cell.to, 'available', [cell.value ? 'explicit_general_opening' : facility === 'first' ? 'blank_defined_as_general_opening' : 'blank_defined_as_track_only_opening']);
    if (cell.value.includes('貸切')) return period(cell.from, cell.to, 'unavailable', ['exclusive_use']);
    if (cell.value.includes('整備')) return period(cell.from, cell.to, 'unavailable', ['maintenance']);
    return period(cell.from, cell.to, 'unknown', ['unrecognized_cell']);
  });
  const published = /(\d{4})年(\d{1,2})月(\d{1,2})日付/.exec(compact(pdf.text));
  return {
    status: aggregate(periods), periods,
    unknownReason: aggregate(periods) === 'unknown' ? 'insufficient_information' : undefined,
    publishedAt: published ? `${published[1]}-${published[2].padStart(2, '0')}-${published[3].padStart(2, '0')}` : null,
    warnings: ['PDF凡例が空欄を開放と明示', '12:00〜13:00は判定対象外', '予定変更の可能性あり'], confidence: 'high',
  };
}

export function parseMisatoPdf(pdf: ExtractedPdf, date: string): PdfParseResult {
  const { month, day } = dateParts(date);
  assertAnchors(pdf, [`陸上競技場 ${month}月分スケジュール`, '専用利用日', '共用利用日', '空欄:予約可能日', '共用利用は13時まで', '共用利用は18時まで']);
  const closure = /(\d{1,2})\/(\d{1,2})~(\d{1,2})\/(\d{1,2}).{0,30}陸上競技場利用中止/.exec(compact(pdf.text));
  if (closure && Number(closure[1]) === month && Number(closure[3]) === month && day >= Number(closure[2]) && day <= Number(closure[4])) {
    return { status: 'unavailable', periods: [period(null, null, 'unavailable', ['explicit_facility_suspension'])], warnings: ['公式PDFの利用中止期間'], confidence: 'high' };
  }
  const rows = itemsForDay(pageItems(pdf), day, text => /^(\d{1,2})$/.test(text) ? Number(text) : null, 85);
  if (!rows) throw new PdfCollectorError('source_changed', 'Target date row missing from Misato schedule');
  const cells = [
    { availableFrom: '09:00', unavailableFrom: '09:00', availableTo: '13:00', unavailableTo: '12:00', value: cellText(rows, 120, 260) },
    { availableFrom: '13:00', unavailableFrom: '13:00', availableTo: '18:00', unavailableTo: '17:00', value: cellText(rows, 260, 405) },
    { availableFrom: '18:00', unavailableFrom: '18:00', availableTo: '21:00', unavailableTo: '21:00', value: cellText(rows, 405, 560) },
  ];
  const periods = cells.map(cell => {
    if (cell.value.includes('共用利用')) return period(cell.availableFrom, cell.availableTo, 'available', ['shared_use_explicit']);
    if (cell.value.includes('専用利用')) return period(cell.unavailableFrom, cell.unavailableTo, 'unavailable', ['exclusive_use']);
    return period(cell.availableFrom, cell.availableTo, 'unknown', ['blank_is_reservable_not_individual_availability']);
  });
  return { status: aggregate(periods), periods, unknownReason: aggregate(periods) === 'unknown' ? 'insufficient_information' : undefined, warnings: ['空欄は予約可能日であり個人利用可とは判定しない', '専用申請は10日前まで変更可能'], confidence: 'high' };
}

export function parseAgeoPdf(pdf: ExtractedPdf, date: string): PdfParseResult {
  const { year, month, day } = dateParts(date);
  assertAnchors(pdf, ['上尾陸上競技場', '個人利用日', '予定表', `令和${reiwaYear(year)}年 ${month}月`, '利用時間', '利用時間は1回4時間まで']);
  const rows = itemsForDay(pageItems(pdf), day, text => /^(\d{1,2})日$/.test(text) ? Number(text.replace('日', '')) : null, 75);
  if (!rows) return { status: 'unknown', periods: [], unknownReason: 'insufficient_information', warnings: ['予定表に個人利用日として掲載なし'] };
  const ranges = parseTimeRange(rows.map(item => item.text).join(' '));
  if (!ranges.length) throw new PdfCollectorError('parse_failed', 'Individual-use row has no time range');
  const periods = ranges.slice(0, 1).map(range => period(range.from, range.to, 'available', ['explicit_individual_use_day']));
  return { status: 'available', periods, warnings: ['占有予備日は実施状況により変更', '1回4時間まで'], confidence: 'high' };
}

export function parseFujimoriPdf(pdf: ExtractedPdf, date: string): PdfParseResult {
  const { year, month, day } = dateParts(date);
  assertAnchors(pdf, ['東京フットボールセンター八王子富士森競技場', '一般開放状況', '○印の区分は一般開放します', `${month}月`, '地域開放']);
  const items = pageItems(pdf);
  const monthItem = items.find(item => compact(item.text) === `${month}月` && item.y > 700);
  if (!monthItem) return { status: 'unknown', periods: [], unknownReason: 'schedule_not_published', warnings: ['対象月が現在の一般開放予定表に未掲載'] };
  const groupStart = monthItem.x - 135;
  const dateCandidates = uniqueItems(items).filter(item => item.x >= groupStart + 15 && item.x <= groupStart + 45 && /^(\d{1,2})$/.test(compact(item.text)));
  const target = dateCandidates.find(item => Number(compact(item.text)) === day);
  if (!target) throw new PdfCollectorError('source_changed', 'Target date row missing from Fujimori matrix');
  const row = items.filter(item => Math.abs(item.y - target.y) < 4);
  const early = cellText(row, groupStart + 55, groupStart + 112);
  const merged = row.some(item => item.x >= groupStart + 105 && item.x < groupStart + 255 && compact(item.text).includes('地域開放'));
  const periods: AvailabilityPeriod[] = [];
  if (early.includes('休止')) periods.push(period('06:00', '09:00', 'unavailable', ['regional_opening_suspended']));
  else {
    const until = /(\d{1,2}):00まで/.exec(early);
    if (until) {
      periods.push(period('06:00', `${until[1].padStart(2, '0')}:00`, 'available', ['shortened_regional_opening']));
      periods.push(period(`${until[1].padStart(2, '0')}:00`, '09:00', 'unavailable', ['regional_opening_shortened']));
    } else periods.push(period('06:00', '09:00', 'available', ['daily_regional_opening_rule']));
  }
  const slots = [
    { from: '09:00', to: '12:00', min: 110, max: 150 },
    { from: '12:00', to: '15:00', min: 150, max: 194 },
    { from: '15:00', to: '18:00', min: 194, max: 237 },
    { from: '18:00', to: '21:00', min: 237, max: 270 },
  ];
  for (const slot of slots) {
    const value = merged ? '地域開放' : cellText(row, groupStart + slot.min, groupStart + slot.max);
    if (/[○〇]/.test(value) || value.includes('地域開放')) periods.push(period(slot.from, slot.to, 'available', [value.includes('地域開放') ? 'regional_opening' : 'explicit_general_opening']));
    else if (value.includes('貸切')) periods.push(period(slot.from, slot.to, 'unavailable', ['exclusive_use']));
    else periods.push(period(slot.from, slot.to, 'unknown', ['unrecognized_or_blank_cell']));
  }
  const update = /(\d{1,2})月(\d{1,2})日更新/.exec(compact(pdf.text));
  return { status: aggregate(periods), periods, unknownReason: aggregate(periods) === 'unknown' ? 'insufficient_information' : undefined, publishedAt: update ? `${year}-${update[1].padStart(2, '0')}-${update[2].padStart(2, '0')}` : null, warnings: ['当日変更の可能性あり', '早朝地域開放規則とPDF変更欄を結合'], confidence: 'high' };
}

export function parseKamiyugiPdf(pdf: ExtractedPdf, date: string): PdfParseResult {
  const { year, month, day } = dateParts(date);
  assertAnchors(pdf, ['八王子市上柚木公園陸上競技場一般開放状況', '〇印の区分は一般開放します', `${month}月`, '8:45', '12:45', '16:45']);
  const items = pageItems(pdf);
  const monthItem = items.find(item => compact(item.text) === `${month}月` && item.y > 700);
  if (!monthItem) return { status: 'unknown', periods: [], unknownReason: 'schedule_not_published', warnings: ['対象月が現在の一般開放予定表に未掲載'] };
  const groupStart = monthItem.x - 115;
  const target = uniqueItems(items).find(item => item.x >= groupStart + 15 && item.x <= groupStart + 40 && /^\d{1,2}$/.test(compact(item.text)) && Number(compact(item.text)) === day);
  if (!target) throw new PdfCollectorError('source_changed', 'Target date row missing from Kamiyugi matrix');
  const row = items.filter(item => Math.abs(item.y - target.y) < 3);
  const slots = [
    { from: '08:45', to: '12:45', min: 75, max: 125 },
    { from: '12:45', to: '16:45', min: 125, max: 185 },
    { from: '16:45', to: '20:45', min: 185, max: 240 },
  ];
  const periods = slots.map(slot => {
    const value = cellText(row, groupStart + slot.min, groupStart + slot.max);
    if (/[○〇]/.test(value)) return period(slot.from, slot.to, 'available', ['explicit_general_opening']);
    if (/貸切|整備/.test(value)) return period(slot.from, slot.to, 'unavailable', [value.includes('貸切') ? 'exclusive_use' : 'maintenance']);
    return period(slot.from, slot.to, 'unknown', ['symbol_not_defined_as_general_opening']);
  });
  const update = /【(\d{1,2})\/(\d{1,2})更新】/.exec(compact(pdf.text));
  const status = aggregate(periods);
  return {
    status,
    periods,
    unknownReason: status === 'unknown' ? 'insufficient_information' : undefined,
    publishedAt: update ? `${year}-${update[1].padStart(2, '0')}-${update[2].padStart(2, '0')}` : null,
    warnings: ['○だけを一般開放と判定', '予定変更があるため利用日当日の公式確認を推奨'],
    confidence: 'high',
  };
}

export function parseKanagawaSportsCenterPdf(pdf: ExtractedPdf, date: string): PdfParseResult {
  const { year, month, day } = dateParts(date);
  assertAnchors(pdf, [
    '県立スポーツセンター',
    `令和${reiwaYear(year)}年${month}月分`,
    '個人・団体利用可能予定日時',
    '「〇」が利用可能予定の日時です',
    '陸上競技場',
  ]);
  const table = pageItems(pdf).filter(item => item.y < 800);
  const rows = itemsForDay(table, day, text => {
    const match = /^(\d{1,2})(?:★)?$/.exec(text);
    return match ? Number(match[1]) : null;
  }, 130);
  if (!rows) throw new PdfCollectorError('source_changed', 'Target date row missing from Kanagawa Sports Center schedule');
  const afternoonEnd = (month > 4 && month < 9) || (month === 4 && day >= 15) || (month === 9 && day <= 15) ? '18:00' : '17:00';
  const slots = [
    { from: '09:00', to: '12:00', value: cellText(rows, 250, 450) },
    { from: '13:00', to: afternoonEnd, value: cellText(rows, 500, 700) },
  ];
  const periods = slots.map(slot => {
    if (/[○〇]/.test(slot.value)) return period(slot.from, slot.to, 'available', ['explicit_individual_or_small_group_availability', 'annual_pass_required_for_individual_use']);
    if (slot.value.includes('×')) return period(slot.from, slot.to, 'unavailable', ['explicit_schedule_unavailable']);
    return period(slot.from, slot.to, 'unknown', ['not_explicitly_published']);
  });
  const status = aggregate(periods);
  return {
    status,
    periods,
    unknownReason: status === 'unknown' ? 'insufficient_information' : undefined,
    warnings: ['個人利用は1年単位の定期利用者のみ', '施設点検等による当日変更の可能性あり'],
    confidence: 'high',
  };
}

export function parseExpo70Pdf(pdf: ExtractedPdf, date: string): PdfParseResult {
  const { year, month, day } = dateParts(date);
  assertAnchors(pdf, [
    '月度',
    '個人利用予定表',
    '個人利用では、陸上競技の練習目的以外でのご利用はできません',
    `${year}年`,
    '日程変更の可能性があります',
  ]);
  const items = pageItems(pdf);
  if (!items.some(item => compact(item.text) === String(month) && item.x >= 85 && item.x < 125 && item.y > 750)) {
    throw new PdfCollectorError('outside_published_period', 'Expo 70 PDF month does not match requested date');
  }
  const target = uniqueItems(items).find(item => {
    const value = compact(item.text);
    return /^\d{1,2}$/.test(value)
      && Number(value) === day
      && ((item.x >= 35 && item.x < 70) || (item.x >= 315 && item.x < 350))
      && item.y > 230 && item.y < 620;
  });
  if (!target) throw new PdfCollectorError('source_changed', 'Target date row missing from Expo 70 individual-use schedule');
  const row = items.filter(item => Math.abs(item.y - target.y) < 2);
  const rightColumn = target.x >= 315;
  const value = cellText(row, rightColumn ? 400 : 120, rightColumn ? 485 : 200);
  const time = /(\d{1,2})時\s*[~〜～-]\s*(\d{1,2})時/.exec(normalize(value));
  if (time) {
    return {
      status: 'available',
      periods: [period(`${time[1].padStart(2, '0')}:00`, `${time[2].padStart(2, '0')}:00`, 'available', ['explicit_individual_use_schedule'])],
      warnings: ['予定表作成後も日程変更の可能性あり', '個人利用は陸上競技の練習目的に限定'],
      confidence: 'high',
    };
  }
  if (value.includes('×')) {
    return {
      status: 'unavailable',
      periods: [period(null, null, 'unavailable', ['explicit_individual_use_schedule_unavailable'])],
      warnings: ['予定表作成後も日程変更の可能性あり'],
      confidence: 'high',
    };
  }
  return {
    status: 'unknown', periods: [], unknownReason: 'insufficient_information',
    warnings: ['予定表の対象日に利用時間または利用不可記号の明示なし'], confidence: 'low',
  };
}

function looseHourRanges(value: string) {
  return [...normalize(value).matchAll(/(\d{1,2})(?::(\d{2}))?\s*[~〜～-]\s*(\d{1,2})(?::(\d{2}))?/g)].map(match => ({
    from: `${match[1].padStart(2, '0')}:${match[2] ?? '00'}`,
    to: `${match[3].padStart(2, '0')}:${match[4] ?? '00'}`,
  }));
}

const timeMinutes = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

export function parseIchikawaKohnodaiPdf(pdf: ExtractedPdf, date: string): PdfParseResult {
  const { month, day } = dateParts(date);
  assertAnchors(pdf, [
    `■${month}月`,
    '陸上競技場使用予定表',
    '利用時間',
    '使用時間',
    '使用予定内容',
    '大会・イベント中の個人利用はできません',
  ]);
  const items = pageItems(pdf);
  const dates = dateRows(items, value => /^\d{1,2}$/.test(value) ? Number(value) : null, 90);
  const dateIndex = dates.findIndex(value => value.day === day);
  if (dateIndex < 0) throw new PdfCollectorError('source_changed', 'Target date row missing from Ichikawa Kohnodai schedule');
  const currentY = dates[dateIndex].item.y;
  const nextY = dates[dateIndex + 1]?.item.y ?? currentY - 45;
  const rows = uniqueItems(items.filter(item => item.y <= currentY + 3 && item.y > nextY + 0.5));
  const rowText = compact(rows.map(item => item.text).join(' '));
  if (rowText.includes('休場日')) {
    return {
      status: 'unavailable',
      periods: [period(null, null, 'unavailable', ['explicit_facility_closure'])],
      warnings: ['市主催行事・天候・緊急利用による変更の可能性あり'],
      confidence: 'high',
    };
  }
  const usageRanges = looseHourRanges(cellText(rows, 105, 165));
  if (usageRanges.length !== 1) throw new PdfCollectorError('source_changed', 'Operating hours missing or ambiguous in Ichikawa Kohnodai schedule');
  const usage = usageRanges[0];
  const usageStart = timeMinutes(usage.from);
  const usageEnd = timeMinutes(usage.to);
  if (usageStart >= usageEnd) throw new PdfCollectorError('source_changed', 'Invalid operating hours in Ichikawa Kohnodai schedule');

  const eventItems = rows.filter(item => item.x >= 165 && !/\d{1,2}時閉館/.test(compact(item.text)));
  const grouped = new Map<number, PdfTextItem[]>();
  for (const item of eventItems) {
    const key = Math.round(item.y);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  const eventRanges: Array<{ from: string; to: string }> = [];
  for (const line of grouped.values()) {
    const value = line.sort((a, b) => a.x - b.x).map(item => item.text).join(' ');
    const ranges = looseHourRanges(value);
    const hasDescription = line.some(item => item.x >= 220 && compact(item.text));
    if (hasDescription && ranges.length === 0) {
      return {
        status: 'unknown', periods: [], unknownReason: 'insufficient_information',
        warnings: ['使用予定内容に対応する時間を安全に特定できない'], confidence: 'low',
      };
    }
    eventRanges.push(...ranges);
  }

  if (eventRanges.length === 0) {
    return {
      status: 'available',
      periods: [period(usage.from, usage.to, 'available', ['outside_explicit_event_hours'])],
      warnings: ['大会・イベント中は個人利用不可', '市主催行事・天候・緊急利用による変更の可能性あり'],
      confidence: 'high',
    };
  }

  const blocked = eventRanges.map(value => ({
    from: Math.max(usageStart, timeMinutes(value.from)),
    to: Math.min(usageEnd, timeMinutes(value.to)),
  })).filter(value => value.from < value.to).sort((a, b) => a.from - b.from);
  if (blocked.length !== eventRanges.length) throw new PdfCollectorError('source_changed', 'Event hours fall outside operating hours in Ichikawa Kohnodai schedule');
  const merged = blocked.reduce<Array<{ from: number; to: number }>>((result, value) => {
    const previous = result.at(-1);
    if (previous && value.from <= previous.to) previous.to = Math.max(previous.to, value.to);
    else result.push({ ...value });
    return result;
  }, []);
  const asTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const periods: AvailabilityPeriod[] = [];
  let cursor = usageStart;
  for (const value of merged) {
    if (cursor < value.from) periods.push(period(asTime(cursor), asTime(value.from), 'available', ['outside_explicit_event_hours']));
    periods.push(period(asTime(value.from), asTime(value.to), 'unavailable', ['explicit_event_hours']));
    cursor = value.to;
  }
  if (cursor < usageEnd) periods.push(period(asTime(cursor), asTime(usageEnd), 'available', ['outside_explicit_event_hours']));
  return {
    status: aggregate(periods),
    periods,
    warnings: ['大会・イベント中は個人利用不可', '市主催行事・天候・緊急利用による変更の可能性あり'],
    confidence: 'high',
  };
}

export function parseBingoSportsParkPdf(pdf: ExtractedPdf, date: string): PdfParseResult {
  const { year, month, day } = dateParts(date);
  assertAnchors(pdf, ['びんご運動公園', '陸上競技場', '個人利用可能日時案内カレンダー', String(year), `.${month}月`, 'トラック第1レーン']);
  const weekday = new Date(`${date}T12:00:00+09:00`).getUTCDay();
  const column = (weekday + 6) % 7;
  const minX = 50 + column * 104;
  const maxX = minX + 104;
  const target = uniqueItems(pageItems(pdf)).find(item => compact(item.text) === String(day)
    && item.x >= minX && item.x < maxX && item.y > 150 && item.y < 540);
  if (!target) throw new PdfCollectorError('source_changed', 'Target date cell missing from Bingo Sports Park calendar');
  const cell = pageItems(pdf).filter(item => item.x >= minX && item.x < maxX && item.y < target.y - 1 && item.y > Math.max(145, target.y - 63));
  const value = cellText(cell, minX, maxX);
  if (value.includes('未確定')) {
    return { status: 'unknown', periods: [], unknownReason: 'insufficient_information', warnings: ['対象日の予定は未確定'], confidence: 'low' };
  }
  if (value.includes('終日×')) {
    return {
      status: 'unavailable', periods: [period(null, null, 'unavailable', ['explicit_full_day_unavailable'])],
      warnings: ['専用利用や公園設備事情による当日変更の可能性あり'], confidence: 'high',
    };
  }
  const trackAvailable = /トラック(?:のみ|・投てき)?可/.test(value);
  if (!trackAvailable || value.includes('×')) {
    return {
      status: 'unknown', periods: [], unknownReason: 'insufficient_information',
      warnings: ['対象日の利用可能時間を安全に特定できない'], confidence: 'low',
    };
  }
  const from = /(\d{1,2}):(\d{2})[~〜～-]/.exec(value);
  const to = /[~〜～-](\d{1,2}):(\d{2})まで/.exec(value);
  if (from && to) throw new PdfCollectorError('source_changed', 'Multiple partial-day boundaries in Bingo Sports Park calendar');
  const fromTime = from ? `${from[1].padStart(2, '0')}:${from[2]}` : null;
  const toTime = to ? `${to[1].padStart(2, '0')}:${to[2]}` : null;
  return {
    status: fromTime || toTime ? 'partially_available' : 'available',
    periods: [period(fromTime, toTime, 'available', [value.includes('投てき') ? 'track_and_throwing_available' : 'track_only_available'])],
    warnings: ['トラック第1レーンは個人使用禁止', '専用利用や公園設備事情による当日変更の可能性あり', '夜間照明は別料金で点灯できない場合あり'],
    confidence: 'high',
  };
}

export const pdfSourceConfigs: PdfSourceConfig[] = [
  { trackId: 'nerima-general-sports-park', name: '練馬総合運動場公園 陸上競技場', landingPageUrl: 'https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.html', discovery: 'latest_pdf_discovery', parser: 'nerima-weekly-slots', parserVersion: '1.0.0' },
  { trackId: 'toda-sports-center-track', name: '戸田市スポーツセンター 陸上競技場', landingPageUrl: 'https://toda-zaidan.org/sportscenter/shisetsu_sc/yoyaku_sc/', discovery: 'monthly_pdf_discovery', parser: 'toda-monthly-events', parserVersion: '1.0.0' },
  { trackId: 'fuchu-citizen-athletic-track', name: '府中市民陸上競技場', landingPageUrl: 'https://www.city.fuchu.tokyo.jp/shisetu/supotu/kyogi/shimin.html', discovery: 'annual_pdf_discovery', parser: 'fuchu-vector-calendar-guard', parserVersion: '1.0.0' },
  { trackId: 'wadabori-park-first-track', name: '和田堀公園 第一競技場', landingPageUrl: 'https://www.tokyo-park.or.jp/park/wadabori/news/index.html', discovery: 'monthly_pdf_discovery', parser: 'wadabori-half-day-first', parserVersion: '1.0.0' },
  { trackId: 'wadabori-park-seibiyama-track', name: '和田堀公園 第二競技場（済美山運動場）', landingPageUrl: 'https://www.tokyo-park.or.jp/park/wadabori/news/index.html', discovery: 'monthly_pdf_discovery', parser: 'wadabori-half-day-second', parserVersion: '1.0.0' },
  { trackId: 'misato-senario-house-field', name: 'セナリオハウスフィールド三郷', landingPageUrl: 'https://www.misato-hall.com/module/3299.htm', discovery: 'monthly_pdf_discovery', parser: 'misato-three-slot-reservation', parserVersion: '1.0.0' },
  { trackId: 'ageo-athletic-stadium', name: '上尾運動公園 陸上競技場', landingPageUrl: 'https://www.parks.or.jp/saitamasuijo/guide/006/006231.html', discovery: 'monthly_pdf_discovery', parser: 'ageo-individual-use-list', parserVersion: '1.0.0' },
  { trackId: 'hachioji-fujimori-athletic-stadium', name: '東京フットボールセンター八王子富士森競技場', landingPageUrl: 'https://www.city.hachioji.tokyo.jp/life/010/002/003/004/p012068.html', discovery: 'latest_pdf_discovery', parser: 'fujimori-multi-month-matrix', parserVersion: '1.0.0' },
  { trackId: 'kamiyugi-park-athletic-stadium', name: '上柚木公園陸上競技場', landingPageUrl: 'https://kamiyugi-park.jp/facility/athletics-stadium/', discovery: 'latest_pdf_discovery', parser: 'kamiyugi-multi-month-matrix', parserVersion: '1.0.0' },
  { trackId: 'kanagawa-prefectural-sports-center-track', name: '神奈川県立スポーツセンター陸上競技場', landingPageUrl: 'https://www.pref.kanagawa.jp/docs/ui6/kojineiyou.html', discovery: 'monthly_pdf_discovery', parser: 'kanagawa-sports-center-monthly', parserVersion: '1.0.0' },
  { trackId: 'expo70-commemorative-stadium', name: '万博記念競技場', landingPageUrl: 'https://www.expo70-park.jp/sports/facility/arena/', discovery: 'monthly_pdf_discovery', parser: 'expo70-individual-use-monthly', parserVersion: '1.0.0' },
  { trackId: 'ichikawa-kohnodai-athletic-stadium', name: '国府台陸上競技場', landingPageUrl: 'https://www.city.ichikawa.lg.jp/page/4185.html', discovery: 'monthly_pdf_discovery', parser: 'ichikawa-kohnodai-monthly-events', parserVersion: '1.0.0' },
  { trackId: 'bingo-sports-park-athletic-stadium', name: 'こざかなくんスポーツパークびんご 陸上競技場', landingPageUrl: 'https://www.bingo-sportspark.com/news.php?c=topics_view&pk=1566461033', discovery: 'monthly_pdf_discovery', parser: 'bingo-individual-use-calendar', parserVersion: '1.0.0' },
];

interface HtmlLink { url: string; text: string }

function htmlLinks(html: string, baseUrl: string): HtmlLink[] {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(match => ({
    url: new URL(match[1], baseUrl).href,
    text: normalize(match[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')),
  }));
}

function decodeHtml(bytes: Uint8Array, contentType: string) {
  const head = new TextDecoder('ascii').decode(bytes.slice(0, 4096));
  const charset = /charset\s*=\s*["']?([^;"'\s>]+)/i.exec(contentType)?.[1]
    ?? /charset\s*=\s*["']?([^;"'\s>]+)/i.exec(head)?.[1]
    ?? 'utf-8';
  try { return new TextDecoder(charset).decode(bytes); } catch { return new TextDecoder('utf-8').decode(bytes); }
}

class PdfSourceClient {
  private bytes = new Map<string, Promise<{ bytes: Uint8Array; contentType: string; finalUrl: string }>>();

  constructor(private readonly fetchImpl: FetchLike) {}

  private request(url: string) {
    if (!this.bytes.has(url)) this.bytes.set(url, (async () => {
      let response: Response;
      try { response = await this.fetchImpl(url, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'ItsRun availability collector/1.0' } }); }
      catch (error) { throw new PdfCollectorError('fetch_failed', `Fetch failed: ${String(error)}`, url); }
      if (!response.ok) throw new PdfCollectorError('fetch_failed', `HTTP ${response.status}`, url);
      return { bytes: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get('content-type') ?? '', finalUrl: response.url || url };
    })());
    return this.bytes.get(url)!;
  }

  async html(url: string) {
    const result = await this.request(url);
    return { html: decodeHtml(result.bytes, result.contentType), finalUrl: result.finalUrl };
  }

  async pdf(url: string) {
    const result = await this.request(url);
    const magic = new TextDecoder('ascii').decode(result.bytes.slice(0, 5));
    if (!result.contentType.toLowerCase().includes('pdf') && magic !== '%PDF-') throw new PdfCollectorError('invalid_content_type', `Expected PDF, got ${result.contentType || 'unknown content type'}`, url);
    if (magic !== '%PDF-') throw new PdfCollectorError('invalid_content_type', 'Response does not contain PDF magic bytes', url);
    // PDF.js may transfer/detach its input buffer. Keep the cached source bytes intact
    // so one document can be parsed for several requested dates in a range run.
    return { ...result, bytes: result.bytes.slice() };
  }
}

async function discoverPdf(config: PdfSourceConfig, date: string, client: PdfSourceClient) {
  const { year, month } = dateParts(date);
  const landing = await client.html(config.landingPageUrl);
  const links = htmlLinks(landing.html, landing.finalUrl);
  const text = (link: HtmlLink) => compact(link.text);
  if (config.trackId === 'nerima-general-sports-park') return links.find(link => text(link).includes('陸上競技場の開放状況(直近1週間分)'))?.url;
  if (config.trackId === 'toda-sports-center-track') {
    const listItem = [...landing.html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
      .map(match => match[1])
      .find(value => compact(value.replace(/<[^>]+>/g, ' ')).includes(`${year}年${month}月の行事予定`));
    return listItem ? htmlLinks(listItem, landing.finalUrl)[0]?.url : undefined;
  }
  if (config.trackId === 'fuchu-citizen-athletic-track') return links.find(link => text(link).includes(`令和${reiwaYear(year)}年度市民陸上競技場カレンダー`))?.url;
  if (config.trackId === 'misato-senario-house-field') {
    if (!compact(landing.html).includes(`令和${reiwaYear(year)}年度`)) return undefined;
    return links.find(link => text(link).includes(`${month}月分予約状況`) && !text(link).includes('会議室'))?.url;
  }
  if (config.trackId === 'ageo-athletic-stadium') return links.find(link => text(link).includes(`${month}月「個人利用日」予定表`))?.url;
  if (config.trackId === 'hachioji-fujimori-athletic-stadium') return links.find(link => text(link).includes('一般開放予定表'))?.url;
  if (config.trackId === 'kamiyugi-park-athletic-stadium') {
    const paragraph = [...landing.html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(match => match[1])
      .find(value => compact(value.replace(/<[^>]+>/g, ' ')).includes('一般開放状況'));
    const url = paragraph ? htmlLinks(paragraph, landing.finalUrl)[0]?.url : undefined;
    return url?.includes(`/${year}/`) ? url : undefined;
  }
  if (config.trackId === 'kanagawa-prefectural-sports-center-track') {
    return links.find(link => text(link).includes(`予定表(令和${reiwaYear(year)}年${month}月分)`))?.url;
  }
  if (config.trackId === 'expo70-commemorative-stadium') {
    const label = `競技場${month}月個人利用予定表`;
    return links.find(link => text(link).includes(label) && link.url.includes(`${year}${String(month).padStart(2, '0')}`))?.url;
  }
  if (config.trackId === 'ichikawa-kohnodai-athletic-stadium') {
    const pageText = compact(landing.html.replace(/<[^>]+>/g, ' '));
    if (!pageText.includes(`更新日:${year}年`) || !pageText.includes('「使用時間」以外を一般開放いたします')) return undefined;
    return links.find(link => text(link).includes(`${month}月使用予定表`) && link.url.toLowerCase().includes('.pdf'))?.url;
  }
  if (config.trackId === 'bingo-sports-park-athletic-stadium') {
    const pageText = compact(landing.html.replace(/<[^>]+>/g, ' '));
    if (!pageText.includes(`陸上競技場${year}.${month}月個人利用可能日時案内カレンダー`)) return undefined;
    return links.find(link => text(link).includes(`${year}.${month}月陸上競技場個人利用可能日時案内カレンダー`) && link.url.toLowerCase().includes('.pdf'))?.url;
  }
  if (config.trackId.startsWith('wadabori-park-')) {
    const article = links.find(link => link.url.includes(`/news/${year}/`) && text(link).includes('競技場') && text(link).includes(`${month}月`));
    if (!article) return undefined;
    const page = await client.html(article.url);
    const facilityLabel = config.trackId === 'wadabori-park-first-track' ? '第1競技場(和田堀)' : '第2競技場(済美山運動場)';
    return htmlLinks(page.html, page.finalUrl).find(link => text(link).includes(facilityLabel) && text(link).includes(`${month}月の予定表`))?.url;
  }
  return undefined;
}

function parserFor(config: PdfSourceConfig, pdf: ExtractedPdf, date: string) {
  if (config.trackId === 'nerima-general-sports-park') return parseNerimaPdf(pdf, date);
  if (config.trackId === 'toda-sports-center-track') return parseTodaPdf(pdf, date);
  if (config.trackId === 'fuchu-citizen-athletic-track') return parseFuchuPdf(pdf, date);
  if (config.trackId === 'wadabori-park-first-track') return parseWadaboriPdf(pdf, date, 'first');
  if (config.trackId === 'wadabori-park-seibiyama-track') return parseWadaboriPdf(pdf, date, 'second');
  if (config.trackId === 'misato-senario-house-field') return parseMisatoPdf(pdf, date);
  if (config.trackId === 'ageo-athletic-stadium') return parseAgeoPdf(pdf, date);
  if (config.trackId === 'hachioji-fujimori-athletic-stadium') return parseFujimoriPdf(pdf, date);
  if (config.trackId === 'kamiyugi-park-athletic-stadium') return parseKamiyugiPdf(pdf, date);
  if (config.trackId === 'kanagawa-prefectural-sports-center-track') return parseKanagawaSportsCenterPdf(pdf, date);
  if (config.trackId === 'expo70-commemorative-stadium') return parseExpo70Pdf(pdf, date);
  if (config.trackId === 'ichikawa-kohnodai-athletic-stadium') return parseIchikawaKohnodaiPdf(pdf, date);
  if (config.trackId === 'bingo-sports-park-athletic-stadium') return parseBingoSportsParkPdf(pdf, date);
  throw new PdfCollectorError('unsupported_source_type', `No parser for ${config.trackId}`);
}

export function createPdfCollector(fetchImpl: FetchLike = fetch, extractImpl: typeof extractPdf = extractPdf) {
  const client = new PdfSourceClient(fetchImpl);
  const extractedBySource = new Map<string, Promise<ExtractedPdf>>();
  return {
    async collect(config: PdfSourceConfig, date: string, now: Date): Promise<PdfCollectionResult> {
      const pdfUrl = await discoverPdf(config, date, client);
      if (!pdfUrl) throw new PdfCollectorError('schedule_not_published', `No PDF published for ${date}`, config.landingPageUrl);
      const source = await client.pdf(pdfUrl);
      const sourceHash = sha256(source.bytes);
      if (!extractedBySource.has(sourceHash)) extractedBySource.set(sourceHash, extractImpl(source.bytes));
      const extracted = await extractedBySource.get(sourceHash)!;
      const result = parserFor(config, extracted, date);
      return {
        ...result,
        pdfUrl: source.finalUrl,
        landingPageUrl: config.landingPageUrl,
        sourceHash,
        documentId: new URL(source.finalUrl).pathname.split('/').at(-1) ?? source.finalUrl,
        fetchedAt: now.toISOString(),
        parser: config.parser,
        parserVersion: config.parserVersion,
      };
    },
  };
}
