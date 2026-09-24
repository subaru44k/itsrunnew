import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import pageMetadata from '../src/data/page-metadata.json';
import { invalidationPaths } from './deploy-content.mjs';

const workflow = readFileSync(new URL('../../.github/workflows/deploy-production.yml', import.meta.url), 'utf8');
const deployScript = readFileSync(new URL('./deploy-production.sh', import.meta.url), 'utf8');
const contentScript = readFileSync(new URL('./deploy-content.mjs', import.meta.url), 'utf8');

describe('Production deployment contract', () => {
  it('is gated, serialized, and supports master, manual, and daily refreshes', () => {
    expect(workflow).toMatch(/push:\n\s+branches:\n\s+- master/);
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain("cron: '30 20 * * *'");
    expect(workflow).toContain("if: vars.PRODUCTION_DEPLOY_ENABLED == 'true'");
    expect(workflow).toContain('group: itsrun-production-deploy');
    expect(workflow).toContain('cancel-in-progress: false');
  });

  it('uses production OIDC only after offline validation and keeps ads disabled', () => {
    expect(workflow).toContain('id-token: write');
    expect(workflow.indexOf('Configure GitHub OIDC credentials')).toBeGreaterThan(workflow.indexOf('Run local production smoke'));
    expect(workflow).not.toMatch(/AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY/);
    expect(workflow).toContain('VITE_DEPLOY_TARGET: production');
    expect(workflow).toContain("VITE_ADSENSE_ENABLED: 'true'");
    expect(workflow).toContain('Build static site with advertising and Google CMP');
    expect(workflow).toContain("ITSRUN_EXPECT_EDGE_ROUTING: 'true'");
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
