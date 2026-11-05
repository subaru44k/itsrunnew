import { reactive, ref } from 'vue';
import type { AvailabilityDataset, TrackAvailability } from './availability';

export interface AvailabilityManifest {
  schemaVersion: number;
  partitionVersion?: 1;
  generation?: string;
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
        value.startDate !== value.dates[0] || value.endDate !== value.dates.at(-1) ||
        !Number.isFinite(Date.parse(value.generatedAt)) ||
        value.dates.some((date, index) => !/^\d{4}-\d{2}-\d{2}$/.test(date) || addDateOnlyDays(value.startDate, index) !== date) ||
        (value.generation !== undefined && (!/^[a-f0-9]{24}$/.test(value.generation) || value.partitionVersion !== 1)) ||
        (value.partitionVersion !== undefined && !value.generation)) {
      throw new Error('Invalid published availability manifest');
    }
    Object.assign(availabilityManifest, { generation: undefined, partitionVersion: undefined }, value);
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

async function fetchAvailabilityDate(date: string, generation: string | undefined, cache: RequestCache = 'no-cache') {
  const path = generation ? `generations/${generation}/dates/${date}.json` : `${date}.json`;
  const response = await fetch(`/availability/${path}`,  { cache, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Availability date HTTP ${response.status}: ${date}`);
  const value = await response.json() as AvailabilityDataset;
  if (value.schemaVersion !== 1 || value.date !== date || value.timezone !== 'Asia/Tokyo' || !Array.isArray(value.facilities) || value.generation !== generation) {
    throw new Error(`Invalid published availability date: ${date}`);
  }
  return value;
}

export function loadAvailabilityDate(date: string): Promise<AvailabilityDataset> {
  return loadDate(date, 1);
}

function loadDate(date: string, retries: number): Promise<AvailabilityDataset> {
  if (!isGeneratedDate(date)) throw new Error(`Availability date is outside the generated range: ${date}`);
  // Long-lived tabs pick up scheduled deployments without blocking navigation.
  if (manifestCheckedAt && Date.now() - manifestCheckedAt >= DATE_CACHE_MS) {
    void loadAvailabilityManifest().catch(() => {});
  }
  const generation = availabilityManifest.generation;
  const cacheKey = `${generation ?? 'legacy'}|${date}`;
  const cached = dateCache.get(cacheKey);
  if (cached?.promise) return cached.promise;
  if (cached?.value && cached.fetchedAt !== undefined && Date.now() - cached.fetchedAt < DATE_CACHE_MS &&
      (availabilityManifestStatus.value !== 'ready' || Date.parse(cached.value.generatedAt) >= Date.parse(availabilityManifest.generatedAt))) {
    return Promise.resolve(cached.value);
  }
  const promise = (async () => {
    try {
      let value = await fetchAvailabilityDate(date, generation);
      if (generation !== availabilityManifest.generation) {
        if (!retries) throw new Error(`Availability changed while loading: ${date}`);
        return await loadDate(date, retries - 1);
      }
      // A deploy can land between the two parallel requests. Accept a newer
      // date file and refresh the manifest; retry an older date file once.
      if (generation && value.generatedAt !== availabilityManifest.generatedAt) throw new Error(`Availability generation mismatch: ${date}`);
      if (!generation && availabilityManifestStatus.value === 'ready' && value.generatedAt !== availabilityManifest.generatedAt) {
        const publishedAt = Date.parse(value.generatedAt);
        const manifestAt = Date.parse(availabilityManifest.generatedAt);
        if (Number.isFinite(publishedAt) && publishedAt > manifestAt) {
          // The date file is newer than the manifest held by this tab.
          if (mismatchRefreshGeneration !== value.generatedAt) {
            mismatchRefreshGeneration = value.generatedAt;
            void loadAvailabilityManifest().catch(() => {});
          }
        } else {
          value = await fetchAvailabilityDate(date, generation, 'reload');
          if (value.generatedAt !== availabilityManifest.generatedAt) throw new Error(`Availability generation mismatch: ${date}`);
        }
      }
      dateCache.set(cacheKey, { value, fetchedAt: Date.now() });
      return value;
    } catch (error) {
      dateCache.delete(cacheKey);
      throw error;
    }
  })();
  dateCache.set(cacheKey, { promise });
  return promise;
}

export interface AvailabilityTrackBundle {
  schemaVersion: number;
  timezone: 'Asia/Tokyo';
  generatedAt: string;
  generation: string;
  trackId: string;
  dates: string[];
  records: TrackAvailability[];
}
const trackCache = new Map<string, Promise<AvailabilityTrackBundle>>();

export function loadAvailabilityTrack(trackId: string): Promise<AvailabilityTrackBundle> {
  const { generation, generatedAt, dates } = availabilityManifest;
  if (!generation || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trackId)) throw new Error('Facility bundle unavailable');
  const key = `${generation}|${trackId}`;
  const cached = trackCache.get(key);
  if (cached) return cached;
  // Only the current generation is reusable; already-open views keep their records.
  for (const previous of trackCache.keys()) if (!previous.startsWith(`${generation}|`)) trackCache.delete(previous);
  const request = (async () => {
    const response = await fetch(`/availability/generations/${generation}/tracks/${trackId}.json`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Availability facility HTTP ${response.status}`);
    const value = await response.json() as AvailabilityTrackBundle;
    if (value.schemaVersion !== 1 || value.timezone !== 'Asia/Tokyo' || value.generation !== generation ||
        value.generatedAt !== generatedAt || value.trackId !== trackId ||
        JSON.stringify(value.dates) !== JSON.stringify(dates) || !Array.isArray(value.records) || value.records.length !== dates.length ||
        value.records.some((record, index) => record.trackId !== trackId || record.date !== dates[index] ||
          record.timezone !== 'Asia/Tokyo' || record.freshness?.validForDate !== record.date ||
          !Number.isFinite(Date.parse(record.freshness?.expiresAt)) || !Array.isArray(record.periods) ||
          !['available', 'partially_available', 'unavailable', 'unknown'].includes(record.status))) {
      throw new Error('Invalid published availability facility');
    }
    if (availabilityManifest.generation !== generation) throw new Error('Availability changed while loading facility');
    return value;
  })().catch(error => { trackCache.delete(key); throw error; });
  trackCache.set(key, request);
  return request;
}
