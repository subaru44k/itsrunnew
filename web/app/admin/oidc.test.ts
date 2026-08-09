import { describe, expect, it } from 'vitest'
import { ADMIN_SCOPES, oidcConfig, isSafeReturnPath } from './oidc'
describe('OIDC boundary', () => {
  it('uses code/PKCE callback boundaries and exact scopes', () => { expect(ADMIN_SCOPES).toBe('openid email profile itsrun/schedule.write'); expect(oidcConfig('https://issuer/', 'client', 'https://preview.example')).toEqual({ authority: 'https://issuer', clientId: 'client', redirectUri: 'https://preview.example/manage/callback', postLogoutRedirectUri: 'https://preview.example/manage' }) })
  it('rejects hostile return paths', () => { expect(isSafeReturnPath('/manage')).toBe(true); expect(isSafeReturnPath('/manage/editor')).toBe(true); for (const path of ['https://evil.example', '//evil.example', '/%2f%2fevil', '/manage\\evil', '/public']) expect(isSafeReturnPath(path)).toBe(false) })
})
