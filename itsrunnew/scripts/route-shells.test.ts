import { copyFile, mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import pageMetadata from '../src/data/page-metadata.json';

const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const shellGenerator = resolve(repositoryRoot, 'scripts/generate-track-route-shells.mjs');
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character] ?? character);

describe('fixed route shells', () => {
  it('generates self-canonical metadata for every Japanese and English fixed route', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'itsrun-route-shells-'));
    try {
      await Promise.all([
        mkdir(join(workspace, 'src/data'), { recursive: true }),
        mkdir(join(workspace, 'src/locales'), { recursive: true }),
        mkdir(join(workspace, 'dist'), { recursive: true }),
      ]);
      await Promise.all([
        copyFile(join(repositoryRoot, 'src/data/tracks.json'), join(workspace, 'src/data/tracks.json')),
        copyFile(join(repositoryRoot, 'src/data/page-metadata.json'), join(workspace, 'src/data/page-metadata.json')),
        copyFile(join(repositoryRoot, 'src/locales/ja.json'), join(workspace, 'src/locales/ja.json')),
        copyFile(join(repositoryRoot, 'src/locales/en.json'), join(workspace, 'src/locales/en.json')),
        copyFile(join(repositoryRoot, 'index.html'), join(workspace, 'dist/index.html')),
      ]);

      await execFileAsync(process.execPath, [shellGenerator], { cwd: workspace });

      for (const page of Object.values(pageMetadata)) {
        for (const locale of ['ja', 'en'] as const) {
          const prefix = locale === 'en' ? '/en' : '';
          const path = page.path ? `${prefix}/${page.path}` : (locale === 'en' ? '/en/' : '/');
          const alternateJa = page.path ? `/${page.path}` : '/';
          const alternateEn = page.path ? `/en/${page.path}` : '/en/';
          const html = await readFile(join(workspace, 'dist', path, 'index.html'), 'utf8');
          expect(html).toContain(`<html lang="${locale}"`);
          expect(html).toContain(`<title>${escapeHtml(page[`${locale}Title`])}</title>`);
          expect(html).toContain(`<meta name="description" content="${escapeHtml(page[`${locale}Description`])}">`);
          expect(html).toContain(`<link rel="canonical" href="https://itsrun.info${path}">`);
          expect(html).toContain(`<link rel="alternate" hreflang="ja" href="https://itsrun.info${alternateJa}">`);
          expect(html).toContain(`<link rel="alternate" hreflang="en" href="https://itsrun.info${alternateEn}">`);
          expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="https://itsrun.info${alternateJa}">`);
        }
      }
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }, 30_000);
});
