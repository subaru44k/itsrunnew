import type { AvailabilityPeriod, TrackAvailability, UnknownReason } from '../../src/model/availability';

export interface NoticeParseResult {
  status: TrackAvailability['status'];
  periods: AvailabilityPeriod[];
  unknownReason?: UnknownReason;
  publishedAt: string | null;
  sourceUrl: string;
  warnings: string[];
}

interface WordpressPost {
  date?: unknown;
  modified?: unknown;
  link?: unknown;
  title?: { rendered?: unknown };
  content?: { rendered?: unknown };
}

function parsePosts(payload: string): WordpressPost[] {
  const value: unknown = JSON.parse(payload.replace(/^\uFEFF/, ''));
  if (!Array.isArray(value)) throw new Error('WordPress response is not a post array');
  return value as WordpressPost[];
}

function textWithBreaks(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/h[1-6]>|<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function fullWidthDigits(value: string) {
  return value.replace(/[０-９]/g, digit => String(digit.charCodeAt(0) - '０'.charCodeAt(0)));
}

function normalized(value: string) {
  return fullWidthDigits(textWithBreaks(value))
    .replace(/：/g, ':')
    .replace(/[〜～−–—]/g, '-')
    .replace(/[（）]/g, character => character === '（' ? '(' : ')');
}

function dateParts(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid date: ${date}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function availablePeriod(from: string, to: string, conditions: string[]): AvailabilityPeriod {
  return { from, to, status: 'available', scope: 'full_track', eligibility: 'public', conditions };
}

function unavailablePeriod(conditions: string[]): AvailabilityPeriod {
  return { from: null, to: null, status: 'unavailable', scope: 'full_track', eligibility: 'public', conditions };
}

function unknown(sourceUrl: string, publishedAt: string | null, warnings: string[] = []): NoticeParseResult {
  return { status: 'unknown', periods: [], unknownReason: 'outside_published_period', publishedAt, sourceUrl, warnings };
}

function postFields(post: WordpressPost) {
  if (typeof post.date !== 'string' || typeof post.link !== 'string'
    || typeof post.title?.rendered !== 'string' || typeof post.content?.rendered !== 'string') {
    throw new Error('WordPress post fields are missing');
  }
  return { date: post.date, link: post.link, title: normalized(post.title.rendered), content: post.content.rendered };
}

export function parseNishikyogokuNotice(payload: string, date: string, fallbackUrl: string): NoticeParseResult {
  const { year, month, day } = dateParts(date);
  const candidates = parsePosts(payload).map(postFields).filter(post =>
    post.title.includes('西京極総合運動公園')
    && post.title.includes('陸上トラック 一般開放日')
    && new RegExp(`[（(]${month}月分[）)]`).test(post.title));
  if (candidates.length === 0) return unknown(fallbackUrl, null);
  if (candidates.length !== 1) throw new Error('Multiple Nishikyogoku monthly notices matched');
  const post = candidates[0];
  const content = normalized(post.content);
  if (!content.includes(`${year}年${month}月`) || !content.includes('東寺ハウジングフィールド西京極(西京極補助競技場)')) {
    throw new Error('Nishikyogoku notice year, month, or facility anchor changed');
  }
  const rawSection = /<th\b[^>]*>\s*開放日時等\s*<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>/i.exec(post.content)?.[1];
  if (!rawSection) throw new Error('Nishikyogoku opening-date section is missing');
  const section = normalized(rawSection);
  const time = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(section);
  if (!time) throw new Error('Nishikyogoku opening time is missing');
  const openDays = new Set<number>();
  for (const match of section.matchAll(/(\d{1,2})日(?:\([^)]*\))?(?:\s*-\s*(\d{1,2})日(?:\([^)]*\))?)?/g)) {
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > 31) throw new Error('Nishikyogoku opening date range is invalid');
    for (let value = start; value <= end; value += 1) openDays.add(value);
  }
  if (openDays.size === 0) throw new Error('Nishikyogoku opening dates are missing');
  const publishedAt = post.date.slice(0, 10);
  if (!openDays.has(day)) return unknown(post.link, publishedAt, ['一般開放日の掲載がない日は利用可否不明']);
  return {
    status: 'partially_available',
    periods: [availablePeriod(`${time[1].padStart(2, '0')}:${time[2]}`, `${time[3].padStart(2, '0')}:${time[4]}`, ['explicit_general_opening'])],
    publishedAt,
    sourceUrl: post.link,
    warnings: ['フィールド・投てき・棒高跳は利用不可', '荒天等による中止の可能性あり'],
  };
}

