import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const suite = process.argv[2];
if (!['smoke', 'pace'].includes(suite)) throw new Error('Usage: node scripts/browser-check.mjs smoke|pace');
const workers = process.env.ITSRUN_BROWSER_WORKERS ?? '2';
if (!['1', '2'].includes(workers)) throw new Error('ITSRUN_BROWSER_WORKERS must be 1 or 2');
const script = new URL(suite === 'smoke' ? './smoke.mjs' : './pace-smoke.mjs', import.meta.url);
const children = new Set();
const stop = signal => { for (const child of children) child.kill(signal); };
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { stop(signal); process.exitCode = 1; });
const results = await Promise.allSettled((workers === '1' ? ['all'] : ['desktop', 'mobile']).map(viewport => new Promise((resolve, reject) => {
  console.log(`${suite}: starting ${viewport}`);
  const child = spawn(process.execPath, [fileURLToPath(script)], {
    env: { ...process.env, ITSRUN_TEST_VIEWPORT: viewport }, stdio: 'inherit',
  });
  children.add(child);
  child.once('error', reject);
  child.once('exit', (code, signal) => {
    children.delete(child);
    if (code === 0) resolve();
    else reject(new Error(`${suite}/${viewport} failed (${signal ?? code})`));
  });
})));
// Wait for both workers before the preview server or temporary workspace is removed.
for (const result of results) if (result.status === 'rejected') {
  console.error(result.reason);
  process.exitCode = 1;
}
