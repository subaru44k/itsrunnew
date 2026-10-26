import { afterEach, expect, it, vi } from 'vitest';
import { selectViewports } from './test-viewports.mjs';
const viewports = [{ width: 1440, height: 1000 }, { width: 390, height: 844 }];
afterEach(() => vi.unstubAllEnvs());
it('partitions desktop/mobile without dropping or duplicating coverage', () => {
  vi.stubEnv('ITSRUN_TEST_VIEWPORT', 'desktop');
  const desktop = selectViewports(viewports);
  vi.stubEnv('ITSRUN_TEST_VIEWPORT', 'mobile');
  const mobile = selectViewports(viewports);
  expect([...desktop, ...mobile]).toEqual(viewports);
  expect(desktop).toHaveLength(1);
  expect(mobile).toHaveLength(1);
  vi.stubEnv('ITSRUN_TEST_VIEWPORT', 'all');
  expect(selectViewports(viewports)).toEqual(viewports);
});
it('rejects an unknown worker instead of silently running no tests', () => {
  vi.stubEnv('ITSRUN_TEST_VIEWPORT', 'phone');
  expect(() => selectViewports(viewports)).toThrow('Invalid test viewport');
});
