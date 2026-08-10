import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { WEB_DEPLOY_TARGET, cacheControlForWebObject, collectWebObjects, deployWebPreview, parseWebDeployArgs, putObjectArgs, verifyWebObject, writeWebReport } from './deploy-web-preview.mjs'

const roots = []
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))} )
async function build() { const root = await mkdtemp(join(tmpdir(), 't15b-')); roots.push(root); await mkdir(join(root, '_nuxt')); await writeFile(join(root, 'index.html'), '<html>ok</html>'); await writeFile(join(root, '_nuxt', 'app.12345678.js'), 'alert(1)'); return root }
const config = (webDir, extra = {}) => ({ mode: 'operator', profile: 'codex-prod', webDir, ...WEB_DEPLOY_TARGET, env: {}, ...extra })
function runner(calls, identity = { Account: WEB_DEPLOY_TARGET.account }) { return async (args) => { calls.push(args); if (args[0] === 'sts') return identity; if (args[0] === 'cloudformation') return { Stacks: [{ StackStatus: 'UPDATE_COMPLETE', Outputs: [{ OutputKey: 'WebBucketName', OutputValue: WEB_DEPLOY_TARGET.bucket }, { OutputKey: 'DistributionDomainName', OutputValue: WEB_DEPLOY_TARGET.domain }] }] }; return {} } }

