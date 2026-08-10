import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import * as fsp from 'node:fs/promises'
import { awaitHostedUiLogin, awaitSignedInSentinel, createBrowserSubstageError, createConcreteAuthAdapters, main, runAuthCoordinator, runBrowserRoleSession, runDirect, AUTH_CONSTANTS, COGNITO_MUTATING_OPERATIONS } from './t16-auth-preview.mjs'

function fakeRun({ fail = null, getShape = 'top-level' } = {}) {
  const calls = []; const envs = []; const payloads = []; const internal = { admin: 'internal-admin-id', nonAdmin: 'internal-nonadmin-id' }; let users = 0; let admins = 0
  const command = { calls, async execFile(_file, args, options) {
    calls.push(args); envs.push(options?.env)
    const op = args[1]
    if (op === fail) throw new Error('canary failure')
    if (op === 'list-users') return { stdout: JSON.stringify({ Users: Array.from({ length: users }, () => ({})) }), stderr: '' }
    if (args[0] === 'sts') return { stdout: JSON.stringify({ Account: '470447451992', Arn: 'arn:aws:iam::470447451992:user/test', UserId: 'test' }), stderr: '' }
    if (op === 'list-users-in-group') return { stdout: JSON.stringify({ Users: Array.from({ length: admins }, () => ({})) }), stderr: '' }
    const input = JSON.parse(await readFile(args[3].replace('file://', ''), 'utf8'))
    payloads.push({ op, input })
    if (op === 'admin-create-user') { users += 1; return { stdout: JSON.stringify({ User: { Username: input.Username.includes('-admin-') ? internal.admin : internal.nonAdmin } }), stderr: '' } }
    if (op === 'admin-get-user') {
      const response = getShape === 'missing' ? {} : getShape === 'nested' ? { User: { Username: input.Username } } : getShape === 'empty' ? { Username: '' } : getShape === 'mismatched' ? { Username: 'wrong-internal-id' } : { Username: input.Username }
      return { stdout: JSON.stringify(response), stderr: '' }
    }
    if (op === 'admin-add-user-to-group') { admins = 1; return { stdout: '', stderr: '' } }
    if (op === 'admin-remove-user-from-group') { admins = 0; return { stdout: '', stderr: '' } }
    if (op === 'admin-delete-user') { users -= 1; return { stdout: '', stderr: '' } }
    return { stdout: '', stderr: '' }
  } }
  const browserInputs = []; const browser = (role, alias, password) => { browserInputs.push({ role, alias, password }); return { form: async () => ({ desktop: 'form-submitted', mobile: 'form-submitted' }), callback: async () => ({ desktop: true, mobile: true }), sentinel: async () => role === 'admin' ? { desktop: 200, mobile: 200 } : { desktop: 403, mobile: 403 } } }
  return { command, browser, browserInputs, calls, envs, payloads, internal }
}

test('direct fake execution uses the concrete boundary and emits only typed auth proof', async () => {
  const fake = fakeRun()
  const result = await main(['--execute-preview-auth'], { command: fake.command, browser: fake.browser, randomBytesImpl: n => Buffer.alloc(n, 7), clock: () => 1 })
  assert.equal(result.status, 'success')
  assert.deepEqual(result.counts, { operations: 9, writes: 0, restores: 0, cleanups: 1 })
  assert.deepEqual(result.roleOutcomes, { admin: 'passed', 'non-admin': 'passed' })
  assert.equal(fake.browserInputs.every(item => item.alias.endsWith('.invalid') && item.password.includes('7')), true)
  assert.equal(JSON.stringify(result).includes('internal-'), false)
  assert.equal(fake.calls.every(args => args[0] === 'sts' || args.includes('--user-pool-id') || args.includes('--cli-input-json')), true)
  assert.equal(fake.envs.every(env => env?.AWS_PROFILE === 'codex-prod' && env?.AWS_REGION === 'ap-northeast-1' && env?.AWS_DEFAULT_REGION === 'ap-northeast-1'), true)
  assert.equal(fake.calls.filter(args => args[1] === 'admin-set-user-password').length, 2)
  assert.equal(fake.calls.filter(args => args[1] === 'admin-get-user').length, 2)
  for (const { op, input } of fake.payloads) if (['admin-set-user-password', 'admin-get-user', 'admin-add-user-to-group', 'admin-remove-user-from-group', 'admin-delete-user'].includes(op)) assert.ok([fake.internal.admin, fake.internal.nonAdmin].includes(input.Username))
  assert.equal(COGNITO_MUTATING_OPERATIONS.includes('admin-delete-user'), true)
  assert.equal(JSON.stringify(AUTH_CONSTANTS).includes('s3'), false)
})

