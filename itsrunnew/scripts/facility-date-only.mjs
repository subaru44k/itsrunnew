#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const dataPath = 'itsrunnew/src/data/tracks.json';

export function onlySourceCheckDatesChanged(before, after) {
  if (!Array.isArray(before) || !Array.isArray(after) || before.length !== after.length) return false;
  let updated = false;
  const stripDates = rows => rows.map(track => ({
    ...track,
    sources: track.sources.map(source => {
      const { verifiedAt, ...rest } = source;
      return rest;
    }),
  }));
  if (!isDeepStrictEqual(stripDates(before), stripDates(after))) return false;
  for (let index = 0; index < before.length; index++) {
    for (let source = 0; source < before[index].sources.length; source++) {
      const oldDate = before[index].sources[source].verifiedAt;
      const newDate = after[index].sources[source].verifiedAt;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(oldDate) || !/^\d{4}-\d{2}-\d{2}$/.test(newDate) || newDate < oldDate) return false;
      if (newDate !== oldDate) updated = true;
    }
  }
  return updated;
}

function git(...args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}

export function dateOnlyPush(beforeSha) {
  if (!/^[a-f0-9]{40}$/.test(beforeSha ?? '') || /^0{40}$/.test(beforeSha)) return false;
  try {
    const paths = git('diff', '--name-only', beforeSha, 'HEAD').split('\n').filter(Boolean);
    if (paths.length !== 1 || paths[0] !== dataPath) return false;
    const before = JSON.parse(git('show', `${beforeSha}:${dataPath}`));
    const after = JSON.parse(readFileSync(new URL('../src/data/tracks.json', import.meta.url), 'utf8'));
    return onlySourceCheckDatesChanged(before, after);
  } catch {
    // If the base cannot be verified, use the regular invalidating deployment.
    return false;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const value = dateOnlyPush(process.env.ITSRUN_BEFORE_SHA) ? 'true' : 'false';
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `date_only=${value}\n`);
  process.stdout.write(`Source-check-date-only push: ${value}\n`);
}
