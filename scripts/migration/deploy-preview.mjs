import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { relative, resolve } from 'node:path'

export function cacheControlForWebObject(key) {
  if (key.endsWith('.html') || key.endsWith('_payload.json') || key === '_nuxt/builds/latest.json') {
    return 'no-cache, no-store, must-revalidate'
  }
  const hashedAsset = key.startsWith('_nuxt/') && (/(^|\/)[A-Za-z0-9_.-]*[A-Za-z0-9_-]{8,}\.[^/]+$/.test(key) || /^_nuxt\/builds\/[^/]+\.json$/.test(key))
  if (hashedAsset) return 'public, max-age=31536000, immutable'
  return 'public, max-age=86400'
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
export async function readCloudFrontObject(domain, key, expectedHash, expectedCacheControl) {
  const url = `https://${domain}/${key}`
  const deadline = Date.now() + 120_000
  let lastError
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      const body = Buffer.from(await response.arrayBuffer())
      const hash = createHash('sha256').update(body).digest('hex')
      const contentType = response.headers.get('content-type') || ''
      const cacheControl = response.headers.get('cache-control') || ''
      if (response.status !== 200) throw new Error(`${key}: expected 200, got ${response.status}`)
      if (!contentType.includes('application/json')) throw new Error(`${key}: unexpected content-type ${contentType}`)
      if (!cacheControl.includes(expectedCacheControl)) throw new Error(`${key}: unexpected cache-control ${cacheControl}`)
      if (hash !== expectedHash) throw new Error(`${key}: CloudFront hash mismatch`)
      return
    } catch (error) {
      lastError = error
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 3000))
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
  if (!stack?.WebBucketName || !stack?.DataBucketName || !stack?.DistributionDomainName) throw new Error('Stack outputs do not contain preview hosting outputs')
  const identity = JSON.parse(aws(['sts', 'get-caller-identity'], profile, region))
  if (identity.Account !== account) throw new Error(`Account mismatch: expected ${account}, got ${identity.Account}`)
  const webBucket = stack.WebBucketName
  const dataBucket = stack.DataBucketName
  const run = (args) => aws(args, profile, region)
  const webKeys = await files(webDir)
  for (const key of webKeys) {
    const cacheControl = cacheControlForWebObject(key)
    run(['s3', 'cp', resolve(webDir, key), `s3://${webBucket}/${key}`, '--cache-control', cacheControl])
  }
  const manifest = JSON.parse(await readFile(resolve(seedRoot, 'manifest.json'), 'utf8'))
  if (manifest.source !== 'non-production fixture') throw new Error('Refusing to upload non-fixture data')
  for (const object of manifest.objects) {
    const local = resolve(seedRoot, object.key)
    run(['s3', 'cp', local, `s3://${dataBucket}/${object.key}`, '--content-type', 'application/json', '--cache-control', object.cacheControl])
    const downloaded = aws(['s3', 'cp', `s3://${dataBucket}/${object.key}`, '-'], profile, region)
    const hash = createHash('sha256').update(downloaded).digest('hex')
    if (hash !== object.sha256) throw new Error(`Uploaded hash mismatch: ${object.key}`)
    await readCloudFrontObject(stack.DistributionDomainName, object.key, object.sha256, 'max-age=0')
  }
  console.log(`Uploaded ${webKeys.length} web objects to ${webBucket} and ${manifest.objects.length} fixture objects to ${dataBucket}; CloudFront verification passed`)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) await main()
