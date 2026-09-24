#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const baseUrl = process.env.ITSRUN_BASE_URL;
if (!baseUrl) throw new Error('ITSRUN_BASE_URL is required');
const production = process.env.ITSRUN_EXPECT_EDGE_ROUTING === 'true';
const plan = JSON.parse(readFileSync('.cache/deployment-plan.json', 'utf8'));
const checks = new Map([['/', 'index.html'], ['/service-worker.js', 'service-worker.js']]);

for (const key of plan.changed) {
  if (key.startsWith('assets/')) continue;
  checks.set(`/${key}`, key);
  if (production && key.endsWith('/index.html')) {
    const route = `/${key.slice(0, -'/index.html'.length)}`;
    checks.set(route === '/en' ? '/en/' : route, key);
  }
}

const entries = [...checks];
let next = 0;
async function worker() {
  while (next < entries.length) {
    const [route, key] = entries[next++];
    const response = await fetch(new URL(route, baseUrl));
    if (!response.ok) throw new Error(`${route}: HTTP ${response.status}`);
    const actual = Buffer.from(await response.arrayBuffer());
    const expected = readFileSync(resolve('dist', key));
    if (!actual.equals(expected)) throw new Error(`${route}: published body differs from dist/${key}`);
  }
}
await Promise.all(Array.from({ length: Math.min(8, entries.length) }, () => worker()));
process.stdout.write(`Verified ${entries.length} published URL bodies, including / and /service-worker.js.\n`);
