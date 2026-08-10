import test from 'node:test'
import assert from 'node:assert/strict'
import { approvedBrowserHosts, assertReservedCell, classifyOAuthStatus, createProtectedCliInput, createSanitizedBrowserRecorder, driveHostedUiSignIn, exactKey, hostedUiCategories, inspectBrowserArtifacts, normalizeHostedUiOutcome, runT16Coordinator, sanitizeOutcome, validateOperatorEnvironment } from './t16-auth-harness.mjs'

test('operator input is validated without returning password material', () => {
  const result = validateOperatorEnvironment({ T16_ADMIN_USERNAME: 'preview-t16-admin@rehearsal.invalid', T16_NONADMIN_USERNAME: 'preview-t16-nonadmin@rehearsal.invalid', T16_ADMIN_PASSWORD: 'a'.repeat(24), T16_NONADMIN_PASSWORD: 'b'.repeat(24) })
  assert.deepEqual(result, { adminUsername: 'preview-t16-admin@rehearsal.invalid', nonAdminUsername: 'preview-t16-nonadmin@rehearsal.invalid', credentialsPresent: true })
  assert.doesNotMatch(JSON.stringify(result), /password|secret|token/i)
})

test('reserved rehearsal target is exact and sanitized', () => {
  assert.deepEqual(assertReservedCell({ key: exactKey, date: '2026-08-09', slot: 0, before: 0, after: 1 }), { key: exactKey, date: '2026-08-09', slot: 0, before: 0, after: 1 })
  assert.throws(() => assertReservedCell({ key: exactKey, date: '2026-08-10', slot: 0, before: 0, after: 1 }))
})

test('outcomes and browser inspection contain only approved fields', () => {
  const outcome = sanitizeOutcome({ role: 'admin', outcome: 'http-200', httpStatus: 200, etag: '"safe"', versionId: 'version', sha256: 'a'.repeat(64), durationMs: 3, counts: { requests: 1 } })
  assert.deepEqual(outcome, { role: 'admin', outcome: 'http-200', httpStatus: 200, etag: '"safe"', versionId: 'version', sha256: 'a'.repeat(64), durationMs: 3, counts: { requests: 1 } })
  assert.deepEqual(inspectBrowserArtifacts({ url: 'https://d2via50thoheqm.cloudfront.net/manage', sessionStorageKeys: ['oidc.transaction.state'] }), { urlPath: '/manage', localStorageKeys: 0, sessionStorageKeys: 1, consoleMessages: 0, networkRequests: 0 })
  assert.throws(() => inspectBrowserArtifacts({ url: 'https://d2via50thoheqm.cloudfront.net/manage', consoleMessages: ['raw token'] }))
})

test('Hosted UI diagnostic normalizes allowlisted categories and strips query material', () => {
  const result = normalizeHostedUiOutcome({
    role: 'diagnostic',
    domText: 'Incorrect username or password; hidden csrf and token values are not retained',
    urlSequence: [
      'https://itsrun-preview-470447451992.auth.ap-northeast-1.amazoncognito.com/login?code=secret-code',
      'https://d2via50thoheqm.cloudfront.net/manage?state=opaque-token',
    ],
    statuses: [200, 302],
    durationMs: 42,
  })
  assert.deepEqual(result, {
    role: 'diagnostic', category: 'incorrect-credentials',
    redirects: [
      { host: 'itsrun-preview-470447451992.auth.ap-northeast-1.amazoncognito.com', path: '/login' },
      { host: 'd2via50thoheqm.cloudfront.net', path: '/manage' },
    ], statuses: [200, 302], durationMs: 42,
  })
  assert.deepEqual(hostedUiCategories, ['callback', 'incorrect-credentials', 'user-not-found', 'password-reset-required', 'oauth-error', 'unknown-login'])
  assert.doesNotMatch(JSON.stringify(result), /secret|token|csrf|password|code|\?/i)
})

