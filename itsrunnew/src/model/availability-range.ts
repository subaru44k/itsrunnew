import { reactive, ref } from 'vue';
import type { AvailabilityDataset } from './availability';

export interface AvailabilityManifest {
  schemaVersion: number;
  timezone: 'Asia/Tokyo';
  generatedAt: string;
  startDate: string;
  endDate: string;
  dates: string[];
}

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const fallbackDates = Array.from({ length: 31 }, (_, index) => addDateOnlyDays(today, index));
export const availabilityManifest = reactive<AvailabilityManifest>({
  schemaVersion: 1,
  timezone: 'Asia/Tokyo',
  generatedAt: new Date(0).toISOString(),
  startDate: fallbackDates[0],
  endDate: fallbackDates.at(-1)!,
  dates: fallbackDates,
});
export const availabilityManifestStatus = ref<'loading' | 'ready' | 'failed'>('loading');
const DATE_CACHE_MS = 60_000;
const dateCache = new Map<string, { promise?: Promise<AvailabilityDataset>; value?: AvailabilityDataset; fetchedAt?: number }>();
let manifestRequest: Promise<void> | null = null;
let manifestCheckedAt = 0;
let mismatchRefreshGeneration: string | null = null;

export function loadAvailabilityManifest(): Promise<void> {
  if (manifestRequest) return manifestRequest;
  availabilityManifestStatus.value = 'loading';
  manifestCheckedAt = Date.now();
  const request = (async () => {
    const response = await fetch('/availability/manifest.json', { cache: 'no-cache', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Availability manifest HTTP ${response.status}`);
    const value = await response.json() as AvailabilityManifest;
    if (value.schemaVersion !== 1 || value.timezone !== 'Asia/Tokyo' ||
        !Array.isArray(value.dates) || value.dates.length !== 31 ||
        value.startDate !== value.dates[0] || value.endDate !== value.dates.at(-1)) {
      throw new Error('Invalid published availability manifest');
    }
    Object.assign(availabilityManifest, value);
  })();
  manifestRequest = request.then(
    () => { manifestRequest = null; availabilityManifestStatus.value = 'ready'; },
    error => { manifestRequest = null; availabilityManifestStatus.value = 'failed'; throw error; },
  );
  return manifestRequest;
}

export function addDateOnlyDays(dateKey: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error(`Invalid date: ${dateKey}`);
  const date = new Date(`${dateKey}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${dateKey}`);
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export function nextWeekdayDate(dateKey: string, targetWeekday: number) {
  const date = new Date(`${dateKey}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime()) || targetWeekday < 0 || targetWeekday > 6) throw new Error('Invalid date or weekday');
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const current = weekdayLabels.indexOf(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', weekday: 'short' }).format(date));
  return addDateOnlyDays(dateKey, (targetWeekday - current + 7) % 7);
}

export function normalizeSelectedDate(value: unknown, today: string, manifest: AvailabilityManifest = availabilityManifest) {
  const candidate = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today;
  if (manifest.dates.includes(candidate)) return candidate;
  if (manifest.dates.includes(today)) return today;
  return manifest.startDate;
}

export function isGeneratedDate(date: string, manifest: AvailabilityManifest = availabilityManifest) {
  return manifest.dates.includes(date);
}

async function fetchAvailabilityDate(date: string, cache: RequestCache = 'no-cache') {
  const response = await fetch(`/availability/${date}.json`, { cache, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Availability date HTTP ${response.status}: ${date}`);
  const value = await response.json() as AvailabilityDataset;
  if (value.schemaVersion !== 1 || value.date !== date || value.timezone !== 'Asia/Tokyo' || !Array.isArray(value.facilities)) {
    throw new Error(`Invalid published availability date: ${date}`);
  }
  return value;
}

export function loadAvailabilityDate(date: string): Promise<AvailabilityDataset> {
  if (!isGeneratedDate(date)) throw new Error(`Availability date is outside the generated range: ${date}`);
  // Long-lived tabs pick up scheduled deployments without blocking navigation.
  if (manifestCheckedAt && Date.now() - manifestCheckedAt >= DATE_CACHE_MS) {
    void loadAvailabilityManifest().catch(() => {});
  }
  const cached = dateCache.get(date);
  if (cached?.promise) return cached.promise;
  if (cached?.value && cached.fetchedAt !== undefined && Date.now() - cached.fetchedAt < DATE_CACHE_MS &&
      (availabilityManifestStatus.value !== 'ready' || Date.parse(cached.value.generatedAt) >= Date.parse(availabilityManifest.generatedAt))) {
    return Promise.resolve(cached.value);
  }
  const promise = (async () => {
    try {
      let value = await fetchAvailabilityDate(date);
      // A deploy can land between the two parallel requests. Accept a newer
      // date file and refresh the manifest; retry an older date file once.
      if (availabilityManifestStatus.value === 'ready' && value.generatedAt !== availabilityManifest.generatedAt) {
        const publishedAt = Date.parse(value.generatedAt);
        const manifestAt = Date.parse(availabilityManifest.generatedAt);
        if (Number.isFinite(publishedAt) && publishedAt > manifestAt) {
          // The date file is newer than the manifest held by this tab.
          if (mismatchRefreshGeneration !== value.generatedAt) {
            mismatchRefreshGeneration = value.generatedAt;
            void loadAvailabilityManifest().catch(() => {});
          }
        } else {
          value = await fetchAvailabilityDate(date, 'reload');
          if (value.generatedAt !== availabilityManifest.generatedAt) throw new Error(`Availability generation mismatch: ${date}`);
        }
      }
      dateCache.set(date, { value, fetchedAt: Date.now() });
      return value;
    } catch (error) {
      dateCache.delete(date);
      throw error;
    }
  })();
  dateCache.set(date, { promise });
  return promise;
}
