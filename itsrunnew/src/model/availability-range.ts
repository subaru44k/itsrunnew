import rawManifest from '../data/availability/manifest.json';
import type { AvailabilityDataset } from './availability';

export interface AvailabilityManifest {
  schemaVersion: number;
  timezone: 'Asia/Tokyo';
  generatedAt: string;
  startDate: string;
  endDate: string;
  dates: string[];
}

export const availabilityManifest = rawManifest as AvailabilityManifest;
const datasetLoaders = import.meta.glob(['../data/availability/*.json', '!../data/availability/manifest.json'], { import: 'default' }) as Record<string, () => Promise<AvailabilityDataset>>;

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

export async function loadAvailabilityDate(date: string) {
  if (!isGeneratedDate(date)) throw new Error(`Availability date is outside the generated range: ${date}`);
  const suffix = `/availability/${date}.json`;
  const loader = Object.entries(datasetLoaders).find(([path]) => path.endsWith(suffix))?.[1];
  if (!loader) throw new Error(`Generated availability file is missing: ${date}`);
  return loader();
}
