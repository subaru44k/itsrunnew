import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { DATA_CONSTANTS, EXECUTION_FLAG, createConcreteDataAdapters, createPlaywrightDataBrowser, main, parseDataArgs, runDataRehearsal, runDirect, safeArgs, safeBucketArgs, createProtectedDataCli, validateOneCellDelta, validateAuthenticatedGetResponse, validateBucketGates, classifyCurrentObject } from './t16-data-preview.mjs'

const proof = {
  preflight: { users: 0, admins: 0, bytes: 501, etag: DATA_CONSTANTS.baselineEtag, versionId: DATA_CONSTANTS.baselineVersionId, sha256: DATA_CONSTANTS.baselineSha256, tuple: 0 },
  capture: { bytes: 501, sha256: DATA_CONSTANTS.baselineSha256, etag: DATA_CONSTANTS.baselineEtag, versionId: DATA_CONSTANTS.baselineVersionId },
  setup: { contexts: 2 },
  load: { adminEtag: DATA_CONSTANTS.baselineEtag, staleEtag: DATA_CONSTANTS.baselineEtag, tuple: 0 },
  update: { status: 200, etag: '"0123456789abcdef0123456789abcdef"', versionId: 'test-version', cacheControl: 'no-store', updatedAt: '2026-08-11T00:00:00.000Z', document: { days: { '2026-08-09': [1, 1, 2] } }, tuple: 1, puts: 1 },
  stale: { status: 409, etag: '"0123456789abcdef0123456789abcdef"', cacheControl: 'no-store', puts: 1, retries: 0, tuple: 1 },
  restore: { status: 200, etag: '"restored-etag"', versionId: 'restored-version', bytes: 501, sha256: DATA_CONSTANTS.baselineSha256, tuple: 0 },
  cleanup: { users: 0, admins: 0 },
}

function adapters({ fail = null, order = [] } = {}) {
  const make = stage => async input => { order.push(stage); if (fail === stage) throw new Error('canary'); return proof[stage] }
  return { preflight: make('preflight'), capture: make('capture'), setup: make('setup'), load: make('load'), update: make('update'), readCurrent: async () => ({ state: 'test', etag: proof.update.etag, versionId: proof.update.versionId, tuple: 1 }), stale: make('stale'), poll: async input => { order.push(`poll-${input.expected}`); return { tuple: input.expected, attempts: 1 } }, restore: make('restore'), cleanup: make('cleanup') }
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
  const expectedTest = { etag: valid.head.ETag, versionId: valid.head.VersionId, document: testDocument, sha256: createHash('sha256').update(valid.bytes).digest('hex') }; assert.deepEqual(classifyCurrentObject(valid, baseline, expectedTest).state, 'test')
  for (const bad of [
    { ...valid, bytes: Buffer.from('wrong') }, { ...valid, parsed: { document: { ...testDocument, days: { ...testDocument.days, '2026-08-10': [2, 2, 0] } }, tuple: 1 } },
    { ...valid, parsed: { document: { ...testDocument, updatedAt: baselineDocument.updatedAt }, tuple: 1 } }, { ...valid, head: { ...valid.head, ContentType: 'text/plain' } },
    { ...valid, head: { ...valid.head, CacheControl: 'public' } }, { ...valid, head: { ...valid.head, ETag: 'weak' } }, { ...valid, head: { ...valid.head, VersionId: '' } },
  ]) assert.doesNotThrow(() => assert.deepEqual(classifyCurrentObject(bad, baseline, expectedTest), { state: 'unknown' }))
  assert.deepEqual(classifyCurrentObject(valid, baseline, { etag: '"other"', versionId: valid.head.VersionId, document: testDocument }), { state: 'unknown' }); assert.deepEqual(classifyCurrentObject(valid, baseline, { etag: valid.head.ETag, versionId: 'other', document: testDocument }), { state: 'unknown' }); assert.deepEqual(classifyCurrentObject(valid, baseline, { etag: valid.head.ETag, versionId: valid.head.VersionId, document: baselineDocument }), { state: 'unknown' })
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
    if (args[1] === 'get-object') { const bytes = currentEtag === proof.update.etag ? Buffer.from(`${JSON.stringify({ ...baselineDocument, updatedAt: proof.update.updatedAt, days: { ...baselineDocument.days, '2026-08-09': [1, 1, 2] } }, null, 2)}\n`) : baseline; await (await import('node:fs/promises')).writeFile(args.at(-1), bytes); return { stdout: '', stderr: '' } }
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

test('low-level Playwright page boundary observes exact UI PUT JSON response', async () => {
  const document = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-08-11T00:00:00.000Z', days: { '2026-08-09': [1, 1, 2] } }
  const request = { method: () => 'PUT', url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, headers: () => ({ 'content-type': 'application/json', 'if-match': DATA_CONSTANTS.baselineEtag }), postDataJSON: () => ({ schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: document.days }) }
  const response = { status: () => 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => request, headers: () => ({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }), json: async () => ({ document, etag: '"0123456789abcdef0123456789abcdef"', versionId: 'version-2' }) }
  let requestListener
  const page = { locator: () => ({ selectOption: async value => assert.equal(value, '1') }), on: (event, listener) => { if (event === 'request') requestListener = listener }, off: () => { requestListener = null }, waitForRequest: async () => request, waitForResponse: async () => response, getByRole: () => ({ click: async () => { requestListener?.(request) } }) }
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
  const page = { locator: () => ({ selectOption: async () => {} }), on: (event, listener) => { if (event === 'request') requestListener = listener }, off: () => {}, waitForRequest: async () => request, waitForResponse: async () => response, getByRole: () => ({ click: async () => { requestListener(request); requestListener(request) } }) }
  const browser = createPlaywrightDataBrowser({ launcher: async () => { throw new Error('launcher must not be used') } })
  await assert.rejects(browser.submit(page, { ifMatch: DATA_CONSTANTS.baselineEtag, baselineDocument: { ...document, updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2] } } }, 1), /UI PUT contract/)
})

