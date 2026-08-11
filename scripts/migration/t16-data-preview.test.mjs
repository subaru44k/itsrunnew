import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { DATA_CONSTANTS, EXECUTION_FLAG, createConcreteDataAdapters, createPlaywrightDataBrowser, main, parseDataArgs, runDataRehearsal, runDirect, safeArgs, safeBucketArgs, createProtectedDataCli, validateOneCellDelta, validateAuthenticatedGetTransport, validateBrowserBaseline, validateBucketGates, classifyCurrentObject, validateProtectedMaterial, validateRestoreProof, validateProtectedRun, shouldRemoveRecoveryMaterial, createLoadInputFromCapture, createDataSetupError, sanitizeDataSetupFailure } from './t16-data-preview.mjs'

const proof = {
  preflight: { users: 0, admins: 0, bytes: 501, etag: DATA_CONSTANTS.baselineEtag, versionId: DATA_CONSTANTS.baselineVersionId, sha256: DATA_CONSTANTS.baselineSha256, tuple: 0 },
  capture: { bytes: 501, document: { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2] } }, etag: DATA_CONSTANTS.baselineEtag, sha256: DATA_CONSTANTS.baselineSha256, tuple: 0, versionId: DATA_CONSTANTS.baselineVersionId },
  setup: { contexts: 2 },
  load: { adminEtag: DATA_CONSTANTS.baselineEtag, staleEtag: DATA_CONSTANTS.baselineEtag, tuple: 0 },
  update: { status: 200, etag: '"0123456789abcdef0123456789abcdef"', versionId: 'test-version', cacheControl: 'no-store', updatedAt: '2026-08-11T00:00:00.000Z', document: { days: { '2026-08-09': [1, 1, 2] } }, tuple: 1, puts: 1 },
  stale: { status: 409, etag: '"0123456789abcdef0123456789abcdef"', cacheControl: 'no-store', puts: 1, retries: 0, tuple: 1 },
  restore: { status: 200, etag: '"restored-etag"', versionId: 'restored-version', bytes: 501, sha256: DATA_CONSTANTS.baselineSha256, tuple: 0 },
  cleanup: { users: 0, admins: 0 },
}
const isSaveName = name => String(name).includes('Save') || String(name).includes('保存')
const browserBaseline = { document: proof.capture.document, etag: DATA_CONSTANTS.baselineEtag, tuple: DATA_CONSTANTS.before }
const readyCell = () => ({ waitFor: async () => {}, isVisible: async () => true, isEnabled: async () => true, click: async () => {}, inputValue: async () => '0' })
const alertNone = () => ({ count: async () => 0 })

function adapters({ fail = null, order = [], restoreArgs = [], loadArgs = [] } = {}) {
  const make = stage => async input => { order.push(stage); if (stage === 'restore') restoreArgs.push(input); if (fail === stage) throw new Error('canary'); return proof[stage] }
  return { preflight: make('preflight'), capture: make('capture'), setup: make('setup'), load: async input => { loadArgs.push(input); return make('load')(input) }, update: make('update'), readCurrent: async () => ({ state: 'test', etag: proof.update.etag, versionId: proof.update.versionId, tuple: 1, document: proof.update.document }), stale: make('stale'), poll: async input => { order.push(`poll-${input.expected}`); return { tuple: input.expected, attempts: 1 } }, restore: make('restore'), cleanup: make('cleanup') }
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

test('setup diagnostics preserve every closed substage and context without data operations', async () => {
  for (const category of ['hosted-ui-redirect', 'form-submission', 'manage-return', 'signed-in-sentinel', 'authenticated-api-response']) {
    for (const context of ['first', 'second']) {
      const reason = category === 'authenticated-api-response' ? 'transport-contract' : undefined; const order = []; const base = adapters({ order }); base.setup = async () => { order.push('setup'); throw createDataSetupError(category, context, reason) }
      const result = await runDataRehearsal(base)
      assert.equal(result.status, 'failed'); assert.deepEqual(result.failure, { checkpoint: 'setup', category, context, ...(reason ? { reason } : {}) }); assert.deepEqual(order, ['preflight', 'capture', 'setup', 'cleanup'])
      assert.equal(order.some(stage => ['load', 'update', 'stale', 'restore'].includes(stage)), false); assert.equal(order.filter(stage => stage === 'cleanup').length, 1)
    }
  }
})

test('hostile setup failures collapse to a generic sanitized category', async () => {
  for (const hostile of [new Error('https://evil.invalid/?password=secret'), { category: 'evil', token: 'secret', body: 'raw' }, 'raw setup failure']) {
    const base = adapters(); base.setup = async () => { throw hostile }
    const result = await runDataRehearsal(base)
    assert.deepEqual(result.failure, { checkpoint: 'setup', category: 'operation-failed', context: 'first' }); assert.doesNotMatch(JSON.stringify(result), /evil\.invalid|password|secret|token|raw setup/)
  }
  assert.deepEqual(sanitizeDataSetupFailure({ category: 'form-ambiguous' }, 'second'), { category: 'form-submission', context: 'second' })
})

test('browser setup maps each production boundary to a closed substage and context', async () => {
  const stages = ['hosted-ui-redirect', 'form-submission', 'manage-return', 'signed-in-sentinel', 'authenticated-api-response']
  for (const stage of stages) for (const target of [0, 1]) {
    let pageIndex = 0; let roleCalls = 0; let sentinelCalls = 0; let validatorCalls = 0; let contextCloses = 0; let browserCloses = 0
    const response = index => ({ status: () => stage === 'authenticated-api-response' && index === target ? 500 : 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => ({ method: () => 'GET' }), headers: () => ({ 'content-type': 'application/json', 'cache-control': 'no-store' }) })
    const pages = [0, 1].map(index => ({ index, waitForResponse: () => Promise.resolve(response(index)), goto: async () => {}, waitForURL: async () => { if (stage === 'manage-return' && index === target) throw new Error('TimeoutError') }, locator: () => readyCell(), getByRole: role => role === 'alert' ? alertNone() : {} }))
    const launcher = async () => ({ newContext: async () => ({ newPage: async () => pages[pageIndex++], close: async () => { contextCloses += 1 } }), close: async () => { browserCloses += 1 } })
    const browser = createPlaywrightDataBrowser({ launcher, responseTimeout: 20, browserRoleSession: async (_page) => { const index = roleCalls++; if (stage === 'hosted-ui-redirect') throw new Error('hosted-ui-redirect-timeout'); if (index !== target) return; if (stage === 'form-submission') throw { name: 'BrowserSubstageError', category: 'form-ambiguous', viewport: 'desktop' } }, signedInSentinel: async (_page) => { const index = sentinelCalls++; if (stage === 'signed-in-sentinel' && index === target) throw new Error('TimeoutError') }, getResponseValidator: async (_response) => { const index = validatorCalls++; if (stage === 'authenticated-api-response' && index === target) throw new Error('generic response failure'); return { document: {}, etag: DATA_CONSTANTS.baselineEtag, tuple: 0 } } })
    let thrown; try { await browser.setup({ username: 'opaque', password: 'opaque', baseline: browserBaseline }) } catch (error) { thrown = error }
    assert.deepEqual(thrown, { name: 'DataSetupSubstageError', category: stage, context: stage === 'hosted-ui-redirect' ? 'first' : target === 0 ? 'first' : 'second', ...(stage === 'authenticated-api-response' ? { reason: 'transport-contract' } : {}) }); await browser.cleanup(); assert.equal(contextCloses, stage === 'hosted-ui-redirect' ? 2 : target === 0 ? 1 : 2); assert.equal(browserCloses, 1); assert.doesNotMatch(JSON.stringify(thrown), /opaque|response failure|TimeoutError/)
  }
})

test('authenticated response validation starts before delayed manage and sentinel stages', async () => {
  const events = []; let pageIndex = 0; let contextCloses = 0; let browserCloses = 0
  const document = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2] } }
  const makePage = name => ({ waitForResponse: () => Promise.resolve({ status: () => 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => ({ method: () => 'GET' }), headers: () => ({ 'content-type': 'application/json', 'cache-control': 'no-store' }), json: async () => { events.push(`${name}:body`); return { document, etag: DATA_CONSTANTS.baselineEtag } } }), goto: async () => {}, waitForURL: async () => { events.push(`${name}:manage-start`); await new Promise(resolve => setTimeout(resolve, 15)); events.push(`${name}:manage-end`) }, locator: () => readyCell(), getByRole: role => role === 'alert' ? alertNone() : {} })
  const pages = [makePage('first'), makePage('second')]; const launcher = async () => ({ newContext: async () => ({ newPage: async () => pages[pageIndex++], close: async () => { contextCloses += 1 } }), close: async () => { browserCloses += 1 } })
  const browser = createPlaywrightDataBrowser({ launcher, browserRoleSession: async () => {}, signedInSentinel: async (_page) => { events.push('sentinel-start'); await new Promise(resolve => setTimeout(resolve, 15)); events.push('sentinel-end') } }); await browser.setup({ username: 'opaque', password: 'opaque', baseline: browserBaseline }); assert.equal(events.includes('first:body'), false); await browser.cleanup(); assert.equal(contextCloses, 2); assert.equal(browserCloses, 1)
})

test('early setup failure drains late validation rejection without unhandled rejection', async () => {
  let contextCloses = 0; let browserCloses = 0; let unhandled = 0; const onUnhandled = () => { unhandled += 1 }; process.on('unhandledRejection', onUnhandled)
  const response = { status: () => 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => ({ method: () => 'GET' }), headers: () => ({ 'content-type': 'application/json', 'cache-control': 'no-store' }), json: () => new Promise((_, reject) => setTimeout(() => reject(new Error('late body')), 10)) }
  const page = { waitForResponse: () => Promise.resolve(response), goto: async () => {}, waitForURL: async () => { throw new Error('manage failed') }, locator: () => readyCell(), getByRole: role => role === 'alert' ? alertNone() : {} }; const launcher = async () => ({ newContext: async () => ({ newPage: async () => page, close: async () => { contextCloses += 1 } }), close: async () => { browserCloses += 1 } }); const browser = createPlaywrightDataBrowser({ launcher, browserRoleSession: async () => {}, signedInSentinel: async () => {} }); await assert.rejects(browser.setup({ username: 'opaque', password: 'opaque', baseline: browserBaseline }), { name: 'DataSetupSubstageError', category: 'manage-return', context: 'first' }); await browser.cleanup(); await new Promise(resolve => setTimeout(resolve, 25)); process.off('unhandledRejection', onUnhandled); assert.equal(unhandled, 0); assert.equal(contextCloses, 1); assert.equal(browserCloses, 1)
})

