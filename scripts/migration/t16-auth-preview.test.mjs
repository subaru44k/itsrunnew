import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createConcreteAuthAdapters, main, AUTH_CONSTANTS, COGNITO_MUTATING_OPERATIONS } from './t16-auth-preview.mjs'

function fakeRun() {
  const calls = []; const internal = { admin: 'internal-admin-id', nonAdmin: 'internal-nonadmin-id' }; let users = 0; let admins = 0
  const command = { calls, async execFile(_file, args) {
    calls.push(args)
    const op = args[1]
    if (op === 'list-users') return { stdout: JSON.stringify({ Users: Array.from({ length: users }, () => ({})) }), stderr: '' }
    if (op === 'list-groups') return { stdout: JSON.stringify({ Groups: [{ GroupName: 'admins', Users: Array.from({ length: admins }, () => ({})) }] }), stderr: '' }
    const input = JSON.parse(await readFile(args[3].replace('file://', ''), 'utf8'))
    if (op === 'admin-create-user') { users += 1; return { stdout: JSON.stringify({ User: { Username: input.Username === input.Username.replace('admin-', 'admin-') && input.Username.includes('admin-') ? internal.admin : internal.nonAdmin } }), stderr: '' } }
    if (op === 'admin-get-user') return { stdout: JSON.stringify({ User: { Username: input.Username } }), stderr: '' }
    if (op === 'admin-add-user-to-group') { admins = 1; return { stdout: '', stderr: '' } }
    if (op === 'admin-remove-user-from-group') { admins = 0; return { stdout: '', stderr: '' } }
    if (op === 'admin-delete-user') { users -= 1; return { stdout: '', stderr: '' } }
    return { stdout: '', stderr: '' }
  } }
  const browser = (role) => ({ form: async () => ({ desktop: 'form-submitted', mobile: 'form-submitted' }), callback: async () => ({ desktop: true, mobile: true }), sentinel: async () => role === 'admin' ? { desktop: 200, mobile: 200 } : { desktop: 403, mobile: 403 } })
  return { command, browser, calls, internal }
}

test('direct fake execution uses the concrete boundary and emits only typed auth proof', async () => {
  const fake = fakeRun()
  const result = await main(['--execute-preview-auth'], { command: fake.command, browser: fake.browser, randomBytesImpl: n => Buffer.alloc(n, 7), clock: () => 1 })
  assert.equal(result.status, 'success')
  assert.deepEqual(result.counts, { operations: 9, writes: 0, restores: 0, cleanups: 1 })
  assert.deepEqual(result.roleOutcomes, { admin: 'passed', 'non-admin': 'passed' })
  assert.equal(JSON.stringify(result).includes('internal-'), false)
  assert.equal(fake.calls.every(args => args.includes('--user-pool-id') || args.includes('--cli-input-json')), true)
  assert.equal(fake.calls.filter(args => args[1] === 'admin-set-user-password').length, 2)
  assert.equal(fake.calls.filter(args => args[1] === 'admin-get-user').length, 2)
  assert.equal(COGNITO_MUTATING_OPERATIONS.includes('admin-delete-user'), true)
  assert.equal(JSON.stringify(AUTH_CONSTANTS).includes('s3'), false)
})

test('auth executable rejects every argv secret and wrong flag', async () => {
  await assert.rejects(() => main([]), /invalid execution flag/)
  await assert.rejects(() => main(['--execute-preview-auth', 'canary-password']), /invalid execution flag/)
})