function submitFixture({ requestOverrides = {}, responseOverrides = {}, responseJson, conflict = false, conflictUi = true } = {}) {
  const baseline = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2] } }
  const updated = { ...baseline, updatedAt: '2026-08-11T00:00:00.000Z', days: { '2026-08-09': [1, 1, 2] } }
  const request = { method: () => 'PUT', url: () => requestOverrides.url ?? `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, headers: () => ({ 'content-type': 'application/json', 'if-match': DATA_CONSTANTS.baselineEtag, ...requestOverrides.headers }), postDataJSON: () => ({ schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: updated.days, ...requestOverrides.body }) }
  let responseCount = 0
  const response = { status: () => conflict ? 409 : (responseOverrides.status ?? 200), url: () => responseOverrides.url ?? `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => request, headers: () => ({ 'content-type': 'application/json', 'cache-control': 'no-store', ...responseOverrides.headers }), json: async () => responseJson ?? { document: updated, etag: '"0123456789abcdef0123456789abcdef"', versionId: 'version-2' } }
  let requestListener
  const page = { locator: () => ({ selectOption: async () => {} }), on: (event, listener) => { if (event === 'request') requestListener = listener }, off: () => { requestListener = null }, waitForRequest: async () => request, waitForResponse: async predicate => { responseCount += 1; if (conflict && responseCount === 2) return { status: () => 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => ({ method: () => 'GET' }), headers: () => ({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }), json: async () => ({ document: updated, etag: '"0123456789abcdef0123456789abcdef"' }) }; return response }, getByRole: (role, options) => ({ click: async () => { if (role === 'button' && /Save|保存/.test(options.name)) requestListener?.(request) }, isVisible: async () => conflictUi }) }
  return { page, baseline, updated }
}

test('low-level stale conflict resolves with one PUT, comparison GET, and localized UI', async () => {
  const fixture = submitFixture(); let puts = 0
  const browser = createPlaywrightDataBrowser({ launcher: async () => { throw new Error('not used') } })
  const updated = await browser.submit(fixture.page, { ifMatch: DATA_CONSTANTS.baselineEtag, baselineDocument: fixture.baseline }, 1); assert.equal(updated.status, 200)
  const conflict = submitFixture({ conflict: true }); let registered
  conflict.page.on = (event, listener) => { if (event === 'request') registered = request => { if (request.method() === 'PUT') puts += 1; listener(request) } }
  conflict.page.getByRole = (role, options) => ({ click: async () => { if (role === 'button' && /Save|保存/.test(options.name)) registered?.(conflict.page.requestForTest) }, isVisible: async () => true })
  conflict.page.requestForTest = { method: () => 'PUT', url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, headers: () => ({ 'content-type': 'application/json', 'if-match': DATA_CONSTANTS.baselineEtag }), postDataJSON: () => ({ schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: fixture.updated.days }) }
  const result = await browser.submit(conflict.page, { ifMatch: DATA_CONSTANTS.baselineEtag, baselineDocument: fixture.baseline }, 1, true)
  assert.deepEqual(result, { status: 409, etag: updated.etag, cacheControl: 'no-store', puts: 1, retries: 0, tuple: 1 }); assert.equal(puts, 1)
})

