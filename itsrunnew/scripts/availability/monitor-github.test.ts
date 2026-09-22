import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { restoreMonitorInputs } from './monitor-github.mjs';

const directories: string[] = [];
const scratch = async () => { const directory = await mkdtemp(join(tmpdir(), 'monitor-github-test-')); directories.push(directory); return directory; };
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
describe('monitor history restoration', () => {
  it('allows first run without history and checks production independently', async () => {
    const directory = await scratch();
    const gh = vi.fn().mockResolvedValueOnce('[]').mockResolvedValueOnce('[{"databaseId":1,"updatedAt":"2026-09-22T01:00:00Z"}]').mockResolvedValueOnce('{"jobs":[{"conclusion":"success"}]}');
    await restoreMonitorInputs({ repository: 'owner/repo', directory, productionEnabled: true, gh });
    expect(JSON.parse(await readFile(join(directory, 'pipeline.json'), 'utf8'))).toEqual({ enabled: true, lastSuccessAt: '2026-09-22T01:00:00Z' });
    expect(gh.mock.calls.filter(([args]) => args[1] === 'list').every(([args]) => args.includes('master') && args.includes('success'))).toBe(true);
  });
  it('skips disabled jobs and restores only the last successful delivered state', async () => {
    const directory = await scratch();
    const gh = vi.fn().mockResolvedValueOnce('[{"databaseId":3},{"databaseId":2}]')
      .mockResolvedValueOnce('{"jobs":[{"conclusion":"skipped"}]}')
      .mockResolvedValueOnce('{"jobs":[{"conclusion":"success"}]}').mockImplementationOnce(async () => {
        await mkdir(join(directory, 'previous'));
        await writeFile(join(directory, 'previous', 'state.json'), '{}');
        return '';
      });
    await restoreMonitorInputs({ repository: 'owner/repo', directory, productionEnabled: false, gh });
    expect(gh.mock.calls.at(-1)?.[0]).toEqual(['run', 'download', '2', '--repo', 'owner/repo', '--name', 'availability-monitor-state', '--dir', join(directory, 'previous')]);
    expect(JSON.parse(await readFile(join(directory, 'pipeline.json'), 'utf8'))).toEqual({ enabled: false, lastSuccessAt: null });
  });
  it('does not turn expired or inaccessible history into a fresh baseline', async () => {
    const directory = await scratch();
    const gh = vi.fn().mockResolvedValueOnce('[{"databaseId":2}]').mockResolvedValueOnce('{"jobs":[{"conclusion":"success"}]}').mockRejectedValueOnce(new Error('artifact expired'));
    await expect(restoreMonitorInputs({ repository: 'owner/repo', directory, productionEnabled: false, gh })).rejects.toThrow('artifact expired');
  });
  it('rejects a downloaded artifact that does not contain state.json', async () => {
    const directory = await scratch();
    const gh = vi.fn().mockResolvedValueOnce('[{"databaseId":2}]').mockResolvedValueOnce('{"jobs":[{"conclusion":"success"}]}').mockResolvedValueOnce('');
    await expect(restoreMonitorInputs({ repository: 'owner/repo', directory, productionEnabled: false, gh })).rejects.toThrow(/ENOENT/);
  });
  it('does not count skipped Production jobs as a successful update', async () => {
    const directory = await scratch();
    const gh = vi.fn().mockResolvedValueOnce('[]').mockResolvedValueOnce('[{"databaseId":1,"updatedAt":"2026-09-22T01:00:00Z"}]').mockResolvedValueOnce('{"jobs":[{"conclusion":"skipped"}]}');
    await restoreMonitorInputs({ repository: 'owner/repo', directory, productionEnabled: true, gh });
    expect(JSON.parse(await readFile(join(directory, 'pipeline.json'), 'utf8')).lastSuccessAt).toBeNull();
  });
  it('propagates API failures instead of claiming no incident', async () => {
    const gh = vi.fn().mockRejectedValueOnce(new Error('API unavailable'));
    await expect(restoreMonitorInputs({ repository: 'owner/repo', directory: await scratch(), productionEnabled: true, gh })).rejects.toThrow('API unavailable');
  });
});

const workflow = await readFile(new URL('../../../.github/workflows/availability-monitor.yml', import.meta.url), 'utf8');
it('runs monitoring independently without deploy permissions and persists only after email succeeds', () => {
  expect(workflow).toContain("cron: '15 22 * * *'");
  expect(workflow).toContain("github.ref == 'refs/heads/master'");
  expect(workflow).toContain('actions: read');
  expect(workflow).not.toMatch(/id-token:|issues:|continue-on-error|deploy:production:content/);
  expect(workflow.indexOf('Save delivered state')).toBeGreaterThan(workflow.indexOf('python3 scripts/availability/monitor-email.py'));
  expect(workflow).toContain('if-no-files-found: error');
  expect(workflow).toContain('retention-days: 90');
});
