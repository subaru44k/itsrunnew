import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { deployWebPreview, parseWebDeployArgs, writeWebReport, WEB_DEPLOY_TARGET } from './deploy-web-preview.mjs'

const exec = promisify(execFile)
const aws = async (args, mode) => {
  const global = ['--region', WEB_DEPLOY_TARGET.region]
  if (mode === 'operator') global.push('--profile', 'codex-prod')
  const result = await exec('/usr/local/aws-cli/aws', [...args, ...global], { env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('AWS_'))), maxBuffer: 1024 * 1024 })
  return JSON.parse(result.stdout)
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.includes('--help')) return 'usage: --mode operator|github --web-dir /absolute/build --report-dir /absolute/reports [--profile codex-prod]'
  const parsed = parseWebDeployArgs(argv)
  const report = await deployWebPreview({ ...parsed, ...WEB_DEPLOY_TARGET, env }, { runAws: (args) => aws(args, parsed.mode) })
  await writeWebReport(report, parsed.reportDir)
  return report
}

if (process.argv[1]?.endsWith('deploy-web-preview-cli.mjs')) main().then((result) => { if (typeof result === 'string') console.log(result) }).catch(() => { process.exitCode = 2 })
