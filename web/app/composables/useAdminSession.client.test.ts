import { describe, expect, it, vi } from 'vitest'
import type { User } from 'oidc-client-ts'
import { createAdminSession, getBrowserAdminSession, resetBrowserAdminSession } from './useAdminSession.client'
import type { OidcPort } from '../admin/oidc'

function fakeUser(state?: unknown): User {
  return { access_token: 'memory-token', state } as unknown as User
}

function fakePort(user: User | null = null) {
  let loaded: ((user: User) => void) | undefined
  let unloaded: (() => void) | undefined
  let expired: (() => void) | undefined
  let renewed: (() => void) | undefined
  const port: OidcPort = {
    events: {
      addUserLoaded: (handler) => { loaded = handler },
      addUserUnloaded: (handler) => { unloaded = handler },
      addAccessTokenExpired: (handler) => { expired = handler },
      addSilentRenewError: (handler) => { renewed = handler },
    },
    getUser: vi.fn(async () => user),
    signinRedirect: vi.fn(async () => undefined),
    signinCallback: vi.fn(async () => fakeUser({ returnPath: '/manage/schedule' })),
    signoutRedirect: vi.fn(async () => undefined),
    clearTransactionState: vi.fn(async () => undefined),
  }
  return { port, emitLoaded: (next: User) => loaded?.(next), emitUnloaded: () => unloaded?.(), emitExpired: () => expired?.(), emitRenewError: () => renewed?.() }
}

describe('browser admin session boundary', () => {
  it('deduplicates initialization and exposes no raw user or manager', async () => {
    const fake = fakePort()
    const session = createAdminSession({ authority: 'https://issuer', clientId: 'client', oidc: fake.port })
    await Promise.all([session.initialize(), session.initialize()])
    expect(fake.port.getUser).toHaveBeenCalledTimes(1)
    expect('user' in session).toBe(false)
    expect('manager' in session).toBe(false)
    expect(await session.getAccessToken()).toBeNull()
  })

  it('uses validated callback state, cleans transaction state, and injects replacement navigation', async () => {
    const fake = fakePort()
    const navigate = vi.fn()
    const session = createAdminSession({ authority: 'https://issuer', clientId: 'client', oidc: fake.port, navigate })
    await Promise.all([session.callback('https://preview.example/manage/callback?code=x'), session.callback('duplicate')])
    expect(fake.port.signinCallback).toHaveBeenCalledTimes(1)
    expect(fake.port.clearTransactionState).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/manage/schedule')
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

  it('attaches each event once and clears in-memory auth for all lifecycle events', async () => {
    const fake = fakePort()
    const session = getBrowserAdminSession({ authority: 'https://issuer', clientId: 'client', oidc: fake.port })
    expect(getBrowserAdminSession({ authority: 'other', clientId: 'other', oidc: fake.port })).toBe(session)
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
})
