import { describe, expect, it } from 'vitest'
import { ADMIN_SCOPES, oidcConfig, isSafeReturnPath, createOidcPort } from './oidc'
describe('OIDC boundary', () => {
  it('uses code/PKCE callback boundaries and exact scopes', () => { expect(ADMIN_SCOPES).toBe('openid email profile itsrun/schedule.write'); expect(oidcConfig('https://issuer/', 'client', 'https://preview.example')).toEqual({ authority: 'https://issuer', clientId: 'client', redirectUri: 'https://preview.example/manage/callback', postLogoutRedirectUri: 'https://preview.example/manage' }) })
  it('rejects hostile return paths', () => { expect(isSafeReturnPath('/manage')).toBe(true); expect(isSafeReturnPath('/manage/editor')).toBe(true); for (const path of ['https://evil.example', '//evil.example', '/%2f%2fevil', '/manage\\evil', '/public']) expect(isSafeReturnPath(path)).toBe(false) })
  it('constructs actual UserManager settings with injected transaction storage', () => {
    const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 } as Storage
    const manager = createOidcPort(oidcConfig('https://issuer', 'client', 'https://preview.example'), storage) as any
    expect(manager.settings.response_type).toBe('code'); expect(manager.settings.scope).toBe(ADMIN_SCOPES); expect(manager.settings.automaticSilentRenew).toBe(false)
    expect(manager.settings.stateStore).toBeDefined(); expect(manager.settings.userStore).toBeDefined(); expect(manager.settings.userStore).not.toBe(manager.settings.stateStore)
  })
})
