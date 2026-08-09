import { describe, expect, it, vi } from 'vitest'
import type { User } from 'oidc-client-ts'
import { createAdminSession, getBrowserAdminSession, replaceClientPath, resetBrowserAdminSession } from './useAdminSession.client'
import type { OidcPort } from '../admin/oidc'

function fakeUser(state?: unknown): User {
  return { access_token: 'memory-token', state } as unknown as User
}

function fakePort(user: User | null = null) {
  let loaded: ((user: User) => void) | undefined
  let unloaded: (() => void) | undefined
  let expired: (() => void) | undefined
  let renewed: (() => void) | undefined
  const registrations = { loaded: 0, unloaded: 0, expired: 0, renewed: 0 }
  const port: OidcPort = {
    events: {
      addUserLoaded: (handler) => { registrations.loaded += 1; loaded = handler },
      addUserUnloaded: (handler) => { registrations.unloaded += 1; unloaded = handler },
      addAccessTokenExpired: (handler) => { registrations.expired += 1; expired = handler },
      addSilentRenewError: (handler) => { registrations.renewed += 1; renewed = handler },
    },
    getUser: vi.fn(async () => user),
    signinRedirect: vi.fn(async () => undefined),
    signinCallback: vi.fn(async () => fakeUser({ returnPath: '/manage/schedule' })),
    signoutRedirect: vi.fn(async () => undefined),
    clearTransactionState: vi.fn(async () => undefined),
  }
  return { port, registrations, emitLoaded: (next: User) => loaded?.(next), emitUnloaded: () => unloaded?.(), emitExpired: () => expired?.(), emitRenewError: () => renewed?.() }
}

describe('browser admin session boundary', () => {
  it('replaces one client path and dispatches one popstate without full reload', () => {
    const replaceState = vi.fn(); const dispatchEvent = vi.fn()
    vi.stubGlobal('window', { history: { state: { marker: 'state' }, replaceState }, dispatchEvent })
    vi.stubGlobal('PopStateEvent', class { type: string; state: unknown; constructor(type: string, init: { state: unknown }) { this.type = type; this.state = init.state } })
    replaceClientPath('/manage/schedule')
    expect(replaceState).toHaveBeenCalledTimes(1)
    expect(replaceState).toHaveBeenCalledWith({ marker: 'state' }, '', '/manage/schedule')
    expect(dispatchEvent).toHaveBeenCalledTimes(1)
    expect(dispatchEvent.mock.calls[0][0].type).toBe('popstate')
    vi.unstubAllGlobals()
  })

  it('covers unconfigured state and deduplicates initialization with retry', async () => {
    const unconfigured = createAdminSession({ authority: '', clientId: '' })
    expect(unconfigured.state.value).toBe('unconfigured')
    const fake = fakePort()
    fake.port.getUser = vi.fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(fakeUser())
    const session = createAdminSession({ authority: 'https://issuer', clientId: 'client', oidc: fake.port })
    await Promise.all([session.initialize(), session.initialize()])
    expect(fake.port.getUser).toHaveBeenCalledTimes(1)
    expect(session.state.value).toBe('sanitizedError')
    await session.initialize()
    expect(fake.port.getUser).toHaveBeenCalledTimes(2)
    expect(session.state.value).toBe('signedIn')
    expect('user' in session).toBe(false)
    expect('manager' in session).toBe(false)
    expect(await session.getAccessToken()).toBe('memory-token')
  })

  it('uses validated callback state, cleans transaction state, and injects replacement navigation', async () => {
    const fake = fakePort()
    const order: string[] = []
    fake.port.clearTransactionState = vi.fn(async () => { order.push('cleanup') })
    const navigate = vi.fn(async () => { order.push('navigate') })
    const session = createAdminSession({ authority: 'https://issuer', clientId: 'client', oidc: fake.port, navigate })
    await Promise.all([session.callback('https://preview.example/manage/callback?code=x'), session.callback('duplicate')])
    expect(fake.port.signinCallback).toHaveBeenCalledTimes(1)
    expect(fake.port.clearTransactionState).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/manage/schedule')
    expect(order).toEqual(['cleanup', 'navigate'])
    expect(await session.getAccessToken()).toBe('memory-token')
  })

  it('sanitizes callback failure and retains only a sanitized error', async () => {
    const fake = fakePort()
    fake.port.signinCallback = vi.fn(async () => { throw new Error('token=secret') })
    const navigate = vi.fn()
    const session = createAdminSession({ authority: 'https://issuer', clientId: 'client', oidc: fake.port, navigate })
    await session.callback()
    expect(fake.port.clearTransactionState).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/manage')
    expect(session.state.value).toBe('sanitizedError')
    expect(session.error.value).toBe('authentication')
    expect(await session.getAccessToken()).toBeNull()
  })

  it('swallows transaction cleanup failure without logging it or changing navigation', async () => {
    const fake = fakePort()
    fake.port.clearTransactionState = vi.fn(async () => { throw new Error('raw transaction token') })
    const navigate = vi.fn()
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const session = createAdminSession({ authority: 'https://issuer', clientId: 'client', oidc: fake.port, navigate })
    await session.callback()
    expect(fake.port.clearTransactionState).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/manage/schedule')
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('passes safe and hostile login paths without exposing redirect errors', async () => {
    const fake = fakePort()
    const session = createAdminSession({ authority: 'https://issuer', clientId: 'client', oidc: fake.port })
    await session.login('/manage/schedule')
    await session.login('https://evil.example')
    expect(fake.port.signinRedirect).toHaveBeenNthCalledWith(1, { state: { returnPath: '/manage/schedule' } })
    expect(fake.port.signinRedirect).toHaveBeenNthCalledWith(2, { state: { returnPath: '/manage' } })
  })

  it('attaches each event once and clears in-memory auth for all lifecycle events', async () => {
    const fake = fakePort()
    const session = getBrowserAdminSession({ authority: 'https://issuer', clientId: 'client', oidc: fake.port })
    expect(getBrowserAdminSession({ authority: 'other', clientId: 'other', oidc: fake.port })).toBe(session)
    expect(fake.registrations).toEqual({ loaded: 1, unloaded: 1, expired: 1, renewed: 1 })
    fake.emitLoaded(fakeUser())
    expect(await session.getAccessToken()).toBe('memory-token')
    fake.emitUnloaded(); expect(await session.getAccessToken()).toBeNull()
    fake.emitLoaded(fakeUser())
    fake.emitExpired(); expect(await session.getAccessToken()).toBeNull()
    fake.emitLoaded(fakeUser())
    fake.emitRenewError(); expect(await session.getAccessToken()).toBeNull()
    await session.logout()
    expect(await session.getAccessToken()).toBeNull()
    resetBrowserAdminSession()
  })

  it('ends logout in signedOut for both redirect outcomes and never logs raw errors', async () => {
    const fake = fakePort()
    const session = createAdminSession({ authority: 'https://issuer', clientId: 'client', oidc: fake.port })
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    fake.emitLoaded(fakeUser())
    await session.logout()
    expect(session.state.value).toBe('signedOut')
    fake.emitLoaded(fakeUser())
    fake.port.signoutRedirect = vi.fn(async () => { throw new Error('raw-token-error') })
    await session.logout()
    expect(session.state.value).toBe('signedOut')
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })
})
