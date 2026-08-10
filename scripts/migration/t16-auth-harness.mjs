const exactKey = 'data/v1/stadiums/oda/availability/2026-08.json'
const sensitive = /token|password|secret|claim|authorization|cookie|access_key|raw|credential/i

export function validateOperatorEnvironment(env = process.env) {
  const names = {
    admin: env.T16_ADMIN_USERNAME,
    nonAdmin: env.T16_NONADMIN_USERNAME,
  }
  if (!/^preview-t16-admin@[^@]+\.invalid$/.test(names.admin || '') || !/^preview-t16-nonadmin@[^@]+\.invalid$/.test(names.nonAdmin || '')) throw new Error('invalid operator identities')
  if (typeof env.T16_ADMIN_PASSWORD !== 'string' || env.T16_ADMIN_PASSWORD.length < 16 || typeof env.T16_NONADMIN_PASSWORD !== 'string' || env.T16_NONADMIN_PASSWORD.length < 16) throw new Error('missing operator credentials')
  return { adminUsername: names.admin, nonAdminUsername: names.nonAdmin, credentialsPresent: true }
}

export function assertReservedCell(target) {
  if (target?.key !== exactKey || target?.date !== '2026-08-09' || target?.slot !== 0 || target?.before !== 0 || target?.after !== 1) throw new Error('invalid rehearsal target')
  return { key: exactKey, date: target.date, slot: target.slot, before: target.before, after: target.after }
}

export function sanitizeOutcome({ role, outcome, httpStatus = null, etag = null, versionId = null, sha256 = null, durationMs = null, counts = null }) {
  if (!['admin', 'non-admin'].includes(role) || typeof outcome !== 'string' || !/^[a-z][a-z-]{1,31}$/.test(outcome)) throw new Error('invalid outcome')
  const result = { role, outcome, httpStatus, etag, versionId, sha256, durationMs, counts }
  return result
}

export function inspectBrowserArtifacts({ url, localStorageKeys = [], sessionStorageKeys = [], consoleMessages = [], networkUrls = [] }) {
  if (typeof url !== 'string' || !url.startsWith('https://d2via50thoheqm.cloudfront.net/')) throw new Error('unsafe browser URL')
  for (const value of [...localStorageKeys, ...sessionStorageKeys, ...consoleMessages, ...networkUrls]) if (sensitive.test(String(value))) throw new Error('sensitive browser artifact')
  return { urlPath: new URL(url).pathname, localStorageKeys: localStorageKeys.length, sessionStorageKeys: sessionStorageKeys.length, consoleMessages: consoleMessages.length, networkRequests: networkUrls.length }
}

export { exactKey }
