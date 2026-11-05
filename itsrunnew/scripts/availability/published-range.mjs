import { createAvailabilityPublication } from './publication.mjs';
import { validatePublishedRange } from './freshness.mjs';

export async function readPublishedRange(baseUrl, trackIds, { fetchImpl = fetch, now = new Date() } = {}) {
  const base = new URL('/availability/', baseUrl);
  async function read(key) {
    const response = await fetchImpl(new URL(key, base), { cache: 'no-cache', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Published availability HTTP ${response.status}: ${key}`);
    return response.json();
  }
  const manifest = await read('manifest.json');
  if (!/^[a-f0-9]{24}$/.test(manifest.generation ?? '') || manifest.partitionVersion !== 1 ||
      !Array.isArray(manifest.dates) || manifest.dates.length !== 31 || manifest.dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) throw new Error('Invalid published generation manifest');
  const datasets = [];
  for (let index = 0; index < manifest.dates.length; index += 8) datasets.push(...await Promise.all(manifest.dates.slice(index, index + 8).map(async date => {
    const { generation, ...dataset } = await read(`generations/${manifest.generation}/dates/${date}.json`);
    if (generation !== manifest.generation) throw new Error('Published date generation mismatch');
    return dataset;
  })));
  validatePublishedRange(manifest, datasets, trackIds, now);
  const expected = createAvailabilityPublication(manifest, datasets, manifest.sourceCommit).manifest;
  if (JSON.stringify(expected) !== JSON.stringify(manifest)) throw new Error('Published availability content identity mismatch');
  return { manifest, datasets };
}
