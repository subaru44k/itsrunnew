import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

function required(name) {
  const index = process.argv.indexOf(`--${name}`)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (!value) throw new Error(`Missing --${name}`)
  return value
}
function aws(args, profile, region, input) {
  return execFileSync('aws', [...args, '--region', region], { env: { ...process.env, AWS_PROFILE: profile }, input, encoding: 'utf8' })
}
const profile = required('profile')
const region = required('region')
const account = required('account')
const outputsFile = resolve(required('stack-outputs'))
const webDir = resolve(required('web-dir'))
const seedRoot = resolve(required('seed-root'))
const outputs = JSON.parse(await readFile(outputsFile, 'utf8'))
const stack = outputs.ItsRunPreviewHosting || Object.values(outputs)[0]
if (!stack?.WebBucketName || !stack?.DataBucketName) throw new Error('Stack outputs do not contain bucket names')
const identity = JSON.parse(aws(['sts', 'get-caller-identity'], profile, region))
if (identity.Account !== account) throw new Error(`Account mismatch: expected ${account}, got ${identity.Account}`)
const webBucket = stack.WebBucketName
const dataBucket = stack.DataBucketName
const run = (args) => aws(args, profile, region)
run(['s3', 'cp', webDir, `s3://${webBucket}`, '--recursive', '--exclude', '*.html', '--exclude', '_nuxt/*', '--cache-control', 'public, max-age=86400'])
run(['s3', 'cp', `${webDir}/_nuxt`, `s3://${webBucket}/_nuxt`, '--recursive', '--cache-control', 'public, max-age=31536000, immutable'])
run(['s3', 'cp', webDir, `s3://${webBucket}`, '--recursive', '--exclude', '*', '--include', '*.html', '--cache-control', 'no-cache, no-store, must-revalidate'])
const manifest = JSON.parse(await readFile(resolve(seedRoot, 'manifest.json'), 'utf8'))
if (manifest.source !== 'non-production fixture') throw new Error('Refusing to upload non-fixture data')
for (const object of manifest.objects) {
  const local = resolve(seedRoot, object.key)
  run(['s3', 'cp', local, `s3://${dataBucket}/${object.key}`, '--content-type', 'application/json', '--cache-control', object.cacheControl])
  const downloaded = aws(['s3', 'cp', `s3://${dataBucket}/${object.key}`, '-'], profile, region)
  const hash = createHash('sha256').update(downloaded).digest('hex')
  if (hash !== object.sha256) throw new Error(`Uploaded hash mismatch: ${object.key}`)
}
console.log(`Uploaded web build to ${webBucket} and ${manifest.objects.length} fixture objects to ${dataBucket}`)
