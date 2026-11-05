import { readFile, rm } from 'node:fs/promises';
import { createAvailabilityPublication, writeAvailabilityPublication } from './publication.mjs';
import { validateFreshRange } from './freshness.mjs';

const generation = process.env.ROLLBACK_GENERATION;
if (!/^[a-f0-9]{24}$/.test(generation ?? '')) throw new Error('Invalid availability rollback generation');
const base = new URL(`/availability/generations/${generation}/`, process.env.PRODUCTION_URL);
async function read(key) {
  const response = await fetch(new URL(key, base), { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Availability rollback HTTP ${response.status}: ${key}`);
  return response.json();
}
const manifest = await read('manifest.json');
if (manifest.generation !== generation || !Array.isArray(manifest.dates) || manifest.dates.length !== 31 ||
    manifest.dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) throw new Error('Invalid rollback manifest');
const datasets = [];
for (let index = 0; index < manifest.dates.length; index += 8) {
  datasets.push(...await Promise.all(manifest.dates.slice(index, index + 8).map(async date => {
    const { generation: actual, ...dataset } = await read(`dates/${date}.json`);
    if (actual !== generation) throw new Error('Rollback date generation mismatch');
    return dataset;
  })));
}
const tracks = JSON.parse(await readFile('src/data/tracks.json', 'utf8'));
validateFreshRange(manifest, datasets, tracks.map(track => track.id));
const publication = createAvailabilityPublication(manifest, datasets, manifest.sourceCommit);
if (publication.manifest.generation !== generation || publication.manifest.trackIdsHash !== manifest.trackIdsHash) throw new Error('Rollback content identity mismatch');
await rm('src/data/availability', { recursive: true, force: true });
await writeAvailabilityPublication('src/data/availability', publication);
console.log(`Restored fresh availability generation ${generation}; schema, IDs, timestamps and hashes verified`);