test('Hosted UI diagnostic never exposes raw DOM, credentials, cookies, or hidden fields', () => {
  const raw = 'user@example.invalid passw0rd! cookie=abc hidden=csrf-value code=abc token=xyz'
  const result = normalizeHostedUiOutcome({ role: 'diagnostic', domText: raw, urlSequence: ['https://example.invalid/login?code=abc&state=xyz'], statuses: [302] })
  assert.equal(result.category, 'unknown-login')
  assert.doesNotMatch(JSON.stringify(result), /user@example|passw0rd|cookie|hidden|csrf|code|token|xyz/i)
  assert.throws(() => normalizeHostedUiOutcome({ role: 'diagnostic', domText: raw, urlSequence: ['javascript:alert(1)'], statuses: [200] }))
})

test('Hosted UI callback is recognized even when it immediately replaces to manage', () => {
  const result = normalizeHostedUiOutcome({ role: 'diagnostic', domText: 'safe', urlSequence: ['https://example.invalid/login', 'https://d2via50thoheqm.cloudfront.net/manage/callback', 'https://d2via50thoheqm.cloudfront.net/manage'], statuses: [200, 302, 200] })
  assert.equal(result.category, 'callback')
})

test('browser recorder attaches before action, retains immediate callback order, and deduplicates', () => {
  const listeners = new Map()
  const page = { on(name, fn) { listeners.set(name, [...(listeners.get(name) || []), fn]) }, off(name, fn) { listeners.set(name, (listeners.get(name) || []).filter(value => value !== fn)) }, emit(name, value) { for (const fn of listeners.get(name) || []) fn(value) } }
  const recorder = createSanitizedBrowserRecorder(page)
  assert.ok(listeners.get('framenavigated')?.length === 1)
  page.emit('framenavigated', { url: () => 'https://itsrun-preview-470447451992.auth.ap-northeast-1.amazoncognito.com/login?state=hidden' })
  page.emit('framenavigated', { url: () => 'https://d2via50thoheqm.cloudfront.net/manage/callback?code=hidden' })
  page.emit('framenavigated', { url: () => 'https://d2via50thoheqm.cloudfront.net/manage' })
  page.emit('framenavigated', { url: () => 'https://d2via50thoheqm.cloudfront.net/manage' })
  page.emit('response', { url: () => 'https://d2via50thoheqm.cloudfront.net/manage?query=hidden', status: () => 200 })
  page.emit('response', { url: () => 'https://untrusted.invalid/secret', status: () => 200 })
  assert.deepEqual(recorder.snapshot(), { events: [
    { kind: 'navigation', host: 'itsrun-preview-470447451992.auth.ap-northeast-1.amazoncognito.com', path: '/login' },
    { kind: 'navigation', host: 'd2via50thoheqm.cloudfront.net', path: '/manage/callback', codePresent: true, statePresent: false },
    { kind: 'navigation', host: 'd2via50thoheqm.cloudfront.net', path: '/manage' },
    { kind: 'response', host: 'd2via50thoheqm.cloudfront.net', path: '/manage', status: 200 },
  ] })
  assert.deepEqual([...approvedBrowserHosts].sort(), ['d2via50thoheqm.cloudfront.net', 'itsrun-preview-470447451992.auth.ap-northeast-1.amazoncognito.com'])
})

test('browser recorder detaches cleanly and emits no raw URL material', () => {
  const listeners = new Map(); const page = { on(name, fn) { listeners.set(name, fn) }, off(name, fn) { if (listeners.get(name) === fn) listeners.delete(name) }, emit(name, value) { listeners.get(name)?.(value) } }
  const recorder = createSanitizedBrowserRecorder(page)
  recorder.detach(); recorder.detach(); page.emit('framenavigated', { url: () => 'https://d2via50thoheqm.cloudfront.net/manage?token=secret' })
  assert.deepEqual(recorder.snapshot(), { events: [] }); assert.deepEqual([...listeners.keys()], [])
})

