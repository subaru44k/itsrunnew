import type { User } from 'oidc-client-ts'
import { computed, ref } from 'vue'
import { createOidcPort, oidcConfig, isSafeReturnPath, type OidcPort } from '../admin/oidc'

export type AdminSessionState = 'unconfigured' | 'signedOut' | 'redirecting' | 'processingCallback' | 'signedIn' | 'sanitizedError' | 'signingOut'
export interface SessionOptions { authority: string; clientId: string; origin?: string; oidc?: OidcPort }

let browserSession: ReturnType<typeof createAdminSession> | undefined

function safeReturnPath(value: unknown): string { return isSafeReturnPath(value) ? value as string : '/manage' }

export function createAdminSession(options: SessionOptions) {
  const state = ref<AdminSessionState>(options.authority && options.clientId ? 'signedOut' : 'unconfigured')
  const user = ref<User | null>(null)
  const error = ref<'configuration' | 'authentication' | null>(options.authority && options.clientId ? null : 'configuration')
  const manager = options.oidc ?? (options.authority && options.clientId ? createOidcPort(oidcConfig(options.authority, options.clientId, options.origin ?? window.location.origin)) : null)
  let initPromise: Promise<void> | undefined
  let callbackPromise: Promise<void> | undefined

  const clear = () => { user.value = null; if (state.value !== 'unconfigured') state.value = 'signedOut' }
  const fail = () => { user.value = null; state.value = 'sanitizedError'; error.value = 'authentication' }
  async function initialize() {
    if (initPromise) return initPromise
    initPromise = (async () => {
      if (!manager) return
      try { user.value = await manager.getUser(); state.value = user.value ? 'signedIn' : 'signedOut' }
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
        user.value = result; state.value = 'signedIn'
        if (typeof window !== 'undefined') window.history.replaceState({}, '', '/manage')
      } catch { fail(); if (typeof window !== 'undefined') window.history.replaceState({}, '', '/manage') }
    })()
    return callbackPromise
  }
  async function logout() {
    if (!manager) return clear()
    state.value = 'signingOut'; user.value = null
    try { await manager.signoutRedirect({ post_logout_redirect_uri: `${options.origin ?? window.location.origin}/manage` }) } catch { clear() }
  }
  async function getAccessToken() { return user.value?.access_token ?? null }
  const attachEvents = () => {
    const events = manager?.events
    events?.addUserLoaded((next) => { user.value = next; state.value = 'signedIn' })
    events?.addUserUnloaded(clear); events?.addAccessTokenExpired(clear); events?.addSilentRenewError(clear)
  }
  attachEvents()
  return { state: computed(() => state.value), user: computed(() => user.value), error: computed(() => error.value), initialize, login, callback, logout, clear, getAccessToken, manager }
}

export function useAdminSession() {
  const config = useRuntimeConfig().public
  if (import.meta.client && !browserSession) browserSession = createAdminSession({ authority: config.cognitoAuthority, clientId: config.cognitoClientId })
  const session = browserSession ?? createAdminSession({ authority: config.cognitoAuthority, clientId: config.cognitoClientId, oidc: undefined })
  if (import.meta.client) void session.initialize()
  return session
}
