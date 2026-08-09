import type { User } from 'oidc-client-ts'
import type { OidcPort } from './oidc'

const fakeUser = (state?: unknown): User => ({ access_token: 'admin-e2e-memory-token', token_type: 'Bearer', state, profile: { sub: 'admin-e2e-user', iss: 'https://admin-e2e.invalid', aud: 'admin-e2e-client' } } as User)
const mode = () => typeof window !== 'undefined' ? sessionStorage.getItem('admin-e2e-mode') : null
export function createAdminE2eOidcPort(): OidcPort {
  let user: User | null = null
  const handlers: Array<(next: User) => void> = []
  const unloaded: Array<() => void> = []
  const expired: Array<() => void> = []
  const renewed: Array<() => void> = []
  return {
    events: { addUserLoaded: (handler) => { handlers.push(handler) }, addUserUnloaded: (handler) => { unloaded.push(handler) }, addAccessTokenExpired: (handler) => { expired.push(handler) }, addSilentRenewError: (handler) => { renewed.push(handler) } },
    getUser: async () => { if (mode() === 'initFailure') throw new Error('fake init failure') ; return user },
    signinRedirect: async (args) => { if (mode() === 'loginFailure') throw new Error('fake redirect failure'); sessionStorage.setItem('admin-e2e-login-settings', JSON.stringify({ responseType: 'code', scope: 'openid email profile itsrun/schedule.write', redirectUri: `${window.location.origin}/manage/callback`, codeChallengeMethod: 'S256', state: args?.state })); sessionStorage.setItem('admin-e2e-transaction', JSON.stringify({ state: args?.state, codeChallenge: 'test-only' })); user = fakeUser(); handlers.forEach((handler) => handler(user as User)); if (mode() === 'expired') queueMicrotask(() => { user = null; expired.forEach((handler) => handler()) }); if (mode() === 'unloaded') queueMicrotask(() => { user = null; unloaded.forEach((handler) => handler()) }); if (mode() === 'silentRenew') queueMicrotask(() => { user = null; renewed.forEach((handler) => handler()) }); window.history.replaceState({}, '', '/manage') },
    signinCallback: async () => { if (mode() === 'callbackFailure') { window.history.replaceState({}, '', '/manage'); throw new Error('fake callback failure') }; user = fakeUser({ returnPath: mode() === 'hostileReturn' ? 'https://evil.invalid' : '/manage' }); handlers.forEach((handler) => handler(user as User)); window.history.replaceState({}, '', '/manage'); return user as User },
    signoutRedirect: async () => { user = null; unloaded.forEach((handler) => handler()) },
    clearTransactionState: async () => { sessionStorage.removeItem('admin-e2e-transaction') },
  }
}

export function triggerAdminE2eExpiry() { return { expired: true, silentRenewError: true } }
