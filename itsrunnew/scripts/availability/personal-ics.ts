import type { AvailabilityPeriod } from '../../src/model/availability';

export type PersonalIcsKind = 'kobe' | 'ichihara';

export interface PersonalIcsResult {
  status: 'partially_available' | 'unknown';
  periods: AvailabilityPeriod[];
  warnings: string[];
}

type IcsProperty = {
  name: string;
  params: Map<string, string>;
  value: string;
};

type IcsEvent = {
  properties: Map<string, IcsProperty[]>;
};

type DateSpan =
  | { kind: 'date'; start: string; end: string }
  | { kind: 'instant'; start: number; end: number | null };

type ParsedEvent = {
  event: IcsEvent;
  span: DateSpan;
};

// The saved Kobe calendar is about 328 KiB and 1,235 events; leave room for
// calendar growth while keeping parsing work bounded for a public endpoint.
const MAX_ICS_LENGTH = 4_000_000;
const MAX_LINES = 50_000;
const MAX_EVENTS = 5_000;
const TOKYO_OFFSET_MS = 9 * 60 * 60 * 1000;

const KOBE_SLOTS = {
  morning: { from: '09:00', to: '12:00' },
  afternoon: { from: '13:00', to: '17:00' },
  night: { from: '17:00', to: '19:00' },
} as const;

const KOBE_CONDITIONS = {
  common: ['個人利用はトラックのみ（芝生・フィールドは利用不可）', '陸上競技のみ利用可'],
  daytime: '利用時間終了30分前までに発券・受付',
  night: '夜間は4〜10月の日曜・祝日以外のみ、17:15までに発券・受付',
} as const;

function uniqueWarnings(warnings: string[]) {
  return [...new Set(warnings.filter(Boolean))];
}

function unknownResult(warnings: string[]): PersonalIcsResult {
  return { status: 'unknown', periods: [], warnings: uniqueWarnings(warnings) };
}

function availablePeriod(from: string, to: string, conditions: string[] = []): AvailabilityPeriod {
  return {
    from,
    to,
    status: 'available',
    scope: 'full_track',
    eligibility: 'public',
    conditions,
  };
}

function normalizeText(value: string) {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\([\\,;:])/g, '$1')
    .normalize('NFKC');
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function isDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return Boolean(match && isCalendarDate(`${match[1]}${match[2]}${match[3]}`));
}

function dateKeyFromIcs(value: string) {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function addDays(date: string, amount: number) {
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + amount));
  return `${String(result.getUTCFullYear()).padStart(4, '0')}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`;
}

function targetDayBounds(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const start = Date.UTC(year, month - 1, day) - TOKYO_OFFSET_MS;
  return { start, end: start + 24 * 60 * 60 * 1000 };
}

function dateKeyAtTokyo(timestamp: number) {
  const result = new Date(timestamp + TOKYO_OFFSET_MS);
  return `${String(result.getUTCFullYear()).padStart(4, '0')}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`;
}

function unfoldIcs(ics: string): { lines: string[]; warnings: string[] } {
  const physicalLines = ics.replace(/\r\n?/g, '\n').split('\n');
  if (physicalLines.length > MAX_LINES) {
    return { lines: [], warnings: ['ICSの行数が上限を超えています。'] };
  }
  const lines: string[] = [];
  const warnings: string[] = [];
  for (const physicalLine of physicalLines) {
    if (/^[ \t]/.test(physicalLine)) {
      if (!lines.length) {
        warnings.push('先頭の折り返し行を解釈できません。');
      } else {
        lines[lines.length - 1] += physicalLine.slice(1);
      }
    } else {
      lines.push(physicalLine.replace(/^\uFEFF/, ''));
    }
  }
  return { lines, warnings };
}

function parseContentLine(line: string): IcsProperty | null {
  const colon = line.indexOf(':');
  if (colon <= 0) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segments = left.split(';');
  const name = segments.shift()?.trim().toUpperCase();
  if (!name || !/^[A-Z][A-Z0-9-]*$/.test(name)) return null;
  const params = new Map<string, string>();
  for (const segment of segments) {
    const equals = segment.indexOf('=');
    if (equals <= 0) return null;
    const key = segment.slice(0, equals).trim().toUpperCase();
    const parameterValue = segment.slice(equals + 1).trim().replace(/^"|"$/g, '');
    if (!/^[A-Z][A-Z0-9-]*$/.test(key) || !parameterValue) return null;
    params.set(key, parameterValue);
  }
  return { name, params, value: normalizeText(value) };
}

