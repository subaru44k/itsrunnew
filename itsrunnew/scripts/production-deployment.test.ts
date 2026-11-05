import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import pageMetadata from '../src/data/page-metadata.json';
import { invalidationPaths } from './deploy-content.mjs';

const workflow = readFileSync(new URL('../../.github/workflows/deploy-production.yml', import.meta.url), 'utf8');
const deployScript = readFileSync(new URL('./deploy-production.sh', import.meta.url), 'utf8');
const contentScript = readFileSync(new URL('./deploy-content.mjs', import.meta.url), 'utf8');

describe('Production deployment contract', () => {
  it('refuses unscoped and all-scope production writes before reaching AWS', () => {
    for (const scope of ['', 'all', 'unexpected']) {
      const result = spawnSync('bash', [new URL('./deploy-production.sh', import.meta.url).pathname], {
        encoding: 'utf8', env: { ...process.env, ITSRUN_DEPLOY_SCOPE: scope, AWS_REGION: 'ap-northeast-1', PRODUCTION_BUCKET: 'unused', PRODUCTION_DISTRIBUTION_ID: 'unused', PRODUCTION_DOMAIN: 'itsrun.info', PRODUCTION_URL: 'https://itsrun.info' },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Production scope must be app or data.');
    }
  });

  it('guards the production target and preserves cache metadata', () => {
    expect(deployScript).toContain("\"$bucket_environment\" == 'Production'");
    expect(deployScript).toContain('node scripts/deploy-content.mjs "$PRODUCTION_BUCKET" "$PRODUCTION_DISTRIBUTION_ID"');
    expect(contentScript).toContain('public,max-age=31536000,immutable');
    expect(contentScript).toContain('public,max-age=300');
    expect(contentScript).toContain("key === 'service-worker.js') return 'no-cache'");
    expect(contentScript).not.toContain("'/*'");
  });

  it('maps each changed fixed shell to its public route and object URL', () => {
    for (const page of Object.values(pageMetadata)) {
      for (const locale of ['ja', 'en'] as const) {
        const prefix = locale === 'en' ? '/en' : '';
        const path = page.path ? `${prefix}/${page.path}` : (locale === 'en' ? '/en/' : '/');
        const shell = path === '/' ? '/index.html' : `${path.replace(/\/$/, '')}/index.html`;
        expect(invalidationPaths([shell.slice(1)])).toContain(path);
        expect(invalidationPaths([shell.slice(1)])).toContain(shell);
      }
    }
  });
});
