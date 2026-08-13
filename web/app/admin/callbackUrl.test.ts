import { describe, expect, it } from 'vitest'
import { captureCallbackUrl, selectCallbackUrl } from './callbackUrl'

const origin = 'https://preview.example'
const path = '/manage/callback'
const current = `${origin}${path}?code=code-value&state=state-value`
const initial = `${origin}${path}?code=initial-code&state=initial-state`

function select(currentHref: unknown = current, navigationEntryNames: readonly unknown[] = []) {
  return selectCallbackUrl({ expectedOrigin: origin, expectedPath: path, currentHref, navigationEntryNames })
}

describe('callback URL selection', () => {
  it('prefers a valid current URL and captures a valid navigation fallback', () => {
    expect(select()).toBe(current)
    expect(select('https://preview.example/manage/callback', [initial])).toBe(initial)
    expect(captureCallbackUrl(origin, path, 'https://preview.example/manage/callback', [{ name: initial } as PerformanceNavigationTiming])).toBe(initial)
  })

  it('counts encoded semantic response names without inspecting their values', () => {
    expect(select(`${origin}${path}?code=x&%73tate=y`)).toBe(`${origin}${path}?code=x&%73tate=y`)
    expect(select(`${origin}${path}?%63ode=x&state=y`)).toBe(`${origin}${path}?%63ode=x&state=y`)
    expect(select(`${origin}${path}?%65rror=x&state=y`)).toBe(`${origin}${path}?%65rror=x&state=y`)
    expect(select(`${origin}${path}?state=x&%73tate=y&code=z`)).toBeUndefined()
    expect(select(`${origin}${path}?state=x&code=y&%63ode=z`)).toBeUndefined()
    expect(select(`${origin}${path}?state=x&error=y&%65rror=z`)).toBeUndefined()
    expect(select(`${origin}${path}?state=x&extra%2Dkey=y&code=z`)).toBe(`${origin}${path}?state=x&extra%2Dkey=y&code=z`)
  })

  it.each([
    ['malformed', 'not a URL'],
    ['cross-origin', `https://evil.example${path}?code=x&state=y`],
    ['wrong path', `${origin}/manage?code=x&state=y`],
    ['fragment', `${origin}${path}?code=x&state=y#fragment`],
    ['userinfo', `https://user:pass@preview.example${path}?code=x&state=y`],
    ['missing state', `${origin}${path}?code=x`],
    ['empty state', `${origin}${path}?code=x&state=`],
    ['repeated state', `${origin}${path}?code=x&state=y&state=z`],
    ['missing response', `${origin}${path}?state=y`],
    ['empty code', `${origin}${path}?code=&state=y`],
    ['repeated code', `${origin}${path}?code=x&code=y&state=z`],
    ['both code and error', `${origin}${path}?code=x&error=y&state=z`],
    ['empty error', `${origin}${path}?error=&state=z`],
    ['malformed percent-encoded name', `${origin}${path}?state=z&%ZZ=x&code=y`],
    ['truncated percent-encoded name', `${origin}${path}?state=z&%F=x&code=y`],
  ])('rejects %s candidates', (_label, value) => { expect(select(value)).toBeUndefined() })

  it('rejects ambiguous or multiple valid navigation entries', () => {
    expect(select('invalid', [])).toBeUndefined()
    expect(select('invalid', ['invalid', `${origin}${path}?code=x&state=y`])).toBe(`${origin}${path}?code=x&state=y`)
    expect(select('invalid', [initial, current])).toBeUndefined()
    expect(select('invalid', [initial, 'invalid'])).toBe(initial)
  })

  it('does not return individual response values', () => {
    const result = select()
    expect(result).toBe(current)
    expect(result).not.toBe('code-value')
    expect(result).not.toBe('state-value')
  })
})
