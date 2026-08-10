import { isAbsolute, relative, resolve } from 'node:path'

const exactKey = 'data/v1/stadiums/oda/availability/2026-08.json'
const sensitive = /token|password|secret|claim|authorization|cookie|access_key|raw|credential/i
const hostedUiCategories = ['callback', 'incorrect-credentials', 'user-not-found', 'password-reset-required', 'oauth-error', 'unknown-login']
const approvedBrowserHosts = new Set(['itsrun-preview-470447451992.auth.ap-northeast-1.amazoncognito.com', 'd2via50thoheqm.cloudfront.net'])

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
  if (!['admin', 'non-admin'].includes(role) || typeof outcome !== 'string' || !/^[a-z][a-z0-9-]{1,31}$/.test(outcome)) throw new Error('invalid outcome')
  const result = { role, outcome, httpStatus, etag, versionId, sha256, durationMs, counts }
  return result
}

export function inspectBrowserArtifacts({ url, localStorageKeys = [], sessionStorageKeys = [], consoleMessages = [], networkUrls = [] }) {
  if (typeof url !== 'string' || !url.startsWith('https://d2via50thoheqm.cloudfront.net/')) throw new Error('unsafe browser URL')
  for (const value of [...localStorageKeys, ...sessionStorageKeys, ...consoleMessages, ...networkUrls]) if (sensitive.test(String(value))) throw new Error('sensitive browser artifact')
  return { urlPath: new URL(url).pathname, localStorageKeys: localStorageKeys.length, sessionStorageKeys: sessionStorageKeys.length, consoleMessages: consoleMessages.length, networkRequests: networkUrls.length }
}

export function normalizeHostedUiOutcome({ role, domText = '', urlSequence = [], statuses = [], durationMs = null }) {
  if (!['admin', 'non-admin', 'diagnostic'].includes(role) || typeof domText !== 'string' || !Array.isArray(urlSequence) || !Array.isArray(statuses)) throw new Error('invalid diagnostic input')
  const redirects = urlSequence.map(value => {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || !url.pathname.startsWith('/')) throw new Error('unsafe diagnostic URL')
    return { host: url.hostname, path: url.pathname }
  })
  const safeStatuses = statuses.map(value => {
    if (!Number.isInteger(value) || value < 100 || value > 599) throw new Error('invalid diagnostic status')
    return value
  })
  const text = domText.toLowerCase()
  const category = redirects.some(({ path }) => path === '/manage/callback')
    ? 'callback'
    : /incorrect|invalid username|wrong password|authentication failed/.test(text)
      ? 'incorrect-credentials'
      : /user not found|unknown user|does not exist/.test(text)
        ? 'user-not-found'
        : /forgot password|reset password|new password required/.test(text)
          ? 'password-reset-required'
          : /oauth|authorize|authorization|openid|discovery/.test(text)
            ? 'oauth-error'
            : 'unknown-login'
  return { role, category, redirects, statuses: safeStatuses, durationMs: Number.isInteger(durationMs) && durationMs >= 0 ? durationMs : null }
}

export function createSanitizedBrowserRecorder(page) {
  if (!page || typeof page.on !== 'function' || typeof page.off !== 'function') throw new Error('invalid recorder page')
  const events = []
  const seen = new Set()
  const add = (kind, rawUrl, status = null) => {
    try {
      const url = new URL(typeof rawUrl === 'string' ? rawUrl : rawUrl?.url?.())
      if (!approvedBrowserHosts.has(url.hostname) || !url.pathname.startsWith('/')) return
      if (status !== null && (!Number.isInteger(status) || status < 100 || status > 599)) return
      const event = status === null ? { kind, host: url.hostname, path: url.pathname } : { kind, host: url.hostname, path: url.pathname, status }
      const key = JSON.stringify(event)
      if (!seen.has(key)) { seen.add(key); events.push(event) }
    } catch {}
  }
  const onNavigation = frame => add('navigation', frame?.url?.())
  const onResponse = response => add('response', response?.url?.(), response?.status?.())
  page.on('framenavigated', onNavigation)
  page.on('response', onResponse)
  let detached = false
  return {
    snapshot() { return { events: events.map(event => ({ ...event })) } },
    detach() { if (!detached) { page.off('framenavigated', onNavigation); page.off('response', onResponse); detached = true } },
  }
}