test('auth executable rejects every argv secret and wrong flag', async () => {
  await assert.rejects(() => main([]), /invalid execution flag/)
  await assert.rejects(() => main(['--execute-preview-auth', 'canary-password']), /invalid execution flag/)
})

test('cleanup attempts deletion, readback, and temp cleanup after a removal failure', async () => {
  const fake = fakeRun({ fail: 'admin-remove-user-from-group' })
  const result = await main(['--execute-preview-auth'], { command: fake.command, browser: fake.browser, randomBytesImpl: n => Buffer.alloc(n, 8), clock: () => 2 })
  assert.equal(result.status, 'cleanup-failed')
  assert.equal(result.cleanupStatus, 'failed')
  assert.equal(fake.calls.some(args => args[1] === 'admin-delete-user'), true)
  assert.equal(fake.calls.some(args => args[1] === 'list-users'), true)
  assert.equal(fake.calls.some(args => args[1] === 'list-users-in-group'), true)
})

test('primary auth failure retains its checkpoint when cleanup also fails', async () => {
  const result = await runAuthCoordinator({
    preflight: async () => { throw new Error('canary auth failure') },
    cleanup: async () => { throw new Error('canary cleanup failure') },
  })
  assert.equal(result.status, 'cleanup-failed')
  assert.equal(result.failureCheckpoint, 'preflight')
  assert.equal(result.failure.category, 'operation-failed')
  assert.equal(result.cleanupStatus, 'failed')
  assert.equal(result.cleanupFailure.category, 'operation-failed')
  assert.equal(JSON.stringify(result).includes('canary'), false)
})

test('AdminGetUser requires exact nonempty top-level Username and still cleans every response failure', async () => {
  for (const shape of ['missing', 'nested', 'empty', 'mismatched']) {
    const fake = fakeRun({ getShape: shape }); let tempRemoved = 0
    const fs = { ...fsp, rm: async (...args) => { tempRemoved += 1; return fsp.rm(...args) } }
    const result = await main(['--execute-preview-auth'], { command: fake.command, browser: fake.browser, fs, randomBytesImpl: n => Buffer.alloc(n, 6), clock: () => 4 })
    assert.equal(result.status, 'failed'); assert.equal(result.failureCheckpoint, 'setup'); assert.equal(result.cleanupStatus, 'passed')
    assert.equal(fake.calls.filter(args => args[1] === 'admin-delete-user').length, 2)
    assert.equal(fake.calls.filter(args => args[1] === 'list-users').length, 2)
    assert.equal(fake.calls.filter(args => args[1] === 'list-users-in-group').length, 2)
    assert.equal(tempRemoved, 1); assert.equal(JSON.stringify(result).includes(shape), false)
  }
})

test('direct wrapper emits sanitized result and sets exit status from typed outcome', async () => {
  const fake = fakeRun(); const output = []; const errors = []; const exits = []
  const success = await runDirect({ argv: ['--execute-preview-auth'], dependencies: { command: fake.command, browser: fake.browser, randomBytesImpl: n => Buffer.alloc(n, 9), clock: () => 3 }, stdout: value => output.push(value), stderr: value => errors.push(value), setExitCode: value => exits.push(value) })
  assert.equal(success.status, 'success'); assert.deepEqual(exits, [0]); assert.equal(errors.length, 0); assert.equal(JSON.parse(output[0]).status, 'success')
  const failed = await runDirect({ argv: ['--execute-preview-auth'], dependencies: { adapters: { preflight: async () => ({ target: 'auth', users: 0, admins: 0, region: AUTH_CONSTANTS.region }), setup: async () => { throw new Error('canary') }, cleanup: async () => ({ users: 0, admins: 0 }) } }, stdout: value => output.push(value), stderr: value => errors.push(value), setExitCode: value => exits.push(value) })
  assert.equal(failed.status, 'failed'); assert.equal(exits.at(-1), 1); assert.equal(JSON.stringify(failed).includes('canary'), false)
})