test('authenticated response diagnostics preserve only the closed reason and context', async () => {
  const baseline = browserBaseline.document
  for (const reason of ['transport-contract', 'response-missing']) for (const target of [0, 1]) {
    let pageIndex = 0; let contextCloses = 0; let browserCloses = 0
    const response = index => {
      const invalid = index === target
      if (invalid && reason === 'response-missing') return undefined
      return invalid && reason === 'response-missing' ? undefined : { status: () => invalid && reason === 'transport-contract' ? 500 : 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => ({ method: () => 'GET' }), headers: () => ({ 'content-type': 'application/json', 'cache-control': 'no-store' }) }
    }
    const pages = [0, 1].map(index => ({ waitForResponse: async () => response(index), goto: async () => {}, waitForURL: async () => {}, locator: () => readyCell(), getByRole: role => role === 'alert' ? alertNone() : {} })); const launcher = async () => ({ newContext: async () => ({ newPage: async () => pages[pageIndex++], close: async () => { contextCloses += 1 } }), close: async () => { browserCloses += 1 } })
    const browser = createPlaywrightDataBrowser({ launcher, responseTimeout: 20, browserRoleSession: async () => {}, signedInSentinel: async () => {} }); let thrown; try { await browser.setup({ username: 'opaque', password: 'opaque', baseline: browserBaseline }) } catch (error) { thrown = error }
    assert.deepEqual(thrown, { name: 'DataSetupSubstageError', category: 'authenticated-api-response', context: target === 0 ? 'first' : 'second', reason }); await browser.cleanup(); assert.equal(contextCloses, target === 0 ? 1 : 2); assert.equal(browserCloses, 1); assert.doesNotMatch(JSON.stringify(thrown), /raw body|opaque|weak/)
  }
})

test('load input helper returns the exact captured nonconstant ETag', async () => {
  const captured = '"11111111111111111111111111111111"'
  assert.deepEqual(createLoadInputFromCapture({ ...proof.capture, etag: captured }), { etag: captured })
  for (const bad of [undefined, { ...proof.capture, etag: undefined }, { ...proof.capture, etag: 'weak' }, { ...proof.capture, etag: captured, extra: true }]) assert.throws(() => createLoadInputFromCapture(bad), /load input mismatch/)
})

test('missing, mismatched, and malformed load proofs stop before update and clean once', async () => {
  for (const bad of [undefined, { adminEtag: '"22222222222222222222222222222222"', staleEtag: proof.preflight.etag, tuple: 0 }, { adminEtag: 'weak', staleEtag: proof.preflight.etag, tuple: 0 }]) { const order = []; const base = adapters({ order }); base.load = async () => bad; const result = await runDataRehearsal(base); assert.equal(result.status, 'failed'); assert.equal(result.failureCheckpoint, 'load'); assert.equal(order.filter(stage => stage === 'update' || stage === 'stale' || stage === 'restore').length, 0); assert.equal(order.filter(stage => stage === 'cleanup').length, 1) }
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
    assert.equal(result.restoreStatus, 'not-required'); assert.equal(order.includes('restore'), false); assert.equal(result.status, 'failed'); if (state === 'unknown') assert.equal(result.failure.category, 'recovery-required')
  }
})

test('indeterminate exact test restores once with observed ETag and VersionId', async () => {
  const order = []; const restoreArgs = []; const base = adapters({ fail: 'update', order, restoreArgs }); base.readCurrent = async () => ({ state: 'test', etag: proof.update.etag, versionId: proof.update.versionId, tuple: 1 }); const result = await runDataRehearsal(base)
  assert.equal(result.restoreStatus, 'passed'); assert.equal(restoreArgs.length, 1); assert.equal(restoreArgs[0].ifMatch, proof.update.etag); assert.equal(restoreArgs[0].versionId, proof.update.versionId)
})

test('post-stale ETag, VersionId, and document mismatches restore exactly once', async () => {
  for (const mismatch of ['etag', 'versionId', 'document']) { const order = []; const restoreArgs = []; const base = adapters({ order, restoreArgs }); const originalRead = base.readCurrent; base.readCurrent = async expected => { const current = await originalRead(expected); if (mismatch === 'etag') current.etag = '"badbadbadbadbadbadbadbadbadbadbadb"'; if (mismatch === 'versionId') current.versionId = 'other-version'; if (mismatch === 'document') current.document = { ...proof.update.document, changed: true }; return current }; const result = await runDataRehearsal(base); assert.equal(result.status, 'failed'); assert.equal(result.counts.restores, 1); assert.equal(restoreArgs.length, 1); assert.equal(restoreArgs[0].ifMatch, proof.update.etag); assert.equal(restoreArgs[0].versionId, proof.update.versionId); assert.equal(order.filter(stage => stage === 'restore').length, 1) }
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
  assert.deepEqual(safeBucketArgs('get-bucket-versioning'), ['s3api', 'get-bucket-versioning', '--bucket', DATA_CONSTANTS.bucket])
  assert.throws(() => safeBucketArgs('list-objects-v2'), /forbidden bucket operation/)
})

test('bucket gates require Enabled versioning and every nested public-block boolean', () => {
  const good = { Status: 'Enabled' }; const block = { PublicAccessBlockConfiguration: { BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true } }
  assert.equal(validateBucketGates(good, block), true)
  for (const field of ['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets']) assert.throws(() => validateBucketGates(good, { PublicAccessBlockConfiguration: { ...block.PublicAccessBlockConfiguration, [field]: false } }), /bucket gate/)
  assert.throws(() => validateBucketGates({ Status: 'Suspended' }, block), /bucket gate/)
  assert.throws(() => validateBucketGates(good, { BlockPublicAcls: true }), /bucket gate/)
})

test('current-object classifier is exact and fail-closed for every state mismatch', () => {
  const baselineDocument = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2], '2026-08-10': [1, 2, 0] } }; const testDocument = { ...baselineDocument, updatedAt: '2026-01-02T00:00:00.000Z', days: { ...baselineDocument.days, '2026-08-09': [1, 1, 2] } }; const bytes = value => Buffer.from(JSON.stringify(value)); const baseline = { bytes: bytes(baselineDocument), sha256: createHash('sha256').update(bytes(baselineDocument)).digest('hex'), parsed: { document: baselineDocument }, head: { ETag: DATA_CONSTANTS.baselineEtag, VersionId: DATA_CONSTANTS.baselineVersionId, ContentType: DATA_CONSTANTS.contentType, CacheControl: DATA_CONSTANTS.cacheControl, ServerSideEncryption: 'AES256' } }; const valid = { bytes: bytes(testDocument), parsed: { document: testDocument, tuple: 1 }, head: { ...baseline.head, ETag: '"0123456789abcdef0123456789abcdef"', VersionId: 'test-version' } }
  assert.deepEqual(classifyCurrentObject({ ...baseline, bytes: Buffer.from(JSON.stringify(baselineDocument)), parsed: { document: baselineDocument, tuple: 0 } }, { ...baseline, parsed: { document: baselineDocument } }), { state: 'baseline', tuple: 0 })
  assert.deepEqual(classifyCurrentObject({ ...baseline, head: { ...baseline.head, VersionId: 'wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE' } }, baseline), { state: 'unknown' })
  const expectedTest = { etag: valid.head.ETag, versionId: valid.head.VersionId, document: testDocument, sha256: createHash('sha256').update(valid.bytes).digest('hex') }; assert.deepEqual(classifyCurrentObject(valid, baseline, expectedTest).state, 'test')
  for (const bad of [
    { ...valid, bytes: Buffer.from(JSON.stringify(testDocument, null, 2)) }, { ...valid, bytes: Buffer.from('wrong') }, { ...valid, parsed: { document: { ...testDocument, days: { ...testDocument.days, '2026-08-10': [2, 2, 0] } }, tuple: 1 } },
    { ...valid, parsed: { document: { ...testDocument, updatedAt: baselineDocument.updatedAt }, tuple: 1 } }, { ...valid, head: { ...valid.head, ContentType: 'text/plain' } },
    { ...valid, head: { ...valid.head, CacheControl: 'public' } }, { ...valid, head: { ...valid.head, ETag: 'weak' } }, { ...valid, head: { ...valid.head, VersionId: '' } },
  ]) assert.doesNotThrow(() => assert.deepEqual(classifyCurrentObject(bad, baseline, expectedTest), { state: 'unknown' }))
  assert.deepEqual(classifyCurrentObject({ ...baseline, bytes: Buffer.from(`${JSON.stringify(baselineDocument)} `) }, baseline), { state: 'unknown' }); assert.deepEqual(classifyCurrentObject({ ...baseline, sha256: 'wrong' }, baseline), { state: 'unknown' })
  assert.deepEqual(classifyCurrentObject(valid, baseline, { etag: '"other"', versionId: valid.head.VersionId, document: testDocument }), { state: 'unknown' }); assert.deepEqual(classifyCurrentObject(valid, baseline, { etag: valid.head.ETag, versionId: 'other', document: testDocument }), { state: 'unknown' }); assert.deepEqual(classifyCurrentObject(valid, baseline, { etag: valid.head.ETag, versionId: valid.head.VersionId, document: baselineDocument }), { state: 'unknown' })
})

