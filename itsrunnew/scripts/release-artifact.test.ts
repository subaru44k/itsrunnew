import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sealRelease, verifyRelease } from './release-artifact.mjs';
import { assertTrustedValidation } from './production-release.mjs';
import { releaseScope } from './release-scope.mjs';
import { ownsKey } from './deploy-content.mjs';

describe('validated publication boundary', () => {
  it('seals exact app bytes, excludes data, and refuses corruption or a different run', () => {
    const root = mkdtempSync(join(tmpdir(), 'itsrun-release-test-'));
    try {
      const dist = join(root, 'dist'), directory = join(root, 'release');
      for (const path of [dist, join(dist, 'assets'), join(dist, 'availability')]) mkdirSync(path);
      writeFileSync(join(dist, 'index.html'), '<html>validated</html>');
      writeFileSync(join(dist, 'service-worker.js'), 'worker');
      writeFileSync(join(dist, 'assets/app-hash.js'), 'application');
      writeFileSync(join(dist, 'availability/manifest.json'), 'old data must not publish');
      const sha = 'a'.repeat(40);
      const release = sealRelease({ directory, dist, sha, runId: '123', app: true, data: false, ids: ['track-b', 'track-a'] });
      expect(Object.keys(release.files)).not.toContain('availability/manifest.json');
      expect(verifyRelease(directory, sha, '123')).toEqual(release);
      expect(() => verifyRelease(directory, sha, '124')).toThrow('Untrusted');
      expect(() => verifyRelease(directory, 'b'.repeat(40), '123')).toThrow('Untrusted');
      writeFileSync(join(directory, 'dist/assets/app-hash.js'), 'tampered');
      expect(() => verifyRelease(directory, sha, '123')).toThrow('bytes');
      const metadata = JSON.parse(readFileSync(join(directory, 'release.json'), 'utf8'));
      expect(metadata.sha).toBe(sha);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('accepts only successful protected-master push runs from this repository', () => {
    const run = { path: '.github/workflows/node-validation.yml', head_branch: 'master', event: 'push', status: 'completed', conclusion: 'success', head_sha: 'a'.repeat(40), repository: { full_name: 'subaru44k/itsrunnew' }, head_repository: { full_name: 'subaru44k/itsrunnew' } };
    expect(() => assertTrustedValidation(run)).not.toThrow();
    for (const change of [{ event: 'pull_request' }, { head_branch: 'feature' }, { conclusion: 'failure' }, { path: 'another.yml' }, { head_repository: { full_name: 'attacker/fork' } }]) {
      expect(() => assertTrustedValidation({ ...run, ...change })).toThrow('protected-master');
    }
  });

  it('separates publication scope from test scope and never crosses owned prefixes', () => {
    expect(releaseScope(['docs/README.md', 'itsrunnew/src/model/availability.test.ts'])).toEqual({ deploy_app: false, deploy_data: false });
    expect(releaseScope(['itsrunnew/src/views/LapTime.vue'])).toEqual({ deploy_app: true, deploy_data: false });
    expect(releaseScope(['itsrunnew/scripts/availability/reviewed-chita.ts'])).toEqual({ deploy_app: false, deploy_data: true });
    expect(releaseScope(['itsrunnew/src/data/tracks.json'])).toEqual({ deploy_app: true, deploy_data: true });
    expect(releaseScope(['unknown/new-tool'])).toEqual({ deploy_app: true, deploy_data: true });
    for (const key of ['index.html', 'assets/app.js', 'tracks/a/index.html']) { expect(ownsKey('app', key)).toBe(true); expect(ownsKey('data', key)).toBe(false); }
    for (const key of ['availability/manifest.json', 'availability/generations/a/tracks/a.json']) { expect(ownsKey('app', key)).toBe(false); expect(ownsKey('data', key)).toBe(true); }
    expect(ownsKey('all', '.itsrun-deploy/app-v2.json')).toBe(false);
  });
});
