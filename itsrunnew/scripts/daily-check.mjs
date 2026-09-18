import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { makeDailyFixture } from './daily-fixtures.mjs';

const mode = process.argv[2];
if (!['live', 'fixtures'].includes(mode)) throw new Error('Usage: node scripts/daily-check.mjs live|fixtures');
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
const env = { ...process.env, ITSRUN_PREVIEW_PORT: port, VITE_DEPLOY_TARGET: 'preview', VITE_ADSENSE_ENABLED: 'false', VITE_FIELD_REPORTS_API: '', ITSRUN_EXPECT_EDGE_ROUTING: 'false' };
const run = command => new Promise((resolveRun, reject) => {
  console.log(`Daily check (${mode}): npm run ${command}`);
  const child = spawn('npm', ['run', command], { cwd: app, env, stdio: 'inherit' });
  child.once('error', reject);
  child.once('exit', (code, signal) => code === 0 ? resolveRun() : reject(new Error(`${command} failed (${signal ?? code})`)));
});
try {
  // Exclude local credentials/config and generated/dependency directories.
  await cp(source, app, { recursive: true, filter: path => !['node_modules', 'dist', 'cdk.out', '.git'].includes(basename(path)) && !basename(path).startsWith('.env') });
  for (const name of ['data', 'research', '.github']) await cp(resolve(source, '..', name), join(scratch, name), { recursive: true });
  await symlink(join(source, 'node_modules'), join(app, 'node_modules'), 'dir');
  if (mode === 'live') {
    await run('collect:availability:range');
    await run('validate:availability:fresh');
    await run('validate:tracks');
    await run('build');
    await run('test:smoke:preview');
  } else {
    const tracks = JSON.parse(await readFile(join(app, 'src/data/tracks.json'), 'utf8'));
    const baseline = JSON.parse(await readFile(join(app, 'src/data/availability.json'), 'utf8'));
    for (const scenario of ['mixed', 'unknown']) {
      console.log(`Daily regression scenario: ${scenario}`);
      const { manifest, datasets } = makeDailyFixture(tracks, baseline, scenario);
      const directory = join(app, 'src/data/availability');
      await rm(directory, { recursive: true, force: true });
      await mkdir(directory);
      await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest));
      for (const dataset of datasets) await writeFile(join(directory, `${dataset.date}.json`), JSON.stringify(dataset));
      await writeFile(join(app, 'src/data/availability.json'), JSON.stringify(datasets[0]));
      await run('validate:tracks');
      await run('build');
      await run('test:smoke:preview');
    }
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}
console.log(`Daily ${mode} check passed; checkout data and dist were not changed.`);
