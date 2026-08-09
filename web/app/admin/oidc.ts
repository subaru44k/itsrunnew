import { InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from 'oidc-client-ts'

export const ADMIN_SCOPES = 'openid email profile itsrun/schedule.write'
export const ADMIN_CALLBACK_PATH = '/manage/callback'
export const ADMIN_LOGOUT_PATH = '/manage'

export function isSafeReturnPath(value: unknown): boolean {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /%2f|%5c|%3a/i.test(value)) return false
  const path = value.split(/[?#]/, 1)[0] ?? ''
  return path === '/manage' || path.startsWith('/manage/')
}

export interface OidcPort {
  readonly user?: User | null
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

export function createOidcPort(config: OidcConfig): OidcPort {
  // The import and UserManager are browser-only: this module is only called by
  // the .client composable after Nuxt has entered a browser lifecycle.
  return new UserManager({
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    post_logout_redirect_uri: config.postLogoutRedirectUri,
    response_type: 'code',
    scope: ADMIN_SCOPES,
    automaticSilentRenew: false,
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
  }) as OidcPort
}

export function hasPersistentToken(value: unknown): boolean {
  return typeof value === 'string' && /(?:access|id|refresh)[_-]?token|eyJ[A-Za-z0-9_-]+\./i.test(value)
}
