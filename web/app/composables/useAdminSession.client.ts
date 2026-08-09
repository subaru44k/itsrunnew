import type { User } from 'oidc-client-ts'
import { computed, ref } from 'vue'
import { createOidcPort, oidcConfig, isSafeReturnPath, type OidcPort } from '../admin/oidc'

export type AdminSessionState = 'unconfigured' | 'signedOut' | 'redirecting' | 'processingCallback' | 'signedIn' | 'sanitizedError' | 'signingOut'
export interface SessionOptions {
  authority: string
  clientId: string
  origin?: string
  oidc?: OidcPort
  navigate?: (path: string) => void
}

let browserSession: ReturnType<typeof createAdminSession> | undefined

function safeReturnPath(value: unknown): string { return isSafeReturnPath(value) ? value as string : '/manage' }

export function createAdminSession(options: SessionOptions) {
  const state = ref<AdminSessionState>(options.authority && options.clientId ? 'signedOut' : 'unconfigured')
  let currentUser: User | null = null
  const error = ref<'configuration' | 'authentication' | null>(options.authority && options.clientId ? null : 'configuration')
  const manager = options.oidc ?? null
  const navigate = options.navigate ?? ((path: string) => {
    if (typeof window !== 'undefined') window.history.replaceState({}, '', path)
  })
  let initPromise: Promise<void> | undefined
  let callbackPromise: Promise<void> | undefined
  let listenersAttached = false

  const clear = () => { currentUser = null; if (state.value !== 'unconfigured') state.value = 'signedOut' }
  const fail = () => { currentUser = null; state.value = 'sanitizedError'; error.value = 'authentication' }
  async function initialize() {
    if (initPromise) return initPromise
    initPromise = (async () => {
      if (!manager) return
      try { currentUser = await manager.getUser(); state.value = currentUser ? 'signedIn' : 'signedOut' }
      catch { fail() }
    })()
    return initPromise
  }
  async function login(returnPath = '/manage') {
    if (!manager) return fail()
    state.value = 'redirecting'; error.value = null
    try { await manager.signinRedirect({ state: { returnPath: safeReturnPath(returnPath) } }) } catch { fail() }
  }
  async function callback(url?: string) {
    if (callbackPromise) return callbackPromise
    callbackPromise = (async () => {
      if (!manager) return fail()
      state.value = 'processingCallback'; error.value = null
      try {
        const result = await manager.signinCallback(url)
        currentUser = result; state.value = 'signedIn'
        const callbackState = result.state as { returnPath?: unknown } | undefined
        navigate(safeReturnPath(callbackState?.returnPath))
      } catch { fail(); navigate('/manage') }
      finally { await manager.clearTransactionState().catch(() => undefined) }
    })()
    return callbackPromise
  }
  async function logout() {
    if (!manager) return clear()
    state.value = 'signingOut'; currentUser = null
    try { await manager.signoutRedirect({ post_logout_redirect_uri: `${options.origin ?? (typeof window !== 'undefined' ? window.location.origin : '')}/manage` }) } catch { clear() }
  }
  async function getAccessToken() { return currentUser?.access_token ?? null }
  const attachEvents = () => {
    if (listenersAttached) return
    listenersAttached = true
    const events = manager?.events
    events?.addUserLoaded((next) => { currentUser = next; state.value = 'signedIn' })
    events?.addUserUnloaded(clear); events?.addAccessTokenExpired(clear); events?.addSilentRenewError(clear)
  }
  attachEvents()
  return { state: computed(() => state.value), error: computed(() => error.value), initialize, login, callback, logout, clear, getAccessToken }
}

export function resetBrowserAdminSession() { browserSession = undefined }

export function getBrowserAdminSession(options: SessionOptions) {
  if (!browserSession) browserSession = createAdminSession(options)
  return browserSession
}

export function useAdminSession() {
  const config = useRuntimeConfig().public
  if (import.meta.client && !browserSession) {
    browserSession = createAdminSession({
      authority: config.cognitoAuthority,
      clientId: config.cognitoClientId,
      origin: window.location.origin,
      oidc: config.cognitoAuthority && config.cognitoClientId
        ? createOidcPort(oidcConfig(config.cognitoAuthority, config.cognitoClientId, window.location.origin))
        : undefined,
    })
  }
  const session = browserSession ?? createAdminSession({ authority: config.cognitoAuthority, clientId: config.cognitoClientId, oidc: undefined })
  if (import.meta.client) void session.initialize()
  return session
}
