import { describe, expect, it } from 'vitest'
import { cacheControlForWebObject, readCloudFrontObject, webObjectUploadCommands } from './deploy-preview.mjs'

const fixtureBody = '{"ok":true}'
const fixtureHash = (await import('node:crypto')).createHash('sha256').update(fixtureBody).digest('hex')

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

  it('generates deterministic uploads with immutable and short-cache objects first', () => {
    const commands = webObjectUploadCommands('/build', 'preview-web', [
      'index.html', '_payload.json', 'robots.txt', '_nuxt/entry.ABCDEFGH.css', '_nuxt/builds/latest.json',
    ])
    expect(commands.map((command) => command[2])).toEqual([
      '/build/_nuxt/entry.ABCDEFGH.css', '/build/robots.txt', '/build/_nuxt/builds/latest.json', '/build/_payload.json', '/build/index.html',
    ])
    expect(commands[0].join(' ')).toContain('immutable')
    expect(commands.at(-1)?.join(' ')).toContain('no-cache')
  })

  it('verifies CloudFront status, metadata, and SHA-256', async () => {
    const response = () => new Response(fixtureBody, { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=60' } })
    await expect(readCloudFrontObject('preview.example', 'data/v1/test.json', fixtureHash, 'public, max-age=0, s-maxage=60', { fetchImpl: async () => response(), timeoutMs: 0, maxAttempts: 1 })).resolves.toBeUndefined()
  })

  it.each([
    ['non-200', () => new Response(fixtureBody, { status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=60' } }), 'expected 200'],
    ['content type', () => new Response(fixtureBody, { status: 200, headers: { 'content-type': 'text/plain', 'cache-control': 'public, max-age=0, s-maxage=60' } }), 'unexpected content-type'],
    ['cache metadata', () => new Response(fixtureBody, { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-cache' } }), 'unexpected cache-control'],
    ['hash', () => new Response('{"different":true}', { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=60' } }), 'hash mismatch'],
  ])('rejects %s', async (_name, fetchImpl, message) => {
    await expect(readCloudFrontObject('preview.example', 'data/v1/test.json', fixtureHash, 'public, max-age=0, s-maxage=60', { fetchImpl: async () => fetchImpl(), timeoutMs: 0, maxAttempts: 1 })).rejects.toThrow(message)
  })

  it('bounds retry attempts and reports timeout', async () => {
    const fetchImpl = async () => { throw new Error('connection refused') }
    await expect(readCloudFrontObject('preview.example', 'data/v1/test.json', fixtureHash, 'public, max-age=0, s-maxage=60', { fetchImpl, timeoutMs: 0, maxAttempts: 2, sleep: async () => {} })).rejects.toThrow('timed out')
  })
})
