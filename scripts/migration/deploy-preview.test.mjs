import { describe, expect, it, vi } from 'vitest'
import { cacheControlForWebObject, readCloudFrontObject } from './deploy-preview.mjs'

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

  it('verifies CloudFront status, metadata, and SHA-256', async () => {
    const body = '{"ok":true}'
    const hash = (await import('node:crypto')).createHash('sha256').update(body).digest('hex')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=60' } })))
    await expect(readCloudFrontObject('preview.example', 'data/v1/test.json', hash, 'max-age=0')).resolves.toBeUndefined()
    vi.unstubAllGlobals()
  })
})