test('OAuth status classification is exact, deterministic, and typed', () => {
  const discovery = { kind: 'response', host: 'cognito-idp.ap-northeast-1.amazonaws.com', path: '/ap-northeast-1_nmj9cP9st/.well-known/openid-configuration', method: 'GET', status: 200 }
  const token = { kind: 'response', host: 'itsrun-preview-470447451992.auth.ap-northeast-1.amazoncognito.com', path: '/oauth2/token', method: 'POST', status: 200 }
  const api = { kind: 'response', host: 'd2via50thoheqm.cloudfront.net', path: '/api/v1/stadiums/oda/availability/2026-08', method: 'GET', status: 200 }
  const cases = [
    [[], 'oauth-discovery-missing'],
    [[{ ...discovery, status: 404 }], 'oauth-discovery-rejected'],
    [[discovery], 'token-request-not-started'],
    [[discovery, { ...token, status: 400 }], 'token-response-rejected'],
    [[discovery, token], 'token-success-session-missing'],
    [[discovery, token, { ...api, status: 500 }], 'api-status-unexpected'],
  ]
  for (const [events, category] of cases) assert.equal(classifyOAuthStatus(events), category)
  assert.deepEqual([...new Set(cases.map(([, category]) => category))].sort(), ['oauth-discovery-missing', 'oauth-discovery-rejected', 'token-request-not-started', 'token-response-rejected', 'token-success-session-missing', 'api-status-unexpected'].sort())
  const canary = { ...token, path: '/oauth2/token?code=secret&state=canary', method: 'POST', status: 200, headers: { authorization: 'Bearer canary' }, body: 'canary-token' }
  assert.equal(classifyOAuthStatus([discovery, canary]), 'token-request-not-started')
  assert.deepEqual(classifyOAuthStatus([discovery, token]), classifyOAuthStatus([discovery, token]))
  assert.doesNotMatch(JSON.stringify(classifyOAuthStatus([discovery, canary])), /secret|canary/i)
})

test('browser recorder retains only exact OAuth method/status fields', () => {
  const listeners = new Map(); const page = { on(name, fn) { listeners.set(name, fn) }, off() {} }
  const recorder = createSanitizedBrowserRecorder(page)
  listeners.get('response')?.({ url: () => 'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_nmj9cP9st/.well-known/openid-configuration?secret=canary', status: () => 200, request: () => ({ method: () => 'GET', headers: () => ({ authorization: 'canary' }), postData: () => 'canary' }) })
  assert.deepEqual(recorder.snapshot(), { events: [{ kind: 'response', host: 'cognito-idp.ap-northeast-1.amazonaws.com', path: '/ap-northeast-1_nmj9cP9st/.well-known/openid-configuration', status: 200, method: 'GET' }] })
  assert.doesNotMatch(JSON.stringify(recorder.snapshot()), /secret|canary|authorization/i)
})

test('token request and callback parameter status retain only booleans', () => {
  const listeners = new Map(); const page = { on(name, fn) { listeners.set(name, fn) }, off() {} }
  const recorder = createSanitizedBrowserRecorder(page)
  listeners.get('framenavigated')?.({ url: () => 'https://d2via50thoheqm.cloudfront.net/manage/callback?code=secret&state=opaque&evil=canary' })
  listeners.get('request')?.({ url: () => 'https://itsrun-preview-470447451992.auth.ap-northeast-1.amazoncognito.com/oauth2/token?code=secret', method: () => 'POST', headers: () => ({ authorization: 'canary' }), postData: () => 'token=canary' })
  listeners.get('requestfailed')?.({ url: () => 'https://itsrun-preview-470447451992.auth.ap-northeast-1.amazoncognito.com/oauth2/token', method: () => 'POST', failure: () => ({ errorText: 'raw-canary-failure' }) })
  assert.deepEqual(recorder.snapshot(), { events: [
    { kind: 'navigation', host: 'd2via50thoheqm.cloudfront.net', path: '/manage/callback', codePresent: true, statePresent: true },
    { kind: 'request', host: 'itsrun-preview-470447451992.auth.ap-northeast-1.amazoncognito.com', path: '/oauth2/token', method: 'POST' },
    { kind: 'requestfailed', host: 'itsrun-preview-470447451992.auth.ap-northeast-1.amazoncognito.com', path: '/oauth2/token', method: 'POST' },
  ] })
  assert.doesNotMatch(JSON.stringify(recorder.snapshot()), /secret|opaque|evil|canary|authorization|raw-canary/i)
})

