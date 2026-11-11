export function isOperationsPath(path) {
  return /^itsrunnew\/scripts\/availability\/(?:health|monitor|monitor-cli|monitor-github|monitor-email|monitor-failure|published-range)(?:\.test)?\.(?:ts|mjs|py)$/.test(path) ||
    /^itsrunnew\/(?:scripts\/scheduler\/|infra\/(?:itsrun-scheduler-stack(?:\.test)?|scheduler-app)\.ts$)/.test(path) ||
    ['.github/workflows/configure-scheduler.yml', '.github/workflows/availability-monitor.yml'].includes(path);
}

// Publication ownership is separate from how broadly a change must be tested.
export function releaseScope(paths) {
  const result = { deploy_app: false, deploy_data: false };
  if (!paths.length) return { deploy_app: true, deploy_data: true };
  for (const path of paths) {
    if (isOperationsPath(path) || path.startsWith('itsrunnew/backend/field-reports/')) continue;
    if (path.startsWith('itsrunnew/scripts/availability/fixtures/') || path.endsWith('.md') || /(?:\.test\.(?:ts|mjs)|_test\.py)$/.test(path)) continue;
    if (/^itsrunnew\/scripts\/(?:availability|course-availability)\//.test(path) || /^itsrunnew\/src\/data\/availability(?:\/|\.json$)/.test(path)) result.deploy_data = true;
    else if (path === 'itsrunnew/src/data/tracks.json') result.deploy_app = result.deploy_data = true;
    else if (/^itsrunnew\/(?:src|public)\//.test(path)) result.deploy_app = true;
    else if (/^itsrunnew\/scripts\/(?:.*smoke|browser-check|daily-check|daily-fixtures|test-viewports|validation-scope|visual-compare|map-compare)\.mjs$/.test(path)) continue;
    else result.deploy_app = result.deploy_data = true;
  }
  return result;
}
