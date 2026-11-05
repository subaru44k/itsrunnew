import { describe, expect, it, vi } from 'vitest';
import { validateFreshRange } from './freshness.mjs';
import { readPublishedRange } from './published-range.mjs';
import { createAvailabilityPublication } from './publication.mjs';
import { makeDailyFixture } from '../daily-fixtures.mjs';
import tracks from '../../src/data/tracks.json';
import baseline from '../../src/data/availability.json';
const sample = tracks.slice(0, 2);
const generated = new Date('2026-11-05T23:15:00Z');
function fixture() {
  const data = makeDailyFixture(sample, baseline, 'mixed', generated);
  for (const day of data.datasets) for (const record of day.facilities) record.evidence.collector = 'verified-fixture-source';
  return createAvailabilityPublication(data.manifest, data.datasets, 'a'.repeat(40));
}
describe('published health input', () => {
  it('checks the published generation without external collection, including a later monitor that day', async () => {
    const publication = fixture();
    const fetchImpl = vi.fn(async url => ({ ok: true, status: 200, json: async () => structuredClone(publication.files[new URL(url).pathname.slice('/availability/'.length)]) }));
    const result = await readPublishedRange('https://site.example', sample.map(track => track.id), { fetchImpl, now: new Date('2026-11-06T08:30:00Z') });
    expect(result.manifest).toEqual(publication.manifest);
    expect(() => validateFreshRange(result.manifest, result.datasets, sample.map(track => track.id), new Date('2026-11-06T08:30:00Z'))).toThrow('timestamp');
    expect(fetchImpl).toHaveBeenCalledTimes(32);
    expect(fetchImpl.mock.calls.every(([url]) => new URL(url).origin === 'https://site.example')).toBe(true);
  });
  it('rejects corrupted records and a previous JST day instead of collecting replacements', async () => {
    const publication = fixture();
    const fetchImpl = async url => ({ ok: true, status: 200, json: async () => structuredClone(publication.files[new URL(url).pathname.slice('/availability/'.length)]) });
    await expect(readPublishedRange('https://site.example', sample.map(track => track.id), { fetchImpl, now: new Date('2026-11-06T15:01:00Z') })).rejects.toThrow('consecutive');
    const key = `generations/${publication.manifest.generation}/dates/${publication.manifest.startDate}.json`;
    publication.files[key].facilities[0].status = 'unknown';
    await expect(readPublishedRange('https://site.example', sample.map(track => track.id), { fetchImpl, now: generated })).rejects.toThrow('identity mismatch');
  });
});
