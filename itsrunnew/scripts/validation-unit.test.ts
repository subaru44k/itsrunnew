import { describe, expect, it } from 'vitest';
import { selectUnitTests } from './validation-unit.mjs';
describe('affected unit scope', () => {
  it('uses focused independent suites and unions mixed feature changes', () => {
    expect(selectUnitTests('false', 'pace')).toEqual(['src/components/laptime', 'src/model/marathon.test.ts']);
    expect(selectUnitTests('false', '', 'ops')).toContain('scripts/availability/monitor');
    expect(selectUnitTests('false', 'reports')).toContain('backend/field-reports');
    expect(selectUnitTests('false', 'archives,pace')).toEqual(['src/components/laptime', 'src/data/athlete-archives.test.ts', 'src/data/competition-label.test.ts', 'src/model/marathon.test.ts']);
  });
  it('keeps every test for unknown, shared, structural or missing scope', () => {
    for (const [full, suites] of [['true', 'pace'], [undefined, 'pace'], ['false', ''], ['false', 'new-suite'], ['false', 'pace,schedule']]) expect(selectUnitTests(full, suites)).toEqual([]);
  });
});
