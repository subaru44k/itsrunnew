import { describe, expect, it, vi } from 'vitest'
import type { User } from 'oidc-client-ts'
import { ErrorResponse, UserManager } from 'oidc-client-ts'
import { ADMIN_SCOPES, oidcConfig, isSafeReturnPath, createOidcPort, classifyOidcCallbackError, OIDC_CALLBACK_ERROR_EVENT } from './oidc'
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
  it.each([
    ['null', null, 'state-unavailable'],
    ['undefined', undefined, 'state-unavailable'],
    ['syntax', new SyntaxError('state=token-canary'), 'state-malformed'],
    ['request type', new Error('invalid request_type in state'), 'invalid-redirect-request-type'],
    ['oauth response', new ErrorResponse({ error: 'invalid_grant', error_description: 'token=canary' }), 'oauth-response-error'],
    ['other', { message: 'state=secret', token: 'canary' }, 'callback-other'],
  ])('reduces hostile callback value %s to a fixed category', (_label, caught, category) => {
    expect(classifyOidcCallbackError(caught)).toBe(category)
    expect(JSON.stringify(classifyOidcCallbackError(caught))).not.toMatch(/canary|secret|token/)
  })
  it('dispatches only the fixed callback category and throws a generic error', async () => {
    const dispatch = vi.fn(); vi.stubGlobal('window', { dispatchEvent: dispatch }); vi.stubGlobal('CustomEvent', class { type: string; detail: unknown; constructor(type: string, init: { detail: unknown }) { this.type = type; this.detail = init.detail } })
    const redirect = vi.spyOn(UserManager.prototype, 'signinRedirectCallback').mockRejectedValue(new SyntaxError('state=raw-canary'))
    try {
      const port = createOidcPort(oidcConfig('https://issuer', 'client', 'https://preview.example'), {} as Storage)
      await expect(port.signinCallback()).rejects.toThrow('OIDC callback failed')
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: OIDC_CALLBACK_ERROR_EVENT, detail: 'state-malformed' }))
      expect(JSON.stringify(dispatch.mock.calls)).not.toMatch(/raw-canary|state=/)
    } finally { redirect.mockRestore(); vi.unstubAllGlobals() }
  })
})
