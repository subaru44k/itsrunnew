import { appendFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { collectAvailabilityRange } from './range';
import { createMonitorFetch } from './monitor-fetch';
import { evaluateHealth, evaluatePipeline, renderHealthReport, tokyoDay, validateHealthState, type HealthState } from './health';
import { validateFreshRange } from './freshness.mjs';

function argument(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  if (!process.argv[index + 1] || process.argv[index + 1].startsWith('--')) throw new Error(`Missing ${name} value`);
  return process.argv[index + 1];
}
const readJson = async (path: string | URL) => JSON.parse(await readFile(path, 'utf8'));
const now = new Date();
const tracks = await readJson(new URL('../../src/data/tracks.json', import.meta.url));
let previous: HealthState | null = null;
const previousPath = argument('--previous');
if (previousPath) {
  // Missing history is allowed only when the restore step deliberately omitted
  // --previous. Corruption/expiry/download failures must not reset deduplication.
  previous = await readJson(previousPath);
  validateHealthState(previous);
}
const output = resolve(argument('--output') ?? await mkdtemp(join(tmpdir(), 'itsrun-availability-monitor-')));
const input = argument('--input');
let datasets;
let manifest;
if (input) {
  manifest = await readJson(join(input, 'manifest.json'));
  datasets = await Promise.all(manifest.dates.map((date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid input date');
    return readJson(join(input, `${date}.json`));
  }));
} else {
  const result = await collectAvailabilityRange(tokyoDay(now.toISOString()), 31, { now, fetchImpl: createMonitorFetch() });
  datasets = result.datasets;
  const dates = datasets.map(dataset => dataset.date);
  manifest = { schemaVersion: 1, timezone: 'Asia/Tokyo', generatedAt: now.toISOString(), startDate: dates[0], endDate: dates.at(-1), dates };
  console.log(`Monitoring collection: ${result.stats.requests} requests, ${result.stats.cacheHits} cache hits`);
}
validateFreshRange(manifest, datasets, tracks.map((track: { id: string }) => track.id), new Date());
const { state, events } = evaluateHealth(datasets, tracks, previous);
const pipelinePath = argument('--pipeline');
if (pipelinePath) {
  const pipeline = await readJson(pipelinePath);
  if (typeof pipeline.enabled !== 'boolean' || (pipeline.lastSuccessAt !== null && typeof pipeline.lastSuccessAt !== 'string')) throw new Error('Invalid pipeline evidence');
  events.push(...evaluatePipeline(state, pipeline.lastSuccessAt, pipeline.enabled));
}
const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : '';
const report = renderHealthReport(state, events, runUrl);
await mkdir(output, { recursive: true });
await writeFile(join(output, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
await writeFile(join(output, 'events.json'), `${JSON.stringify(events, null, 2)}\n`);
await writeFile(join(output, 'report.md'), report);
await writeFile(join(output, 'notification.txt'), report.split('## 施設別の状態')[0]);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report);
console.log(`Monitoring report: ${output}/report.md (${events.length} state changes)`);
