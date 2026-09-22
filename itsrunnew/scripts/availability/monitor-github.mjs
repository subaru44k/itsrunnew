import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const execute = promisify(execFile);
const defaultGh = async args => (await execute('gh', args, { timeout: 120000, maxBuffer: 4 * 1024 * 1024 })).stdout;

export async function restoreMonitorInputs({ repository, directory, productionEnabled, gh = defaultGh }) {
  if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('GITHUB_REPOSITORY is required');
  if (!directory) throw new Error('Monitor input directory is required');
  await mkdir(directory, { recursive: true });
  const monitorRuns = JSON.parse(await gh(['run', 'list', '--repo', repository, '--workflow', 'availability-monitor.yml', '--branch', 'master', '--status', 'success', '--limit', '100', '--json', 'databaseId']));
  let previous;
  for (const run of monitorRuns) {
    const details = JSON.parse(await gh(['run', 'view', String(run.databaseId), '--repo', repository, '--json', 'jobs']));
    // Runs while the enable switch was off finish successfully but have no state.
    if (details.jobs.length && details.jobs.every(job => job.conclusion === 'skipped')) continue;
    previous = run;
    break;
  }
  if (!previous && monitorRuns.length === 100) throw new Error('Monitor history exceeds lookup window; restore a known baseline explicitly');
  if (previous) {
    // Only a successful monitor has delivered its notifications and saved a usable
    // baseline. Expiry, deletion and download failures must not reset deduplication.
    await gh(['run', 'download', String(previous.databaseId), '--repo', repository, '--name', 'availability-monitor-state', '--dir', join(directory, 'previous')]);
    console.log(`Restored monitor baseline from run ${previous.databaseId}`);
  } else console.log('First successful monitor baseline: no history yet');
  let production;
  if (productionEnabled) {
    const runs = JSON.parse(await gh(['run', 'list', '--repo', repository, '--workflow', 'deploy-production.yml', '--branch', 'master', '--status', 'success', '--limit', '100', '--json', 'databaseId,updatedAt']));
    for (const run of runs) {
      const details = JSON.parse(await gh(['run', 'view', String(run.databaseId), '--repo', repository, '--json', 'jobs']));
      if (details.jobs.some(job => job.conclusion === 'success')) { production = run; break; }
    }
  }
  await writeFile(join(directory, 'pipeline.json'), JSON.stringify({ enabled: productionEnabled, lastSuccessAt: production?.updatedAt ?? null }));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await restoreMonitorInputs({
  repository: process.env.GITHUB_REPOSITORY,
  directory: process.argv[2],
  productionEnabled: process.env.PRODUCTION_DEPLOY_ENABLED === 'true',
});
