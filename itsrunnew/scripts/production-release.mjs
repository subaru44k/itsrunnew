import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseScope } from './release-scope.mjs';
import { verifyRelease } from './release-artifact.mjs';

const repository = process.env.GITHUB_REPOSITORY ?? 'subaru44k/itsrunnew';
const gh = args => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const api = path => JSON.parse(gh(['api', `repos/${repository}/${path}`]));
const output = values => {
  const text = Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, text);
  console.log(text);
};
export function assertTrustedValidation(run, repo = repository) {
  if (run.path !== '.github/workflows/node-validation.yml' || run.head_branch !== 'master' || run.event !== 'push' ||
      run.status !== 'completed' || run.conclusion !== 'success' || run.repository?.full_name !== repo ||
      run.head_repository?.full_name !== repo || !/^[a-f0-9]{40}$/.test(run.head_sha)) throw new Error('Release requires a successful protected-master push validation');
}
function unchangedSince(sha) {
  const current = api('git/ref/heads/master').object.sha;
  if (current === sha) return { deploy_app: false, deploy_data: false };
  const comparison = api(`compare/${sha}...${current}`);
  if (comparison.status !== 'ahead' || !Array.isArray(comparison.files) || comparison.files.length >= 300) {
    return { deploy_app: true, deploy_data: true };
  }
  return releaseScope(comparison.files.map(file => file.filename));
}
function assertCurrent(sha, scope) {
  const changes = unchangedSince(sha);
  if (scope === 'app' ? changes.deploy_app : scope === 'data' ? changes.deploy_data : changes.deploy_app || changes.deploy_data) {
    throw new Error(`Obsolete ${scope} release ${sha}: relevant master files changed; content was not published`);
  }
}
function download(run) {
  const directory = resolve('.cache/release');
  rmSync(directory, { recursive: true, force: true });
  gh(['run', 'download', String(run.id), '--repo', repository, '--name', `production-release-${run.head_sha}`, '--dir', directory]);
  return verifyRelease(directory, run.head_sha, run.id);
}
async function prepare() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  if (event.client_payload?.scheduled_time) {
    const delay = Date.now() - Date.parse(event.client_payload.scheduled_time);
    if (!Number.isFinite(delay)) throw new Error('Invalid scheduler timestamp');
    console.log(`Scheduled trigger delay: ${Math.round(delay / 1000)} seconds`);
  }
  const rollbackRun = process.env.ROLLBACK_RUN_ID;
  const generation = process.env.ROLLBACK_GENERATION ?? '';
  if ((generation && !/^[a-f0-9]{24}$/.test(generation)) || (generation && rollbackRun)) throw new Error('Choose one valid rollback target');
  let run;
  if (process.env.GITHUB_EVENT_NAME === 'workflow_run') {
    const candidate = event.workflow_run;
    if (candidate.conclusion !== 'success' || candidate.head_branch !== 'master' || candidate.event !== 'push') {
      output({ app: false, data: false }); return;
    }
    run = api(`actions/runs/${candidate.id}`);
  } else if (rollbackRun) {
    if (!/^\d+$/.test(rollbackRun)) throw new Error('Invalid rollback validation run ID');
    run = api(`actions/runs/${rollbackRun}`);
  } else {
    const sha = api('git/ref/heads/master').object.sha;
    const runs = api(`actions/workflows/node-validation.yml/runs?head_sha=${sha}&branch=master&event=push&status=success&per_page=10`).workflow_runs;
    run = runs[0];
    if (!run) throw new Error('Current master has no successful validation; refusing scheduled collection');
    assertTrustedValidation(run);
    assertCurrent(sha, 'data');
    output({ app: false, data: true, sha, run: run.id, rollback: false, generation }); return;
  }
  assertTrustedValidation(run);
  const release = download(run);
  if (rollbackRun && !release.deploy_app) throw new Error('Requested validation run has no application artifact');
  const newer = rollbackRun ? { deploy_app: false, deploy_data: true } : unchangedSince(run.head_sha);
  output({ app: release.deploy_app && !newer.deploy_app, data: !rollbackRun && release.deploy_data && !newer.deploy_data, sha: run.head_sha, run: run.id, rollback: Boolean(rollbackRun), generation: '' });
}
async function restore(runId, expectedSha) {
  const run = api(`actions/runs/${runId}`);
  assertTrustedValidation(run);
  if (run.head_sha !== expectedSha) throw new Error('Validation run SHA mismatch');
  const release = download(run);
  if (!release.deploy_app) throw new Error('Validation has no application artifact');
  const response = await fetch(`${process.env.PRODUCTION_URL}/availability/manifest.json`, { cache: 'no-cache', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Published availability HTTP ${response.status}`);
  const manifest = await response.json();
  if (manifest.schemaVersion !== 1 || manifest.partitionVersion !== 1 || manifest.trackIdsHash !== release.trackIdsHash) {
    throw new Error('Application/data schema or facility IDs do not match; publish compatible fresh data first');
  }
  rmSync('dist', { recursive: true, force: true });
  cpSync('.cache/release/dist', 'dist', { recursive: true });
  if (release.dateOnly && process.env.IS_ROLLBACK !== 'true' && process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, 'ITSRUN_DEFER_FACILITY_DATE_INVALIDATION=true\n');
  console.log(`Restored validated application ${expectedSha} without rebuilding`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, first, second] = process.argv.slice(2);
  if (command === 'prepare') await prepare();
  else if (command === 'guard') assertCurrent(first, second);
  else if (command === 'restore') await restore(first, second);
  else throw new Error('Usage: production-release.mjs prepare|guard SHA|restore RUN_ID SHA');
}
