import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAvailabilityPublication, validateAvailabilityPublication, writeAvailabilityPublication } from './publication.mjs';
import { makeDailyFixture } from '../daily-fixtures.mjs';
import tracks from '../../src/data/tracks.json';
import baseline from '../../src/data/availability.json';

const sampleTracks = tracks.slice(0, 2);
const fixture = () => makeDailyFixture(sampleTracks, baseline, 'mixed');

describe('availability publication', () => {
  it('preserves every date record in one facility bundle without another collection', () => {
    const { manifest, datasets } = fixture();
    const result = createAvailabilityPublication(manifest, datasets, 'a'.repeat(40));
    const prefix = `generations/${result.manifest.generation}`;
    expect(result.files[`${prefix}/manifest.json`]).toEqual(result.manifest);
    expect(result.manifest.sourceCommit).toBe('a'.repeat(40));
    for (const track of sampleTracks) {
      const bundle = result.files[`${prefix}/tracks/${track.id}.json`];
      expect(bundle.records).toHaveLength(31);
      for (const [index, date] of manifest.dates.entries()) {
        expect(bundle.records[index]).toEqual(datasets[index].facilities.find(record => record.trackId === track.id));
        expect(result.files[`${prefix}/dates/${date}.json`].facilities).toEqual(datasets[index].facilities);
        expect(result.files[`${date}.json`]).toEqual(datasets[index]);
      }
    }
  });

  it('uses immutable identities for both content and collector revision', () => {
    const { manifest, datasets } = fixture();
    const first = createAvailabilityPublication(manifest, datasets, 'a'.repeat(40));
    expect(createAvailabilityPublication(manifest, datasets, 'a'.repeat(40)).manifest.generation).toBe(first.manifest.generation);
    expect(createAvailabilityPublication(manifest, datasets, 'b'.repeat(40)).manifest.generation).not.toBe(first.manifest.generation);
    datasets[0].facilities[0].warnings.push('changed');
    expect(createAvailabilityPublication(manifest, datasets, 'a'.repeat(40)).manifest.generation).not.toBe(first.manifest.generation);
  });

  it('rejects a damaged partition before deployment', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'itsrun-publication-test-'));
    try {
      const { manifest, datasets } = fixture();
      const publication = createAvailabilityPublication(manifest, datasets);
      await writeAvailabilityPublication(directory, publication);
      await validateAvailabilityPublication(directory, publication.manifest, datasets);
      const key = Object.keys(publication.files).find(key => key.includes('/tracks/'))!;
      await writeFile(join(directory, key), '{}');
      await expect(validateAvailabilityPublication(directory, publication.manifest, datasets)).rejects.toThrow('partition mismatch');
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it.each(['duplicate', 'missing', 'path', 'date', 'generation'])('rejects inconsistent %s before publishing', fault => {
    const { manifest, datasets } = fixture();
    if (fault === 'duplicate') datasets[0].facilities.push(datasets[0].facilities[0]);
    if (fault === 'missing') datasets[1].facilities.pop();
    if (fault === 'path') datasets[0].facilities[0].trackId = '../escape';
    if (fault === 'date') manifest.dates[2] = manifest.dates[0];
    if (fault === 'generation') datasets[1].generatedAt = '2000-01-01T00:00:00Z';
    expect(() => createAvailabilityPublication(manifest, datasets)).toThrow();
  });
});
