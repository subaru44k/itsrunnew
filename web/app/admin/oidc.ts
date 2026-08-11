import { ErrorResponse, InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from 'oidc-client-ts'

export const ADMIN_SCOPES = 'openid email profile itsrun/schedule.write'
export const ADMIN_CALLBACK_PATH = '/manage/callback'
export const ADMIN_LOGOUT_PATH = '/manage'
export const OIDC_CALLBACK_ERROR_EVENT = 'itsrun:oidc-callback-category'
export const OIDC_CALLBACK_ERROR_CATEGORIES = ['state-unavailable', 'state-malformed', 'invalid-redirect-request-type', 'oauth-response-error', 'state-mismatch', 'client-id-missing', 'authority-missing', 'authority-mismatch', 'client-id-mismatch', 'code-missing', 'state-response-missing', 'matching-state-storage-missing', 'callback-other'] as const
export type OidcCallbackErrorCategory = typeof OIDC_CALLBACK_ERROR_CATEGORIES[number]

export function classifyOidcCallbackError(caught: unknown): OidcCallbackErrorCategory {
  if (caught == null) return 'state-unavailable'
  if (caught instanceof SyntaxError) return 'state-malformed'
  if (caught instanceof ErrorResponse) return 'oauth-response-error'
  if (caught instanceof Error && caught.message === 'invalid request_type in state') return 'invalid-redirect-request-type'
  if (caught instanceof Error && caught.message === 'State does not match') return 'state-mismatch'
  if (caught instanceof Error && caught.message === 'No client_id on state') return 'client-id-missing'
  if (caught instanceof Error && caught.message === 'No authority on state') return 'authority-missing'
  if (caught instanceof Error && caught.message === 'authority mismatch on settings vs. signin state') return 'authority-mismatch'
  if (caught instanceof Error && caught.message === 'client_id mismatch on settings vs. signin state') return 'client-id-mismatch'
  if (caught instanceof Error && caught.message === 'Expected code in response') return 'code-missing'
  if (caught instanceof Error && caught.message === 'No state in response') return 'state-response-missing'
  if (caught instanceof Error && caught.message === 'No matching state found in storage') return 'matching-state-storage-missing'
  return 'callback-other'
}

export function isSafeReturnPath(value: unknown): boolean {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /%2f|%5c|%3a/i.test(value)) return false
  const path = value.split(/[?#]/, 1)[0] ?? ''
  return path === '/manage' || path.startsWith('/manage/')
}

export interface OidcPort {
  readonly events?: {
    addUserLoaded(handler: (user: User) => void): void
    addUserUnloaded(handler: () => void): void
    addAccessTokenExpired(handler: () => void): void
    addSilentRenewError(handler: () => void): void
  }
  getUser(): Promise<User | null>
  signinRedirect(args?: { state?: { returnPath: string } }): Promise<void>
  signinCallback(url?: string): Promise<User>
  signoutRedirect(args?: { post_logout_redirect_uri: string }): Promise<void>
  clearTransactionState(): Promise<void>
  readonly settings?: UserManager['settings']
}

export interface OidcConfig { authority: string; clientId: string; redirectUri: string; postLogoutRedirectUri: string }

export function browserOrigin(origin = window.location.origin) {
  return origin
}

export function oidcConfig(authority: string, clientId: string, origin: string): OidcConfig {
  return {
    authority: authority.replace(/\/$/, ''),
    clientId,
    redirectUri: `${origin}${ADMIN_CALLBACK_PATH}`,
    postLogoutRedirectUri: `${origin}${ADMIN_LOGOUT_PATH}`,
  }
}

export function createOidcPort(config: OidcConfig, storage: Storage = window.sessionStorage): OidcPort {
  // The import and UserManager are browser-only: this module is only called by
  // the .client composable after Nuxt has entered a browser lifecycle.
  const manager = new UserManager({
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    post_logout_redirect_uri: config.postLogoutRedirectUri,
    response_type: 'code',
    scope: ADMIN_SCOPES,
    automaticSilentRenew: false,
    stateStore: new WebStorageStateStore({ store: storage }),
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
  })
  return {
    events: manager.events,
    settings: manager.settings,
    getUser: () => manager.getUser(),
    signinRedirect: (args) => manager.signinRedirect(args),
    signinCallback: async (url) => {
      try {
        const user = await manager.signinRedirectCallback(url)
        if (!user) throw new Error('OIDC callback did not produce a user')
        return user
      } catch (caught) {
        const category = classifyOidcCallbackError(caught)
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent(OIDC_CALLBACK_ERROR_EVENT, { detail: category }))
        // Deliberately discard the caught value; attaching it would violate the diagnostic boundary.
        // eslint-disable-next-line preserve-caught-error
        throw new Error('OIDC callback failed')
      }
    },
    signoutRedirect: (args) => manager.signoutRedirect(args),
    clearTransactionState: async () => {
      // oidc-client-ts stores authorization transaction/PKCE material under
      // its dedicated `oidc.` state-store prefix; preserve unrelated entries.
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index)
        if (key?.startsWith('oidc.')) storage.removeItem(key)
      }
    },
  }
}

export function hasPersistentToken(value: unknown): boolean {
  return typeof value === 'string' && /(?:access|id|refresh)[_-]?token|eyJ[A-Za-z0-9_-]+\./i.test(value)
}