test('protected material validator enforces direct child, modes, symlinks, and bytes', async () => {
  const parent = '/repo/.artifacts/migration'; const run = `${parent}/t16-data-run`; const file = `${run}/capture.json`; const bytes = Buffer.from('original'); let states = { [parent]: { mode: 0o700, isDirectory: () => true }, [run]: { mode: 0o700, isDirectory: () => true }, [file]: { mode: 0o600, isFile: () => true } }; const fs = { lstat: async path => states[path], readFile: async () => bytes }
  await validateProtectedMaterial({ fs, parent, run, file, bytes })
  for (const target of [parent, run, file]) { states = { ...states, [target]: { ...(states[target] ?? {}), isSymbolicLink: () => true } }; await assert.rejects(validateProtectedMaterial({ fs, parent, run, file, bytes }), /protected/); states[target] = { mode: target === file ? 0o600 : 0o700, ...(target === file ? { isFile: () => true } : { isDirectory: () => true }) } }
  states[run] = { mode: 0o700, isDirectory: () => true }; states[file] = { mode: 0o600, isFile: () => true }; fs.readFile = async () => Buffer.from('swapped'); await assert.rejects(validateProtectedMaterial({ fs, parent, run, file, bytes }), /protected material/)
  fs.readFile = async () => bytes; for (const [name, mapping, target] of [
    ['parent mode', { [parent]: { mode: 0o755, isDirectory: () => true }, [run]: states[run], [file]: states[file] }, file], ['run mode', { [parent]: states[parent], [run]: { mode: 0o755, isDirectory: () => true }, [file]: states[file] }, file], ['file mode', { [parent]: states[parent], [run]: states[run], [file]: { mode: 0o644, isFile: () => true } }, file], ['parent non-dir', { [parent]: { mode: 0o700, isDirectory: () => false }, [run]: states[run], [file]: states[file] }, file], ['file non-file', { [parent]: states[parent], [run]: states[run], [file]: { mode: 0o600, isFile: () => false } }, file], ['nested file', { [parent]: states[parent], [run]: states[run], [`${run}/nested/capture.json`]: states[file] }, `${run}/nested/capture.json`], ['escaped file', { [parent]: states[parent], [run]: states[run], [`${parent}/other.json`]: states[file] }, `${parent}/other.json`],
  ]) { states = mapping; await assert.rejects(validateProtectedMaterial({ fs, parent, run, file: target, bytes }), /protected/, name) }
})

test('restore proof independently rejects identity, readback, metadata, and content mismatches', () => {
  const doc = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2], '2026-08-10': [1, 2, 0], '2026-08-11': [2, 0, 1], '2026-08-12': [0, 1, 2], '2026-08-13': [1, 2, 0], '2026-08-14': [2, 0, 1], '2026-08-15': [0, 1, 2] } }; const originalBytes = Buffer.from(`${JSON.stringify(doc, null, 2)}\n`); const original = { bytes: originalBytes, parsed: { document: doc } }; const response = { ETag: '"abcdef0123456789abcdef0123456789"', VersionId: 'restore-version' }; const readback = { bytes: originalBytes, parsed: { document: doc, tuple: 0 }, head: { ETag: response.ETag, VersionId: response.VersionId, ContentType: DATA_CONSTANTS.contentType, CacheControl: DATA_CONSTANTS.cacheControl, ServerSideEncryption: 'AES256' } }; assert.equal(validateRestoreProof({ response, readback, original, testEtag: '"0123456789abcdef0123456789abcdef"', testVersionId: 'test-version' }), true)
  const cases = [
    { response: { ...response, ETag: 'weak' } }, { response: { ...response, ETag: undefined } }, { response: { ...response, ETag: DATA_CONSTANTS.baselineEtag } }, { response: { ...response, ETag: '"0123456789abcdef0123456789abcdef"' } }, { response: { ...response, VersionId: '' } }, { response: { ...response, VersionId: undefined } }, { response: { ...response, VersionId: DATA_CONSTANTS.baselineVersionId } }, { response: { ...response, VersionId: 'test-version' } },
    { readback: { ...readback, head: { ...readback.head, ETag: '"fedcba9876543210fedcba9876543210"' } } }, { readback: { ...readback, head: { ...readback.head, VersionId: 'other' } } }, { readback: { ...readback, bytes: Buffer.from('changed') } }, { readback: { ...readback, parsed: { document: { ...doc, days: { '2026-08-09': [1, 1, 2] } }, tuple: 0 } } }, { readback: { ...readback, head: { ...readback.head, ContentType: 'text/plain' } } }, { readback: { ...readback, head: { ...readback.head, CacheControl: 'public' } } }, { readback: { ...readback, head: { ...readback.head, ServerSideEncryption: undefined } } },
  ]; for (const bad of cases) assert.throws(() => validateRestoreProof({ response: bad.response ?? response, readback: bad.readback ?? readback, original, testEtag: '"0123456789abcdef0123456789abcdef"', testVersionId: 'test-version' }), /restore/)
})

test('protected run validator rejects non-direct, escaped, prefixed, and malformed runs', async () => {
  const parent = '/repo/.artifacts/migration'; const good = `${parent}/t16-data-good`; let state = { [parent]: { mode: 0o700, isDirectory: () => true }, [good]: { mode: 0o700, isDirectory: () => true } }; const fs = { lstat: async path => state[path] ?? { mode: 0, isDirectory: () => false } }; await validateProtectedRun({ fs, parent, run: good })
  const cases = [
    ['parent mode', { [parent]: { mode: 0o755, isDirectory: () => true }, [good]: state[good] }], ['run mode', { [parent]: state[parent], [good]: { mode: 0o755, isDirectory: () => true } }],
    ['parent symlink', { [parent]: { mode: 0o700, isDirectory: () => true, isSymbolicLink: () => true }, [good]: state[good] }], ['run symlink', { [parent]: state[parent], [good]: { mode: 0o700, isDirectory: () => true, isSymbolicLink: () => true } }],
    ['parent non-directory', { [parent]: { mode: 0o700, isDirectory: () => false }, [good]: state[good] }], ['run non-directory', { [parent]: state[parent], [good]: { mode: 0o700, isDirectory: () => false } }],
    ['relative', { migration: state[parent], good: state[good] }], ['escaped sibling', { [parent]: state[parent], [`${parent}/../t16-data-good`]: state[good] }], ['nested', { [parent]: state[parent], [`${parent}/nested/t16-data-good`]: state[good] }], ['bad prefix', { [parent]: state[parent], [`${parent}/other`]: state[good] }],
  ]
  for (const [name, mapping] of cases) { state = mapping; const run = name === 'relative' ? 'migration/good' : name === 'escaped sibling' ? `${parent}/../t16-data-good` : name === 'nested' ? `${parent}/nested/t16-data-good` : name === 'bad prefix' ? `${parent}/other` : good; await assert.rejects(validateProtectedRun({ fs, parent: name === 'relative' ? 'migration' : parent, run }), /protected/, name) }
})

test('recovery removal truth table is fail-closed', () => {
  assert.equal(shouldRemoveRecoveryMaterial({ restoreStatus: 'not-required', restoreAttempted: false }), true); assert.equal(shouldRemoveRecoveryMaterial({ restoreStatus: 'passed', restoreAttempted: true }), true)
  for (const input of [{ restoreStatus: 'not-required', restoreAttempted: true }, { restoreStatus: 'started', restoreAttempted: true }, { restoreStatus: 'failed', restoreAttempted: true }, { restoreStatus: 'not-required', recoveryMaterialRetained: true }, { restoreStatus: 'passed', cleanupFailed: true }]) assert.equal(shouldRemoveRecoveryMaterial(input), false)
})

test('direct wrapper emits only the allowlisted sanitized result', async () => {
  const output = []; const errors = []; const exits = []
  const result = await runDirect({ argv: [EXECUTION_FLAG], dependencies: { adapters: adapters(), testOnly: true }, stdout: value => output.push(value), stderr: value => errors.push(value), setExitCode: value => exits.push(value) })
  assert.equal(result.status, 'success'); assert.equal(errors.length, 0); assert.deepEqual(exits, [0])
  assert.doesNotMatch(output[0], /canary|password|token|secret|bucket|data\/v1|2026-08-09/)
})

