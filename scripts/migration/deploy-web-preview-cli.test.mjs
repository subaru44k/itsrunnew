import { describe, expect, it } from 'vitest'
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
    expect(calls[0].args).toEqual(['sts', 'get-caller-identity', '--region', 'ap-northeast-1'])
    expect(calls[0].options.env).toEqual({ PATH: '/bin', HOME: '/tmp', AWS_ACCESS_KEY_ID: 'id', AWS_SECRET_ACCESS_KEY: 'secret', AWS_SESSION_TOKEN: 'session' })
  })
})
