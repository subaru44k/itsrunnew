import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../../.github/workflows/deploy-preview.yml', import.meta.url), 'utf8');
const deployScript = readFileSync(new URL('./deploy-preview.sh', import.meta.url), 'utf8');
const previewStack = readFileSync(new URL('../infra/itsrun-preview-stack.ts', import.meta.url), 'utf8');

describe('Preview deployment contract', () => {
  it('supports master, manual, and 05:00 JST daily triggers with one deployment at a time', () => {
    expect(workflow).toMatch(/push:\n\s+branches:\n\s+- master/);
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain("cron: '0 20 * * *'");
    expect(workflow).toContain('group: itsrun-preview-deploy');
    expect(workflow).toContain('cancel-in-progress: false');
  });

  it('uses OIDC after validation without live AWS keys', () => {
    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('aws-actions/configure-aws-credentials@00943011d9042930efac3dcd3a170e4273319bc8');
    expect(workflow.indexOf('Configure GitHub OIDC credentials')).toBeGreaterThan(workflow.indexOf('Run local production smoke'));
    expect(workflow).not.toMatch(/AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY/);
    expect(workflow).toContain('VITE_DEPLOY_TARGET: preview');
    expect(workflow).toContain("VITE_ADSENSE_ENABLED: 'false'");
  });

  it('guards the target before invoking the shared diff-based content deployer', () => {
    expect(deployScript).toContain('Unexpected Preview bucket.');
    expect(deployScript).toContain('node scripts/deploy-content.mjs "$PREVIEW_BUCKET" "$PREVIEW_DISTRIBUTION_ID"');
    expect(deployScript).not.toContain('create-invalidation');
    expect(previewStack).not.toContain('BucketDeployment');
    expect(previewStack).not.toContain("'/*'");
  });
});

const productionWorkflow = readFileSync(new URL('../../.github/workflows/deploy-production.yml', import.meta.url), 'utf8');
const validationWorkflow = readFileSync(new URL('../../.github/workflows/node-validation.yml', import.meta.url), 'utf8');
describe('daily availability regression gates', () => {
  it('requires fixture and live daily preflight on PR and master in the protected validation check', () => {
    expect(validationWorkflow).toContain('name: Node 24 validation');
    expect(validationWorkflow).toContain('pull_request:');
    expect(validationWorkflow).toContain('push:');
    expect(validationWorkflow).toContain('run: npm run test:daily:fixtures');
    expect(validationWorkflow).toContain('run: npm run test:daily\n');
    expect(validationWorkflow).not.toContain('continue-on-error:');
    expect(validationWorkflow).toContain('CHROME_PATH: /usr/bin/google-chrome');
  });
  for (const [target, yaml] of [['Preview', workflow], ['Production', productionWorkflow]]) {
    it(`${target} validates fresh generated data before building or deploying`, () => {
      const collect = yaml.indexOf('run: npm run collect:availability:range');
      const fresh = yaml.indexOf('run: npm run validate:availability:fresh');
      const build = yaml.indexOf('run: npm run build');
      const smoke = yaml.indexOf('run: npm run test:smoke:preview');
      const credentials = yaml.indexOf('name: Configure GitHub OIDC credentials');
      expect(collect).toBeGreaterThan(-1);
      expect(fresh).toBeGreaterThan(collect);
      expect(build).toBeGreaterThan(fresh);
      expect(smoke).toBeGreaterThan(build);
      expect(credentials).toBeGreaterThan(smoke);
      expect(yaml).not.toContain('continue-on-error:');
      expect(yaml).toContain('AVAILABILITY_RESULT: ${{ steps.availability.outcome }}');
      expect(yaml).toContain('LOCAL_SMOKE_RESULT: ${{ steps.local_smoke.outcome }}');
    });
  }
});
