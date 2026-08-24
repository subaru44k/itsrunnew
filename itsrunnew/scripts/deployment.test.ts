import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../../.github/workflows/deploy-preview.yml', import.meta.url), 'utf8');
const deployScript = readFileSync(new URL('./deploy-preview.sh', import.meta.url), 'utf8');

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
  });

  it('preserves cache metadata and invalidates only entry routes', () => {
    expect(deployScript).toContain("public,max-age=31536000,immutable");
    expect(deployScript).toContain("public,max-age=300");
    expect(deployScript).toContain("--cache-control 'no-cache'");
    expect(deployScript).toContain("--paths '/' '/index.html' '/tracks' '/en/tracks'");
    expect(deployScript).not.toContain("--paths '/*'");
  });
});
