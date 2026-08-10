import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function workflow(name) {
  return readFile(resolve(root, '.github/workflows', name), 'utf8');
}

describe('T15A migration validation workflow', () => {
  it('is limited to reviewed triggers and read-only permissions', async () => {
    const text = await workflow('validate-migration.yml');
    expect(text).toMatch(/pull_request:\s*\n\s+branches:\s*\n\s+- migration\/aws-s3-cloudfront/);
    expect(text).toMatch(/push:\s*\n\s+branches:\s*\n\s+- migration\/aws-s3-cloudfront/);
    expect(text.match(/^permissions:\s*$/gm)).toHaveLength(1);
    expect(text).toMatch(/^permissions:\s*\n\s+contents:\s*read\s*\n\s*\nconcurrency:/m);
    expect(text).not.toMatch(/^[ \t]+permissions:/m);
    expect(text).not.toMatch(/\b[a-z0-9-]+:\s*write\b/i);
    expect(text).not.toMatch(/workflow_dispatch|schedule:|workflow_run|repository_dispatch/);
    expect(text).not.toMatch(/pull_request_target|id-token\s*:\s*write|contents\s*:\s*write|secrets\./);
    expect(text).toMatch(/concurrency:/);
    expect(text).toMatch(/timeout-minutes:\s*30/);
  });

  it('pins every action to a full reviewed commit and records its release', async () => {
    const text = await workflow('validate-migration.yml');
    const uses = [...text.matchAll(/^\s+uses:\s+([^\s#]+)\s+#\s+(.+)$/gm)];
    expect(uses).toHaveLength(2);
    for (const [, ref, release] of uses) {
      expect(ref).toMatch(/@[0-9a-f]{40}$/);
      expect(release).toMatch(/^v\d/);
    }
  });

  it('runs the bounded Node/npm/Chromium production checks without artifacts', async () => {
    const text = await workflow('validate-migration.yml');
    expect(text).toContain('node-version: 24.18.1');
    const npmPin = text.indexOf('npm install --global npm@11.4.2');
    const npmGate = text.indexOf('test "$(npm --version)" = "11.4.2"');
    const npmCi = text.indexOf('npm ci');
    expect(npmPin).toBeGreaterThan(-1);
    expect(npmGate).toBeGreaterThan(npmPin);
    expect(npmCi).toBeGreaterThan(npmGate);
    expect(text).toContain('npm run check');
    expect(text).toContain('npm run test:e2e');
    expect(text).toContain('playwright install --with-deps chromium');
    expect(text).not.toMatch(/upload-artifact|cdk\.out|\.artifacts\/migration|\.env|AWS_ACCESS_KEY|AWS_SECRET/);
  });
});

describe('T15C preview deployment workflow', () => {
  it('is dispatch-only with scoped permissions, concurrency, and dependency gate', async () => {
    const text = await workflow('deploy-preview-web.yml');
    expect(text).toMatch(/^on:\s*\n\s+workflow_dispatch:\s*$/m);
    expect(text).not.toMatch(/pull_request|push:|schedule:|workflow_run|workflow_call|repository_dispatch/);
    expect(text.match(/^\s*permissions:\s*$/gm)).toHaveLength(2);
    expect(text).toMatch(/^permissions:\s*\n\s+contents:\s*read\s*\n\s*\nconcurrency:/m);
    expect(text).toMatch(/^\s+deploy:[\s\S]*?\n\s+needs:\s+validate/m);
    expect(text).toMatch(/deploy:[\s\S]*?permissions:\s*\n\s+contents:\s*read\s*\n\s+id-token:\s*write/);
    expect(text).not.toMatch(/environment:|upload-artifact|download-artifact|pull_request_target|secrets\.|cdk\s+(deploy|bootstrap)|invalidation|DeleteObject|sync\b|\bcp\b|schedule-data/i);
  });

  it('pins every third-party action and checks the exact repository/ref on both jobs', async () => {
    const text = await workflow('deploy-preview-web.yml');
    const uses = [...text.matchAll(/^\s+uses:\s+([^\s#]+)\s+#\s+(.+)$/gm)];
    expect(uses).toHaveLength(5);
    for (const [, ref, release] of uses) {
      expect(ref).toMatch(/@[0-9a-f]{40}$/);
      expect(release).toMatch(/^v\d/);
    }
    expect(text.match(/test \"\$GITHUB_REPOSITORY\" = \"subaru44k\/itsrunnew\"/g)).toHaveLength(2);
    expect(text.match(/test \"\$GITHUB_REF\" = \"refs\/heads\/migration\/aws-s3-cloudfront\"/g)).toHaveLength(2);
    expect(text.match(/ref: \$\{\{ github\.sha \}\}/g)).toHaveLength(2);
    expect(text).toContain('aws-actions/configure-aws-credentials@00943011d9042930efac3dcd3a170e4273319bc8 # v5.1.0');
  });

  it('pins Node/npm and orders validation, build, helper, and raw preview checks', async () => {
    const text = await workflow('deploy-preview-web.yml');
    expect(text.match(/node-version: 24\.18\.1/g)).toHaveLength(2);
    expect(text.match(/npm install --global npm@11\.4\.2/g)).toHaveLength(2);
    expect(text.match(/test \"\$\(npm --version\)\" = \"11\.4\.2\"/g)).toHaveLength(2);
    expect(text.match(/npm ci/g)).toHaveLength(2);
    expect(text).toContain('run: npm run check');
    expect(text).toContain('run: npm run test:e2e');
    expect(text).toContain('run: npm run build --workspace @itsrun/web');
    const helper = text.indexOf('node scripts/migration/deploy-web-preview-cli.mjs');
    const raw = text.indexOf('run: npm run test:e2e:preview');
    expect(helper).toBeGreaterThan(-1);
    expect(raw).toBeGreaterThan(helper);
    expect(text).toMatch(/--mode github[\s\S]*--web-dir[\s\S]*web\/.output\/public[\s\S]*--report-dir[\s\S]*t15-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
    expect(text).not.toMatch(/--profile|AWS_ACCESS_KEY|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN/);
  });

  it('uses only the reviewed public build configuration and OIDC role', async () => {
    const text = await workflow('deploy-preview-web.yml');
    expect(text).toContain('NUXT_PUBLIC_SITE_URL: https://d2via50thoheqm.cloudfront.net');
    expect(text).toContain('NUXT_PUBLIC_API_BASE_PATH: /api/v1');
    expect(text).toContain('NUXT_PUBLIC_COGNITO_AUTHORITY: https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_nmj9cP9st');
    expect(text).toContain('NUXT_PUBLIC_COGNITO_CLIENT_ID: 1olddro3tldfinupl52u9dl1j4');
    expect(text).toContain('role-to-assume: arn:aws:iam::470447451992:role/itsrun-preview-github-web-deploy');
    expect(text).toContain('aws-region: ap-northeast-1');
    expect(text).toMatch(/role-session-name: itsrun-preview-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
    expect(text).toContain('PREVIEW_BASE_URL: https://d2via50thoheqm.cloudfront.net');
  });
});
