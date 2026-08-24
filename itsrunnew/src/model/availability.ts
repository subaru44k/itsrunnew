import rawAvailability from '../data/availability.json';

export type AvailabilityStatus = 'available' | 'partially_available' | 'unavailable' | 'unknown';
export type AvailabilityPeriodStatus = 'available' | 'unavailable' | 'unknown';
export type UnknownReason =
  | 'web_schedule_unavailable'
  | 'source_stale'
  | 'fetch_failed'
  | 'parse_failed'
  | 'extraction_failed'
  | 'invalid_content_type'
  | 'source_changed'
  | 'outside_published_period'
  | 'schedule_not_published'
  | 'unsupported_pdf_graphics'
  | 'phone_confirmation_required'
  | 'reservation_system_unsupported'
  | 'unsupported_source_type'
  | 'insufficient_information';

export interface AvailabilityPeriod {
  from: string | null;
  to: string | null;
  status: AvailabilityPeriodStatus;
  scope: 'full_track' | 'track_and_jogging_course' | 'jogging_course_only' | 'lane_subset' | 'unknown';
  eligibility: 'public' | 'local_resident_worker_student' | 'unknown';
  conditions: string[];
}

export interface TrackAvailability {
  trackId: string;
  date: string;
  timezone: 'Asia/Tokyo';
  status: AvailabilityStatus;
  periods: AvailabilityPeriod[];
  unknownReason: UnknownReason | null;
  source: {
    url: string;
    landingPageUrl: string | null;
    type: 'official';
    publicationFormat: string;
    publishedAt: string | null;
    documentId: string | null;
  };
  freshness: {
    fetchedAt: string | null;
    parsedAt: string;
    checkedAt: string;
    validForDate: string;
    expiresAt: string;
  };
  evidence: {
    collector: string;
    parserVersion: string;
    sourceHash: string | null;
    confidence: 'high' | 'medium' | 'low';
  };
  warnings: string[];
}

export interface AvailabilityDataset {
  schemaVersion: number;
  date: string;
  timezone: 'Asia/Tokyo';
  generatedAt: string;
  facilities: TrackAvailability[];
}

export const availabilityDataset = rawAvailability as AvailabilityDataset;

export function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export function unknownAvailability(trackId: string, date: string, reason: UnknownReason): TrackAvailability {
  const checkedAt = new Date().toISOString();
  return {
    trackId,
    date,
    timezone: 'Asia/Tokyo',
    status: 'unknown',
    periods: [],
    unknownReason: reason,
    source: { url: '', landingPageUrl: null, type: 'official', publicationFormat: 'unknown', publishedAt: null, documentId: null },
    freshness: { fetchedAt: null, parsedAt: checkedAt, checkedAt, validForDate: date, expiresAt: checkedAt },
    evidence: { collector: 'runtime-fallback', parserVersion: '1.0.0', sourceHash: null, confidence: 'low' },
    warnings: [],
  };
}

export function availabilityForTrack(trackId: string, date: string, now = new Date(), dataset: AvailabilityDataset = availabilityDataset) {
  const record = dataset.facilities.find(item => item.trackId === trackId && item.date === date);
  if (!record) return unknownAvailability(trackId, date, 'outside_published_period');
  if (record.freshness.validForDate !== date || now.getTime() >= new Date(record.freshness.expiresAt).getTime()) {
    return { ...record, status: 'unknown' as const, periods: [], unknownReason: 'source_stale' as const };
  }
  return record;
}

export function isTodayCandidate(status: AvailabilityStatus, showUnavailable = false) {
  return showUnavailable || status !== 'unavailable';
}

export const isAvailabilityCandidate = isTodayCandidate;
