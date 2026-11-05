import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const dateKey = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

// Partition one validated collection; never fetch or infer additional availability here.
export function createAvailabilityPublication(input, datasets, sourceCommit) {
  const { schemaVersion, timezone, generatedAt, startDate, endDate, dates } = input;
  const manifest = { schemaVersion, timezone, generatedAt, startDate, endDate, dates };
  if (manifest.schemaVersion !== 1 || manifest.timezone !== 'Asia/Tokyo' || !Number.isFinite(Date.parse(manifest.generatedAt)) ||
      !Array.isArray(manifest.dates) || !manifest.dates.length || manifest.dates.length > 31 ||
      manifest.startDate !== manifest.dates[0] || manifest.endDate !== manifest.dates.at(-1) ||
      datasets.length !== manifest.dates.length) throw new Error('Invalid availability publication manifest');
  if (sourceCommit && !/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error('Invalid availability source commit');
  const ids = datasets[0].facilities.map(record => record.trackId).sort();
  if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))) throw new Error('Invalid availability facility IDs');
  datasets.forEach((dataset, index) => {
    const date = manifest.dates[index];
    if (!dateKey(date) || (index && Date.parse(date) - Date.parse(manifest.dates[index - 1]) !== 86400000) ||
        dataset.schemaVersion !== 1 || dataset.timezone !== manifest.timezone || dataset.date !== date ||
        dataset.generatedAt !== manifest.generatedAt ||
        JSON.stringify(dataset.facilities.map(record => record.trackId).sort()) !== JSON.stringify(ids) ||
        dataset.facilities.some(record => record.date !== date || record.timezone !== manifest.timezone || record.freshness.validForDate !== date)) {
      throw new Error(`Invalid availability publication date: ${date}`);
    }
  });
  const generation = hash({ manifest, datasets, sourceCommit }).slice(0, 24);
  const published = { ...manifest, partitionVersion: 1, generation, trackIdsHash: hash(ids), ...(sourceCommit ? { sourceCommit } : {}) };
  const prefix = `generations/${generation}`;
  const files = { 'manifest.json': published, [`${prefix}/manifest.json`]: published };
  for (const dataset of datasets) {
    files[`${dataset.date}.json`] = dataset; // Compatibility for previously loaded applications.
    files[`${prefix}/dates/${dataset.date}.json`] = { ...dataset, generation };
  }
  const byDate = datasets.map(dataset => new Map(dataset.facilities.map(record => [record.trackId, record])));
  for (const trackId of ids) files[`${prefix}/tracks/${trackId}.json`] = {
    schemaVersion: 1, timezone: manifest.timezone, generatedAt: manifest.generatedAt,
    generation, trackId, dates: manifest.dates, records: byDate.map(records => records.get(trackId)),
  };
  return { manifest: published, files };
}

export async function writeAvailabilityPublication(directory, publication) {
  for (const [key, value] of Object.entries(publication.files)) {
    const path = join(directory, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(value)}\n`, 'utf8');
  }
}

export async function validateAvailabilityPublication(directory, manifest, datasets) {
  const expected = createAvailabilityPublication(manifest, datasets, manifest.sourceCommit);
  if (JSON.stringify(expected.manifest) !== JSON.stringify(manifest)) throw new Error('Availability publication identity mismatch');
  await Promise.all(Object.entries(expected.files).map(async ([key, value]) => {
    const actual = JSON.parse(await readFile(join(directory, key), 'utf8'));
    if (JSON.stringify(actual) !== JSON.stringify(value)) throw new Error(`Availability partition mismatch: ${key}`);
  }));
}
