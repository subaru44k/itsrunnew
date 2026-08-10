import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { deployWebPreview, parseWebDeployArgs, writeWebReport, WEB_DEPLOY_TARGET } from './deploy-web-preview.mjs'

export function createAwsRunner(mode, env = process.env, execImpl = execFile) {
  const executable = mode === 'operator' ? '/usr/local/aws-cli/aws' : '/usr/local/bin/aws'
  const keys = mode === 'github' ? ['PATH', 'HOME', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'] : ['PATH', 'HOME']
  const childEnv = Object.fromEntries(keys.filter((key) => env[key]).map((key) => [key, env[key]]))
  return async (args) => {
    const global = ['--region', WEB_DEPLOY_TARGET.region]
    if (mode === 'operator') global.push('--profile', 'codex-prod')
    const result = await promisify(execImpl)(executable, [...args, ...global], { env: childEnv, maxBuffer: 1024 * 1024 })
    try { return JSON.parse(result.stdout) } catch { throw new Error('aws response') }
  }
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.includes('--help')) return 'usage: --mode operator|github --web-dir /absolute/build --report-dir /absolute/reports [--profile codex-prod]'
  const parsed = parseWebDeployArgs(argv)
  const report = await deployWebPreview({ ...parsed, ...WEB_DEPLOY_TARGET, env }, { runAws: createAwsRunner(parsed.mode, env) })
  await writeWebReport(report, parsed.reportDir)
  return report
}

if (process.argv[1]?.endsWith('deploy-web-preview-cli.mjs')) main().then((result) => { if (typeof result === 'string') console.log(result) }).catch(() => { process.exitCode = 2 })