const sensitiveCliOperations = new Set(['admin-create-user', 'admin-set-user-password', 'admin-add-user-to-group', 'admin-get-user', 'admin-remove-user-from-group', 'admin-delete-user'])

const hostedUiCheckpoints = new Set(['form-ready', 'form-submitted', 'form-ambiguous', 'control-missing', 'control-disabled', 'fill-failed', 'submit-not-observed'])

export async function driveHostedUiSignIn(page, { username, password, waitForNavigationSignal, timeoutMs = 30000, timer = { set: setTimeout, clear: clearTimeout } } = {}) {
  const checkpoint = (value) => { if (!hostedUiCheckpoints.has(value)) throw new Error('invalid hosted UI checkpoint'); return { checkpoint: value } }
  if (!page || typeof page.locator !== 'function' || typeof timer.set !== 'function' || typeof timer.clear !== 'function' || typeof timeoutMs !== 'number' || timeoutMs <= 0 || typeof username !== 'string' || typeof password !== 'string') return checkpoint('form-ambiguous')
  let form
  try {
    const forms = page.locator('form[name="cognitoSignInForm"]:visible')
    if (await forms.count() !== 1) return checkpoint('form-ambiguous')
    form = forms
    if (!(await form.isVisible()) || !(await form.isEnabled())) return checkpoint('control-disabled')
    const usernameControl = form.locator('input[name="username"]:visible'); const passwordControl = form.locator('input[name="password"]:visible'); const submitControl = form.locator('input[type="submit"][name="signInSubmitButton"]:visible')
    if (await usernameControl.count() !== 1 || await passwordControl.count() !== 1 || await submitControl.count() !== 1) return checkpoint('control-missing')
    if (!(await usernameControl.isVisible()) || !(await passwordControl.isVisible()) || !(await submitControl.isVisible()) || !(await usernameControl.isEnabled()) || !(await passwordControl.isEnabled()) || !(await submitControl.isEnabled())) return checkpoint('control-disabled')
    if (typeof waitForNavigationSignal !== 'function') return checkpoint('submit-not-observed')
    const signal = Promise.resolve().then(() => waitForNavigationSignal())
    try { await usernameControl.fill(username); await passwordControl.fill(password) } catch { return checkpoint('fill-failed') }
    try { await submitControl.click() } catch { return checkpoint('fill-failed') }
    let timerId
    const timeout = new Promise((_, reject) => { timerId = timer.set(() => reject(new Error('timeout')), timeoutMs) })
    try { await Promise.race([signal, timeout]); return checkpoint('form-submitted') } catch { return checkpoint('submit-not-observed') } finally { if (timerId !== undefined) timer.clear(timerId) }
  } catch { return checkpoint('form-ambiguous') }
}

export function createProtectedCliInput({ root, filePath, operation, payload, inspectFile, writeProtected, unlink }) {
  if (!sensitiveCliOperations.has(operation) || typeof payload !== 'object' || payload === null || typeof inspectFile !== 'function' || typeof writeProtected !== 'function' || typeof unlink !== 'function') throw new Error('invalid protected operation')
  if (!isAbsolute(root) || !isAbsolute(filePath)) throw new Error('invalid protected path')
  const rootPath = resolve(root); const targetPath = resolve(filePath); const child = relative(rootPath, targetPath)
  if (!child || child === '..' || child.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(child)) throw new Error('protected path containment')
  let info
  try { info = inspectFile(targetPath) } catch { throw new Error('protected file inspect') }
  if (!info || info.isSymbolicLink || !info.isFile || info.mode !== 0o600) throw new Error('protected file mode')
  let encoded
  try { encoded = JSON.stringify(payload); if (!encoded || encoded === 'undefined') throw new Error('invalid payload') } catch { throw new Error('invalid protected payload') }
  try { writeProtected(targetPath, encoded) } catch { throw new Error('protected write') }
  let removed = false
  return {
    args: ['cognito-idp', operation, '--cli-input-json', `file://${targetPath}`],
    cleanup() { if (!removed) { try { unlink(targetPath) } catch { throw new Error('protected cleanup') } removed = true } },
  }
}

export { approvedBrowserHosts, exactKey, hostedUiCategories, hostedUiCheckpoints }
