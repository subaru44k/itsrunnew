import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { buildManifest } from './deploy-content.mjs';
import { makeDailyFixture } from './daily-fixtures.mjs';
import { createAvailabilityPublication, writeAvailabilityPublication } from './availability/publication.mjs';

const prebuilt = process.env.ITSRUN_PREBUILT_DIST ? resolve(process.env.ITSRUN_PREBUILT_DIST) : undefined;
const mode = process.argv[2];
if (!['live', 'fixtures', 'fixture-smoke', 'features'].includes(mode)) throw new Error('Usage: node scripts/daily-check.mjs live|fixtures|fixture-smoke|features');
const source = fileURLToPath(new URL('..', import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), 'itsrun-daily-'));
const app = join(scratch, 'itsrunnew');
const port = process.env.ITSRUN_PREVIEW_PORT ?? await new Promise((resolvePort, reject) => {
  const reservation = createServer();
  reservation.once('error', reject);
  reservation.listen(0, '127.0.0.1', () => {
    const assignedPort = reservation.address().port;
    reservation.close(error => error ? reject(error) : resolvePort(String(assignedPort)));
  });
});
const env = { ...process.env, ITSRUN_AI_CACHE_DIR: process.env.ITSRUN_AI_CACHE_DIR ?? join(source, '.cache/availability-ai'), ITSRUN_PREVIEW_PORT: port, VITE_DEPLOY_TARGET: 'preview', VITE_ADSENSE_ENABLED: 'false', VITE_FIELD_REPORTS_API: mode === 'features' ? 'https://reports.test.invalid' : '', ITSRUN_EXPECT_EDGE_ROUTING: 'false' };
const run = command => new Promise((resolveRun, reject) => {
  console.log(`Daily check (${mode}): npm run ${command}`);
  const child = spawn('npm', ['run', command], { cwd: app, env, stdio: 'inherit' });
  child.once('error', reject);
  child.once('exit', (code, signal) => code === 0 ? resolveRun() : reject(new Error(`${command} failed (${signal ?? code})`)));
});
async function appBuildSignature(directory = join(app, 'dist')) {
  const files = Object.entries(buildManifest(directory)).filter(([key]) => !key.startsWith('availability/'));
  return createHash('sha256').update(JSON.stringify(files)).digest('hex');
}

try {
  // Exclude local credentials/config and generated/dependency directories.
  await cp(source, app, { recursive: true, filter: path => !['node_modules', 'dist', 'cdk.out', '.git', '.cache'].includes(basename(path)) && !basename(path).startsWith('.env') });
  for (const name of ['data', 'research', '.github']) await cp(resolve(source, '..', name), join(scratch, name), { recursive: true });
  await symlink(join(source, 'node_modules'), join(app, 'node_modules'), 'dir');
  async function build() {
    if (!prebuilt) { await run('build'); return; }
    await rm(join(app, 'dist'), { recursive: true, force: true });
    await cp(prebuilt, join(app, 'dist'), { recursive: true });
    await rm(join(app, 'dist/availability'), { recursive: true, force: true });
    await cp(join(app, 'src/data/availability'), join(app, 'dist/availability'), { recursive: true });
  }
  // Ensure the copied public link follows this isolated workspace's generated data.
  await rm(join(app, 'public/availability'), { force: true });
  await symlink('../src/data/availability', join(app, 'public/availability'), 'dir');
  if (mode === 'live') {
    await run('collect:availability:range');
    await run('validate:availability:fresh');
    await run('validate:tracks');
    await build();
    await run('test:smoke:preview');
  } else {
    const tracks = JSON.parse(await readFile(join(app, 'src/data/tracks.json'), 'utf8'));
    const baseline = JSON.parse(await readFile(join(app, 'src/data/availability.json'), 'utf8'));
    let firstBuildSignature = prebuilt ? await appBuildSignature(prebuilt) : undefined;
    for (const scenario of (['fixture-smoke', 'features'].includes(mode) ? ['mixed'] : ['mixed', 'unknown'])) {
      console.log(`Daily regression scenario: ${scenario}`);
      const { manifest, datasets } = makeDailyFixture(tracks, baseline, scenario);
      const directory = join(app, 'src/data/availability');
      await rm(directory, { recursive: true, force: true });
      await mkdir(directory);
      await writeAvailabilityPublication(directory, createAvailabilityPublication(manifest, datasets));
      await writeFile(join(app, 'src/data/availability.json'), JSON.stringify(datasets[0]));
      await run('validate:tracks');
      await build();
      const signature = await appBuildSignature();
      if (firstBuildSignature && signature !== firstBuildSignature) {
        throw new Error('Daily data changed application assets or HTML shells');
      }
      firstBuildSignature = signature;
      await run(mode === 'features' ? 'test:features:preview' : scenario === 'unknown' ? 'test:unknown:preview' : 'test:smoke:preview');
    }
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}
console.log(`Daily ${mode} check passed; checkout data and dist were not changed.`);
