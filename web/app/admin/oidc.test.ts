import { describe, expect, it, vi } from 'vitest'
import type { User } from 'oidc-client-ts'
import { UserManager } from 'oidc-client-ts'
import { ADMIN_SCOPES, oidcConfig, isSafeReturnPath, createOidcPort } from './oidc'
describe('OIDC boundary', () => {
  it('uses code/PKCE callback boundaries and exact scopes', () => { expect(ADMIN_SCOPES).toBe('openid email profile itsrun/schedule.write'); expect(oidcConfig('https://issuer/', 'client', 'https://preview.example')).toEqual({ authority: 'https://issuer', clientId: 'client', redirectUri: 'https://preview.example/manage/callback', postLogoutRedirectUri: 'https://preview.example/manage' }) })
  it('rejects hostile return paths', () => { expect(isSafeReturnPath('/manage')).toBe(true); expect(isSafeReturnPath('/manage/editor')).toBe(true); for (const path of ['https://evil.example', '//evil.example', '/%2f%2fevil', '/manage\\evil', '/public']) expect(isSafeReturnPath(path)).toBe(false) })
  it('constructs actual UserManager settings with injected transaction storage', async () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
      clear: () => { values.clear() },
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size },
    } as Storage
    const manager = createOidcPort(oidcConfig('https://issuer', 'client', 'https://preview.example'), storage)
    expect(manager.settings?.response_type).toBe('code'); expect(manager.settings?.scope).toBe(ADMIN_SCOPES); expect(manager.settings?.automaticSilentRenew).toBe(false)
    expect(manager.settings?.stateStore).toBeDefined(); expect(manager.settings?.userStore).toBeDefined(); expect(manager.settings?.userStore).not.toBe(manager.settings?.stateStore)
    const tokenUser = JSON.stringify({ access_token: 'memory-only-token', profile: { sub: 'admin' } })
    await manager.settings?.userStore?.set('user', tokenUser)
    expect(await manager.settings?.userStore?.get('user')).toBe(tokenUser)
    expect([...values.entries()].some(([key, value]) => /token|user|admin/i.test(`${key} ${value}`))).toBe(false)
    await manager.settings?.stateStore?.set('transaction', JSON.stringify({ state: 'x' }))
    storage.setItem('unrelated', 'keep')
    expect([...values.keys()].some((key) => key.startsWith('oidc.'))).toBe(true)
    await manager.clearTransactionState()
    expect(storage.getItem('unrelated')).toBe('keep')
    expect([...values.keys()].some((key) => key.includes('transaction'))).toBe(false)
  })
  it('uses only the redirect callback API at the production port boundary', async () => {
    const redirectUser = { access_token: 'memory-only-token', profile: { sub: 'admin' } } as unknown as User
    const redirect = vi.spyOn(UserManager.prototype, 'signinRedirectCallback').mockResolvedValue(redirectUser)
    const generic = vi.spyOn(UserManager.prototype, 'signinCallback').mockRejectedValue(new Error('generic callback must not run'))
    try {
      const port = createOidcPort(oidcConfig('https://issuer', 'client', 'https://preview.example'), {} as Storage)
      await expect(port.signinCallback('https://preview.example/manage/callback?code=opaque&state=opaque')).resolves.toBe(redirectUser)
      expect(redirect).toHaveBeenCalledWith('https://preview.example/manage/callback?code=opaque&state=opaque')
      expect(generic).not.toHaveBeenCalled()
    } finally {
      redirect.mockRestore()
      generic.mockRestore()
    }
  })
})