test('direct construction uses low-level CLI and independent browser ports', async () => {
  const baselineDocument = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2], '2026-08-10': [1, 2, 0], '2026-08-11': [2, 0, 1], '2026-08-12': [0, 1, 2], '2026-08-13': [1, 2, 0], '2026-08-14': [2, 0, 1], '2026-08-15': [0, 1, 2] } }
  const baseline = Buffer.from(`${JSON.stringify(baselineDocument, null, 2)}\n`)
  assert.equal(baseline.length, DATA_CONSTANTS.baselineBytes); assert.equal(createHash('sha256').update(baseline).digest('hex'), DATA_CONSTANTS.baselineSha256)
  const calls = []; let users = 0; let admins = 0; let currentEtag = DATA_CONSTANTS.baselineEtag; let currentVersion = DATA_CONSTANTS.baselineVersionId
  const execFile = async (_file, args) => {
    calls.push(args)
    if (args[0] === 'sts') return { stdout: JSON.stringify({ Account: DATA_CONSTANTS.account }), stderr: '' }
    if (args[1] === 'head-object') return { stdout: JSON.stringify({ ContentLength: 501, ETag: currentEtag, VersionId: currentVersion, ChecksumSHA256: DATA_CONSTANTS.baselineSha256, ContentType: DATA_CONSTANTS.contentType, CacheControl: DATA_CONSTANTS.cacheControl, ServerSideEncryption: 'AES256' }), stderr: '' }
    if (args[1] === 'get-bucket-versioning') return { stdout: JSON.stringify({ Status: 'Enabled' }), stderr: '' }
    if (args[1] === 'get-public-access-block') return { stdout: JSON.stringify({ PublicAccessBlockConfiguration: { BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true } }), stderr: '' }
    if (args[1] === 'get-object') { const bytes = currentEtag === proof.update.etag ? Buffer.from(JSON.stringify({ ...baselineDocument, updatedAt: proof.update.updatedAt, days: { ...baselineDocument.days, '2026-08-09': [1, 1, 2] } })) : baseline; await (await import('node:fs/promises')).writeFile(args.at(-1), bytes); return { stdout: '', stderr: '' } }
    if (args[1] === 'put-object') { currentEtag = '"fedcba9876543210fedcba9876543210"'; currentVersion = 'restore-version'; return { stdout: JSON.stringify({ ETag: currentEtag, VersionId: currentVersion }), stderr: '' } }
    if (args[1] === 'list-users') return { stdout: JSON.stringify({ Users: Array.from({ length: users }) }), stderr: '' }
    if (args[1] === 'list-users-in-group') return { stdout: JSON.stringify({ Users: Array.from({ length: admins }) }), stderr: '' }
    if (args[1] === 'admin-create-user') { users += 1; return { stdout: JSON.stringify({ User: { Username: 'internal-user' } }), stderr: '' } }
    if (args[1] === 'admin-add-user-to-group') { admins = 1; return { stdout: '' , stderr: '' } }
    if (args[1] === 'admin-remove-user-from-group') { admins = 0; return { stdout: '', stderr: '' } }
    if (args[1] === 'admin-delete-user') { users -= 1; return { stdout: '', stderr: '' } }
    if (args[1] === 'admin-get-user') return { stdout: JSON.stringify({ Username: 'internal-user' }), stderr: '' }
    return { stdout: '', stderr: '' }
  }
  const browser = { async setup() { return { contexts: 2 } }, async load() { return proof.load }, async update() { currentEtag = proof.update.etag; currentVersion = proof.update.versionId; return { ...proof.update, document: { ...baselineDocument, updatedAt: proof.update.updatedAt, days: { ...baselineDocument.days, '2026-08-09': [1, 1, 2] } } } }, async stale() { return proof.stale }, async poll(input) { return { tuple: input.expected, attempts: 1 } }, async cleanup() { return proof.cleanup } }
  const result = await main([EXECUTION_FLAG], { execFile, browser, randomBytesImpl: n => Buffer.alloc(n, 7) })
  assert.equal(result.status, 'success', JSON.stringify(result)); assert.equal(calls.some(args => args[1] === 'get-object' && args.at(-1).startsWith('/')), true)
  assert.equal(calls.some(args => args[1] === 'put-object' && args.includes('--if-match')), true)
  assert.equal(calls.some(args => args.includes('delete-object') || args.includes('list-objects-v2')), false)
})

test('concrete adapter restore failure retains material and happy restore removes only run', async () => {
  const baselineDocument = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2], '2026-08-10': [1, 2, 0], '2026-08-11': [2, 0, 1], '2026-08-12': [0, 1, 2], '2026-08-13': [1, 2, 0], '2026-08-14': [2, 0, 1], '2026-08-15': [0, 1, 2] } }; const baselineBytes = Buffer.from(`${JSON.stringify(baselineDocument, null, 2)}\n`); const root = '/repo/.artifacts/migration/t16-data-fake'; const parent = '/repo/.artifacts/migration'; const files = new Map(); const modes = new Map([[parent, { mode: 0o700, isDirectory: () => true }], [root, { mode: 0o700, isDirectory: () => true }]]); let current = { etag: DATA_CONSTANTS.baselineEtag, version: DATA_CONSTANTS.baselineVersionId, bytes: baselineBytes }; const removed = []; const fs = { async mkdir() {}, async chmod(path, mode) { const old = modes.get(path) ?? {}; modes.set(path, { ...old, mode }) }, async mkdtemp() { return root }, async writeFile(path, data) { files.set(path, Buffer.from(data)); modes.set(path, { mode: 0o600, isFile: () => true }) }, async readFile(path) { return files.get(path) ?? current.bytes }, async unlink(path) { files.delete(path) }, async rm(path) { removed.push(path) }, async lstat(path) { if (modes.has(path)) return modes.get(path); return { mode: 0o600, isFile: () => true } }, async stat(path) { return this.lstat(path) } }; let puts = 0; let mismatch = true; const command = async operation => { if (operation === 'get-bucket-versioning') return { stdout: JSON.stringify({ Status: 'Enabled' }) }; if (operation === 'get-public-access-block') return { stdout: JSON.stringify({ PublicAccessBlockConfiguration: { BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true } }) }; if (operation === 'head-object') return { stdout: JSON.stringify({ ETag: current.etag, VersionId: current.version, ContentType: DATA_CONSTANTS.contentType, CacheControl: DATA_CONSTANTS.cacheControl, ServerSideEncryption: 'AES256' }) }; if (operation === 'get-object') return {}; if (operation === 'put-object') { puts += 1; const responseVersion = 'restore-version'; current = { etag: '"abcdef0123456789abcdef0123456789"', version: mismatch ? 'readback-version' : responseVersion, bytes: baselineBytes }; return { stdout: JSON.stringify({ ETag: current.etag, VersionId: responseVersion }) }; throw new Error('unexpected command') }; const execFile = async (_file, args) => { if (args[0] === 'sts') return { stdout: JSON.stringify({ Account: DATA_CONSTANTS.account }) }; if (args.includes('admin-create-user')) return { stdout: JSON.stringify({ User: { Username: 'internal-user' } }) }; if (args.includes('admin-get-user')) return { stdout: JSON.stringify({ Username: 'internal-user' }) }; if (args.includes('list-users-in-group') || args.includes('list-users')) return { stdout: JSON.stringify({ Users: [] }) }; return { stdout: '' } }; const browser = { async setup() { return { contexts: 2 } }, async load() { return proof.load }, async update() { current = { etag: proof.update.etag, version: proof.update.versionId, bytes: Buffer.from(JSON.stringify({ ...baselineDocument, updatedAt: proof.update.updatedAt, days: { ...baselineDocument.days, '2026-08-09': [1, 1, 2] } })) }; return { ...proof.update, document: { ...baselineDocument, updatedAt: proof.update.updatedAt, days: { ...baselineDocument.days, '2026-08-09': [1, 1, 2] } } } }, async stale() { return proof.stale }, async poll(input) { return { tuple: input.expected, attempts: 1 } }, async cleanup() {} }; const runOne = async readbackMismatch => { mismatch = readbackMismatch; puts = 0; removed.length = 0; current = { etag: DATA_CONSTANTS.baselineEtag, version: DATA_CONSTANTS.baselineVersionId, bytes: baselineBytes }; const result = await main([EXECUTION_FLAG], { command, execFile, browser, fs, randomBytesImpl: n => Buffer.alloc(n, 1) }); return result }; const failed = await runOne(true); assert.equal(failed.status, 'failed'); assert.equal(failed.restoreStatus, 'failed'); assert.equal(failed.recoveryMaterialRetained, true); assert.equal(puts, 1); assert.equal(removed.length, 0); mismatch = false; const success = await runOne(false); assert.equal(success.status, 'success'); assert.equal(puts, 1); assert.deepEqual(removed, [root]); assert.equal(removed.includes(parent), false)
}
})

function publicResponse({ status = 200, type = 'application/json', cache = DATA_CONSTANTS.cacheControl, body, length } = {}) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body ?? { days: { [DATA_CONSTANTS.date]: [0, 0, 0] } }))
  const values = { 'content-type': type, 'cache-control': cache, ...(length === undefined ? {} : { 'content-length': String(length) }) }
  return { status, headers: { get: name => values[name.toLowerCase()] ?? null }, arrayBuffer: async () => bytes }
}

test('public poll uses exact injected fetch boundary and retries tuple mismatch', async () => {
  const document = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { [DATA_CONSTANTS.date]: [0, 1, 2] } }
  const calls = []; let clears = 0; let sequence = [publicResponse({ type: 'application/json; charset=utf-8', body: { ...document, days: { [DATA_CONSTANTS.date]: [0, 1, 2] } } }), publicResponse({ body: { ...document, days: { [DATA_CONSTANTS.date]: [1, 1, 2] } } })]
  const result = await createPlaywrightDataBrowser({ fetchImpl: async (url, options) => { calls.push({ url, options }); return sequence.shift() }, timer: setTimeout, clearTimer: id => { clears += 1; clearTimeout(id) }, sleep: async () => {} }).poll({ expected: 1, maxAttempts: 3, maxMs: 1000 })
  assert.deepEqual(result, { tuple: 1, attempts: 2 }); assert.equal(calls.length, 2); assert.equal(calls[0].url, `${DATA_CONSTANTS.apiOrigin}/${DATA_CONSTANTS.key}`); assert.equal(calls[0].options.method, 'GET'); assert.equal(calls[0].options.cache, 'no-store'); assert.equal(calls[0].options.credentials, 'omit'); assert.deepEqual(calls[0].options.headers, { accept: 'application/json' }); assert.equal(calls[0].options.headers.authorization, undefined); assert.equal(clears >= 2, true)
})

test('public poll aborts pending fetch/body at the overall deadline and clears timers', async () => {
  let fetchAborted = false; let bodyAborted = false; let clears = 0
  const pendingFetch = (url, options) => new Promise((resolve, reject) => { options.signal.addEventListener('abort', () => { fetchAborted = true; reject(new Error('aborted')) }, { once: true }) })
  await assert.rejects(createPlaywrightDataBrowser({ fetchImpl: pendingFetch, timer: setTimeout, clearTimer: id => { clears += 1; clearTimeout(id) } }).poll({ expected: 1, maxAttempts: 5, maxMs: 20 }), /observation timeout/)
  const pendingBody = publicResponse({ body: Buffer.from('{}') }); pendingBody.arrayBuffer = () => new Promise((resolve, reject) => { pendingBody._reject = reject })
  await assert.rejects(createPlaywrightDataBrowser({ fetchImpl: async (_url, options) => { options.signal.addEventListener('abort', () => { bodyAborted = true }, { once: true }); return pendingBody }, timer: setTimeout, clearTimer: id => { clears += 1; clearTimeout(id) } }).poll({ expected: 1, maxAttempts: 5, maxMs: 20 }), /observation timeout/)
  assert.equal(fetchAborted, true); assert.equal(bodyAborted, true); assert.equal(clears > 0, true)
  const mismatch = publicResponse({ body: { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { [DATA_CONSTANTS.date]: [0, 1, 2] } } })
  await assert.rejects(createPlaywrightDataBrowser({ fetchImpl: async () => mismatch, sleep: () => new Promise(() => {}) }).poll({ expected: 1, maxAttempts: 5, maxMs: 20 }), /observation timeout/)
})

