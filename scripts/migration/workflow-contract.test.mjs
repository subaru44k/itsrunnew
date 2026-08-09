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
    expect(text).toMatch(/permissions:\s*\n\s+contents:\s*read/);
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
    expect(text).toContain('npm ci');
    expect(text).toContain('npm run check');
    expect(text).toContain('npm run test:e2e');
    expect(text).toContain('playwright install --with-deps chromium');
    expect(text).not.toMatch(/upload-artifact|cdk\.out|\.artifacts\/migration|\.env|AWS_ACCESS_KEY|AWS_SECRET/);
  });
});
