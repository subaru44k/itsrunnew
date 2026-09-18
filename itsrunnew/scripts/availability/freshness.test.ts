import { describe, expect, it } from 'vitest';
import { makeDailyFixture } from '../daily-fixtures.mjs';
import { validateFreshRange } from './freshness.mjs';
import trackDataset from '../../src/data/tracks.json';
import baseline from '../../src/data/availability.json';

const tracks = trackDataset.filter(track => ['nerima-general-sports-park', 'hikarigaoka-park-track', 'oizumi-chuo-park-track', 'toda-sports-center-track'].includes(track.id));
const now = new Date('2026-12-31T15:01:00Z');
function fresh() {
  const result = makeDailyFixture(tracks, baseline, 'mixed', now);
  for (const dataset of result.datasets) for (const item of dataset.facilities) item.evidence.collector = 'test-collector';
  return result;
}
const validate = ({ manifest, datasets }: ReturnType<typeof fresh>) => validateFreshRange(manifest, datasets, tracks.map(track => track.id), now);

describe('daily availability deployment gate', () => {
  it('uses JST across a year boundary and exercises Toda closed then open', () => {
    const data = fresh();
    expect(data.manifest.startDate).toBe('2027-01-01');
    expect(data.manifest.endDate).toBe('2027-01-31');
    expect(data.datasets[0].facilities.find(item => item.trackId === 'toda-sports-center-track')?.status).toBe('unavailable');
    expect(data.datasets[1].facilities.find(item => item.trackId === 'toda-sports-center-track')?.status).toBe('available');
    expect(() => validate(data)).not.toThrow();
  });
  it('accepts honest unknown results without demanding all four statuses', () => {
    const data = fresh();
    for (const dataset of data.datasets) for (const item of dataset.facilities) item.status = 'unknown';
    expect(() => validate(data)).not.toThrow();
  });
  it('rejects yesterday, gaps, and stale generation', () => {
    const yesterday = fresh(); yesterday.manifest.startDate = '2026-12-31';
    expect(() => validate(yesterday)).toThrow(/consecutive/);
    const gap = fresh(); gap.manifest.dates[1] = gap.manifest.dates[2];
    expect(() => validate(gap)).toThrow(/consecutive/);
    const stale = fresh(); stale.manifest.generatedAt = '2026-12-30T00:00:00Z';
    expect(() => validate(stale)).toThrow(/timestamp/);
  });
  it('rejects duplicate facilities, expiry, missing files and synthetic publication', () => {
    const duplicate = fresh(); duplicate.datasets[0].facilities.push(duplicate.datasets[0].facilities[0]);
    expect(() => validate(duplicate)).toThrow(/exactly once/);
    const expired = fresh(); expired.datasets[0].facilities[0].freshness.expiresAt = now.toISOString();
    expect(() => validate(expired)).toThrow(/expired/);
    const missing = fresh(); missing.datasets.pop();
    expect(() => validate(missing)).toThrow(/Missing/);
    expect(() => validate(makeDailyFixture(tracks, baseline, 'mixed', now))).toThrow(/never be deployed/);
  });
});