function parseEvents(lines: string[]) {
  const events: IcsEvent[] = [];
  const warnings: string[] = [];
  let insideCalendar = false;
  let current: IcsEvent | null = null;
  let hasCalendar = false;
  let malformed = false;

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === 'BEGIN:VCALENDAR') {
      if (insideCalendar || current) malformed = true;
      insideCalendar = true;
      hasCalendar = true;
      continue;
    }
    if (upper === 'END:VCALENDAR') {
      if (current || !insideCalendar) malformed = true;
      insideCalendar = false;
      continue;
    }
    if (upper === 'BEGIN:VEVENT') {
      if (!insideCalendar || current) {
        malformed = true;
        continue;
      }
      if (events.length >= MAX_EVENTS) {
        warnings.push('ICSのイベント数が上限を超えています。');
        return { events: [], warnings, malformed: true, hasCalendar };
      }
      current = { properties: new Map() };
      continue;
    }
    if (upper === 'END:VEVENT') {
      if (!current) {
        malformed = true;
      } else {
        events.push(current);
        current = null;
      }
      continue;
    }
    if (!current) continue;
    const property = parseContentLine(line);
    if (!property) {
      malformed = true;
      continue;
    }
    const values = current.properties.get(property.name) ?? [];
    values.push(property);
    current.properties.set(property.name, values);
  }
  if (current || insideCalendar || !hasCalendar) malformed = true;
  if (!hasCalendar) warnings.push('VCALENDARがありません。');
  if (malformed) warnings.push('ICSの構造を解釈できません。');
  return { events, warnings, malformed, hasCalendar };
}

function oneProperty(event: IcsEvent, name: string) {
  const values = event.properties.get(name) ?? [];
  return values.length === 1 ? values[0] : null;
}

function propertyValue(event: IcsEvent, name: string) {
  return oneProperty(event, name)?.value ?? null;
}

function parseDateTime(value: string, property: IcsProperty) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (!match) throw new Error('日時形式が未対応です。');
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, utc] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (!isCalendarDate(`${yearText}${monthText}${dayText}`) || hour > 23 || minute > 59 || second > 59) {
    throw new Error('日時の値が不正です。');
  }
  const tzid = property.params.get('TZID');
  if (tzid && tzid !== 'Asia/Tokyo') throw new Error(`未対応のタイムゾーンです: ${tzid}`);
  if (!utc && !tzid) throw new Error('タイムゾーンのない日時は未対応です。');
  const timestamp = utc
    ? Date.UTC(year, month - 1, day, hour, minute, second)
    : Date.UTC(year, month - 1, day, hour, minute, second) - TOKYO_OFFSET_MS;
  return timestamp;
}

function parsePropertyDate(property: IcsProperty): { type: 'date'; value: string } | { type: 'instant'; value: number } {
  const valueType = property.params.get('VALUE')?.toUpperCase();
  const dateValue = /^\d{8}$/.test(property.value) && (valueType === 'DATE' || valueType === undefined);
  if (dateValue) {
    if (!isCalendarDate(property.value)) throw new Error('日付の値が不正です。');
    const tzid = property.params.get('TZID');
    if (tzid && tzid !== 'Asia/Tokyo') throw new Error(`未対応のタイムゾーンです: ${tzid}`);
    return { type: 'date', value: dateKeyFromIcs(property.value) };
  }
  if (valueType === 'DATE') throw new Error('VALUE=DATEの日付形式が不正です。');
  if (valueType && valueType !== 'DATE-TIME') throw new Error('未対応の日時形式です。');
  return { type: 'instant', value: parseDateTime(property.value, property) };
}

