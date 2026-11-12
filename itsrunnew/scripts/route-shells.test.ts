import { copyFile, mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import courses from '../src/data/running-courses.json';
import facilityGuidance from '../src/data/facility-guidance.json';
import guides from '../src/data/legacy-facility-guides.json';
import ja from '../src/locales/ja.json';
import en from '../src/locales/en.json';
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
        copyFile(join(repositoryRoot, 'src/data/legacy-facility-guides.json'), join(workspace, 'src/data/legacy-facility-guides.json')),
        copyFile(join(repositoryRoot, 'src/data/facility-guidance.json'), join(workspace, 'src/data/facility-guidance.json')),
        copyFile(join(repositoryRoot, 'src/data/running-courses.json'), join(workspace, 'src/data/running-courses.json')),
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
      for (const course of courses) for (const locale of ['ja', 'en'] as const) {
        const prefix = locale === 'en' ? '/en' : '';
        const html = await readFile(join(workspace, `dist${prefix}/courses/${course.id}/index.html`), 'utf8');
        expect(html).toContain('data-static-course-detail');
        expect(html).toContain(`<h1>${escapeHtml(course.name[locale])}</h1>`);
        expect(html).toContain(`<link rel="canonical" href="https://itsrun.info${prefix}/courses/${course.id}">`);
        expect(html).toContain(escapeHtml(course.urls.map));
        expect(html).toContain(locale === 'en' ? 'usual conditions' : '通常の利用条件');
        for (const rule of course.rules) expect(html).toContain(escapeHtml(rule[locale]));
        for (const source of course.sources) expect(html).toContain(escapeHtml(source.url));
        expect(html).not.toContain('openingHoursSpecification');
      }
      const dataset = JSON.parse(await readFile(join(repositoryRoot, 'src/data/tracks.json'), 'utf8'));
      const oizumiTrack = dataset.find((track: { id: string }) => track.id.includes('oizumi'));
      expect(oizumiTrack).toBeTruthy();
      const nearbyHtml = await readFile(join(workspace, `dist/tracks/${oizumiTrack.id}/index.html`), 'utf8');
      expect(nearbyHtml).toContain('href="/courses/wako-jurin-jogging"');
      for (const [id, entry] of Object.entries(facilityGuidance)) {
        for (const locale of ['ja', 'en'] as const) {
          const prefix = locale === 'en' ? '/en' : '';
          const html = await readFile(join(workspace, `dist${prefix}/tracks/${id}/index.html`), 'utf8');
          for (const paragraph of entry[locale].paragraphs) expect(html).toContain(escapeHtml(paragraph));
          for (const link of entry[locale].links) expect(html).toContain(escapeHtml(link.url));
          const copy = entry[locale];
          if ('title' in copy) expect(html).toContain(`<title>${escapeHtml(copy.title)}</title>`);
          if ('description' in copy) expect(html).toContain(escapeHtml(copy.description));
        }
      }
      for (const [id, guide] of Object.entries(guides)) {
        for (const locale of ['ja', 'en'] as const) {
          const prefix = locale === 'en' ? '/en' : '';
          const html = await readFile(join(workspace, `dist${prefix}/tracks/${id}/index.html`), 'utf8');
          const copy = (locale === 'en' ? en : ja)[guide.localeKey as 'yume' | 'komazawa' | 'todoroki'];
          expect(html).toContain('data-legacy-facility');
          expect(html).toContain(escapeHtml(copy.access_1));
          if ('tel' in copy) expect(html).toContain(escapeHtml(copy.tel));
          if ('opinion_1' in copy) {
            expect(html).toContain(escapeHtml(copy.opinion_1));
            expect(html).toContain(locale === 'en' ? 'do not describe current availability' : '現在の利用状況や設備・混雑を示すものではありません');
          }
          expect(html).toContain(`<link rel="canonical" href="https://itsrun.info${prefix}/tracks/${id}">`);
        }
      }
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }, 30_000);
});
