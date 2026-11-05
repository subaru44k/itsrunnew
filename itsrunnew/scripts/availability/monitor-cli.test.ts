import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { makeDailyFixture } from '../daily-fixtures.mjs';
import { createAvailabilityPublication } from './publication.mjs';
import tracks from '../../src/data/tracks.json';
import baseline from '../../src/data/availability.json';

it('runs the real published-monitor CLI twice against one generation without collecting or sending', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'itsrun-monitor-cli-'));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const collectedAt = new Date(`${today}T12:00:00+09:00`);
  const fixture = makeDailyFixture(tracks, baseline, 'mixed', collectedAt);
  for (const day of fixture.datasets) for (const record of day.facilities) record.evidence.collector = 'monitor-cli-regression';
  const publication = createAvailabilityPublication(fixture.manifest, fixture.datasets);
  const files = new Map(Object.entries(publication.files).map(([key, value]) => [`/availability/${key}`, JSON.stringify(value)]));
  let requests = 0;
  const server = createServer((request, response) => {
    requests++;
    const body = files.get(request.url!);
    response.writeHead(body ? 200 : 404, { 'content-type': 'application/json' });
    response.end(body ?? '{}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const guard = join(directory, 'network-guard.mjs');
  await writeFile(guard, `const NativeDate = Date; const now = Number(process.env.MONITOR_TEST_NOW); globalThis.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }; const original = globalThis.fetch; globalThis.fetch = (url, ...args) => { if (new URL(url).origin !== ${JSON.stringify(base)}) throw new Error('External fetch forbidden in monitor CLI regression'); return original(url, ...args); };`);
  let observation = collectedAt.getTime();
  async function run(output: string, previous?: string) {
    const args = ['--import', 'tsx', new URL('./monitor.ts', import.meta.url).pathname, '--published-url', base, '--output', output];
    if (previous) args.push('--previous', previous);
    await new Promise<void>((resolve, reject) => {
      let log = '';
      const child = spawn(process.execPath, args, { env: { ...process.env, OPENAI_API_KEY: '', ITSRUN_REQUIRE_AI_KEY: '', GITHUB_STEP_SUMMARY: '', MONITOR_TEST_NOW: String(observation += 1000), NODE_OPTIONS: `--import=${pathToFileURL(guard).href}` }, timeout: 15_000 });
      child.stdout.on('data', value => { log += value; });
      child.stderr.on('data', value => { log += value; });
      child.once('error', reject);
      child.once('exit', code => code === 0 ? resolve() : reject(new Error(log)));
    });
  }
  try {
    const first = join(directory, 'first'), second = join(directory, 'second');
    await run(first);
    await run(second, join(first, 'state.json'));
    expect(JSON.parse(await readFile(join(second, 'events.json'), 'utf8'))).toEqual([]);
    expect(JSON.parse(await readFile(join(second, 'state.json'), 'utf8')).collectionGeneratedAt).toBe(publication.manifest.generatedAt);
    expect(requests).toBe(64);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}, 30_000);
