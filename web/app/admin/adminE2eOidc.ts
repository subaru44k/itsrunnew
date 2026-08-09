import type { User } from 'oidc-client-ts'
import type { OidcPort } from './oidc'

const fakeUser = (): User => ({ access_token: 'admin-e2e-memory-token', token_type: 'Bearer', profile: { sub: 'admin-e2e-user', iss: 'https://admin-e2e.invalid', aud: 'admin-e2e-client' } } as User)
export function createAdminE2eOidcPort(): OidcPort {
  let user: User | null = null
  const handlers: Array<(next: User) => void> = []
  const unloaded: Array<() => void> = []
  const expired: Array<() => void> = []
  const renewed: Array<() => void> = []
  return {
    events: { addUserLoaded: (handler) => { handlers.push(handler) }, addUserUnloaded: (handler) => { unloaded.push(handler) }, addAccessTokenExpired: (handler) => { expired.push(handler) }, addSilentRenewError: (handler) => { renewed.push(handler) } },
    getUser: async () => user,
    signinRedirect: async (args) => { sessionStorage.setItem('admin-e2e-login-settings', JSON.stringify({ responseType: 'code', scope: 'openid email profile itsrun/schedule.write', redirectUri: `${window.location.origin}/manage/callback`, codeChallengeMethod: 'S256', state: args?.state })); sessionStorage.setItem('admin-e2e-transaction', JSON.stringify({ state: args?.state, codeChallenge: 'test-only' })); user = fakeUser(); handlers.forEach((handler) => handler(user as User)); window.history.replaceState({}, '', '/manage') },
    signinCallback: async () => { user = fakeUser(); handlers.forEach((handler) => handler(user as User)); return user as User },
    signoutRedirect: async () => { user = null; unloaded.forEach((handler) => handler()) },
    clearTransactionState: async () => { sessionStorage.removeItem('admin-e2e-transaction') },
  }
}

export function triggerAdminE2eExpiry() { return { expired: true, silentRenewError: true } }
