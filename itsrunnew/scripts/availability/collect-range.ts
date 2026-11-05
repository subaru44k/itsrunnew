import { readdir, mkdir, rm, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { collectAvailabilityRange } from './range';
import { createSourceFetch } from './source-fetch';
import { createAvailabilityPublication, writeAvailabilityPublication } from './publication.mjs';

function tokyoDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.env.ITSRUN_REQUIRE_AI_KEY === 'true' && !process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for trusted deployment collection');

const from = argument('--from') ?? tokyoDateKey();
const days = Number(argument('--days') ?? '31');
const now = new Date();
const result = await collectAvailabilityRange(from, days, {
  now,
  fetchImpl: createSourceFetch(fetch, { onDiagnostic: diagnostic => {
    console.warn(`Availability fetch: ${JSON.stringify(diagnostic)}`);
  } }),
});
const scriptDirectory = fileURLToPath(new URL('.', import.meta.url));
const dataRoot = resolve(scriptDirectory, '../../src/data');
const outputDirectory = resolve(dataRoot, 'availability');
await mkdir(outputDirectory, { recursive: true });

const activeFiles = new Set(result.datasets.map(dataset => `${dataset.date}.json`));
for (const filename of await readdir(outputDirectory)) {
  if (/^\d{4}-\d{2}-\d{2}\.json$/.test(filename) && !activeFiles.has(filename)) await unlink(resolve(outputDirectory, filename));
}
await rm(resolve(outputDirectory, 'generations'), { recursive: true, force: true });
const dates = result.datasets.map(dataset => dataset.date);
const manifest = {
  schemaVersion: 1,
  timezone: 'Asia/Tokyo',
  generatedAt: now.toISOString(),
  startDate: dates[0],
  endDate: dates.at(-1),
  dates,
};
await writeAvailabilityPublication(outputDirectory, createAvailabilityPublication(manifest, result.datasets, process.env.ITSRUN_SOURCE_SHA ?? process.env.GITHUB_SHA));
await writeFile(resolve(dataRoot, 'availability.json'), `${JSON.stringify(result.datasets[0], null, 2)}\n`, 'utf8');

console.log(`Availability range generated: ${manifest.startDate} -> ${manifest.endDate} (${dates.length} days)`);
console.log(`Official HTTP requests: ${result.stats.requests}; cache hits: ${result.stats.cacheHits}`);
console.log(`Output: ${outputDirectory}`);
