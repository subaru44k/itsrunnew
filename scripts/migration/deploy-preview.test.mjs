import { describe, expect, it } from 'vitest'
import { cacheControlForWebObject } from './deploy-preview.mjs'

describe('preview web cache classification', () => {
  it.each([
    'index.html',
    '_payload.json',
    'en/_payload.json',
    'en/pace/marathon/_payload.json',
    '_nuxt/builds/latest.json',
  ])('%s is mutable/no-cache', (key) => {
    expect(cacheControlForWebObject(key)).toContain('no-cache')
  })

  it.each(['_nuxt/entry.BwNEmpOK.css', '_nuxt/chunks/ABC1234567.js', '_nuxt/builds/abc123.json'])('%s is immutable', (key) => {
    expect(cacheControlForWebObject(key)).toContain('immutable')
  })

  it('keeps un-hashed assets on the short public cache', () => {
    expect(cacheControlForWebObject('robots.txt')).toBe('public, max-age=86400')
  })
})
