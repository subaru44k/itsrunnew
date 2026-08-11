import assert from 'node:assert/strict'
import test from 'node:test'
import { DATA_CONSTANTS, EXECUTION_FLAG, main, parseDataArgs, runDataRehearsal, runDirect, safeArgs, createProtectedDataCli } from './t16-data-preview.mjs'

const proof = {
  preflight: { users: 0, admins: 0, bytes: 501, etag: DATA_CONSTANTS.baselineEtag, versionId: DATA_CONSTANTS.baselineVersionId, sha256: DATA_CONSTANTS.baselineSha256, tuple: 0 },
  capture: { bytes: 501, sha256: DATA_CONSTANTS.baselineSha256, etag: DATA_CONSTANTS.baselineEtag, versionId: DATA_CONSTANTS.baselineVersionId },
  setup: { contexts: 2 },
  load: { adminEtag: DATA_CONSTANTS.baselineEtag, staleEtag: DATA_CONSTANTS.baselineEtag, tuple: 0 },
  update: { status: 200, etag: '"test-etag"', versionId: 'test-version', tuple: 1 },
  stale: { status: 409, etag: '"test-etag"', versionId: 'test-version', retries: 0, tuple: 1 },
  restore: { status: 200, etag: '"restored-etag"', versionId: 'restored-version', bytes: 501, sha256: DATA_CONSTANTS.baselineSha256, tuple: 0 },
  cleanup: { users: 0, admins: 0 },
}

function adapters({ fail = null, order = [] } = {}) {
  const make = stage => async input => { order.push(stage); if (fail === stage) throw new Error('canary'); return proof[stage] }
  return { preflight: make('preflight'), capture: make('capture'), setup: make('setup'), load: make('load'), update: make('update'), stale: make('stale'), poll: async input => { order.push(`poll-${input.expected}`); return { tuple: input.expected, attempts: 1 } }, restore: make('restore'), cleanup: make('cleanup') }
}

test('accepts only the literal execution flag', () => {
  assert.deepEqual(parseDataArgs([EXECUTION_FLAG]), { execute: true })
  assert.throws(() => parseDataArgs([]), /invalid execution flag/)
  assert.throws(() => parseDataArgs([EXECUTION_FLAG, 'secret']), /invalid execution flag/)
})
test('complete rehearsal has one update, one stale conflict, one restore, and cleanup after restore', async () => {
  const order = []; const result = await runDataRehearsal(adapters({ order }))
  assert.equal(result.status, 'success')
  assert.equal(result.counts.writes, 1); assert.equal(result.counts.restores, 1)
  assert.equal(order.indexOf('restore') < order.indexOf('cleanup'), true)
  assert.equal(order.filter(stage => stage === 'stale').length, 1)
})

test('an indeterminate update still gets exactly one restoration attempt before cleanup', async () => {
  const order = []; const result = await runDataRehearsal(adapters({ fail: 'update', order }))
  assert.equal(result.status, 'failed'); assert.equal(result.restoreStatus, 'passed')
  assert.equal(order.filter(stage => stage === 'restore').length, 1)
  assert.equal(order.indexOf('restore') < order.indexOf('cleanup'), true)
})

test('no restore is attempted before the update boundary', async () => {
  const order = []; const result = await runDataRehearsal(adapters({ fail: 'load', order }))
  assert.equal(result.restoreStatus, 'not-required'); assert.equal(order.includes('restore'), false)
})

test('S3 command boundary is exact and conditional', async () => {
  const calls = []
  const cli = createProtectedDataCli({ execFile: async (file, args, options) => { calls.push({ file, args, options }); return { stdout: '{}', stderr: '' } } })
  await cli('head-object')
  await cli('get-object', { inputPath: '/private/file.json' })
  await cli('put-object', { inputPath: '/private/file.json', ifMatch: '"test"', checksum: 'YWJj' })
  assert.deepEqual(calls.map(call => call.args.slice(0, 4)), [
    ['s3api', 'head-object', '--bucket', DATA_CONSTANTS.bucket],
    ['s3api', 'get-object', '--bucket', DATA_CONSTANTS.bucket],
    ['s3api', 'put-object', '--bucket', DATA_CONSTANTS.bucket],
  ])
  assert.equal(calls[2].args.includes('--if-match') && calls[2].args.includes('"test"'), true)
  assert.equal(calls.every(call => call.options.env.AWS_PROFILE === DATA_CONSTANTS.profile && call.options.env.AWS_REGION === DATA_CONSTANTS.region), true)
  assert.throws(() => safeArgs('delete-object'), /forbidden data operation/)
})

test('direct wrapper emits only the allowlisted sanitized result', async () => {
  const output = []; const errors = []; const exits = []
  const result = await runDirect({ argv: [EXECUTION_FLAG], dependencies: { adapters: adapters() }, stdout: value => output.push(value), stderr: value => errors.push(value), setExitCode: value => exits.push(value) })
  assert.equal(result.status, 'success'); assert.equal(errors.length, 0); assert.deepEqual(exits, [0])
  assert.doesNotMatch(output[0], /canary|password|token|secret|bucket|data\/v1|2026-08-09/)
})
