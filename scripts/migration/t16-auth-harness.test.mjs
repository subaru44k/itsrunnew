import test from 'node:test'
import assert from 'node:assert/strict'
import { assertReservedCell, exactKey, inspectBrowserArtifacts, sanitizeOutcome, validateOperatorEnvironment } from './t16-auth-harness.mjs'

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
