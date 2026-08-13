import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { contentType, createStaticServer, resolveStaticPath } from './serve-web-output.mjs'

test('static resolver removes query, resolves index, and blocks decoded traversal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'itsrun-static-'))
  try { await mkdir(join(root, 'nested')); await writeFile(join(root, 'index.html'), 'ok'); assert.equal(resolveStaticPath('/?secret=1', root), join(root, 'index.html')); assert.equal(resolveStaticPath('/nested', root), join(root, 'nested', 'index.html')); for (const path of ['/../secret', '/%2e%2e/secret', '/%252e%252e/secret', '/..%5csecret', '/%5csecret']) assert.equal(resolveStaticPath(path, root), null) } finally { await rm(root, { recursive: true, force: true }) }
})

test('content types are deterministic', () => {
  assert.equal(contentType('x.html'), 'text/html; charset=utf-8'); assert.equal(contentType('x.js'), 'text/javascript; charset=utf-8'); assert.equal(contentType('x.css'), 'text/css; charset=utf-8'); assert.equal(contentType('x.json'), 'application/json; charset=utf-8'); assert.equal(contentType('x.svg'), 'image/svg+xml'); assert.equal(contentType('x.bin'), 'application/octet-stream')
})

test('HTTP server permits GET/HEAD and rejects other methods', async () => {
  const root = await mkdtemp(join(tmpdir(), 'itsrun-static-http-')); await writeFile(join(root, 'index.html'), 'ok')
  const server = createStaticServer(root); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address(); const origin = `http://127.0.0.1:${address.port}`
    const get = await fetch(`${origin}/?ignored=1`); assert.equal(get.status, 200); assert.equal(await get.text(), 'ok'); assert.equal(get.headers.get('content-type'), 'text/html; charset=utf-8')
    const head = await fetch(`${origin}/`, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '')
    const post = await fetch(`${origin}/`, { method: 'POST' }); assert.equal(post.status, 405); assert.equal(post.headers.get('allow'), 'GET, HEAD')
    const traversal = await fetch(`${origin}/%2e%2e/secret`); assert.ok([403, 404].includes(traversal.status))
  } finally { await new Promise((resolve) => server.close(resolve)); await rm(root, { recursive: true, force: true }) }
})