describe('T15B isolated web deployment', () => {
  it('builds explicit per-object commands and immutable/short/html order', () => { expect(cacheControlForWebObject('index.html')).toContain('no-cache'); expect(putObjectArgs({ key: 'index.html', path: '/tmp/index.html', contentType: 'text/html', cacheControl: cacheControlForWebObject('index.html') }, WEB_DEPLOY_TARGET.bucket)[1]).toBe('put-object') })
  it('fails identity before any write and rejects wrong mode context', async () => { const root = await build(); const calls = []; await expect(deployWebPreview(config(root), { runAws: runner(calls, { Account: 'x' }) })).rejects.toMatchObject({ category: 'identity' }); expect(calls).toHaveLength(1); await expect(deployWebPreview(config(root, { mode: 'github', profile: 'codex-prod' }), { runAws: runner([]) })).rejects.toMatchObject({ category: 'configuration' }) })
  it('accepts only the reviewed GitHub OIDC context and role after STS', async () => {
    const root = await build()
    const calls = []
    const env = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'subaru44k/itsrunnew', GITHUB_REF: 'refs/heads/migration/aws-s3-cloudfront', AWS_ACCESS_KEY_ID: 'short-lived-id', AWS_SECRET_ACCESS_KEY: 'short-lived-secret', AWS_SESSION_TOKEN: 'short-lived-session' }
    const runAws = async (args) => {
      calls.push(args)
      if (args[0] === 'sts') return { Account: WEB_DEPLOY_TARGET.account, Arn: 'arn:aws:sts::470447451992:assumed-role/itsrun-preview-github-web-deploy/session' }
      if (args[0] === 'cloudformation') return { Stacks: [{ StackStatus: 'UPDATE_COMPLETE', Outputs: [{ OutputKey: 'WebBucketName', OutputValue: WEB_DEPLOY_TARGET.bucket }, { OutputKey: 'DistributionDomainName', OutputValue: WEB_DEPLOY_TARGET.domain }] }] }
      return {}
    }
    const fetchImpl = async (url) => {
      const key = url.includes('/index.html?') ? 'index.html' : '_nuxt/app.12345678.js'
      const body = Buffer.from(key === 'index.html' ? '<html>ok</html>' : 'alert(1)')
      return new Response(body, { status: 200, headers: { 'content-type': key.endsWith('.html') ? 'text/html' : 'application/javascript', 'cache-control': cacheControlForWebObject(key) } })
    }
    await expect(deployWebPreview({ ...config(root), mode: 'github', profile: undefined, env }, { runAws, fetchImpl })).resolves.toMatchObject({ status: 'match', mode: 'github' })
    expect(calls[0]).not.toContain('--profile')
  })
  it('runs only STS, stack read, PutObject, and CloudFront verification', async () => { const root = await build(); const calls = []; const fetchImpl = async (url) => { const key = url.includes('/index.html?') ? 'index.html' : '_nuxt/app.12345678.js'; const body = Buffer.from(key === 'index.html' ? '<html>ok</html>' : 'alert(1)'); return new Response(body, { status: 200, headers: { 'content-type': key.endsWith('.html') ? 'text/html' : 'application/javascript', 'cache-control': cacheControlForWebObject(key) } }) }; const report = await deployWebPreview(config(root), { runAws: runner(calls), fetchImpl }); expect(report.status).toBe('match'); expect(calls.filter((call) => call[1] === 'put-object')).toHaveLength(2); expect(calls.flat().some((value) => /delete|sync|cp|acl|invalidation|data/i.test(value))).toBe(false) })
  it('rejects empty, hidden, symlinked, and wrong bucket builds before STS', async () => { const root = await mkdtemp(join(tmpdir(), 't15b-empty-')); roots.push(root); const calls = []; await expect(deployWebPreview(config(root), { runAws: runner(calls) })).rejects.toMatchObject({ category: 'empty' }); expect(calls).toHaveLength(0); await expect(deployWebPreview(config(root, { bucket: 'wrong' }), { runAws: runner(calls) })).rejects.toMatchObject({ category: 'configuration' }) })
  it('uses exact metadata types and cache contract for common web extensions', async () => { const root = await build(); await writeFile(join(root, 'icon.png'), 'x'); await writeFile(join(root, 'font.woff2'), 'x'); const objects = await collectWebObjects(root); expect(objects.find((object) => object.key === 'icon.png').contentType).toBe('image/png'); expect(objects.find((object) => object.key === 'font.woff2').contentType).toBe('font/woff2'); expect(objects.every((object) => object.cacheControl === cacheControlForWebObject(object.key))).toBe(true) })
  it('bounds hanging fetch and encodes key segments with hash query', async () => { const object = { key: '_nuxt/a b.js', sha256: 'a'.repeat(64), contentType: 'application/javascript', cacheControl: 'public, max-age=86400' }; let seen; await expect(verifyWebObject(WEB_DEPLOY_TARGET.domain, object, { timeoutMs: 20, maxAttempts: 1, fetchImpl: (url, options) => { seen = [url, options.signal]; return new Promise(() => {}) } })).rejects.toMatchObject({ category: 'timeout' }); expect(seen[0]).toContain('_nuxt/a%20b.js?sha256='); expect(seen[1].aborted).toBe(true) })
  it('rejects malformed argument modes and report target collisions', async () => { expect(() => parseWebDeployArgs(['--mode', 'operator', '--web-dir', '/x', '--report-dir', '/x', '--unknown', 'x'])).toThrow(); await expect(writeWebReport({ status: 'match' }, '/tmp/reports')).rejects.toMatchObject({ category: 'report' }) })
  it('rejects near-match assumed roles, duplicate outputs, and non-terminal stacks before puts', async () => { const root = await build(); const calls = []; const env = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'subaru44k/itsrunnew', GITHUB_REF: 'refs/heads/migration/aws-s3-cloudfront', AWS_ACCESS_KEY_ID: 'id', AWS_SECRET_ACCESS_KEY: 'secret', AWS_SESSION_TOKEN: 'session' }; const near = runner(calls, { Account: WEB_DEPLOY_TARGET.account, Arn: 'arn:aws:sts::470447451992:assumed-role/itsrun-preview-github-web-deploy/session/extra' }); await expect(deployWebPreview({ ...config(root), mode: 'github', profile: undefined, env }, { runAws: near })).rejects.toMatchObject({ category: 'identity' }); expect(calls).toHaveLength(1); const badStack = async (args) => { calls.push(args); if (args[0] === 'sts') return { Account: WEB_DEPLOY_TARGET.account }; return { Stacks: [{ StackStatus: 'CREATE_COMPLETE', Outputs: [] }, { StackStatus: 'UPDATE_COMPLETE', Outputs: [] }] } }; await expect(deployWebPreview(config(root), { runAws: badStack })).rejects.toMatchObject({ category: 'stack' }); expect(calls.filter((call) => call[1] === 'put-object')).toHaveLength(0) })
})
