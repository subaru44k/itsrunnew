import { describe, expect, it } from 'vitest';
import type {
  AvailabilityDataset,
  AvailabilityStatus,
  TrackAvailability,
  UnknownReason,
} from '../../src/model/availability';
import {
  evaluateHealth,
  evaluatePipeline,
  renderHealthReport,
  validateHealthState,
  type HealthState,
} from './health';

const trackA = { id: 'track-a', name: { ja: 'A競技場' } };
const trackB = { id: 'track-b', name: { ja: 'B競技場' } };
const defaultTracks = [trackA];

const date1 = '2026-09-20';
const date2 = '2026-09-21';
const date3 = '2026-09-22';
const date4 = '2026-09-23';
const futureDates = [
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04',
  '2026-10-05',
  '2026-10-06',
] as const;

// 01:00Z is 10:00 in Tokyo, so these timestamps have the named JST day.
const run1 = '2026-09-20T01:00:00.000Z';
const run1Later = '2026-09-20T03:00:00.000Z';
const run1Latest = '2026-09-20T05:00:00.000Z';
const run2 = '2026-09-21T01:00:00.000Z';
const run3 = '2026-09-22T01:00:00.000Z';

const hardReasons = [
  'fetch_failed',
  'parse_failed',
  'extraction_failed',
  'invalid_content_type',
  'source_changed',
  'source_stale',
] as const satisfies readonly UnknownReason[];

const expectedUnknownReasons = [
  'web_schedule_unavailable',
  'outside_published_period',
  'schedule_not_published',
  'unsupported_pdf_graphics',
  'phone_confirmation_required',
  'reservation_system_unsupported',
  'unsupported_source_type',
  'insufficient_information',
] as const satisfies readonly UnknownReason[];

type RecordOptions = {
  status?: AvailabilityStatus;
  unknownReason?: UnknownReason | null;
  sourceUrl?: string;
  landingPageUrl?: string | null;
  sourceHash?: string | null;
};

function makeRecord(trackId: string, date: string, generatedAt: string, options: RecordOptions = {}): TrackAvailability {
  const status = options.status ?? 'available';
  const checkedAt = generatedAt;
  const expiresAt = new Date(Date.parse(generatedAt) + 24 * 60 * 60 * 1000).toISOString();
  return {
    trackId,
    date,
    timezone: 'Asia/Tokyo',
    status,
    periods: status === 'unknown' ? [] : [{
      from: '09:00',
      to: '17:00',
      status: status === 'unavailable' ? 'unavailable' : 'available',
      scope: 'full_track',
      eligibility: 'public',
      conditions: [],
    }],
    unknownReason: options.unknownReason ?? null,
    source: {
      url: options.sourceUrl ?? `https://example.test/${trackId}/${date}.pdf`,
      landingPageUrl: options.landingPageUrl === undefined
        ? `https://example.test/${trackId}/schedule`
        : options.landingPageUrl,
      type: 'official',
      publicationFormat: 'fixture',
      publishedAt: null,
      documentId: null,
    },
    freshness: {
      fetchedAt: generatedAt,
      parsedAt: checkedAt,
      checkedAt,
      validForDate: date,
      expiresAt,
    },
    evidence: {
      collector: 'health-test',
      parserVersion: '1.0.0',
      sourceHash: options.sourceHash ?? `hash-${trackId}-${date}`,
      confidence: 'high',
    },
    warnings: [],
  };
}

function makeDataset(
  date: string,
  generatedAt: string,
  tracks = defaultTracks,
  overrides: Record<string, RecordOptions> = {},
): AvailabilityDataset {
  return {
    schemaVersion: 1,
    date,
    timezone: 'Asia/Tokyo',
    generatedAt,
    facilities: tracks.map(track => makeRecord(track.id, date, generatedAt, overrides[track.id])),
  };
}