export function parseChigasakiNotice(payload: string, date: string, fallbackUrl: string): NoticeParseResult {
  const { year, month, day } = dateParts(date);
  const expectedTitle = `${month}月の陸上個人利用日のご案内`;
  const candidates = parsePosts(payload).map(postFields).filter(post =>
    post.title === expectedTitle
    && post.date.startsWith(`${year}-${String(month).padStart(2, '0')}-`)
    && new RegExp(`/${year}/${String(month).padStart(2, '0')}/`).test(post.link));
  if (candidates.length === 0) return unknown(fallbackUrl, null);
  if (candidates.length !== 1) throw new Error('Multiple Chigasaki monthly notices matched');
  const post = candidates[0];
  const content = normalized(post.content);
  if (!content.includes(`[${month}月の陸上個人利用日のご案内]`) && !content.includes(`【${month}月の陸上個人利用日のご案内】`)) {
    throw new Error('Chigasaki monthly notice anchor changed');
  }
  const available = new RegExp(`${month}月${day}日\\([^)]*\\)\\s*(\\d{1,2}):(\\d{2})\\s*-\\s*(\\d{1,2}):(\\d{2})`).exec(content);
  const publishedAt = post.date.slice(0, 10);
  if (available) {
    return {
      status: 'partially_available',
      periods: [availablePeriod(`${available[1].padStart(2, '0')}:${available[2]}`, `${available[3].padStart(2, '0')}:${available[4]}`, ['explicit_individual_use_notice'])],
      publishedAt,
      sourceUrl: post.link,
      warnings: ['掲載時点以降に変更される可能性あり', '投てき種目は利用不可'],
    };
  }
  const closureLines = content.split('\n').filter(line => /施設休館日|開放無し/.test(line));
  const explicitlyClosed = closureLines.some(line => [...line.matchAll(new RegExp(`${month}月(\\d{1,2})日`, 'g'))]
    .some(match => Number(match[1]) === day));
  if (explicitlyClosed) {
    return {
      status: 'unavailable', periods: [unavailablePeriod(['explicit_no_opening_notice'])], publishedAt, sourceUrl: post.link,
      warnings: ['掲載時点以降に変更される可能性あり'],
    };
  }
  return unknown(post.link, publishedAt, ['個人利用日時の掲載がない日は利用可否不明']);
}

export function parseYamashiroNotice(html: string, date: string, sourceUrl: string): NoticeParseResult {
  const { year, month, day } = dateParts(date);
  const title = /<meta\s+(?:name|property)=["'](?:twitter|og):title["']\s+content=["']([^"']+)["']/i.exec(html)?.[1];
  const description = /<meta\s+(?:name|property)=["'](?:twitter|og):description["']\s+content=["']([^"']+)["']/i.exec(html)?.[1];
  const publication = /<meta\s+property=["']article:published_time["']\s+content=["'](\d{4})-(\d{2})-(\d{2})/i.exec(html);
  if (!title || !description || !publication || !normalized(title).includes('陸上競技場個人利用のお知らせ')) {
    throw new Error('Yamashiro rolling notice anchors changed');
  }
  const publishedAt = `${publication[1]}-${publication[2]}-${publication[3]}`;
  if (Number(publication[1]) !== year) return unknown(sourceUrl, publishedAt, ['記事公開年と対象年が一致しない']);
  const content = normalized(description);
  const dayExpression = `${month}月\\s*${day}日\\([^)]*\\)`;
  const available = new RegExp(`${dayExpression}\\s*(\\d{1,2}):(\\d{2})\\s*-\\s*(\\d{1,2}):(\\d{2})`).exec(content);
  if (available) {
    return {
      status: 'partially_available',
      periods: [availablePeriod(`${available[1].padStart(2, '0')}:${available[2]}`, `${available[3].padStart(2, '0')}:${available[4]}`, ['explicit_rolling_individual_use_notice'])],
      publishedAt,
      sourceUrl,
      warnings: ['短期更新のお知らせのため掲載外の日は不明', '利用前に施設へ最新状況を確認'],
    };
  }
  if (new RegExp(`${dayExpression}\\s*利用不可`).test(content)) {
    return { status: 'unavailable', periods: [unavailablePeriod(['explicit_unavailable_notice'])], publishedAt, sourceUrl, warnings: ['短期更新のお知らせ'] };
  }
  return unknown(sourceUrl, publishedAt, ['短期更新範囲外']);
}