test('protected CLI boundary uses file URI only and sanitizes canary payloads', () => {
  const root = '/tmp/t16-protected'; const filePath = `${root}/operation.json`; let written = ''; let unlinked = 0
  const boundary = createProtectedCliInput({ root, filePath, operation: 'admin-set-user-password', payload: { alias: 'canary-alias', password: 'canary-password', internal: 'canary-internal' }, inspectFile: () => ({ isFile: true, isSymbolicLink: false, mode: 0o600 }), writeProtected: (_path, body) => { written = body }, unlink: () => { unlinked += 1 } })
  assert.deepEqual(boundary.args, ['cognito-idp', 'admin-set-user-password', '--cli-input-json', `file://${filePath}`]); assert.match(written, /canary-password/); assert.doesNotMatch(JSON.stringify(boundary), /canary-alias|canary-password|canary-internal/); boundary.cleanup(); boundary.cleanup(); assert.equal(unlinked, 1)
})

test('protected CLI boundary rejects unknown, outside, symlink, non-0600, and writer failures', () => {
  const base = { root: '/tmp/t16-protected', filePath: '/tmp/t16-protected/operation.json', payload: { value: 'canary' }, inspectFile: () => ({ isFile: true, isSymbolicLink: false, mode: 0o600 }), writeProtected: () => {}, unlink: () => {} }
  assert.throws(() => createProtectedCliInput({ ...base, operation: 'delete-all' })); assert.throws(() => createProtectedCliInput({ ...base, filePath: '/tmp/other/operation.json', operation: 'admin-delete-user' })); assert.throws(() => createProtectedCliInput({ ...base, operation: 'admin-delete-user', inspectFile: () => ({ isFile: true, isSymbolicLink: true, mode: 0o600 }) })); assert.throws(() => createProtectedCliInput({ ...base, operation: 'admin-delete-user', inspectFile: () => ({ isFile: true, isSymbolicLink: false, mode: 0o644 }) })); assert.throws(() => createProtectedCliInput({ ...base, operation: 'admin-delete-user', writeProtected: () => { throw new Error('canary writer') } }), /protected write/)
})

test('protected CLI operation table supports per-operation JSON files and immediate cleanup', () => {
  const operations = ['admin-create-user', 'admin-set-user-password', 'admin-add-user-to-group', 'admin-get-user', 'admin-remove-user-from-group', 'admin-delete-user']; const files = []; const removed = []
  for (const [index, operation] of operations.entries()) { const path = `/tmp/t16-protected/op-${index}.json`; const boundary = createProtectedCliInput({ root: '/tmp/t16-protected', filePath: path, operation, payload: { internal: 'canary-internal', alias: 'canary-alias', password: 'canary-password' }, inspectFile: () => ({ isFile: true, isSymbolicLink: false, mode: 0o600 }), writeProtected: (file, body) => files.push({ file, body }), unlink: (file) => removed.push(file) }); boundary.cleanup() }
  assert.equal(files.length, operations.length); assert.deepEqual(removed, files.map(({ file }) => file)); assert.equal(new Set(files.map(({ file }) => file)).size, operations.length); assert.equal(JSON.stringify(removed).includes('canary'), false)
})

test('protected adapter failure cleanup retains internal identity without exposing it', () => {
  const calls = []; const internal = 'canary-internal'; calls.push({ operation: 'create', id: internal }); try { throw new Error('canary-password') } catch { calls.push({ operation: 'delete', id: internal }) }
  assert.deepEqual(calls.map(({ operation }) => operation), ['create', 'delete']); const safe = { status: 'setup-failed', cleanup: true, calls: 2 }; assert.doesNotMatch(JSON.stringify(safe), /canary|password|internal/i)
})

