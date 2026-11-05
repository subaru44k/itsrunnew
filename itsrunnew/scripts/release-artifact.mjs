import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest } from './deploy-content.mjs';

export const trackIdsHash = ids => createHash('sha256').update(JSON.stringify([...ids].sort())).digest('hex');
const shaPattern = /^[a-f0-9]{40}$/;
const runPattern = /^\d+$/;

export function verifyRelease(directory, expectedSha, expectedRun) {
  const release = JSON.parse(readFileSync(resolve(directory, 'release.json'), 'utf8'));
  if (release.version !== 1 || !shaPattern.test(expectedSha) || !runPattern.test(String(expectedRun)) ||
      release.sha !== expectedSha || String(release.runId) !== String(expectedRun) ||
      typeof release.deploy_app !== 'boolean' || typeof release.deploy_data !== 'boolean' ||
      !/^[a-f0-9]{64}$/.test(release.trackIdsHash)) throw new Error('Untrusted release metadata');
  const actual = existsSync(resolve(directory, 'dist')) ? buildManifest(resolve(directory, 'dist')) : {};
  if (Object.keys(actual).some(key => key.startsWith('availability/') || key.startsWith('.') || key.includes('..')) ||
      JSON.stringify(actual) !== JSON.stringify(release.files) ||
      (release.deploy_app && (!actual['index.html'] || !actual['service-worker.js'] || !Object.keys(actual).some(key => key.startsWith('assets/'))))) {
    throw new Error('Release artifact bytes do not match validated hashes');
  }
  return release;
}

export function sealRelease({ directory, dist, sha, runId, app, data, ids }) {
  if (!shaPattern.test(sha) || !runPattern.test(String(runId))) throw new Error('Invalid release identity');
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  if (app) cpSync(dist, resolve(directory, 'dist'), { recursive: true, filter: path => path !== resolve(dist, 'availability') });
  const release = { version: 1, sha, runId: String(runId), deploy_app: app, deploy_data: data, trackIdsHash: trackIdsHash(ids), files: app ? buildManifest(resolve(directory, 'dist')) : {} };
  writeFileSync(resolve(directory, 'release.json'), `${JSON.stringify(release)}\n`);
  return verifyRelease(directory, sha, runId);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, directory = '.cache/release', sha = process.env.GITHUB_SHA, runId = process.env.GITHUB_RUN_ID] = process.argv.slice(2);
  if (command === 'seal') {
    const tracks = JSON.parse(readFileSync('src/data/tracks.json', 'utf8'));
    sealRelease({ directory: resolve(directory), dist: resolve('dist'), sha, runId, app: process.env.DEPLOY_APP === 'true', data: process.env.DEPLOY_DATA === 'true', ids: tracks.map(track => track.id) });
  } else if (command === 'verify') verifyRelease(directory, sha, runId);
  else throw new Error('Usage: release-artifact.mjs seal|verify DIRECTORY SHA RUN_ID');
  console.log(`Release artifact ${command}: ${sha} / validation run ${runId}`);
}
