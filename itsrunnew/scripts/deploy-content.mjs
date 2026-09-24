#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const stateKey = '.itsrun-deploy/manifest-v1.json';
const dist = resolve('dist');

function aws(...args) {
  return execFileSync('aws', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : entry.isFile() ? [path] : [];
  });
}

export function buildManifest(directory = dist) {
  return Object.fromEntries(filesIn(directory).map(file => [
    relative(directory, file).split('/').join('/'),
    createHash('sha256').update(readFileSync(file)).digest('hex'),
  ]).sort(([a], [b]) => a.localeCompare(b)));
}

export function invalidationPaths(keys) {
  const paths = new Set();
  const availabilityKeys = keys.filter(key => key.startsWith('availability/'));
  if (availabilityKeys.length > 1) paths.add('/availability/*');
  for (const key of keys) {
    if (key.startsWith('availability/') && availabilityKeys.length > 1) continue;
    if (key === 'index.html') {
      paths.add('/');
    } else if (key.endsWith('/index.html')) {
      const route = `/${key.slice(0, -'/index.html'.length)}`;
      if (route === '/en') paths.add('/en/');
      else {
        paths.add(route);
        if (/^\/(en\/)?tracks\/[a-z0-9-]+$/.test(route)) paths.add(`${route}/`);
      }
    }
    paths.add(`/${key}`);
  }
  return [...paths].sort();
}

export function planDeployment(previous, current) {
  const changed = Object.keys(current).filter(key => current[key] !== previous[key]).sort();
  // Keep immutable hashed assets for tabs that loaded the previous HTML before deployment.
  const removed = Object.keys(previous).filter(key => !(key in current) && !key.startsWith('assets/')).sort();
  // A new content-hashed asset has a fresh URL; only a reused key could be cached.
  const invalidateChanged = changed.filter(key => !key.startsWith('assets/') || key in previous);
  let affected = [...invalidateChanged, ...removed];
  const grouped = [];
  for (const [pattern, wildcard] of [
    [/^tracks\/[a-z0-9-]+\/index\.html$/, '/tracks/*'],
    [/^en\/tracks\/[a-z0-9-]+\/index\.html$/, '/en/tracks/*'],
  ]) {
    const allShells = [...new Set([...Object.keys(previous), ...Object.keys(current)].filter(key => pattern.test(key)))];
    // A wildcard is warranted only when every shell in this namespace changed.
    if (allShells.length > 10 && allShells.every(key => affected.includes(key))) {
      affected = affected.filter(key => !pattern.test(key));
      grouped.push(wildcard);
    }
  }
  return { changed, removed, paths: [...new Set([...invalidationPaths(affected), ...grouped])].sort() };
}

function previousManifest(bucket, temporaryDirectory) {
  const path = join(temporaryDirectory, 'previous.json');
  try {
    aws('s3api', 'get-object', '--bucket', bucket, '--key', stateKey, path, '--output', 'json');
  } catch (error) {
    const message = String(error.stderr ?? '');
    if (!/NoSuchKey|Not Found|\(404\)/.test(message)) throw error;
    // One-time migration: compare the existing objects by bytes, avoiding a full invalidation.
    const snapshot = join(temporaryDirectory, 'snapshot');
    mkdirSync(snapshot);
    aws('s3', 'sync', `s3://${bucket}`, snapshot,
      '--exclude', '.itsrun-deploy/*', '--only-show-errors');
    return { files: buildManifest(snapshot), migrated: true };
  }
  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (data.version !== 1 || typeof data.files !== 'object' || !data.files || Array.isArray(data.files)) {
    throw new Error('Invalid deployment manifest; refusing to deploy.');
  }
  return { files: data.files, migrated: false };
}

function cacheControl(key) {
  if (key === 'index.html' || key === 'service-worker.js') return 'no-cache';
  if (key.startsWith('assets/')) return 'public,max-age=31536000,immutable';
  return 'public,max-age=300';
}

function upload(bucket, key) {
  const args = ['s3', 'cp', join(dist, key), `s3://${bucket}/${key}`,
    '--cache-control', cacheControl(key), '--only-show-errors'];
  if (key === 'index.html') args.push('--content-type', 'text/html');
  if (key === 'service-worker.js') args.push('--content-type', 'application/javascript');
  aws(...args);
}

function output(name, value) {
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, { flag: 'a' });
}

export function deploy({ bucket, distribution }) {
  if (!statSync(join(dist, 'index.html')).isFile() || !statSync(join(dist, 'service-worker.js')).isFile()) {
    throw new Error('dist/ is missing required entry files.');
  }
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'itsrun-deploy-'));
  try {
    const current = buildManifest();
    const previous = previousManifest(bucket, temporaryDirectory);
    const plan = planDeployment(previous.files, current);
    for (const key of plan.changed) upload(bucket, key);
    for (const key of plan.removed) aws('s3api', 'delete-object', '--bucket', bucket, '--key', key);

    let invalidationId = '';
    for (let offset = 0; offset < plan.paths.length; offset += 1000) {
      const paths = plan.paths.slice(offset, offset + 1000);
      invalidationId = aws('cloudfront', 'create-invalidation', '--distribution-id', distribution,
        '--paths', ...paths, '--query', 'Invalidation.Id', '--output', 'text');
      aws('cloudfront', 'wait', 'invalidation-completed', '--distribution-id', distribution, '--id', invalidationId);
      const status = aws('cloudfront', 'get-invalidation', '--distribution-id', distribution,
        '--id', invalidationId, '--query', 'Invalidation.Status', '--output', 'text');
      if (status !== 'Completed') throw new Error(`CloudFront invalidation ${invalidationId} did not complete.`);
    }
    // Commit only after every invalidation succeeds. A failed run retries the same paths.
    const manifestFile = join(temporaryDirectory, 'current.json');
    if (previous.migrated || plan.changed.length || plan.removed.length) {
      writeFileSync(manifestFile, JSON.stringify({ version: 1, files: current }));
      aws('s3', 'cp', manifestFile, `s3://${bucket}/${stateKey}`,
        '--cache-control', 'no-store', '--content-type', 'application/json', '--only-show-errors');
    }
    mkdirSync('.cache', { recursive: true });
    writeFileSync('.cache/deployment-plan.json', JSON.stringify(plan));
    output('invalidation_id', invalidationId || 'skipped');
    output('invalidation_paths', plan.paths.length);
    output('changed_files', plan.changed.length);
    output('removed_files', plan.removed.length);
    process.stdout.write(`Content: ${plan.changed.length} changed, ${plan.removed.length} removed; ` +
      `CloudFront: ${plan.paths.length} paths${invalidationId ? ` (${invalidationId} completed)` : ' (skipped)'}.\n`);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const [bucket, distribution] = process.argv.slice(2);
  if (!bucket || !distribution) throw new Error('Usage: node deploy-content.mjs BUCKET DISTRIBUTION');
  deploy({ bucket, distribution });
}