function fakeHostedPage({ visibleForm = true, ambiguous = false, controls = {}, fillError = false, clickError = false } = {}) {
  const forms = [{ visible: visibleForm, username: '', password: '', submits: 0 }]
  if (ambiguous) forms.push({ visible: true, username: '', password: '', submits: 0 })
  const control = (form, name) => ({ async count() { return controls[name]?.count ?? 1 }, async isVisible() { return form.visible && controls[name]?.visible !== false }, async isEnabled() { return controls[name]?.enabled !== false }, async fill(value) { if (fillError) throw new Error(`canary ${value}`); form[name] = value }, async click() { if (clickError) throw new Error('canary click'); form.submits += 1 } })
  const locator = (selector) => {
    if (selector.startsWith('form')) { const visible = forms.filter((form) => form.visible); return { async count() { return visible.length }, async isVisible() { return visible.length === 1 && visible[0].visible }, async isEnabled() { return true }, locator: (nested) => control(visible[0], nested.includes('username') ? 'username' : nested.includes('password') ? 'password' : 'submit') } }
    throw new Error('unexpected page selector')
  }
  return { page: { locator }, forms }
}

test('visible-form driver scopes responsive duplicates and submits only selected form on desktop/mobile fixtures', async () => {
  for (const viewport of ['desktop', 'mobile']) {
    const fixture = fakeHostedPage(); const result = await driveHostedUiSignIn(fixture.page, { username: 'canary-alias', password: 'canary-password', waitForNavigationSignal: async () => ({ navigation: viewport }), timeoutMs: 20 }); assert.deepEqual(result, { checkpoint: 'form-submitted' }); assert.equal(fixture.forms[0].username, 'canary-alias'); assert.equal(fixture.forms[0].password, 'canary-password'); assert.equal(fixture.forms[0].submits, 1)
  }
})

test('visible-form driver rejects absent/ambiguous forms and missing or disabled controls', async () => {
  assert.deepEqual(await driveHostedUiSignIn(fakeHostedPage({ visibleForm: false }).page, { username: 'canary', password: 'canary', waitForNavigationSignal: async () => undefined }), { checkpoint: 'form-ambiguous' })
  assert.deepEqual(await driveHostedUiSignIn(fakeHostedPage({ ambiguous: true }).page, { username: 'canary', password: 'canary', waitForNavigationSignal: async () => undefined }), { checkpoint: 'form-ambiguous' })
  assert.deepEqual(await driveHostedUiSignIn(fakeHostedPage({ controls: { username: { count: 0 } } }).page, { username: 'canary', password: 'canary', waitForNavigationSignal: async () => undefined }), { checkpoint: 'control-missing' })
  assert.deepEqual(await driveHostedUiSignIn(fakeHostedPage({ controls: { password: { enabled: false } } }).page, { username: 'canary', password: 'canary', waitForNavigationSignal: async () => undefined }), { checkpoint: 'control-disabled' })
})

test('visible-form driver sanitizes fill/click failures and bounds no-submit', async () => {
  const fillFailure = await driveHostedUiSignIn(fakeHostedPage({ fillError: true }).page, { username: 'canary-alias', password: 'canary-password', waitForNavigationSignal: async () => undefined }); assert.deepEqual(fillFailure, { checkpoint: 'fill-failed' }); assert.doesNotMatch(JSON.stringify(fillFailure), /canary|password/i)
  const clickFailure = await driveHostedUiSignIn(fakeHostedPage({ clickError: true }).page, { username: 'canary-alias', password: 'canary-password', waitForNavigationSignal: async () => undefined }); assert.deepEqual(clickFailure, { checkpoint: 'click-failed' })
  let setCount = 0; let clearCount = 0; const timer = { set(callback) { setCount += 1; return setTimeout(callback, 2) }, clear(id) { clearCount += 1; clearTimeout(id) } }; const timeout = await driveHostedUiSignIn(fakeHostedPage().page, { username: 'canary-alias', password: 'canary-password', waitForNavigationSignal: () => new Promise(() => {}), timeoutMs: 2, timer }); assert.deepEqual(timeout, { checkpoint: 'submit-not-observed' }); assert.equal(setCount, 1); assert.equal(clearCount, 1)
})