test('public poll enforces max attempts and rejects invalid bounded responses', async () => {
  let calls = 0; await assert.rejects(createPlaywrightDataBrowser({ fetchImpl: async () => { calls += 1; return publicResponse({ body: { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { [DATA_CONSTANTS.date]: [0, 1, 2] } } }) }, sleep: async () => {} }).poll({ expected: 1, maxAttempts: 3, maxMs: 500 }), /observation timeout/); assert.equal(calls, 3)
  const streamed = publicResponse({ body: Buffer.from('{}') }); streamed.body = { getReader: () => { let done = false; return { read: async () => { if (done) return { done: true }; done = true; return { done: false, value: Buffer.alloc(32769) } }, cancel: async () => {}, releaseLock: () => {} } } }
  for (const response of [publicResponse({ status: 500 }), publicResponse({ type: 'text/plain' }), publicResponse({ type: 'application/json; charset=utf-8', cache: 'no-store' }), publicResponse({ cache: `${DATA_CONSTANTS.cacheControl}; foo=bar` }), publicResponse({ body: Buffer.alloc(32769), length: 32769 }), publicResponse({ body: Buffer.from('{') }), { status: 200, headers: { get: name => name === 'content-type' ? 'application/json' : DATA_CONSTANTS.cacheControl } }, streamed]) await assert.rejects(createPlaywrightDataBrowser({ fetchImpl: async () => response, sleep: async () => {} }).poll({ expected: 1, maxAttempts: 1, maxMs: 500 }), /observation timeout/)
})

test('shared schedule parser rejects every malformed exact-month schema', async () => {
  const valid = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-08-11T00:00:00.000Z', days: { [DATA_CONSTANTS.date]: [0, 1, 2] } }
  const malformed = [
    Buffer.from('{'), Buffer.from(JSON.stringify(null)), Buffer.from(JSON.stringify([])), Buffer.from(JSON.stringify({ ...valid, extra: true })),
    Buffer.from(JSON.stringify({ ...valid, days: { '2026-07-31': [0, 1, 2] } })), Buffer.from(JSON.stringify({ ...valid, days: { '2026-08-32': [0, 1, 2] } })),
    Buffer.from(JSON.stringify({ ...valid, days: { [DATA_CONSTANTS.date]: [0, 1], '2026-08-10': [0, 1, 2] } })), Buffer.from(JSON.stringify({ ...valid, days: { [DATA_CONSTANTS.date]: [0, 3, 2], '2026-08-10': [0, 1, 2] } })), Buffer.from(JSON.stringify({ ...valid, days: { [DATA_CONSTANTS.date]: [0, null, 2] } })), Buffer.from(JSON.stringify({ ...valid, days: { [DATA_CONSTANTS.date]: [0, '1', 2] } })),
    Buffer.from(JSON.stringify({ ...valid, days: Object.fromEntries(Array.from({ length: 32 }, (_, index) => [`2026-08-${String(index + 1).padStart(2, '0')}`, [0, 1, 2]])) })),
  ]
  for (const bytes of malformed) { const response = publicResponse({ body: bytes }); await assert.rejects(createPlaywrightDataBrowser({ fetchImpl: async () => response }).poll({ expected: 1, maxAttempts: 1, maxMs: 500 }), /observation timeout/) }
})

test('public poll aborts and cancels a pending stream reader exactly once', async () => {
  let readerSignal; let cancelCount = 0; let releaseCount = 0; let resolveRead
  const response = publicResponse({ body: Buffer.from('{}') }); response.body = { getReader: options => { readerSignal = options.signal; return { read: () => new Promise(resolve => { resolveRead = resolve }), cancel: async () => { cancelCount += 1; resolveRead?.({ done: true }) }, releaseLock: () => { releaseCount += 1 } } } }
  await assert.rejects(createPlaywrightDataBrowser({ fetchImpl: async () => response }).poll({ expected: 1, maxAttempts: 1, maxMs: 20 }), /observation timeout/)
  assert.equal(readerSignal.aborted, true); assert.equal(cancelCount, 1); assert.equal(releaseCount, 1)
})