function parseEvent(event: IcsEvent): ParsedEvent {
  const startProperty = oneProperty(event, 'DTSTART');
  if (!startProperty) throw new Error('DTSTARTがありません。');
  const endProperties = event.properties.get('DTEND') ?? [];
  if (endProperties.length > 1) throw new Error('DTENDが重複しています。');
  const start = parsePropertyDate(startProperty);
  if (!endProperties.length) {
    return start.type === 'date'
      ? { event, span: { kind: 'date', start: start.value, end: addDays(start.value, 1) } }
      : { event, span: { kind: 'instant', start: start.value, end: null } };
  }
  const end = parsePropertyDate(endProperties[0]);
  if (end.type !== start.type) throw new Error('DTSTARTとDTENDの形式が一致しません。');
  if (start.type === 'date' && end.type === 'date') {
    if (end.value <= start.value) throw new Error('DTENDがDTSTARTより後ではありません。');
    return { event, span: { kind: 'date', start: start.value, end: end.value } };
  }
  if (start.type === 'instant' && end.type === 'instant') {
    if (end.value <= start.value) throw new Error('DTENDがDTSTARTより後ではありません。');
    return { event, span: { kind: 'instant', start: start.value, end: end.value } };
  }
  throw new Error('イベント期間を解釈できません。');
}

function eventMatchesDate(span: DateSpan, date: string) {
  if (span.kind === 'date') return span.start <= date && date < span.end;
  if (span.end === null) return dateKeyAtTokyo(span.start) === date;
  const bounds = targetDayBounds(date);
  return span.start < bounds.end && span.end > bounds.start;
}

function hasUnsupportedRecurrence(event: IcsEvent) {
  return ['RRULE', 'RDATE', 'EXDATE', 'RECURRENCE-ID'].some(name => event.properties.has(name));
}

function isCancelled(event: IcsEvent) {
  return propertyValue(event, 'STATUS')?.toUpperCase() === 'CANCELLED';
}

function isNegativeSummary(summary: string) {
  const compact = summary.replace(/[ \t\r\n]/g, '');
  return /[✕✖×]/u.test(compact) || /個人利用(?:不可|なし|中止)/u.test(compact);
}