function makeRange(
  dates: string[],
  generatedAt: string,
  tracks = defaultTracks,
  overridesByDate: Record<string, Record<string, RecordOptions>> = {},
): AvailabilityDataset[] {
  return dates.map(date => makeDataset(date, generatedAt, tracks, overridesByDate[date]));
}

function unknownOverrides(dates: readonly string[], reason: UnknownReason = 'schedule_not_published') {
  return Object.fromEntries(dates.map(date => [date, {
    [trackA.id]: { status: 'unknown' as const, unknownReason: reason },
  }]));
}

function emptyPipelineState(generatedAt: string): HealthState {
  return { schemaVersion: 1, generatedAt, facilities: {}, pipeline: null };
}

describe('availability health monitoring', () => {
  it.each(hardReasons)('opens an error finding for the hard unknown reason %s', (reason) => {
    const result = evaluateHealth([
      makeDataset(date1, run1, defaultTracks, {
        [trackA.id]: { status: 'unknown', unknownReason: reason },
      }),
    ], defaultTracks);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      kind: 'opened',
      trackId: trackA.id,
      finding: {
        causes: [reason],
        affectedDates: [date1],
        severity: 'error',
      },
    });
    expect(result.state.facilities[trackA.id].active?.causes).toEqual([reason]);
  });

  it('does not repeat an identical finding when hash, URL, and affected date change', () => {
    const first = evaluateHealth([
      makeDataset(date1, run1, defaultTracks, {
        [trackA.id]: {
          status: 'unknown',
          unknownReason: 'fetch_failed',
          sourceUrl: 'https://example.test/old.pdf',
          sourceHash: 'old-hash',
        },
      }),
    ], defaultTracks);
    const second = evaluateHealth([
      makeDataset(date2, run2, defaultTracks, {
        [trackA.id]: {
          status: 'unknown',
          unknownReason: 'fetch_failed',
          sourceUrl: 'https://example.test/new.pdf',
          sourceHash: 'new-hash',
        },
      }),
    ], defaultTracks, first.state);

    expect(second.events).toEqual([]);
    expect(second.state.facilities[trackA.id].active?.affectedDates).toEqual([date2]);
    expect(second.state.facilities[trackA.id].sourceUrls).toContain('https://example.test/new.pdf');
  });

  it('emits a changed event when the hard cause changes', () => {
    const first = evaluateHealth([
      makeDataset(date1, run1, defaultTracks, {
        [trackA.id]: { status: 'unknown', unknownReason: 'fetch_failed' },
      }),
    ], defaultTracks);
    const second = evaluateHealth([
      makeDataset(date2, run2, defaultTracks, {
        [trackA.id]: { status: 'unknown', unknownReason: 'parse_failed' },
      }),
    ], defaultTracks, first.state);

    expect(second.events).toHaveLength(1);
    expect(second.events[0]).toMatchObject({
      kind: 'changed',
      trackId: trackA.id,
      finding: { causes: ['parse_failed'], severity: 'error' },
    });
  });

  it.each(expectedUnknownReasons)('keeps expected unknown reason %s silent on first observation', (reason) => {
    const result = evaluateHealth([
      makeDataset(date1, run1, defaultTracks, {
        [trackA.id]: { status: 'unknown', unknownReason: reason },
      }),
    ], defaultTracks);

    expect(result.events).toEqual([]);
    expect(result.state.facilities[trackA.id]).toMatchObject({
      active: null,
      knownDates: [],
      reasons: { [reason]: 1 },
      lastHealthyAt: null,
    });
  });

  it('holds a same-day known-to-unknown loss, then confirms it on the next JST day', () => {
    const healthy = evaluateHealth([makeDataset(date1, run1)], defaultTracks);
    const pending = evaluateHealth([
      makeDataset(date1, run1Later, defaultTracks, {
        [trackA.id]: { status: 'unknown', unknownReason: 'schedule_not_published' },
      }),
    ], defaultTracks, healthy.state);
    const stillPending = evaluateHealth([
      makeDataset(date1, run1Latest, defaultTracks, {
        [trackA.id]: { status: 'unknown', unknownReason: 'schedule_not_published' },
      }),
    ], defaultTracks, pending.state);
    const confirmed = evaluateHealth([
      makeDataset(date1, run2, defaultTracks, {
        [trackA.id]: { status: 'unknown', unknownReason: 'schedule_not_published' },
      }),
    ], defaultTracks, stillPending.state);

    expect(pending.events).toEqual([]);
    expect(pending.state.facilities[trackA.id].active).toBeNull();
    expect(pending.state.facilities[trackA.id].pendingSince).toBe(run1Later);
    expect(stillPending.events).toEqual([]);
    expect(stillPending.state.facilities[trackA.id].pendingSince).toBe(run1Later);
    expect(confirmed.events).toHaveLength(1);
    expect(confirmed.events[0]).toMatchObject({
      kind: 'opened',
      finding: { causes: ['coverage_drop'], affectedDates: [date1], severity: 'warning' },
    });
  });

  it('confirms a two-day loss for future schedule dates after the JST day changes', () => {
    const targetDate = '2026-10-03';
    const healthy = evaluateHealth([makeDataset(targetDate, run1)], defaultTracks);
    const pending = evaluateHealth([
      makeDataset(targetDate, run1Later, defaultTracks, {
        [trackA.id]: { status: 'unknown', unknownReason: 'schedule_not_published' },
      }),
    ], defaultTracks, healthy.state);
    const confirmed = evaluateHealth([
      makeDataset(targetDate, run2, defaultTracks, {
        [trackA.id]: { status: 'unknown', unknownReason: 'schedule_not_published' },
      }),
    ], defaultTracks, pending.state);

    expect(pending.events).toEqual([]);
    expect(pending.state.facilities[trackA.id].pendingSince).toBe(run1Later);
    expect(confirmed.events).toHaveLength(1);
    expect(confirmed.events[0]).toMatchObject({
      kind: 'opened',
      finding: { causes: ['coverage_drop'], affectedDates: [targetDate], severity: 'warning' },
    });
  });

  it('uses the exact three-of-six loss boundary and ignores two-of-four losses', () => {
    const healthy = evaluateHealth(makeRange([...futureDates], run1), defaultTracks);
    const threeOfSix = evaluateHealth(makeRange(
      [...futureDates],
      run1Later,
      defaultTracks,
      unknownOverrides(futureDates.slice(0, 3)),
    ), defaultTracks, healthy.state);

    expect(threeOfSix.events).toEqual([]);
    expect(threeOfSix.state.facilities[trackA.id].pendingSince).toBe(run1Later);
    const boundaryConfirmed = evaluateHealth(makeRange(
      [...futureDates],
      run2,
      defaultTracks,
      unknownOverrides(futureDates.slice(0, 3)),
    ), defaultTracks, threeOfSix.state);
    expect(boundaryConfirmed.events).toHaveLength(1);
    expect(boundaryConfirmed.events[0]).toMatchObject({
      kind: 'opened',
      finding: { causes: ['coverage_drop'], affectedDates: futureDates.slice(0, 3), severity: 'warning' },
    });

    const fourDates = futureDates.slice(0, 4);
    const fourHealthy = evaluateHealth(makeRange([...fourDates], run1), defaultTracks);
    const twoOfFour = evaluateHealth(makeRange(
      [...fourDates],
      run1Later,
      defaultTracks,
      unknownOverrides(fourDates.slice(0, 2)),
    ), defaultTracks, fourHealthy.state);

    expect(twoOfFour.events).toEqual([]);
    expect(twoOfFour.state.facilities[trackA.id].pendingSince).toBeNull();
    expect(twoOfFour.state.facilities[trackA.id].active).toBeNull();
  });

  it('does not invent a coverage loss when the baseline date expires from a shifted window', () => {
    const healthy = evaluateHealth(makeRange([date1, date2, date3], run1), defaultTracks);
    const shifted = evaluateHealth(makeRange([date2, date3, date4], run2), defaultTracks, healthy.state);

    expect(shifted.events).toEqual([]);
    expect(shifted.state.facilities[trackA.id]).toMatchObject({
      active: null,
      pendingSince: null,
      knownDates: [date2, date3, date4],
    });
  });

  it('retains a known baseline date through a failing collection day', () => {
    const healthy = evaluateHealth(makeRange([date1, date2, date3], run1), defaultTracks);
    const failed = evaluateHealth(makeRange([date1, date2, date3], run2, defaultTracks, {
      [date2]: { [trackA.id]: { status: 'unknown', unknownReason: 'fetch_failed' } },
    }), defaultTracks, healthy.state);

    expect(failed.state.facilities[trackA.id]).toMatchObject({
      knownDates: [date1, date2, date3],
      lastHealthyAt: run1,
      active: expect.objectContaining({ causes: ['fetch_failed'] }),
    });
  });

  it('requires affected dates to become known before recovering a hard error', () => {
    const failed = evaluateHealth([
      makeDataset(date1, run1, defaultTracks, {
        [trackA.id]: { status: 'unknown', unknownReason: 'fetch_failed' },
      }),
    ], defaultTracks);
    const expectedUnknown = evaluateHealth([
      makeDataset(date1, run2, defaultTracks, {
        [trackA.id]: { status: 'unknown', unknownReason: 'schedule_not_published' },
      }),
    ], defaultTracks, failed.state);
    const recovered = evaluateHealth([
      makeDataset(date1, run3),
    ], defaultTracks, expectedUnknown.state);

    expect(expectedUnknown.events).toEqual([]);
    expect(expectedUnknown.state.facilities[trackA.id].active?.causes).toEqual(['fetch_failed']);
    expect(recovered.events).toHaveLength(1);
    expect(recovered.events[0]).toMatchObject({ kind: 'recovered', trackId: trackA.id, finding: null });
    expect(recovered.state.facilities[trackA.id].active).toBeNull();
  });

  it('does not recover an expired finding while every new date remains unknown', () => {
    const failed = evaluateHealth([
      makeDataset('2026-09-01', run1, defaultTracks, {
        [trackA.id]: { status: 'unknown', unknownReason: 'fetch_failed' },
      }),
    ], defaultTracks);
    const stillUnknown = evaluateHealth(makeRange(
      ['2026-09-02', '2026-09-03'],
      run2,
      defaultTracks,
      unknownOverrides(['2026-09-02', '2026-09-03']),
    ), defaultTracks, failed.state);

    expect(stillUnknown.events).toEqual([]);
    expect(stillUnknown.state.facilities[trackA.id].active?.causes).toEqual(['fetch_failed']);
  });

  it('counts unavailable as a known result', () => {
    const result = evaluateHealth([
      makeDataset(date1, run1, defaultTracks, {
        [trackA.id]: { status: 'unavailable' },
      }),
    ], defaultTracks);

    expect(result.events).toEqual([]);
    expect(result.state.facilities[trackA.id]).toMatchObject({
      knownDates: [date1],
      lastHealthyAt: run1,
      reasons: {},
      active: null,
    });
  });

  it('rejects missing, duplicate, and date-mismatched records', () => {
    const missing = makeDataset(date1, run1, [trackA]);
    expect(() => evaluateHealth([missing], [trackA, trackB])).toThrow(/Incomplete monitor input/);

    const duplicate = makeDataset(date1, run1);
    duplicate.facilities.push(duplicate.facilities[0]);
    expect(() => evaluateHealth([duplicate], defaultTracks)).toThrow(/Incomplete monitor input/);

    const mismatched = makeDataset(date1, run1);
    mismatched.facilities[0].date = date2;
    expect(() => evaluateHealth([mismatched], defaultTracks)).toThrow(/Incomplete monitor input/);
  });

  it('rejects malformed restored monitor state', () => {
    const seed = evaluateHealth([makeDataset(date1, run1)], defaultTracks).state;
    const malformedSchema = structuredClone(seed) as unknown as { schemaVersion: number };
    malformedSchema.schemaVersion = 2;
    expect(() => validateHealthState(malformedSchema)).toThrow(/Invalid monitor state/);

    const malformedStatus = structuredClone(seed) as unknown as {
      facilities: Record<string, { statuses: Record<string, string> }>;
    };
    malformedStatus.facilities[trackA.id].statuses[date1] = 'broken';
    expect(() => validateHealthState(malformedStatus)).toThrow();

    const malformedFinding = structuredClone(seed) as unknown as {
      facilities: Record<string, { active: unknown }>;
    };
    malformedFinding.facilities[trackA.id].active = {
      causes: ['fetch_failed'],
      affectedDates: ['not-a-date'],
      severity: 'error',
      since: run1,
    };
    expect(() => validateHealthState(malformedFinding)).toThrow(/Invalid monitor finding/);
  });

  it('reports an active removed facility as removed rather than recovered', () => {
    const initial = evaluateHealth([
      makeDataset(date1, run1, [trackA, trackB], {
        [trackB.id]: { status: 'unknown', unknownReason: 'fetch_failed' },
      }),
    ], [trackA, trackB]);
    const next = evaluateHealth([
      makeDataset(date2, run2, [trackA]),
    ], [trackA], initial.state);

    expect(next.state.facilities[trackB.id]).toBeUndefined();
    expect(next.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'removed', trackId: trackB.id }),
    ]));
    expect(next.events).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'recovered', trackId: trackB.id }),
    ]));
  });
});