test('low-level launcher/context setup captures two independent authenticated GET baselines', async () => {
  const baseline = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2] } }
  let getCount = 0
  const makePage = () => {
    let getResolver
    const response = { status: () => 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => ({ method: () => 'GET' }), headers: () => ({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }), json: async () => ({ document: { ...baseline, days: { ...baseline.days } }, etag: DATA_CONSTANTS.baselineEtag }) }
    const control = { count: async () => 1, isVisible: async () => true, isEnabled: async () => true, fill: async () => {}, click: async () => {} }
    const form = { count: async () => 1, isVisible: async () => true, isEnabled: async () => true, locator: () => control }
    return { waitForResponse: () => response, goto: async () => { getCount += 1 }, waitForURL: async predicate => { for (const url of [`https://${DATA_CONSTANTS.hostedUiDomain}/login`, `${DATA_CONSTANTS.apiOrigin}/manage/callback`, `${DATA_CONSTANTS.apiOrigin}/manage`]) { try { if (predicate(url)) return } catch {} } throw new Error('unexpected URL') }, locator: selector => selector.startsWith('form') ? form : control, getByRole: (_role, options) => /Sign out|ログアウト/.test(options.name) ? { waitFor: async () => {} } : { click: async () => {} } }
  }
  const pages = [makePage(), makePage()]
  const launcher = async () => ({ newContext: async () => ({ newPage: async () => pages.shift(), close: async () => {} }), close: async () => {} })
  const browser = createPlaywrightDataBrowser({ launcher })
  assert.deepEqual(await browser.setup({ username: 'test', password: 'test' }), { contexts: 2 })
  assert.equal(getCount, 2)
  assert.deepEqual(await browser.load({ etag: DATA_CONSTANTS.baselineEtag }), { adminEtag: DATA_CONSTANTS.baselineEtag, staleEtag: DATA_CONSTANTS.baselineEtag, tuple: 0 })
})

test('authenticated GET validator rejects every malformed baseline contract', async () => {
  const document = { schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-08-09': [0, 1, 2] } }
  const valid = { status: () => 200, url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, request: () => ({ method: () => 'GET' }), headers: () => ({ 'content-type': 'application/json', 'cache-control': 'no-store' }), json: async () => ({ document, etag: DATA_CONSTANTS.baselineEtag }) }
  const cases = [
    ['origin', { url: () => `https://evil.invalid${DATA_CONSTANTS.apiPath}` }], ['path', { url: () => `${DATA_CONSTANTS.apiOrigin}/wrong` }], ['status', { status: () => 204 }],
    ['content type', { headers: () => ({ 'content-type': 'text/plain', 'cache-control': 'no-store' }) }], ['cache', { headers: () => ({ 'content-type': 'application/json', 'cache-control': 'public' }) }],
    ['body shape', { json: async () => ({ document, etag: DATA_CONSTANTS.baselineEtag, versionId: 'bad' }) }], ['weak ETag', { json: async () => ({ document, etag: 'W/"weak"' }) }],
  ]
  for (const [name, overrides] of cases) await assert.rejects(validateAuthenticatedGetResponse({ ...valid, ...overrides }), /contract|shape|proof/, name)
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
  let missingRegistered; missing.page.on = (event, listener) => { if (event === 'request') missingRegistered = listener }; missing.page.getByRole = () => ({ click: async () => missingRegistered?.(missing.page.requestForTest), isVisible: async () => false }); missing.page.requestForTest = { method: () => 'PUT', url: () => `${DATA_CONSTANTS.apiOrigin}${DATA_CONSTANTS.apiPath}`, headers: () => ({ 'content-type': 'application/json', 'if-match': DATA_CONSTANTS.baselineEtag }), postDataJSON: () => ({ schemaVersion: 1, stadium: 'oda', yearMonth: '2026-08', days: missing.updated.days }) }
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