test('public poll leaves no active timers across success, exhaustion, and deadline paths', async () => {
  const tracked = () => { const active = new Set(); const timer = (fn, ms) => { const id = setTimeout(() => { active.delete(id); fn() }, ms); active.add(id); return id }; const clearTimer = id => { active.delete(id); clearTimeout(id) }; return { active, timer, clearTimer } }
  const valid = publicResponse({ body: { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-08-11T00:00:00.000Z', days: { [DATA_CONSTANTS.date]: [1, 1, 2] } } })
  for (const scenario of ['success', 'exhausted', 'fetch-timeout', 'body-timeout', 'sleep-timeout']) {
    const timers = tracked(); let fetchImpl
    if (scenario === 'success') fetchImpl = async () => valid
    else if (scenario === 'exhausted') fetchImpl = async () => publicResponse({ body: { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-08-11T00:00:00.000Z', days: { [DATA_CONSTANTS.date]: [0, 1, 2] } } })
    else if (scenario === 'fetch-timeout') fetchImpl = (_url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('late fetch')), { once: true }))
    else if (scenario === 'body-timeout') fetchImpl = async () => ({ status: 200, headers: { get: name => name === 'content-type' ? 'application/json' : DATA_CONSTANTS.cacheControl }, arrayBuffer: () => new Promise(() => {}) })
    else fetchImpl = async () => publicResponse({ body: { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-08-11T00:00:00.000Z', days: { [DATA_CONSTANTS.date]: [0, 1, 2] } } })
    const options = { fetchImpl, timer: timers.timer, clearTimer: timers.clearTimer, maxAttempts: 2, maxMs: 20 }
    const browser = createPlaywrightDataBrowser({ ...options, ...(scenario === 'sleep-timeout' ? { sleep: () => new Promise(() => {}) } : {}) })
    if (scenario === 'success') await browser.poll({ expected: 1, maxAttempts: 2, maxMs: 100 })
    else await assert.rejects(browser.poll({ expected: 1, maxAttempts: 2, maxMs: 20 }), /observation timeout/)
    assert.equal(timers.active.size, 0, scenario)
  }
})

test('public poll guards late fetch/body rejections after deadline', async () => {
  const unhandled = []; const listener = reason => unhandled.push(reason); process.on('unhandledRejection', listener)
  try {
    const late = (_url, options) => new Promise((resolve, reject) => { options.signal.addEventListener('abort', () => setTimeout(() => reject(new Error('late fetch')), 5), { once: true }) })
    await assert.rejects(createPlaywrightDataBrowser({ fetchImpl: late }).poll({ expected: 1, maxAttempts: 1, maxMs: 10 }), /observation timeout/)
    const response = publicResponse({ body: Buffer.from('{}') }); response.arrayBuffer = () => new Promise((resolve, reject) => setTimeout(() => reject(new Error('late body')), 5))
    await assert.rejects(createPlaywrightDataBrowser({ fetchImpl: async () => response }).poll({ expected: 1, maxAttempts: 1, maxMs: 10 }), /observation timeout/)
    await new Promise(resolve => setTimeout(resolve, 20)); assert.deepEqual(unhandled, [])
  } finally { process.off('unhandledRejection', listener) }
})

test('public poll never starts an attempt after the overall deadline', async () => {
  let now = 0; let calls = 0; const mismatch = publicResponse({ body: { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-08-11T00:00:00.000Z', days: { [DATA_CONSTANTS.date]: [0, 1, 2] } } })
  await assert.rejects(createPlaywrightDataBrowser({ clock: () => now, fetchImpl: async () => { calls += 1; return mismatch }, sleep: async () => { now = 100 } }).poll({ expected: 1, maxAttempts: 5, maxMs: 50 }), /observation timeout/); assert.equal(calls, 1)
})

test('low-level Playwright page boundary observes exact UI PUT JSON response', async () => {
  const document = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-08-11T00:00:00.000Z', days: { '2026-08-09': [1, 1, 2] } }
  const request = { method: () => 'PUT', url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, headers: () => ({ 'content-type': 'application/json', 'if-match': DATA_CONSTANTS.baselineEtag }), postDataJSON: () => ({ schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: document.days }) }
  const response = { status: () => 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => request, headers: () => ({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }), json: async () => ({ document, etag: '"0123456789abcdef0123456789abcdef"', versionId: 'version-2' }) }
  let requestListener
  const cell = { waitFor: async () => {}, isVisible: async () => true, isEnabled: async () => true, inputValue: async () => '0', selectOption: async value => { assert.equal(value, '1'); cell.inputValue = async () => '1' }, click: async () => {} }
  const save = { waitFor: async () => {}, isVisible: async () => true, isEnabled: async () => true, click: async ({ trial } = {}) => { if (!trial) requestListener?.(request) } }
  const page = { locator: selector => { assert.equal(selector, '[id="2026-08-09-0"]'); return cell }, on: (event, listener) => { if (event === 'request') requestListener = listener }, off: () => { requestListener = null }, waitForRequest: async () => request, waitForResponse: async () => response, getByRole: () => save }
  const browser = createPlaywrightDataBrowser({ launcher: async () => { throw new Error('launcher must not be used') } })
  const baselineDocument = { ...document, updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2] } }
  const result = await browser.submit(page, { ifMatch: DATA_CONSTANTS.baselineEtag, baselineDocument }, 1)
  assert.equal(result.status, 200); assert.equal(result.versionId, 'version-2'); assert.equal(result.tuple, 1)
})

test('low-level browser boundary rejects a second matching PUT', async () => {
  const document = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-08-11T00:00:00.000Z', days: { '2026-08-09': [1, 1, 2] } }
  const request = { method: () => 'PUT', url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, headers: () => ({ 'content-type': 'application/json', 'if-match': DATA_CONSTANTS.baselineEtag }), postDataJSON: () => ({ schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: document.days }) }
  const response = { status: () => 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => request, headers: () => ({ 'content-type': 'application/json', 'cache-control': 'no-store' }), json: async () => ({ document, etag: '"0123456789abcdef0123456789abcdef"', versionId: 'version-2' }) }
  let requestListener
  const cell = { waitFor: async () => {}, isVisible: async () => true, isEnabled: async () => true, inputValue: async () => '0', selectOption: async () => { cell.inputValue = async () => '1' }, click: async () => {} }
  const save = { waitFor: async () => {}, isVisible: async () => true, isEnabled: async () => true, click: async ({ trial } = {}) => { if (!trial) { requestListener(request); requestListener(request) } } }
  const page = { locator: selector => { assert.equal(selector, '[id="2026-08-09-0"]'); return cell }, on: (event, listener) => { if (event === 'request') requestListener = listener }, off: () => {}, waitForRequest: async () => request, waitForResponse: async () => response, getByRole: () => save }
  const browser = createPlaywrightDataBrowser({ launcher: async () => { throw new Error('launcher must not be used') } })
  await assert.rejects(browser.submit(page, { ifMatch: DATA_CONSTANTS.baselineEtag, baselineDocument: { ...document, updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2] } } }, 1), /UI PUT contract/)
})

function submitFixture({ requestOverrides = {}, responseOverrides = {}, responseJson, conflict = false, conflictUi = true, cellOptions = {}, saveOptions = {} } = {}) {
  const baseline = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2] } }
  const updated = { ...baseline, updatedAt: '2026-08-11T00:00:00.000Z', days: { '2026-08-09': [1, 1, 2] } }
  const request = { method: () => 'PUT', url: () => requestOverrides.url ?? `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, headers: () => ({ 'content-type': 'application/json', 'if-match': DATA_CONSTANTS.baselineEtag, ...requestOverrides.headers }), postDataJSON: () => ({ schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: updated.days, ...requestOverrides.body }) }
  let responseCount = 0
  const response = { status: () => conflict ? 409 : (responseOverrides.status ?? 200), url: () => responseOverrides.url ?? `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => request, headers: () => ({ 'content-type': 'application/json', 'cache-control': 'no-store', ...responseOverrides.headers }), json: async () => responseJson ?? { document: updated, etag: '"0123456789abcdef0123456789abcdef"', versionId: 'version-2' } }
  let requestListener; let saveClicks = 0
  const cellStarted = Date.now(); let cellValue = cellOptions.value ?? '0'; const cellEnabled = () => cellOptions.enableAfter === undefined ? cellOptions.enabled ?? true : Date.now() - cellStarted >= cellOptions.enableAfter; const cell = { waitFor: async () => { if (cellOptions.delay) await new Promise(resolve => setTimeout(resolve, cellOptions.delay)) }, isVisible: async () => cellOptions.visible ?? true, isEnabled: async () => cellEnabled(), inputValue: async () => cellValue, selectOption: async value => { cellValue = value }, click: async ({ timeout = 1000 } = {}) => { const deadline = Date.now() + timeout; while (!cellEnabled() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 1)); if (!cellEnabled()) throw new Error('not actionable') } }; const saveStarted = Date.now(); const saveEnabled = () => saveOptions.enableAfter === undefined ? saveOptions.enabled ?? true : Date.now() - saveStarted >= saveOptions.enableAfter; const save = { waitFor: async () => { if (saveOptions.delay) await new Promise(resolve => setTimeout(resolve, saveOptions.delay)) }, isVisible: async () => saveOptions.visible ?? true, isEnabled: async () => saveEnabled(), click: async ({ trial = false, timeout = 1000 } = {}) => { const deadline = Date.now() + timeout; while (!saveEnabled() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 1)); if (!saveEnabled()) throw new Error('not actionable'); if (!trial) { saveClicks += 1; if (requestListener) requestListener(request) } } }
  const page = { locator: selector => { assert.equal(selector, '[id="2026-08-09-0"]'); return cellOptions.missing ? {} : cell }, on: (event, listener) => { if (event === 'request') requestListener = listener }, off: () => { requestListener = null }, waitForRequest: async () => request, waitForResponse: async predicate => { responseCount += 1; if (conflict && responseCount === 2) return { status: () => 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => ({ method: () => 'GET' }), headers: () => ({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }), json: async () => ({ document: updated, etag: '"0123456789abcdef0123456789abcdef"' }) }; return response }, getByRole: (role, options) => role === 'button' && isSaveName(options.name) ? (saveOptions.missing ? {} : save) : ({ click: async () => {}, isVisible: async () => conflictUi }) }
  return { page, baseline, updated, saveClicks: () => saveClicks }
}

test('cell and localized Save readiness is bounded and fails before any PUT', async () => {
  const browser = createPlaywrightDataBrowser({ launcher: async () => { throw new Error('not used') }, responseTimeout: 30 })
  const delayed = submitFixture({ cellOptions: { enableAfter: 5 }, saveOptions: { enableAfter: 5 } })
  assert.equal((await browser.submit(delayed.page, { ifMatch: DATA_CONSTANTS.baselineEtag, baselineDocument: delayed.baseline }, 1)).status, 200)
  assert.equal(delayed.saveClicks(), 1)
  for (const cellOptions of [{ missing: true }, { visible: false }, { enabled: false }, { value: '1' }]) {
    const fixture = submitFixture({ cellOptions })
    await assert.rejects(browser.submit(fixture.page, { ifMatch: DATA_CONSTANTS.baselineEtag, baselineDocument: fixture.baseline }, 1), /target cell/)
    assert.equal(fixture.saveClicks(), 0)
  }
  for (const saveOptions of [{ missing: true }, { visible: false }, { enabled: false }]) {
    const fixture = submitFixture({ saveOptions })
    await assert.rejects(browser.submit(fixture.page, { ifMatch: DATA_CONSTANTS.baselineEtag, baselineDocument: fixture.baseline }, 1), /Save control/)
    assert.equal(fixture.saveClicks(), 0)
  }
  const started = Date.now(); const permanentlyDisabled = submitFixture({ saveOptions: { enabled: false } })
  await assert.rejects(browser.submit(permanentlyDisabled.page, { ifMatch: DATA_CONSTANTS.baselineEtag, baselineDocument: permanentlyDisabled.baseline }, 1), /Save control/)
  assert.ok(Date.now() - started < 500); assert.equal(permanentlyDisabled.saveClicks(), 0)
})

test('submit waiter rejections stay handled when Save click fails', async () => {
  let unhandled = 0; const onUnhandled = () => { unhandled += 1 }; process.on('unhandledRejection', onUnhandled)
  try {
    const fixture = submitFixture({ conflict: true }); const failingSave = { waitFor: async () => {}, isVisible: async () => true, isEnabled: async () => true, click: async ({ trial } = {}) => { if (!trial) throw new Error('click failed') } }
    fixture.page.getByRole = (_role, options) => isSaveName(options.name) ? failingSave : ({ click: async () => {}, isVisible: async () => true })
    fixture.page.waitForRequest = () => new Promise((resolve, reject) => setTimeout(() => reject(new Error('late request waiter')), 5))
    fixture.page.waitForResponse = () => new Promise((resolve, reject) => setTimeout(() => reject(new Error('late response waiter')), 5))
    await assert.rejects(createPlaywrightDataBrowser({ launcher: async () => { throw new Error('not used') }, responseTimeout: 30 }).submit(fixture.page, { ifMatch: DATA_CONSTANTS.baselineEtag, baselineDocument: fixture.baseline }, 1, true), /click failed/)
    await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(unhandled, 0)
  } finally { process.off('unhandledRejection', onUnhandled) }
})

test('low-level stale conflict resolves with one PUT, comparison GET, and localized UI', async () => {
  const fixture = submitFixture(); let puts = 0
  const browser = createPlaywrightDataBrowser({ launcher: async () => { throw new Error('not used') } })
  const updated = await browser.submit(fixture.page, { ifMatch: DATA_CONSTANTS.baselineEtag, baselineDocument: fixture.baseline }, 1); assert.equal(updated.status, 200)
  const conflict = submitFixture({ conflict: true }); let registered
  conflict.page.on = (event, listener) => { if (event === 'request') registered = request => { if (request.method() === 'PUT') puts += 1; listener(request) } }
  const conflictSave = { waitFor: async () => {}, isVisible: async () => true, isEnabled: async () => true, click: async ({ trial } = {}) => { if (!trial) registered?.(conflict.page.requestForTest) } }; conflict.page.getByRole = (role, options) => isSaveName(options.name) ? conflictSave : ({ click: async () => {}, isVisible: async () => true })
  conflict.page.requestForTest = { method: () => 'PUT', url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, headers: () => ({ 'content-type': 'application/json', 'if-match': DATA_CONSTANTS.baselineEtag }), postDataJSON: () => ({ schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: fixture.updated.days }) }
  const result = await browser.submit(conflict.page, { ifMatch: DATA_CONSTANTS.baselineEtag, baselineDocument: fixture.baseline }, 1, true)
  assert.deepEqual(result, { status: 409, etag: updated.etag, cacheControl: 'no-store', puts: 1, retries: 0, tuple: 1 }); assert.equal(puts, 1)
})

test('low-level launcher/context setup captures two independent authenticated GET baselines', async () => {
  const baseline = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2] } }
  const capturedEtag = '"11111111111111111111111111111111"'; let getCount = 0
  const makePage = () => {
    let getResolver
    const response = { status: () => 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => ({ method: () => 'GET' }), headers: () => ({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }), json: async () => ({ document: { ...baseline, days: { ...baseline.days } }, etag: capturedEtag }) }
    const control = { count: async () => 1, waitFor: async () => {}, isVisible: async () => true, isEnabled: async () => true, inputValue: async () => '0', fill: async () => {}, click: async () => {} }
    const form = { count: async () => 1, isVisible: async () => true, isEnabled: async () => true, locator: () => control }
    return { waitForResponse: () => response, goto: async () => { getCount += 1 }, waitForURL: async predicate => { for (const url of [`https://${DATA_CONSTANTS.hostedUiDomain}/login`, `${DATA_CONSTANTS.apiOrigin}/manage/callback`, `${DATA_CONSTANTS.apiOrigin}/manage`]) { try { if (predicate(url)) return } catch {} } throw new Error('unexpected URL') }, locator: selector => selector.startsWith('form') ? form : control, getByRole: (_role, options) => /Sign out|ログアウト/.test(options.name) ? { waitFor: async () => {} } : { click: async () => {} } }
  }
  const pages = [makePage(), makePage()]
  const launcher = async () => ({ newContext: async () => ({ newPage: async () => pages.shift(), close: async () => {} }), close: async () => {} })
  const browser = createPlaywrightDataBrowser({ launcher })
  assert.deepEqual(await browser.setup({ username: 'test', password: 'test', baseline: { document: baseline, etag: capturedEtag, tuple: 0 } }), { contexts: 2 })
  assert.equal(getCount, 2)
  assert.deepEqual(await browser.load({ etag: capturedEtag }), { adminEtag: capturedEtag, staleEtag: capturedEtag, tuple: 0 })
})