describe('production update pipeline health', () => {
  it('opens only after 30 hours, stays quiet on recurrence, recovers, and respects disabled monitoring', () => {
    const generatedAt = '2026-09-22T12:00:00.000Z';
    const state = emptyPipelineState(generatedAt);
    const thirtyHoursAgo = new Date(Date.parse(generatedAt) - 30 * 60 * 60 * 1000).toISOString();
    const overdue = new Date(Date.parse(generatedAt) - 30 * 60 * 60 * 1000 - 1).toISOString();
    const recent = new Date(Date.parse(generatedAt) - 29 * 60 * 60 * 1000).toISOString();

    expect(evaluatePipeline(state, thirtyHoursAgo, true)).toEqual([]);

    const opened = evaluatePipeline(state, overdue, true);
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({ kind: 'opened', trackId: '_production' });
    expect(state.pipeline?.causes).toEqual(['production_update_overdue']);

    expect(evaluatePipeline(state, overdue, true)).toEqual([]);
    const findingBeforeDisable = state.pipeline;
    expect(evaluatePipeline(state, recent, false)).toEqual([]);
    expect(state.pipeline).toBe(findingBeforeDisable);

    const recovered = evaluatePipeline(state, recent, true);
    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({ kind: 'recovered', trackId: '_production', finding: null });
    expect(state.pipeline).toBeNull();
  });
});

describe('health report rendering', () => {
  it('includes evidence URLs and the last good timestamp', () => {
    const healthy = evaluateHealth([
      makeDataset(date1, run1, defaultTracks, {
        [trackA.id]: { sourceUrl: 'https://example.test/a/healthy.pdf' },
      }),
    ], defaultTracks);
    const failed = evaluateHealth([
      makeDataset(date2, run2, defaultTracks, {
        [trackA.id]: {
          status: 'unknown',
          unknownReason: 'fetch_failed',
          sourceUrl: 'https://example.test/a/failed.pdf',
        },
      }),
    ], defaultTracks, healthy.state);
    const report = renderHealthReport(failed.state, failed.events, 'https://ci.example/runs/42');

    expect(report).toContain('https://ci.example/runs/42');
    expect(report).toContain('https://example.test/a/failed.pdf');
    expect(report).toContain(run1);
    expect(report).toContain('最終正常確認');
  });
});