test('Hosted UI redirect gate delays form access and enforces exact host/path', async () => {
  let current = 'https://d2via50thoheqm.cloudfront.net/manage'; let formAccess = false
  const page = {
    getByRole() { return { click: async () => { await new Promise(resolve => setTimeout(resolve, 10)); current = `https://${AUTH_CONSTANTS.hostedUiDomain}/login?client_id=opaque` } } },
    waitForURL(predicate, { timeout }) { return new Promise((resolve, reject) => { const started = Date.now(); const poll = () => { if (predicate(current)) return resolve(); if (Date.now() - started >= timeout) return reject(new Error('timeout')); setTimeout(poll, 1) }; poll() }) },
    locator() { formAccess = true; throw new Error('form accessed before redirect gate') },
  }
  assert.deepEqual(await awaitHostedUiLogin(page, { timeoutMs: 1000 }), { checkpoint: 'hosted-ui-login' }); assert.equal(formAccess, false)
  await assert.rejects(() => awaitHostedUiLogin({ getByRole: () => ({ click: async () => {} }), waitForURL: (predicate) => new Promise((resolve, reject) => { setTimeout(() => reject(new Error('timeout')), 5) }) }, { timeoutMs: 20 }), /hosted-ui-redirect-timeout/)
  const wrong = { getByRole: () => ({ click: async () => {} }), waitForURL: (predicate) => { assert.equal(predicate(`https://${AUTH_CONSTANTS.hostedUiDomain}/authorize`), false); return Promise.reject(new Error('wrong path')) } }
  await assert.rejects(() => awaitHostedUiLogin(wrong, { timeoutMs: 20 }), /hosted-ui-redirect-timeout/)
})

test('browser role integration invokes form driver only after the delayed URL gate', async () => {
  let current = 'https://d2via50thoheqm.cloudfront.net/manage'; const order = []
  const page = {
    getByRole() { return { click: async () => { order.push('click'); await new Promise(resolve => setTimeout(resolve, 10)); current = `https://${AUTH_CONSTANTS.hostedUiDomain}/login` } } },
    waitForURL(predicate, { timeout }) { return new Promise((resolve, reject) => { const started = Date.now(); const poll = () => { if (predicate(current)) { order.push('gate'); return resolve() }; if (Date.now() - started >= timeout) return reject(new Error('timeout')); setTimeout(poll, 1) }; poll() }) },
  }
  const result = await runBrowserRoleSession(page, { username: 'alias.invalid', password: 'not-output', formDriver: async () => { order.push('form'); assert.equal(current, `https://${AUTH_CONSTANTS.hostedUiDomain}/login`); return { checkpoint: 'form-submitted' } } })
  assert.deepEqual(result, { checkpoint: 'form-submitted' }); assert.deepEqual(order, ['click', 'gate', 'form'])
})

test('browser substage failures retain only exact category and viewport', async () => {
  const categories = ['form-ambiguous', 'control-missing', 'control-disabled', 'fill-failed', 'click-failed', 'submit-not-observed', 'callback-missing', 'manage-timeout', 'signed-in-missing', 'api-response-missing', 'api-status-unexpected', 'oauth-discovery-missing', 'oauth-discovery-rejected', 'oauth-token-endpoint-missing', 'oauth-token-endpoint-rejected', 'oauth-token-success-session-missing']
  for (const [index, category] of categories.entries()) {
    const viewport = index % 2 === 0 ? 'desktop' : 'mobile'
    const result = await runAuthCoordinator({ preflight: async () => ({ target: 'auth', users: 0, admins: 0, region: AUTH_CONSTANTS.region }), setup: async () => ({ users: 2, admins: 1 }), admin: { form: async () => { const error = new Error('canary raw browser error'); error.name = 'BrowserSubstageError'; error.category = category; error.viewport = viewport; throw error } }, cleanup: async () => ({ users: 0, admins: 0 }) })
    assert.deepEqual(result.failure, { stage: 'admin-form', category, viewport }); assert.equal(JSON.stringify(result).includes('canary'), false); assert.equal(JSON.stringify(result).includes('raw browser'), false)
  }
  assert.throws(() => createBrowserSubstageError('canary', 'desktop'), /invalid browser substage/)
})

test('signed-in sentinel waits for delayed visible hydration and times out safely', async () => {
  let visible = false
  const delayed = { getByRole: () => ({ waitFor: async ({ state }) => { assert.equal(state, 'visible'); await new Promise(resolve => setTimeout(resolve, 10)); visible = true } }) }
  const result = await awaitSignedInSentinel(delayed, { viewport: 'desktop', timeoutMs: 1000 })
  assert.deepEqual(result, { checkpoint: 'signed-in-visible', viewport: 'desktop' }); assert.equal(visible, true)
  const timeout = { getByRole: () => ({ waitFor: async () => { throw new Error('canary raw timeout') } }) }
  await assert.rejects(() => awaitSignedInSentinel(timeout, { viewport: 'mobile', timeoutMs: 10 }), error => error.name === 'BrowserSubstageError' && error.category === 'signed-in-missing' && error.viewport === 'mobile' && !String(error.message).includes('canary'))
})
