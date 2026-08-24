import { spawn } from 'node:child_process';

const port = process.env.ITSRUN_PREVIEW_PORT ?? '4173';
const baseUrl = `http://127.0.0.1:${port}`;
const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', port, '--strictPort'], {
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let previewLog = '';
preview.stdout.on('data', chunk => { previewLog += chunk; });
preview.stderr.on('data', chunk => { previewLog += chunk; });

const waitForPreview = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (preview.exitCode !== null) throw new Error(`Preview exited before startup.\n${previewLog}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Preview did not start within 30 seconds.\n${previewLog}`);
};

const runSmoke = () => new Promise((resolve, reject) => {
  const smoke = spawn('npm', ['run', 'test:smoke'], {
    env: { ...process.env, ITSRUN_BASE_URL: baseUrl },
    stdio: 'inherit',
  });
  smoke.once('error', reject);
  smoke.once('exit', code => code === 0 ? resolve() : reject(new Error(`Smoke test exited with code ${code}.`)));
});

try {
  await waitForPreview();
  await runSmoke();
} finally {
  preview.kill('SIGTERM');
}
