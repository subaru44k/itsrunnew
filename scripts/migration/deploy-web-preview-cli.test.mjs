import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cacheControlForWebObject } from './deploy-web-preview.mjs'
import { createAwsRunner, main } from './deploy-web-preview-cli.mjs'

describe('T15B CLI boundary', () => {
  it('returns help without invoking AWS', async () => { await expect(main(['--help'])).resolves.toContain('usage:') })
  it('rejects incomplete or alternate arguments before AWS', async () => {
    await expect(main(['--mode', 'operator', '--web-dir', '/tmp/build'])).rejects.toMatchObject({ category: 'configuration' })
    await expect(main(['--mode', 'operator', '--profile', 'other', '--web-dir', '/tmp/build', '--report-dir', '/tmp/report'])).rejects.toMatchObject({ category: 'configuration' })
  })
  it('passes only mode-approved executable, args, and child environment', async () => {
    const calls = []
    const fakeExec = (file, args, options, callback) => { calls.push({ file, args, options }); callback(null, { stdout: '{"Account":"x"}', stderr: '' }) }
    await createAwsRunner('github', { PATH: '/bin', HOME: '/tmp', AWS_ACCESS_KEY_ID: 'id', AWS_SECRET_ACCESS_KEY: 'secret', AWS_SESSION_TOKEN: 'session', AWS_PROFILE: 'bad', AWS_CONFIG_FILE: '/bad' }, fakeExec)(['sts', 'get-caller-identity'])
    expect(calls[0].file).toBe('/usr/local/bin/aws')
    expect(calls[0].args).toEqual(['sts', 'get-caller-identity', '--region', 'ap-northeast-1', '--no-cli-pager', '--output', 'json'])
    expect(calls[0].options.env).toEqual({ PATH: '/bin', HOME: '/tmp', AWS_ACCESS_KEY_ID: 'id', AWS_SECRET_ACCESS_KEY: 'secret', AWS_SESSION_TOKEN: 'session' })
  })
  it('runs the injected CLI boundary with one exact global set per AWS call', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 't15br2-'))
    const webDir = join(workspaceRoot, 'build'); const reportDir = join(workspaceRoot, '.artifacts', 'migration', 'run1')
    await mkdir(join(workspaceRoot, '.artifacts', 'migration'), { recursive: true }); await mkdir(webDir); await writeFile(join(webDir, 'index.html'), '<html>ok</html>')
    const calls = []; const body = Buffer.from('<html>ok</html>')
    const fakeExec = (file, args, options, callback) => {
      calls.push({ file, args, options })
      const command = args[0]
      const stdout = command === 'sts' ? JSON.stringify({ Account: '470447451992' }) : command === 'cloudformation' ? JSON.stringify({ Stacks: [{ StackStatus: 'UPDATE_COMPLETE', Outputs: [{ OutputKey: 'WebBucketName', OutputValue: 'itsrun-preview-web-470447451992-ap-northeast-1' }, { OutputKey: 'DistributionDomainName', OutputValue: 'd2via50thoheqm.cloudfront.net' }] }] }) : '{}'
      callback(null, { stdout, stderr: '' })
    }
    const fetchImpl = async () => new Response(body, { status: 200, headers: { 'content-type': 'text/html', 'cache-control': cacheControlForWebObject('index.html') } })
    await expect(main(['--mode', 'operator', '--profile', 'codex-prod', '--web-dir', webDir, '--report-dir', reportDir], {}, { execImpl: fakeExec, fetchImpl, workspaceRoot })).resolves.toMatchObject({ status: 'match' })
    expect(calls).toHaveLength(3)
    for (const call of calls) { expect(call.file).toBe('/usr/local/aws-cli/aws'); expect(call.args.filter((value) => value === '--region')).toHaveLength(1); expect(call.args.filter((value) => value === '--profile')).toHaveLength(1); expect(call.args).toContain('--no-cli-pager'); expect(call.args).toContain('--output'); expect(call.options.env.AWS_ACCESS_KEY_ID).toBeUndefined() }
    expect(calls[2].args.find((value) => value.startsWith('fileb:///'))).toBeDefined()
    expect((await readFile(join(reportDir, 'web-deploy-report.json'), 'utf8')).includes(webDir)).toBe(false)
    await rm(workspaceRoot, { recursive: true, force: true })
  })
  it('sanitizes command failures and never exposes stderr or credential values', async () => {
    const fakeExec = (_file, _args, _options, callback) => callback(Object.assign(new Error('secret-token stderr'), { stderr: 'secret-token stderr' }))
    await expect(createAwsRunner('operator', { PATH: '/bin', HOME: '/tmp' }, fakeExec)(['sts', 'get-caller-identity'])).rejects.toSatisfy((error) => error.category === 'command' && !error.message.includes('secret-token'))
  })
})
