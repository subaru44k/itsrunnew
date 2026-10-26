import { describe, expect, it } from 'vitest';
import { validationScope } from './validation-scope.mjs';

describe('validation scope safety boundary', () => {
  it('keeps lightweight checks only for Markdown', () => {
    expect(validationScope(['AGENTS.md', 'docs/SITE_STRUCTURE.md'])).toEqual({ docs_only: true, daily: false });
  });
  it('omits daily only for independent pace and results changes', () => {
    expect(validationScope(['itsrunnew/src/components/laptime/pace-image.ts', 'itsrunnew/src/model/marathon.ts', 'itsrunnew/src/views/LapTime.vue'])).toEqual({ docs_only: false, daily: false });
    expect(validationScope(['itsrunnew/src/data/ryuji-results.json', 'itsrunnew/src/views/NozomiAntena.vue', 'docs/SITE_STRUCTURE.md']).daily).toBe(false);
  });
  it.each(['src/App.vue', 'src/styles.css', 'src/locales/ja.json', 'src/views/TrackDetail.vue', 'src/data/tracks.json', 'src/model/availability.ts', 'scripts/smoke.mjs', 'scripts/browser-check.mjs', 'scripts/availability/collect.ts', 'package-lock.json', 'vite.config.ts', 'unknown.ts'])('requires full daily for %s, even mixed with a pace change', path => {
    expect(validationScope([`itsrunnew/${path}`, 'itsrunnew/src/views/LapTime.vue']).daily).toBe(true);
  });
  it('fails closed for missing diff, workflow changes, deletion and rename', () => {
    expect(validationScope([]).daily).toBe(true);
    expect(validationScope(['.github/workflows/node-validation.yml']).daily).toBe(true);
    expect(validationScope(['itsrunnew/src/views/LapTime.vue'], true).daily).toBe(true);
  });
});