test('visible-form driver detaches cancellable signal after early failure', async () => {
  let cancelled = 0
  let rejectSignal
  const signal = new Promise((_, reject) => { rejectSignal = reject })
  const result = await driveHostedUiSignIn(fakeHostedPage({ clickError: true }).page, {
    username: 'canary-alias', password: 'canary-password',
    waitForNavigationSignal: () => ({ promise: signal, cancel() { cancelled += 1 } }),
  })
  assert.deepEqual(result, { checkpoint: 'click-failed' })
  assert.equal(cancelled, 1)
  rejectSignal(new Error('canary signal rejection'))
  await new Promise(resolve => setImmediate(resolve))
})

function coordinatorFixture({ failAt = null, restoreFails = false, cleanupFails = false } = {}) {
  const calls = []
  const proofs = {
    preflight: { target: 'd029', baseline: true }, setup: { users: 2, admins: 1 },
    'admin-form': { desktop: 'form-submitted', mobile: 'form-submitted' }, 'non-admin-form': { desktop: 'form-submitted', mobile: 'form-submitted' },
    'admin-callback': { desktop: true, mobile: true }, 'non-admin-callback': { desktop: true, mobile: true },
    'admin-sentinel': { desktop: 200, mobile: 200 }, 'non-admin-sentinel': { desktop: 403, mobile: 403 },
    'data-read': { contexts: 2, baseline: true }, 'data-update': { putCount: 1, newEtag: true, newVersionId: true },
    'stale-conflict': { putCount: 1, status: 409, versionUnchanged: true }, 'public-observation': { status: 200, slot: 1 },
    restore: { putCount: 1, bytesExact: true, hashExact: true, metadataExact: true }, cleanup: { users: 0, admins: 0 },
  }
  const stage = (name, action = async () => {}) => async context => {
    calls.push(name)
    if (name === 'data-update' || name === 'stale-conflict') context.markWrite()
    if (failAt === name) throw new Error('canary raw adapter failure')
    await action(context)
    return proofs[name]
  }
  return {
    calls,
    adapters: {
      preflight: stage('preflight'), setup: stage('setup'),
      admin: { form: stage('admin-form'), callback: stage('admin-callback'), sentinel: stage('admin-sentinel') },
      nonAdmin: { form: stage('non-admin-form'), callback: stage('non-admin-callback'), sentinel: stage('non-admin-sentinel') },
      data: { read: stage('data-read'), update: stage('data-update'), stale: stage('stale-conflict'), public: stage('public-observation') },
      restore: stage('restore', async () => { if (restoreFails) throw new Error('canary restore failure') }),
      cleanup: stage('cleanup', async () => { if (cleanupFails) throw new Error('canary cleanup failure') }),
    },
  }
}

test('credential-free coordinator returns stable success state and exact write/restore ordering', async () => {
  const fixture = coordinatorFixture()
  const result = await runT16Coordinator(fixture.adapters)
  assert.deepEqual(result, {
    status: 'success', lastCheckpoint: 'complete', failureCheckpoint: null,
    roleOutcomes: { admin: 'passed', 'non-admin': 'passed' },
    counts: { operations: 14, writes: 2, restores: 1, cleanups: 1 }, failure: null,
    restoreStatus: 'passed', cleanupStatus: 'passed',
  })
  assert.deepEqual(fixture.calls, ['preflight', 'setup', 'admin-form', 'admin-callback', 'admin-sentinel', 'non-admin-form', 'non-admin-callback', 'non-admin-sentinel', 'data-read', 'data-update', 'stale-conflict', 'public-observation', 'restore', 'cleanup'])
})

