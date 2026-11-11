import rawCourses from '../data/running-courses.json';
import { distanceKm, tracks, type LocaleName, type TrackFacility } from './tracks';

export interface RunningCourse {
  kind: 'course';
  id: string;
  name: LocaleName;
  location: TrackFacility['location'];
  lapMeters: number[];
  approximate: boolean;
  surface: 'rubber-chip' | 'special-paving' | null;
  distanceMarkersMeters: number | null;
  crossings: LocaleName | null;
  hours: LocaleName | null;
  rules: LocaleName[];
  urls: { official: string; map: string };
  sources: { url: string; label: LocaleName; verifiedAt: string; fields: string[] }[];
}

export type TrainingPlace = TrackFacility | RunningCourse;
export type PlaceKind = 'all' | 'track' | 'course';
export const runningCourses = rawCourses as RunningCourse[];
export const trainingPlaces: TrainingPlace[] = [...tracks, ...runningCourses];
export function isRunningCourse(place: TrainingPlace): place is RunningCourse { return 'kind' in place && place.kind === 'course'; }
export function courseById(id: unknown) { return typeof id === 'string' ? runningCourses.find(course => course.id === id) ?? null : null; }
export function placeById(id: unknown) { return typeof id === 'string' ? trainingPlaces.find(place => place.id === id) ?? null : null; }
export function placePath(place: TrainingPlace, locale: string) { return `${locale === 'en' ? '/en' : ''}/${isRunningCourse(place) ? 'courses' : 'tracks'}/${place.id}`; }
export function matchesPlaceFilters(place: TrainingPlace, kind: PlaceKind, minLapMeters: number) {
  const course = isRunningCourse(place);
  if (kind !== 'all' && (kind === 'course') !== course) return false;
  if (!minLapMeters) return true;
  return course ? place.lapMeters.some(length => length >= minLapMeters) : place.track.lengthMeters != null && place.track.lengthMeters >= minLapMeters;
}
export function courseDistance(course: RunningCourse, locale: string) {
  return `${course.approximate ? (locale === 'en' ? 'approx. ' : '約') : ''}${course.lapMeters.map(length => length.toLocaleString(locale === 'en' ? 'en-US' : 'ja-JP')).join(' / ')} m`;
}
export function courseSurface(course: RunningCourse, locale: string) {
  return ({ 'rubber-chip': ['ゴムチップ', 'Rubber chip'], 'special-paving': ['特殊舗装（材質未確認）', 'Special paving (material unconfirmed)'], unknown: ['路面未確認', 'Surface unconfirmed'] })[course.surface ?? 'unknown'][locale === 'en' ? 1 : 0];
}
export function nearestCourses(origin: TrainingPlace['location'], excludeId?: string, maxKm = 15, limit = 3) {
  return runningCourses.filter(course => course.id !== excludeId)
    .map(course => ({ course, distance: distanceKm(origin, course.location) }))
    .filter(item => item.distance <= maxKm)
    .sort((a, b) => a.distance - b.distance || a.course.id.localeCompare(b.course.id)).slice(0, limit);
}
