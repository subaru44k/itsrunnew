import { relative, resolve, sep, isAbsolute } from 'node:path'
import { runAwsJson, uploadSealedMigrationRun } from './firestore-upload.mjs'

const PROFILE = 'codex-prod'
const ACCOUNT = '470447451992'
const REGION = 'ap-northeast-1'
const BUCKET = 'itsrun-preview-data-470447451992-ap-northeast-1'
const DOMAIN = 'd2via50thoheqm.cloudfront.net'
const MANIFEST_SHA256 = '2d6000e0a56026abc1bdad91717d4627d942b6cef2d19e729239c5192000eb16'
const PREFIX = 'data/v1/stadiums/'
const OBJECT_COUNT = 74
const ENV_KEYS = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_WEB_IDENTITY_TOKEN_FILE', 'AWS_ROLE_ARN', 'AWS_PROFILE', 'AWS_DEFAULT_PROFILE']

const beneath = (root, candidate) => { const rel = relative(resolve(root), resolve(candidate)); return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel) }
const directChild = (root, candidate) => beneath(root, candidate) && !relative(resolve(root), resolve(candidate)).includes(sep)
const validRunName = (value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value)
const usage = () => 'Usage: node scripts/migration/firestore-upload-cli.mjs --run <sealed-run-name> --report <report-run-name>'

export function parseUploadCliArgs(argv) {
  if (argv.length === 1 && argv[0] === '--help') return { help: true }
  if (argv.length !== 4 || argv[0] !== '--run' || argv[2] !== '--report' || !validRunName(argv[1]) || !validRunName(argv[3])) throw new Error('invocation')
  return { runName: argv[1], reportName: argv[3] }
}

export async function main(argv = process.argv.slice(2), env = process.env, { cwd = process.cwd(), runAws, fetch, execFile, fsImpl } = {}) {
  let args
  try { args = parseUploadCliArgs(argv) } catch { return 2 }
  if (args.help) { console.log(usage()); return 0 }
  if (!env || ENV_KEYS.some((key) => env[key])) return 2
  const artifactRoot = resolve(cwd, '.artifacts/migration'); const runDir = resolve(artifactRoot, args.runName); const reportDir = resolve(artifactRoot, args.reportName)
  if (!directChild(artifactRoot, runDir) || !directChild(artifactRoot, reportDir) || runDir === reportDir) return 2
  const config = { profile: PROFILE, account: ACCOUNT, region: REGION, bucket: BUCKET, distributionDomain: DOMAIN, manifestSha256: MANIFEST_SHA256, objectCount: OBJECT_COUNT, allowedPrefix: PREFIX, runDir, manifestPath: resolve(runDir, 'manifest.json'), env }
  const approvedTarget = Object.freeze({ bucket: BUCKET, distributionDomain: DOMAIN })
  const aws = runAws ?? ((args) => runAwsJson(execFile, args)); const fetcher = fetch ?? globalThis.fetch
  if (typeof aws !== 'function' || typeof fetcher !== 'function') return 2
  try { const result = await uploadSealedMigrationRun(config, { runAws: aws, fetch: fetcher, approvedTarget, fsImpl, reportDir }); return result.report.status === 'match' ? 0 : 2 } catch { return 2 }
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = await main()