function parseClock(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function periodMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function parseIchiharaPeriods(event: IcsEvent) {
  const summary = propertyValue(event, 'SUMMARY');
  const description = event.properties.get('DESCRIPTION')?.map(value => value.value).join('\n') ?? '';
  if (!summary || !/[〇○◯]/u.test(summary) || !/(?:午前|午後)/u.test(summary)) return { periods: [], warning: '個人利用可の時間帯ラベルがありません。' };
  const normalized = description.normalize('NFKC').replace(/[〜～]/g, '~');
  const rangePattern = /(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/g;
  const matches = [...normalized.matchAll(rangePattern)];
  if (!matches.length) return { periods: [], warning: 'DESCRIPTIONに明示的な時間帯がありません。' };
  const periods: AvailabilityPeriod[] = [];
  for (const match of matches) {
    const from = parseClock(`${match[1]}:${match[2]}`);
    const to = parseClock(`${match[3]}:${match[4]}`);
    if (!from || !to || periodMinutes(from) >= periodMinutes(to)) return { periods: [], warning: 'DESCRIPTIONの時間帯が不正です。' };
    periods.push(availablePeriod(from, to));
  }
  return { periods, warning: null };
}

function parseKobePeriods(event: IcsEvent, date: string) {
  const summary = propertyValue(event, 'SUMMARY');
  if (!summary || !summary.includes('個人利用') || isNegativeSummary(summary)) return { periods: [], warning: null };
  const compact = summary.replace(/[ \t\r\n]/g, '');
  const periods: AvailabilityPeriod[] = [];
  if (/(?:午前|AM)(?![A-Z])/u.test(compact)) {
    periods.push(availablePeriod(KOBE_SLOTS.morning.from, KOBE_SLOTS.morning.to, [...KOBE_CONDITIONS.common, KOBE_CONDITIONS.daytime]));
  }
  if (/(?:午後|PM)(?![A-Z])/u.test(compact)) {
    periods.push(availablePeriod(KOBE_SLOTS.afternoon.from, KOBE_SLOTS.afternoon.to, [...KOBE_CONDITIONS.common, KOBE_CONDITIONS.daytime]));
  }
  if (/夜間|(?:^|[^A-Z])NIGHT(?:$|[^A-Z])/u.test(compact)) {
    const month = Number(date.slice(5, 7));
    if (month >= 4 && month <= 10 && new Date(`${date}T00:00:00Z`).getUTCDay() !== 0) {
      periods.push(availablePeriod(KOBE_SLOTS.night.from, KOBE_SLOTS.night.to, [...KOBE_CONDITIONS.common, KOBE_CONDITIONS.night]));
    }
  }
  if (!periods.length) return { periods: [], warning: '個人利用イベントの時間帯ラベルがありません。' };
  return { periods, warning: null };
}

function mergeAdjacent(periods: AvailabilityPeriod[]) {
  const sorted = [...periods].sort((a, b) => (a.from ?? '').localeCompare(b.from ?? '') || (a.to ?? '').localeCompare(b.to ?? ''));
  const merged: AvailabilityPeriod[] = [];
  for (const period of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && previous.status === period.status && previous.scope === period.scope
      && previous.eligibility === period.eligibility && JSON.stringify(previous.conditions) === JSON.stringify(period.conditions)
      && previous.to !== null && previous.to === period.from) {
      previous.to = period.to;
    } else if (!previous || previous.from !== period.from || previous.to !== period.to) {
      merged.push({ ...period, conditions: [...period.conditions] });
    }
  }
  return merged;
}

function deduplicateAndSort(periods: AvailabilityPeriod[]) {
  const seen = new Set<string>();
  return [...periods]
    .filter(period => {
      const key = `${period.from ?? ''}/${period.to ?? ''}/${period.status}/${period.scope}/${period.eligibility}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => periodMinutes(a.from ?? '00:00') - periodMinutes(b.from ?? '00:00'));
}

export function parsePersonalIcs(ics: string, date: string, kind: PersonalIcsKind): PersonalIcsResult {
  if (typeof ics !== 'string' || ics.length > MAX_ICS_LENGTH) return unknownResult(['ICSの入力が不正または大きすぎます。']);
  if (!isDateKey(date)) return unknownResult(['対象日が不正です。']);
  if (kind !== 'kobe' && kind !== 'ichihara') return unknownResult(['施設種別が未対応です。']);

  const unfolded = unfoldIcs(ics);
  if (!unfolded.lines.length) return unknownResult(unfolded.warnings);
  const parsed = parseEvents(unfolded.lines);
  if (parsed.malformed || !parsed.events.length) return unknownResult([...unfolded.warnings, ...parsed.warnings, '対象日の個人利用イベントを確認できません。']);

  const warnings = [...unfolded.warnings, ...parsed.warnings];
  const parsedEvents: ParsedEvent[] = [];
  for (const event of parsed.events) {
    if (hasUnsupportedRecurrence(event)) {
      warnings.push('繰り返しイベントは未対応です。');
      continue;
    }
    try {
      parsedEvents.push(parseEvent(event));
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'イベントの日時を解釈できません。');
    }
  }
  if (warnings.some(warning => /未対応|不正|解釈できません|構造|タイムゾーン/.test(warning)) && !parsedEvents.length) {
    return unknownResult(warnings);
  }

  const targetEvents = parsedEvents.filter(value => eventMatchesDate(value.span, date));
  if (!targetEvents.length) return unknownResult([...warnings, '対象日の個人利用イベントがありません。']);

  const activeEvents = targetEvents.filter(value => !isCancelled(value.event));
  if (targetEvents.some(value => isCancelled(value.event))) warnings.push('STATUS:CANCELLED のイベントは無視しました。');
  if (!activeEvents.length) return unknownResult([...warnings, '対象日の有効な個人利用イベントがありません。']);

  const negativeEvents = activeEvents.filter(value => isNegativeSummary(propertyValue(value.event, 'SUMMARY') ?? ''));
  const positivePeriods: AvailabilityPeriod[] = [];
  for (const { event } of activeEvents) {
    if (isNegativeSummary(propertyValue(event, 'SUMMARY') ?? '')) continue;
    const result = kind === 'kobe' ? parseKobePeriods(event, date) : parseIchiharaPeriods(event);
    if (result.warning) warnings.push(result.warning);
    positivePeriods.push(...result.periods);
  }
  if (negativeEvents.length && positivePeriods.length) {
    return unknownResult([...warnings, '個人利用可否が競合するイベントがあります。']);
  }
  if (!positivePeriods.length) return unknownResult([...warnings, '対象日の個人利用可能な時間帯を確認できません。']);

  const periods = kind === 'ichihara' ? mergeAdjacent(positivePeriods) : deduplicateAndSort(positivePeriods);
  return { status: 'partially_available', periods, warnings: uniqueWarnings(warnings) };
}