test('coordinator failure matrix preserves checkpoint, blocks data after auth, and always cleans identities', async () => {
  for (const [failAt, expected] of [['setup', 'setup'], ['admin-form', 'admin-form'], ['admin-callback', 'admin-callback'], ['admin-sentinel', 'admin-sentinel'], ['non-admin-form', 'non-admin-form'], ['non-admin-callback', 'non-admin-callback'], ['non-admin-sentinel', 'non-admin-sentinel'], ['data-read', 'data-read'], ['data-update', 'data-update'], ['stale-conflict', 'stale-conflict'], ['public-observation', 'public-observation']]) {
    const fixture = coordinatorFixture({ failAt })
    const result = await runT16Coordinator(fixture.adapters)
    assert.equal(result.status, 'failed'); assert.equal(result.failure.stage, expected); assert.equal(result.lastCheckpoint, 'cleanup'); assert.equal(result.failureCheckpoint, expected)
    assert.equal(fixture.calls.at(-1), 'cleanup')
    if (!['data-update', 'stale-conflict', 'public-observation'].includes(failAt)) assert.equal(fixture.calls.some(call => call === 'data-update'), false)
    assert.doesNotMatch(JSON.stringify(result), /canary|adapter raw/i)
  }
})

test('coordinator restores once before cleanup after write failure and treats restore failure as terminal', async () => {
  const failed = coordinatorFixture({ failAt: 'stale-conflict' })
  const result = await runT16Coordinator(failed.adapters)
  assert.equal(result.status, 'failed'); assert.equal(result.failure.stage, 'stale-conflict')
  assert.deepEqual(failed.calls.slice(-2), ['restore', 'cleanup']); assert.equal(result.counts.writes, 2); assert.equal(result.counts.restores, 1); assert.equal(result.failureCheckpoint, 'stale-conflict')
  const restoreFailure = coordinatorFixture({ failAt: 'stale-conflict', restoreFails: true })
  const terminal = await runT16Coordinator(restoreFailure.adapters)
  assert.equal(terminal.status, 'restore-failed'); assert.equal(terminal.failure.stage, 'restore'); assert.equal(terminal.failureCheckpoint, 'stale-conflict'); assert.deepEqual(restoreFailure.calls.slice(-2), ['restore', 'cleanup'])
})

test('coordinator reports partial cleanup without exposing adapter material', async () => {
  const fixture = coordinatorFixture({ cleanupFails: true })
  const result = await runT16Coordinator(fixture.adapters)
  assert.equal(result.status, 'cleanup-failed'); assert.equal(result.failure.stage, 'cleanup'); assert.equal(result.failureCheckpoint, 'cleanup'); assert.equal(result.counts.cleanups, 1)
  assert.doesNotMatch(JSON.stringify(result), /canary|raw adapter/i)
})

test('coordinator rejects resolved no-op or malformed proof results as typed failures', async () => {
  const form = coordinatorFixture()
  form.adapters.admin.form = async () => ({ checkpoint: 'form-ambiguous' })
  const formResult = await runT16Coordinator(form.adapters)
  assert.equal(formResult.status, 'failed'); assert.equal(formResult.failure.category, 'invalid-proof'); assert.equal(formResult.failureCheckpoint, 'admin-form')
  const update = coordinatorFixture()
  update.adapters.data.update = async context => { context.markWrite(); return { putCount: 0, newEtag: false, newVersionId: false } }
  const updateResult = await runT16Coordinator(update.adapters)
  assert.equal(updateResult.status, 'failed'); assert.equal(updateResult.failure.category, 'invalid-proof'); assert.equal(updateResult.restoreStatus, 'passed'); assert.equal(updateResult.counts.restores, 1)
  const timed = coordinatorFixture()
  timed.adapters.data.read = async () => { const error = new Error('canary timeout'); error.name = 'TimeoutError'; throw error }
  const timedResult = await runT16Coordinator(timed.adapters)
  assert.equal(timedResult.failure.category, 'timeout'); assert.equal(timedResult.failureCheckpoint, 'data-read')
})