test('setup owns each GET waiter sequentially with finite timeout and no unhandled rejection', async () => {
  const baseline = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2] } }; const events = []; const timeouts = []; let unhandled = 0; const onUnhandled = () => { unhandled += 1 }; process.on('unhandledRejection', onUnhandled)
  const makePage = name => { const response = { status: () => 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => ({ method: () => 'GET' }), headers: () => ({ 'content-type': 'application/json', 'cache-control': 'no-store' }), json: async () => { throw new Error('body must not be read') } }; const control = { count: async () => 1, waitFor: async () => {}, isVisible: async () => true, isEnabled: async () => true, inputValue: async () => '0', fill: async () => {}, click: async () => {} }; const form = { count: async () => 1, isVisible: async () => true, isEnabled: async () => true, locator: () => control }; return { waitForResponse: (_predicate, options) => { events.push(`${name}:transport`); timeouts.push(options.timeout); return Promise.resolve(response) }, goto: async () => events.push(`${name}:goto`), waitForURL: async () => {}, locator: selector => selector.startsWith('form') ? form : control, getByRole: (_role, options) => /Sign out|ログアウト/.test(options.name) ? { waitFor: async () => {} } : { click: async () => {} } } }
  const pages = [makePage('page1'), makePage('page2')]; let contextCloses = 0; let browserCloses = 0; const launcher = async () => ({ newContext: async () => ({ newPage: async () => pages.shift(), close: async () => { contextCloses += 1 } }), close: async () => { browserCloses += 1 } }); const browser = createPlaywrightDataBrowser({ launcher, responseTimeout: 1234 }); await browser.setup({ username: 'test', password: 'test', baseline: { document: baseline, etag: DATA_CONSTANTS.baselineEtag, tuple: 0 } }); await new Promise(resolve => setImmediate(resolve)); process.off('unhandledRejection', onUnhandled); assert.deepEqual(timeouts, [1234, 1234]); assert.equal(events.indexOf('page1:transport') >= 0, true); assert.equal(events.indexOf('page1:transport') < events.indexOf('page2:transport'), true); await browser.cleanup(); await browser.cleanup(); assert.equal(contextCloses, 2); assert.equal(browserCloses, 1); assert.equal(unhandled, 0)
})

test('first or second GET waiter rejection is consumed and cleanup closes all resources once', async () => {
  for (const rejected of [0, 1]) { let index = 0; let contextCloses = 0; let browserCloses = 0; let unhandled = 0; const onUnhandled = () => { unhandled += 1 }; process.on('unhandledRejection', onUnhandled); const response = { status: () => 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => ({ method: () => 'GET' }), headers: () => ({ 'content-type': 'application/json', 'cache-control': 'no-store' }), json: async () => ({ document: { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2] } }, etag: DATA_CONSTANTS.baselineEtag }) }; const pages = [0, 1].map(pageIndex => { const control = { count: async () => 1, waitFor: async () => {}, isVisible: async () => true, isEnabled: async () => true, inputValue: async () => '0', fill: async () => {}, click: async () => {} }; const form = { count: async () => 1, isVisible: async () => true, isEnabled: async () => true, locator: () => control }; return { waitForResponse: () => pageIndex === rejected ? Promise.reject(new Error('waiter')) : Promise.resolve(response), goto: async () => {}, waitForURL: async () => {}, locator: selector => selector.startsWith('form') ? form : control, getByRole: (_role, options) => /Sign out|ログアウト/.test(options.name) ? { waitFor: async () => {} } : { click: async () => {} } } }); const launcher = async () => ({ newContext: async () => ({ newPage: async () => pages[index++], close: async () => { contextCloses += 1 } }), close: async () => { browserCloses += 1 } }); const browser = createPlaywrightDataBrowser({ launcher }); let thrown; try { await browser.setup({ username: 'test', password: 'test', baseline: browserBaseline }) } catch (error) { thrown = error }; assert.deepEqual(thrown, { name: 'DataSetupSubstageError', category: 'authenticated-api-response', context: rejected === 0 ? 'first' : 'second', reason: 'response-missing' }); await browser.cleanup(); await new Promise(resolve => setImmediate(resolve)); process.off('unhandledRejection', onUnhandled); assert.equal(unhandled, 0); assert.equal(contextCloses, rejected === 0 ? 1 : 2); assert.equal(browserCloses, 1) }
})

test('late GET waiter rejection during pending login stays handled and propagates after cleanup', async () => {
  let contextCloses = 0; let browserCloses = 0; let unhandled = 0; const onUnhandled = () => { unhandled += 1 }; process.on('unhandledRejection', onUnhandled); const control = { count: async () => 1, isVisible: async () => true, isEnabled: async () => true, fill: async () => {}, click: async () => {} }; const form = { count: async () => 1, isVisible: async () => true, isEnabled: async () => true, locator: selector => control }; const page = { waitForResponse: () => new Promise((_, reject) => setTimeout(() => reject(new Error('late waiter')), 5)), goto: async () => new Promise(resolve => setTimeout(resolve, 30)), waitForURL: async () => {}, locator: selector => selector.startsWith('form') ? form : control, getByRole: (_role, options) => /Sign out|ログアウト/.test(options?.name) ? { waitFor: async () => {} } : { click: async () => {} } }; const launcher = async () => ({ newContext: async () => ({ newPage: async () => page, close: async () => { contextCloses += 1 } }), close: async () => { browserCloses += 1 } }); const browser = createPlaywrightDataBrowser({ launcher, browserRoleSession: async () => {}, signedInSentinel: async () => {} }); await assert.rejects(browser.setup({ username: 'test', password: 'test', baseline: browserBaseline }), { name: 'DataSetupSubstageError', category: 'authenticated-api-response', context: 'first', reason: 'response-missing' }); await browser.cleanup(); await new Promise(resolve => setImmediate(resolve)); process.off('unhandledRejection', onUnhandled); assert.equal(unhandled, 0); assert.equal(contextCloses, 1); assert.equal(browserCloses, 1)
})

test('concrete setup failure cleans its temporary identity without entering data stages', async () => {
  const calls = []; const files = new Map(); const modes = new Map(); const root = '/repo/.artifacts/migration/t16-data-setup-failure'; const parent = '/repo/.artifacts/migration'; const fs = { async mkdir() {}, async chmod(path, mode) { modes.set(path, { mode, isDirectory: () => path === parent || path === root, isFile: () => path !== parent && path !== root }) }, async mkdtemp() { modes.set(root, { mode: 0o700, isDirectory: () => true }); return root }, async writeFile(path, data) { files.set(path, Buffer.from(data)); modes.set(path, { mode: 0o600, isFile: () => true }) }, async unlink(path) { files.delete(path) }, async rm() {}, async lstat(path) { return modes.get(path) ?? { mode: 0o600, isFile: () => true } }, async readFile(path) { return files.get(path) ?? Buffer.alloc(0) } }; const execFile = async (_file, args) => { calls.push(args); if (args[0] === 'sts') return { stdout: JSON.stringify({ Account: DATA_CONSTANTS.account }) }; if (args.includes('admin-create-user')) return { stdout: JSON.stringify({ User: { Username: 'internal-user' } }) }; if (args.includes('admin-get-user')) return { stdout: JSON.stringify({ Username: 'internal-user' }) }; if (args.includes('list-users-in-group') || args.includes('list-users')) return { stdout: JSON.stringify({ Users: [] }) }; return { stdout: '' } }; let updates = 0; const browser = { async setup() { throw new Error('setup failure') }, async cleanup() {} }; const adapters = createConcreteDataAdapters({ execFile, browser, fs, randomBytesImpl: n => Buffer.alloc(n, 1) }); await assert.rejects(adapters.setup({ username: 'ignored', password: 'ignored' }), /setup failure/); await adapters.cleanup({ restoreStatus: 'failed', restoreAttempted: true, recoveryMaterialRetained: true }); assert.equal(calls.some(args => args.includes('put-object')), false); assert.equal(updates, 0); assert.equal(calls.some(args => args.includes('admin-remove-user-from-group')), true); assert.equal(calls.some(args => args.includes('admin-delete-user')), true); assert.doesNotMatch(JSON.stringify(calls), /ignored/)
})

test('authenticated GET transport validator rejects every malformed contract without reading body', async () => {
  const document = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2] } }
  const valid = { status: () => 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => ({ method: () => 'GET' }), headers: () => ({ 'content-type': 'application/json', 'cache-control': 'no-store' }), json: () => { throw new Error('body must not be read') } }
  const cases = [
    ['origin', { url: () => `https://evil.invalid${DATA_CONSTANTS.apiPath}` }], ['path', { url: () => `${DATA_CONSTANTS.apiOrigin}/wrong` }], ['status', { status: () => 204 }],
    ['content type', { headers: () => ({ 'content-type': 'text/plain', 'cache-control': 'no-store' }) }], ['cache', { headers: () => ({ 'content-type': 'application/json', 'cache-control': 'public' }) }],
  ]
  for (const [name, overrides] of cases) assert.throws(() => validateAuthenticatedGetTransport({ ...valid, ...overrides }), /contract|missing/, name)
  assert.doesNotThrow(() => validateAuthenticatedGetTransport(valid))
})

