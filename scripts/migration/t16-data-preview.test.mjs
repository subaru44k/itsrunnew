import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile as readFsFile } from 'node:fs/promises'
import { DATA_CONSTANTS, EXECUTION_FLAG, createConcreteDataAdapters, main, parseDataArgs, runDataRehearsal, runDirect, safeArgs, createProtectedDataCli } from './t16-data-preview.mjs'

const proof = {
  preflight: { users: 0, admins: 0, bytes: 501, etag: DATA_CONSTANTS.baselineEtag, versionId: DATA_CONSTANTS.baselineVersionId, sha256: DATA_CONSTANTS.baselineSha256, tuple: 0 },
  capture: { bytes: 501, sha256: DATA_CONSTANTS.baselineSha256, etag: DATA_CONSTANTS.baselineEtag, versionId: DATA_CONSTANTS.baselineVersionId },
  setup: { contexts: 2 },
  load: { adminEtag: DATA_CONSTANTS.baselineEtag, staleEtag: DATA_CONSTANTS.baselineEtag, tuple: 0 },
  update: { status: 200, etag: '"0123456789abcdef0123456789abcdef"', versionId: 'test-version', cacheControl: 'no-store', updatedAt: '2026-08-11T00:00:00.000Z', tuple: 1, puts: 1 },
  stale: { status: 409, etag: '"0123456789abcdef0123456789abcdef"', versionId: 'test-version', cacheControl: 'no-store', puts: 1, retries: 0, tuple: 1 },
  restore: { status: 200, etag: '"restored-etag"', versionId: 'restored-version', bytes: 501, sha256: DATA_CONSTANTS.baselineSha256, tuple: 0 },
  cleanup: { users: 0, admins: 0 },
}

function adapters({ fail = null, order = [] } = {}) {
  const make = stage => async input => { order.push(stage); if (fail === stage) throw new Error('canary'); return proof[stage] }
  return { preflight: make('preflight'), capture: make('capture'), setup: make('setup'), load: make('load'), update: make('update'), readCurrent: async () => ({ state: 'test', etag: proof.update.etag, versionId: proof.update.versionId }), stale: make('stale'), poll: async input => { order.push(`poll-${input.expected}`); return { tuple: input.expected, attempts: 1 } }, restore: make('restore'), cleanup: make('cleanup') }
}

test('accepts only the literal execution flag', async () => {
  assert.deepEqual(parseDataArgs([EXECUTION_FLAG]), { execute: true })
  assert.throws(() => parseDataArgs([]), /invalid execution flag/)
  assert.throws(() => parseDataArgs([EXECUTION_FLAG, 'secret']), /invalid execution flag/)
  assert.rejects(() => main([EXECUTION_FLAG], { adapters: adapters() }), /complete adapter injection is test-only/)
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

test('indeterminate baseline is fail-closed without restore, while unknown state is recovery-required', async () => {
  for (const state of ['baseline', 'unknown']) {
    const order = []; const base = adapters({ fail: 'update', order }); base.readCurrent = async () => ({ state })
    const result = await runDataRehearsal(base)
    assert.equal(result.restoreStatus, 'not-required'); assert.equal(order.includes('restore'), false); assert.equal(result.status, 'failed')
  }
})

test('restore failure retains recovery material and never retries', async () => {
  const order = []; const base = adapters({ order }); base.restore = async () => { order.push('restore'); throw new Error('canary restore') }
  const result = await runDataRehearsal(base)
  assert.equal(result.status, 'failed'); assert.equal(result.recoveryMaterialRetained, true); assert.equal(order.filter(stage => stage === 'restore').length, 1)
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
  const result = await runDirect({ argv: [EXECUTION_FLAG], dependencies: { adapters: adapters(), testOnly: true }, stdout: value => output.push(value), stderr: value => errors.push(value), setExitCode: value => exits.push(value) })
  assert.equal(result.status, 'success'); assert.equal(errors.length, 0); assert.deepEqual(exits, [0])
  assert.doesNotMatch(output[0], /canary|password|token|secret|bucket|data\/v1|2026-08-09/)
})

test('direct construction uses low-level CLI and independent browser ports', async () => {
  const baseline = await readFsFile('.artifacts/preview-seed/data/v1/stadiums/oda/availability/2026-08.json')
  const calls = []; let users = 0; let admins = 0; let currentEtag = DATA_CONSTANTS.baselineEtag
  const execFile = async (_file, args) => {
    calls.push(args)
    if (args[0] === 'sts') return { stdout: JSON.stringify({ Account: DATA_CONSTANTS.account }), stderr: '' }
    if (args[1] === 'head-object') return { stdout: JSON.stringify({ ContentLength: 501, ETag: currentEtag, VersionId: currentEtag === DATA_CONSTANTS.baselineEtag ? DATA_CONSTANTS.baselineVersionId : 'new-version', ChecksumSHA256: DATA_CONSTANTS.baselineSha256, ContentType: DATA_CONSTANTS.contentType, CacheControl: DATA_CONSTANTS.cacheControl, ServerSideEncryption: 'AES256' }), stderr: '' }
    if (args[1] === 'get-object') { await (await import('node:fs/promises')).writeFile(args.at(-1), baseline); return { stdout: '', stderr: '' } }
    if (args[1] === 'put-object') { currentEtag = '"fedcba9876543210fedcba9876543210"'; return { stdout: JSON.stringify({ ETag: currentEtag, VersionId: 'restore-version' }), stderr: '' } }
    if (args[1] === 'list-users') return { stdout: JSON.stringify({ Users: Array.from({ length: users }) }), stderr: '' }
    if (args[1] === 'list-users-in-group') return { stdout: JSON.stringify({ Users: Array.from({ length: admins }) }), stderr: '' }
    if (args[1] === 'admin-create-user') { users += 1; return { stdout: JSON.stringify({ User: { Username: 'internal-user' } }), stderr: '' } }
    if (args[1] === 'admin-add-user-to-group') { admins = 1; return { stdout: '' , stderr: '' } }
    if (args[1] === 'admin-remove-user-from-group') { admins = 0; return { stdout: '', stderr: '' } }
    if (args[1] === 'admin-delete-user') { users -= 1; return { stdout: '', stderr: '' } }
    if (args[1] === 'admin-get-user') return { stdout: JSON.stringify({ Username: 'internal-user' }), stderr: '' }
    return { stdout: '', stderr: '' }
  }
  const browser = { async setup() { return { contexts: 2 } }, async load() { return proof.load }, async update() { return proof.update }, async stale() { return proof.stale }, async poll(input) { return { tuple: input.expected, attempts: 1 } }, async cleanup() { return proof.cleanup } }
  const result = await main([EXECUTION_FLAG], { execFile, browser, randomBytesImpl: n => Buffer.alloc(n, 7) })
  assert.equal(result.status, 'success', JSON.stringify(result)); assert.equal(calls.some(args => args[1] === 'get-object' && args.at(-1).startsWith('/')), true)
  assert.equal(calls.some(args => args[1] === 'put-object' && args.includes('--if-match')), true)
  assert.equal(calls.some(args => args.includes('delete-object') || args.includes('list-objects-v2')), false)
})
