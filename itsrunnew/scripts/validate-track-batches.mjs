import { readFile, readdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const appRoot = process.cwd();
const batchDirectory = resolve(appRoot, '../research/track-expansion/batches');
const tracks = JSON.parse(await readFile(resolve(appRoot, 'src/data/tracks.json'), 'utf8'));
const publishedIds = new Set(tracks.map(track => track.id));
const historicalWithoutReconciliation = new Set([
  '2026-08-kanto-completeness-audit',
  '2026-08-kansai-public-tracks',
  '2026-08-chugoku-aichi-fukuoka-public-tracks',
]);
const allowedDecisions = new Set(['existing', 'include', 'hold', 'exclude', 'defer']);
const requestedPaths = process.argv.slice(2);
const paths = requestedPaths.length
  ? requestedPaths.map(path => resolve(appRoot, path))
  : (await readdir(batchDirectory))
      .filter(name => name.endsWith('.json'))
      .map(name => resolve(batchDirectory, name));
const errors = [];

for (const path of paths) {
  const batch = JSON.parse(await readFile(path, 'utf8'));
  const label = batch.batchId ?? basename(path);
  const candidates = batch.candidates ?? [];
  const ids = new Set();
  const actual = { existing: 0, include: 0, hold: 0, exclude: 0, defer: 0 };
  for (const candidate of candidates) {
    if (!candidate.trackId || ids.has(candidate.trackId)) errors.push(`${label}: candidate ID is missing or duplicated: ${candidate.trackId ?? '(missing)'}`);
    ids.add(candidate.trackId);
    if (!allowedDecisions.has(candidate.decision)) errors.push(`${label}: invalid decision for ${candidate.trackId}: ${candidate.decision}`);
    else actual[candidate.decision] += 1;
    if (candidate.decision === 'include' && !publishedIds.has(candidate.trackId)) errors.push(`${label}: included candidate is absent from Track Dataset: ${candidate.trackId}`);
    if (candidate.decision === 'exclude' && publishedIds.has(candidate.trackId)) errors.push(`${label}: excluded candidate remains in Track Dataset: ${candidate.trackId}`);
  }
  for (const decision of ['include', 'hold', 'exclude', 'defer']) {
    if (batch.review?.[decision] !== undefined && batch.review[decision] !== actual[decision]) errors.push(`${label}: review.${decision} does not match candidates`);
  }
  const reconciliation = batch.discoveryReconciliation;
  if (!reconciliation && !historicalWithoutReconciliation.has(label)) errors.push(`${label}: discoveryReconciliation is required for new batches`);
  if (reconciliation) {
    const declared = reconciliation.counts ?? {};
    const sum = [...allowedDecisions].reduce((total, decision) => total + (declared[decision] ?? 0), 0);
    if (sum !== reconciliation.facilityClusters || sum !== candidates.length) errors.push(`${label}: discovery reconciliation total does not match candidate ledger`);
    for (const decision of allowedDecisions) if ((declared[decision] ?? 0) !== actual[decision]) errors.push(`${label}: discovery reconciliation ${decision} count is incorrect`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Track expansion batches valid: ${paths.length} files; candidate ledgers reconcile.`);
}
