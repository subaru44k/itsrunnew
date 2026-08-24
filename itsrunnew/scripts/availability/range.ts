import type { AvailabilityDataset } from '../../src/model/availability';
import { collectAvailability } from './collectors';
import { createPdfCollector } from './pdf';

type FetchLike = typeof fetch;

export interface FetchCacheStats {
  requests: number;
  cacheHits: number;
}

export function addDateDays(dateKey: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error(`Invalid date: ${dateKey}`);
  const date = new Date(`${dateKey}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${dateKey}`);
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export function dateKeys(from: string, days: number) {
  if (!Number.isInteger(days) || days < 1 || days > 62) throw new Error('--days must be an integer from 1 to 62');
  return Array.from({ length: days }, (_, index) => addDateDays(from, index));
}

function bodyKey(body: BodyInit | null | undefined) {
  if (body == null) return '';
  if (typeof body === 'string') return body;
  if (body instanceof URLSearchParams) return body.toString();
  return String(body);
}

export function createCachedFetch(fetchImpl: FetchLike = fetch) {
  const cache = new Map<string, Promise<Response>>();
  const stats: FetchCacheStats = { requests: 0, cacheHits: 0 };
  const cachedFetch: FetchLike = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const key = `${method} ${url}\n${bodyKey(init?.body)}`;
    if (cache.has(key)) stats.cacheHits += 1;
    else {
      stats.requests += 1;
      cache.set(key, fetchImpl(input, init).then(response => response.clone()));
    }
    return (await cache.get(key)!).clone();
  };
  return { fetch: cachedFetch, stats };
}

export async function collectAvailabilityRange(from: string, days: number, options: { now?: Date; fetchImpl?: FetchLike } = {}) {
  const dates = dateKeys(from, days);
  const now = options.now ?? new Date();
  const cached = createCachedFetch(options.fetchImpl ?? fetch);
  const pdfCollector = createPdfCollector(cached.fetch);
  const datasets: AvailabilityDataset[] = [];
  for (const date of dates) {
    const facilities = await collectAvailability(date, { now, fetchImpl: cached.fetch, pdfCollector });
    datasets.push({ schemaVersion: 1, date, timezone: 'Asia/Tokyo', generatedAt: now.toISOString(), facilities });
  }
  return { datasets, stats: cached.stats };
}
