import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { restoreMonitorInputs } from './monitor-github.mjs';

const directories: string[] = [];
const scratch = async () => { const directory = await mkdtemp(join(tmpdir(), 'monitor-github-test-')); directories.push(directory); return directory; };
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
describe('monitor history restoration', () => {
  it('restores history without mistaking an application or plan job for a data update', async () => {
    const directory = await scratch();
    const gh = vi.fn().mockResolvedValueOnce('[]');
    await restoreMonitorInputs({ repository: 'owner/repo', directory, productionEnabled: true, gh });
    expect(JSON.parse(await readFile(join(directory, 'pipeline.json'), 'utf8'))).toEqual({ enabled: true, lastSuccessAt: null });
    expect(gh).toHaveBeenCalledTimes(1);
    expect(gh.mock.calls[0][0]).toContain('availability-monitor.yml');
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
  it('propagates API failures instead of claiming no incident', async () => {
    const gh = vi.fn().mockRejectedValueOnce(new Error('API unavailable'));
    await expect(restoreMonitorInputs({ repository: 'owner/repo', directory: await scratch(), productionEnabled: true, gh })).rejects.toThrow('API unavailable');
  });
});

const workflow = await readFile(new URL('../../../.github/workflows/availability-monitor.yml', import.meta.url), 'utf8');
it('runs monitoring independently without deploy permissions and persists only after email succeeds', () => {
  expect(workflow).toContain("cron: '15 1 * * *'");
  expect(workflow).toContain('types: [availability-monitor]');
  expect(workflow).toContain("github.ref == 'refs/heads/master'");
  expect(workflow).toContain('actions: read');
  expect(workflow).not.toMatch(/id-token:|issues:|continue-on-error|deploy:production:content/);
  expect(workflow.indexOf('Save delivered state')).toBeGreaterThan(workflow.indexOf('python3 scripts/availability/monitor-email.py'));
  expect(workflow).toContain('if-no-files-found: error');
  expect(workflow).toContain('retention-days: 90');
  expect(workflow).not.toContain('OPENAI_API_KEY');
  expect(workflow).not.toContain('Install PDF rendering tools');
  expect(workflow).toContain('--published-url');
});
