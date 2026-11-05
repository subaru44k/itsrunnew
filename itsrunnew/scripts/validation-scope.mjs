import { execFileSync } from 'node:child_process';
import { appendFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Unknown/shared/structural changes retain the full regression boundary.
const allSuites = 'pace,archives,reports,schedule';
export function validationScope(paths, structuralChange = false) {
  if (paths.length && paths.every(path => path.endsWith('.md'))) return { docs_only: true, daily: false, suites: '' };
  const full = { docs_only: false, daily: true, suites: allSuites };
  if (!paths.length || structuralChange) return full;
  const suites = new Set();
  for (const path of paths) {
    if (path.endsWith('.md')) continue;
    if (/^itsrunnew\/src\/(?:components\/laptime\/[^/]+\.(?:vue|ts)|model\/(?:marathon(?:\.test)?|LapTimeCalculator)\.ts|views\/LapTime\.vue)$/.test(path)) suites.add('pace');
    else if (/^itsrunnew\/src\/(?:views\/(?:NozomiAntena|RyujiMiura|OjiroHonda|YotaMashiko|HarukiNiizuma)\.vue|components\/AthleteArchive\.vue|data\/(?:(?:nozomi|ryuji|ojiro-honda|yota-mashiko|haruki-niizuma|ekiden|regional)-results\.json|athlete-archives(?:\.test)?\.ts|competition-label(?:\.test)?\.ts|competition-names-ja\.json))$/.test(path)) suites.add('archives');
    else if (/^itsrunnew\/(?:src\/(?:components\/FieldReports\.vue|services\/field-reports(?:\.test)?\.ts)|backend\/field-reports\/[^/]+)$/.test(path)) suites.add('reports');
    else return full;
  }
  return { docs_only: false, daily: false, suites: [...suites].sort().join(',') };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  let scope = validationScope([]);
  const base = process.env.BASE_SHA;
  if (base && /^[a-f0-9]{40}$/i.test(base) && !/^0+$/.test(base)) {
    let available = false;
    try {
      git(['cat-file', '-e', `${base}^{commit}`]);
      available = true;
    } catch {
      console.log('Comparison base unavailable; running full validation.');
    }
    if (available) {
      // A known diff with whitespace errors must fail, never become a skip.
      git(['diff', '--check', base, 'HEAD']);
      const paths = git(['diff', '--name-only', '-z', base, 'HEAD']).split('\0').filter(Boolean);
      const structural = git(['diff', '--name-only', '--diff-filter=DR', '--no-renames', '-z', base, 'HEAD']).length > 0;
      scope = validationScope(paths, structural);
    }
  }
  const output = Object.entries(scope).map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
  console.log(output);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `Validation scope: ${scope.docs_only ? 'Markdown only' : scope.daily ? 'full daily regression' : 'independent feature'}; browser suites: ${scope.suites || 'none'}\n`);
}
