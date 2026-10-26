import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Only explicitly independent features may omit the availability regression suites.
// Shared code, dependencies, tooling, renamed/deleted files and unknown paths run all gates.
export function validationScope(paths, structuralChange = false) {
  if (!paths.length || structuralChange) return { docs_only: false, daily: true };
  if (paths.every(path => path.endsWith('.md'))) return { docs_only: true, daily: false };
  const independent = path => path.endsWith('.md')
    || /^itsrunnew\/src\/components\/laptime\/[^/]+\.(vue|ts)$/.test(path)
    || /^itsrunnew\/src\/model\/(marathon(?:\.test)?|LapTimeCalculator)\.ts$/.test(path)
    || /^itsrunnew\/src\/views\/(LapTime|NozomiAntena|RyujiMiura)\.vue$/.test(path)
    || /^itsrunnew\/src\/data\/(nozomi|ryuji)-results\.json$/.test(path);
  return { docs_only: false, daily: !paths.every(independent) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
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
    `Validation scope: ${scope.docs_only ? 'Markdown only' : scope.daily ? 'full daily regression' : 'independent feature: regular smoke, no daily suites'}\n`);
}
