import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const featureTests = {
  ops: ['scripts/availability/health', 'scripts/availability/monitor', 'scripts/availability/published-range', 'scripts/availability/freshness', 'scripts/scheduler', 'infra/itsrun-scheduler-stack.test.ts'],
  pace: ['src/model/marathon.test.ts', 'src/components/laptime'],
  archives: ['src/data/athlete-archives.test.ts', 'src/data/competition-label.test.ts'],
  reports: ['src/services/field-reports.test.ts', 'backend/field-reports'],
};
export function selectUnitTests(daily, suites, unitScope) {
  if (daily === 'false' && suites === '' && unitScope === 'ops') return [...featureTests.ops];
  // Missing/unknown scope always runs the entire suite.
  if (daily !== 'false' || !suites) return [];
  const selected = suites.split(',').filter(Boolean);
  if (!selected.length || selected.some(suite => !(suite in featureTests))) return [];
  return [...new Set(selected.flatMap(suite => featureTests[suite]))].sort();
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tests = selectUnitTests(process.env.ITSRUN_FULL_VALIDATION, process.env.ITSRUN_TEST_SUITES, process.env.ITSRUN_UNIT_SCOPE);
  console.log(`Unit scope: ${tests.length ? tests.join(', ') : 'all tests'}`);
  const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...tests], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
