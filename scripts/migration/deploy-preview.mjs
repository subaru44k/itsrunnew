import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

export function cacheControlForWebObject(key) {
  if (key.endsWith('.html') || key.endsWith('_payload.json') || key === '_nuxt/builds/latest.json') {
    return 'no-cache, no-store, must-revalidate'
  }
  const hashedAsset = key.startsWith('_nuxt/') && (/(^|\/)[A-Za-z0-9_.-]*[A-Za-z0-9_-]{8,}\.[^/]+$/.test(key) || /^_nuxt\/builds\/[^/]+\.json$/.test(key))
  if (hashedAsset) return 'public, max-age=31536000, immutable'
  return 'public, max-age=86400'
}

export function webObjectUploadCommands(webDir, webBucket, keys) {
  const rank = (key) => cacheControlForWebObject(key).includes('no-cache') ? 2 : cacheControlForWebObject(key).includes('immutable') ? 0 : 1
  return [...keys].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map((key) => [
    's3', 'cp', resolve(webDir, key), `s3://${webBucket}/${key}`, '--cache-control', cacheControlForWebObject(key),
  ])
}

function required(name) {
  const index = process.argv.indexOf(`--${name}`)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (!value) throw new Error(`Missing --${name}`)
  return value
}
function aws(args, profile, region, input) {
  return execFileSync('aws', [...args, '--region', region], { env: { ...process.env, AWS_PROFILE: profile }, input, encoding: 'utf8' })
}
async function files(root, prefix = '') {
  const entries = await readdir(resolve(root, prefix), { withFileTypes: true })
  const result = []
  for (const entry of entries) {
    const key = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) result.push(...await files(root, key))
    else result.push(key)
  }
  return result
}
export async function readCloudFrontObject(domain, key, expectedHash, expectedCacheControl, options = {}) {
  const fetchImpl = options.fetchImpl || fetch
  const sleep = options.sleep || ((milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds)))
  const now = options.now || Date.now
  const timeoutMs = options.timeoutMs ?? 120_000
  const maxAttempts = options.maxAttempts ?? 40
  const url = `https://${domain}/${key}`
  const deadline = now() + timeoutMs
  let lastError
  let attempts = 0
  while (attempts < maxAttempts && (attempts === 0 || now() < deadline)) {
    attempts += 1
    try {
      const response = await fetchImpl(url)
      const body = Buffer.from(await response.arrayBuffer())
      const hash = createHash('sha256').update(body).digest('hex')
      const contentType = response.headers.get('content-type') || ''
      const cacheControl = response.headers.get('cache-control') || ''
      if (response.status !== 200) throw new Error(`${key}: expected 200, got ${response.status}`)
      if (!contentType.includes('application/json')) throw new Error(`${key}: unexpected content-type ${contentType}`)
      const normalizeCache = (value) => value.split(',').map((part) => part.trim()).filter(Boolean).sort().join(',')
      if (normalizeCache(cacheControl) !== normalizeCache(expectedCacheControl)) throw new Error(`${key}: unexpected cache-control ${cacheControl}`)
      if (hash !== expectedHash) throw new Error(`${key}: CloudFront hash mismatch`)
      return
    } catch (error) {
      lastError = error
      if (attempts < maxAttempts && now() < deadline) await sleep(3000)
    }
  }
  throw new Error(`CloudFront verification timed out: ${lastError instanceof Error ? lastError.message : lastError}`)
}

async function main() {
  const profile = required('profile')
  const region = required('region')
  const account = required('account')
  const outputsFile = resolve(required('stack-outputs'))
  const webDir = resolve(required('web-dir'))
  const seedRoot = resolve(required('seed-root'))
  const outputs = JSON.parse(await readFile(outputsFile, 'utf8'))
  const stack = outputs.ItsRunPreviewHosting || Object.values(outputs)[0]
  if (!stack?.WebBucketName || !stack?.DataBucketName || !stack?.DistributionDomainName || !stack?.DistributionId) throw new Error('Stack outputs do not contain preview hosting outputs')
  const identity = JSON.parse(aws(['sts', 'get-caller-identity'], profile, region))
  if (identity.Account !== account) throw new Error(`Account mismatch: expected ${account}, got ${identity.Account}`)
  const webBucket = stack.WebBucketName
  const dataBucket = stack.DataBucketName
  const run = (args) => aws(args, profile, region)
  const webKeys = await files(webDir)
  for (const args of webObjectUploadCommands(webDir, webBucket, webKeys)) run(args)
  const manifest = JSON.parse(await readFile(resolve(seedRoot, 'manifest.json'), 'utf8'))
  if (manifest.source !== 'non-production fixture') throw new Error('Refusing to upload non-fixture data')
  for (const object of manifest.objects) {
    const local = resolve(seedRoot, object.key)
    run(['s3', 'cp', local, `s3://${dataBucket}/${object.key}`, '--content-type', 'application/json', '--cache-control', object.cacheControl])
    const downloaded = aws(['s3', 'cp', `s3://${dataBucket}/${object.key}`, '-'], profile, region)
    const hash = createHash('sha256').update(downloaded).digest('hex')
    if (hash !== object.sha256) throw new Error(`Uploaded hash mismatch: ${object.key}`)
    await readCloudFrontObject(stack.DistributionDomainName, object.key, object.sha256, object.cacheControl)
  }
  console.log(`Uploaded ${webKeys.length} web objects to ${webBucket} and ${manifest.objects.length} fixture objects to ${dataBucket}; CloudFront verification passed`)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) await main()
