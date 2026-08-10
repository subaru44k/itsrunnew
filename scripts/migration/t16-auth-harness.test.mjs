import test from 'node:test'
import assert from 'node:assert/strict'
import { approvedBrowserHosts, assertReservedCell, createSanitizedBrowserRecorder, exactKey, hostedUiCategories, inspectBrowserArtifacts, normalizeHostedUiOutcome, sanitizeOutcome, validateOperatorEnvironment } from './t16-auth-harness.mjs'

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
    { kind: 'navigation', host: 'd2via50thoheqm.cloudfront.net', path: '/manage/callback' },
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
