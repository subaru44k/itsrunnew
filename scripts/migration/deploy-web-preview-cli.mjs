import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { deployWebPreview, parseWebDeployArgs, prepareWebReportTarget, writeWebReport, WEB_DEPLOY_TARGET } from './deploy-web-preview.mjs'

export function createAwsRunner(mode, env = process.env, execImpl = execFile) {
  const executable = mode === 'operator' ? '/usr/local/aws-cli/aws' : '/usr/local/bin/aws'
  const keys = mode === 'github' ? ['PATH', 'HOME', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'] : ['PATH', 'HOME']
  const childEnv = Object.fromEntries(keys.filter((key) => env[key]).map((key) => [key, env[key]]))
  return async (args) => {
    const global = ['--region', WEB_DEPLOY_TARGET.region]
    if (mode === 'operator') global.push('--profile', 'codex-prod')
    const finalArgs = [...args, ...global, '--no-cli-pager', '--output', 'json']
    try {
      const result = await promisify(execImpl)(executable, finalArgs, { env: childEnv, maxBuffer: 1024 * 1024, timeout: 60000 })
      try { return JSON.parse(result.stdout) } catch { throw new Error('invalid command response') }
    } catch { const error = new Error('web deployment command failed'); error.category = 'command'; throw error }
  }
}

export async function main(argv = process.argv.slice(2), env = process.env, dependencies = {}) {
  if (argv.includes('--help')) return 'usage: --mode operator|github --web-dir /absolute/build --report-dir /absolute/reports [--profile codex-prod]'
  const parsed = parseWebDeployArgs(argv)
  const workspaceRoot = dependencies.workspaceRoot ?? process.cwd()
  const handle = await prepareWebReportTarget(workspaceRoot, parsed.reportDir, dependencies.fsApi)
  try {
    const report = await deployWebPreview({ ...parsed, ...WEB_DEPLOY_TARGET, env }, { runAws: createAwsRunner(parsed.mode, env, dependencies.execImpl), fetchImpl: dependencies.fetchImpl, now: dependencies.now, sleep: dependencies.sleep, maxAttempts: dependencies.maxAttempts, timeoutMs: dependencies.timeoutMs })
    await writeWebReport(handle, report, dependencies.fsApi)
    return report
  } catch (error) {
    const failed = { schemaVersion: 1, status: 'failed', category: error?.category ?? 'deployment', attemptedCount: error?.attemptedCount ?? 0, uploadedCount: error?.uploadedCount ?? 0, verifiedCount: error?.verifiedCount ?? 0 }
    await writeWebReport(handle, failed, dependencies.fsApi).catch(() => {})
    throw error?.category ? error : new Error('web deployment failed')
  }
}

if (process.argv[1]?.endsWith('deploy-web-preview-cli.mjs')) main().then((result) => { if (typeof result === 'string') console.log(result) }).catch(() => { process.exitCode = 2 })