test('browser baseline proof rejects missing, malformed, weak, and nonzero tuple captures', () => {
  assert.deepEqual(validateBrowserBaseline(browserBaseline).tuple, 0)
  for (const bad of [undefined, {}, { ...browserBaseline, etag: 'weak' }, { ...browserBaseline, tuple: 1 }, { ...browserBaseline, document: { ...browserBaseline.document, days: { ...browserBaseline.document.days, '2026-08-09': [1, 1, 2] } } }, { ...browserBaseline, extra: true }]) assert.throws(() => validateBrowserBaseline(bad), /baseline mismatch/)
})

test('browser baseline clones are independent authoritative copies', () => {
  const first = validateBrowserBaseline(browserBaseline)
  const second = validateBrowserBaseline(browserBaseline)
  first.document.days[DATA_CONSTANTS.date][DATA_CONSTANTS.slot] = DATA_CONSTANTS.after
  assert.equal(second.document.days[DATA_CONSTANTS.date][DATA_CONSTANTS.slot], DATA_CONSTANTS.before)
  assert.equal(browserBaseline.document.days[DATA_CONSTANTS.date][DATA_CONSTANTS.slot], DATA_CONSTANTS.before)
})

test('hosted UI redirect retries once per logical context with fresh pages and exact cleanup', async () => {
  let created = 0; let closed = 0; let browserClosed = 0; let roleCalls = 0; let pageNumber = 0
  const makePage = () => { const response = { status: () => 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => ({ method: () => 'GET' }), headers: () => ({ 'content-type': 'application/json', 'cache-control': 'no-store' }) }; const control = readyCell(); return { waitForResponse: () => Promise.resolve(response), goto: async () => {}, waitForURL: async () => {}, locator: () => control, getByRole: role => role === 'alert' ? alertNone() : {} } }
  const launcher = async () => ({ newContext: async () => { created += 1; const page = makePage(); return { newPage: async () => { pageNumber += 1; return page }, close: async () => { closed += 1 } } }, close: async () => { browserClosed += 1 } })
  const browser = createPlaywrightDataBrowser({ launcher, browserRoleSession: async () => { roleCalls += 1; if (roleCalls % 2 === 1) throw new Error('hosted-ui-redirect-timeout') }, signedInSentinel: async () => {} })
  assert.deepEqual(await browser.setup({ username: 'opaque', password: 'opaque', baseline: browserBaseline }), { contexts: 2 }); assert.equal(created, 4); assert.equal(pageNumber, 4); await browser.cleanup(); await browser.cleanup(); assert.equal(closed, 4); assert.equal(browserClosed, 1)
})

test('two hosted UI redirect failures stop after two attempts without data work', async () => {
  let created = 0; let closed = 0; let browserClosed = 0
  const launcher = async () => ({ newContext: async () => { created += 1; return { newPage: async () => ({ waitForResponse: () => Promise.resolve({ status: () => 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => ({ method: () => 'GET' }), headers: () => ({ 'content-type': 'application/json', 'cache-control': 'no-store' }) }), goto: async () => {}, waitForURL: async () => {}, locator: () => readyCell(), getByRole: role => role === 'alert' ? alertNone() : {} }), close: async () => { closed += 1 } } }, close: async () => { browserClosed += 1 } })
  const browser = createPlaywrightDataBrowser({ launcher, browserRoleSession: async () => { throw new Error('hosted-ui-redirect-timeout') }, signedInSentinel: async () => {} }); await assert.rejects(browser.setup({ username: 'opaque', password: 'opaque', baseline: browserBaseline }), { name: 'DataSetupSubstageError', category: 'hosted-ui-redirect', context: 'first' }); await browser.cleanup(); assert.equal(created, 2); assert.equal(closed, 2); assert.equal(browserClosed, 1)
})

test('non-redirect setup failures receive one attempt and no retry', async () => {
  let created = 0; let closed = 0; let browserClosed = 0
  const launcher = async () => ({ newContext: async () => { created += 1; return { newPage: async () => ({ waitForResponse: () => Promise.resolve({ status: () => 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => ({ method: () => 'GET' }), headers: () => ({ 'content-type': 'application/json', 'cache-control': 'no-store' }) }), goto: async () => {}, waitForURL: async () => {}, locator: () => readyCell(), getByRole: role => role === 'alert' ? alertNone() : {} }), close: async () => { closed += 1 } } }, close: async () => { browserClosed += 1 } })
  const browser = createPlaywrightDataBrowser({ launcher, browserRoleSession: async () => { throw { category: 'form-ambiguous' } }, signedInSentinel: async () => {} }); await assert.rejects(browser.setup({ username: 'opaque', password: 'opaque', baseline: browserBaseline }), { name: 'DataSetupSubstageError', category: 'form-submission', context: 'first' }); await browser.cleanup(); assert.equal(created, 1); assert.equal(closed, 1); assert.equal(browserClosed, 1)
})

test('low-level PUT contract negative matrix rejects without hanging', async () => {
  const cases = [
    ['wrong origin', { requestOverrides: { url: 'https://evil.invalid/x' } }],
    ['wrong path', { responseOverrides: { url: `${DATA_CONSTANTS.apiOrigin}/wrong` } }],
    ['wrong content type', { requestOverrides: { headers: { 'content-type': 'text/plain' } } }],
    ['wrong if-match', { requestOverrides: { headers: { 'if-match': '"weak"' } } }],
    ['case-changed if-match', { requestOverrides: { headers: { 'if-match': '"0123456789ABCDEF0123456789ABCDEF"' } } }],
    ['if-none-match', { requestOverrides: { headers: { 'if-none-match': '*' } } }],
    ['extra body', { requestOverrides: { body: { extra: true } } }],
    ['wrong status', { responseOverrides: { status: 201 } }],
    ['wrong response content type', { responseOverrides: { headers: { 'content-type': 'text/plain' } } }],
    ['wrong response cache', { responseOverrides: { headers: { 'cache-control': 'public' } } }],
    ['weak response etag', { responseJson: { document: { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-08-11T00:00:00.000Z', days: { '2026-08-09': [1, 1, 2] } }, etag: 'weak', versionId: 'v' } }],
    ['empty version', { responseJson: { document: { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-08-11T00:00:00.000Z', days: { '2026-08-09': [1, 1, 2] } }, etag: '"0123456789abcdef0123456789abcdef"', versionId: '' } }],
  ]
  for (const [name, options] of cases) { const fixture = submitFixture(options); const browser = createPlaywrightDataBrowser({ launcher: async () => { throw new Error('not used') } }); await assert.rejects(browser.submit(fixture.page, { ifMatch: DATA_CONSTANTS.baselineEtag, baselineDocument: fixture.baseline }, 1), /contract|etag|timestamp|mismatch/, name) }
})

test('submit rejects unchanged server timestamp and missing conflict controls', async () => {
  const timestamp = submitFixture({ responseJson: { document: { ...submitFixture().updated, updatedAt: '2026-01-01T00:00:00.000Z' }, etag: '"0123456789abcdef0123456789abcdef"', versionId: 'version-2' } })
  const browser = createPlaywrightDataBrowser({ launcher: async () => { throw new Error('not used') } })
  await assert.rejects(browser.submit(timestamp.page, { ifMatch: DATA_CONSTANTS.baselineEtag, baselineDocument: timestamp.baseline }, 1), /timestamp|mismatch/)
  const missing = submitFixture({ conflict: true, conflictUi: false }); const result = submitFixture(); const accepted = await browser.submit(result.page, { ifMatch: DATA_CONSTANTS.baselineEtag, baselineDocument: result.baseline }, 1); assert.equal(accepted.status, 200)
  let missingRegistered; missing.page.on = (event, listener) => { if (event === 'request') missingRegistered = listener }; const missingSave = { waitFor: async () => {}, isVisible: async () => true, isEnabled: async () => true, click: async ({ trial } = {}) => { if (!trial) missingRegistered?.(missing.page.requestForTest) } }; missing.page.getByRole = (_role, options) => isSaveName(options.name) ? missingSave : ({ click: async () => {}, isVisible: async () => false }); missing.page.requestForTest = { method: () => 'PUT', url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, headers: () => ({ 'content-type': 'application/json', 'if-match': DATA_CONSTANTS.baselineEtag }), postDataJSON: () => ({ schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: missing.updated.days }) }
  await assert.rejects(browser.submit(missing.page, { ifMatch: DATA_CONSTANTS.baselineEtag, baselineDocument: missing.baseline }, 1, true), /conflict UI missing/)
})

test('whole-document comparison is semantic, not JSON property-order sensitive', () => {
  const baseline = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2] } }
  const reordered = { days: { '2026-08-09': [1, 1, 2] }, yearMonth: '2026-08', stadium: 'oda', schemaVersion: 1, updatedAt: '2026-08-11T00:00:00.000Z' }
  assert.equal(validateOneCellDelta(baseline, reordered, { requireUpdatedAt: true }), reordered)
})

test('whole-document delta rejects every non-target mutation and stale timestamp', () => {
  const baseline = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2], '2026-08-10': [1, 2, 0] } }
  const accepted = { ...baseline, updatedAt: '2026-08-11T00:00:00.000Z', days: { ...baseline.days, '2026-08-09': [1, 1, 2] } }
  assert.equal(validateOneCellDelta(baseline, accepted, { requireUpdatedAt: true }), accepted)
  for (const candidate of [
    { ...accepted, days: { ...accepted.days, '2026-08-10': [2, 2, 0] } },
    { ...accepted, days: { ...accepted.days, '2026-08-09': [1, 2, 2] } },
    { ...accepted, days: { ...accepted.days, '2026-08-11': [1, 1, 1] } },
    { ...accepted, updatedAt: baseline.updatedAt },
    { ...accepted, unknown: true },
  ]) assert.throws(() => validateOneCellDelta(baseline, candidate, { requireUpdatedAt: true }), /mismatch|timestamp/)
})
