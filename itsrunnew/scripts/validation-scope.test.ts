import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validationScope } from './validation-scope.mjs';

describe('validation scope safety boundary', () => {
  it('keeps lightweight checks only for Markdown', () => {
    expect(validationScope(['AGENTS.md', 'docs/SITE_STRUCTURE.md'])).toEqual({ docs_only: true, daily: false, suites: '' });
  });
  it('omits daily only for independent pace and results changes', () => {
    expect(validationScope(['itsrunnew/src/components/laptime/pace-image.ts', 'itsrunnew/src/model/marathon.ts', 'itsrunnew/src/views/LapTime.vue'])).toEqual({ docs_only: false, daily: false, suites: 'pace' });
    expect(validationScope(['itsrunnew/src/data/ryuji-results.json', 'itsrunnew/src/views/NozomiAntena.vue', 'docs/SITE_STRUCTURE.md']).daily).toBe(false);
  });
  it('selects all current archive data/views and report behavior without live collection', () => {
    for (const path of ['src/views/OjiroHonda.vue', 'src/views/YotaMashiko.vue', 'src/views/HarukiNiizuma.vue', 'src/components/AthleteArchive.vue', 'src/data/ekiden-results.json', 'src/data/regional-results.json', 'src/data/competition-names-ja.json']) {
      expect(validationScope([`itsrunnew/${path}`])).toEqual({ docs_only: false, daily: false, suites: 'archives' });
    }
    expect(validationScope(['itsrunnew/src/components/FieldReports.vue'])).toEqual({ docs_only: false, daily: false, suites: 'reports' });
    expect(validationScope(['itsrunnew/src/views/LapTime.vue', 'itsrunnew/src/views/OjiroHonda.vue']).suites).toBe('archives,pace');
    expect(validationScope(['itsrunnew/src/App.vue']).suites).toBe('pace,archives,reports,schedule');
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

it('uses real Git diffs for independent/mixed/renamed files and fails on whitespace', () => {
  const root = mkdtempSync(join(tmpdir(), 'itsrun-validation-scope-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  try {
    mkdirSync(join(root, 'itsrunnew/scripts'), { recursive: true });
    mkdirSync(join(root, 'itsrunnew/src/views'), { recursive: true });
    const script = join(root, 'itsrunnew/scripts/validation-scope.mjs');
    copyFileSync(new URL('./validation-scope.mjs', import.meta.url), script);
    copyFileSync(new URL('./release-scope.mjs', import.meta.url), join(root, 'itsrunnew/scripts/release-scope.mjs'));
    const pace = join(root, 'itsrunnew/src/views/LapTime.vue');
    const shared = join(root, 'itsrunnew/src/App.vue');
    writeFileSync(pace, 'baseline\n');
    git('init', '-q');
    git('config', 'user.name', 'Validation Test');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'commit.gpgsign', 'false');
    git('config', 'core.hooksPath', '/dev/null');
    const commit = () => { git('add', '.'); git('commit', '-qm', 'test revision'); return git('rev-parse', 'HEAD'); };
    let base = commit();
    const run = () => spawnSync(process.execPath, [script], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, BASE_SHA: base, GITHUB_OUTPUT: '', GITHUB_STEP_SUMMARY: '' },
    });
    writeFileSync(pace, 'pace change\n'); commit();
    expect(run().stdout).toContain('daily=false');
    writeFileSync(shared, 'shared change\n'); commit();
    expect(run().stdout).toContain('daily=true');
    base = git('rev-parse', 'HEAD');
    git('mv', 'itsrunnew/src/views/LapTime.vue', 'itsrunnew/src/views/NozomiAntena.vue'); commit();
    expect(run().stdout).toContain('daily=true');
    base = git('rev-parse', 'HEAD');
    writeFileSync(shared, 'bad whitespace   \n'); commit();
    expect(run().status).not.toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 20000);
