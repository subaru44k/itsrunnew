import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
})

const defaultRoot = resolve(fileURLToPath(new URL('../../web/.output/public/', import.meta.url)))

function decodePathname(requestUrl) {
  const rawInput = String(requestUrl || '/').split(/[?#]/, 1)[0] || '/'
  if (rawInput.includes('\\') || /(?:^|\/)\.\.(?:\/|$)/.test(rawInput) || /%(?:2e|5c)/i.test(rawInput)) return null
  const raw = new URL(requestUrl || '/', 'http://127.0.0.1').pathname
  if (raw.includes('\\')) return null
  let decoded
  try { decoded = decodeURIComponent(raw) } catch { return null }
  if (decoded.includes('\\') || /%[0-9a-f]{2}/i.test(decoded) || decoded.split('/').some((part) => part === '..')) return null
  return decoded
}

export function resolveStaticPath(requestUrl, root = defaultRoot) {
  const pathname = decodePathname(requestUrl)
  if (!pathname) return null
  const relativePath = pathname === '/' ? 'index.html' : (extname(pathname) ? pathname.slice(1) : `${pathname.replace(/^\/+|\/+$/g, '')}/index.html`)
  const rootPath = resolve(root)
  const candidate = resolve(rootPath, relativePath)
  const outside = relative(rootPath, candidate).startsWith('..') || relative(rootPath, candidate).includes('..' + '/')
  return outside ? null : candidate
}

export function contentType(pathname) { return CONTENT_TYPES[extname(pathname).toLowerCase()] ?? 'application/octet-stream' }

export function createStaticServer(root = defaultRoot) {
  return createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' }); response.end('Method Not Allowed'); return
    }
    const candidate = resolveStaticPath(request.url, root)
    if (!candidate) { response.writeHead(403); response.end('Forbidden'); return }
    try {
      const body = await readFile(candidate)
      response.writeHead(200, { 'content-type': contentType(candidate), 'content-length': String(body.byteLength) })
      response.end(request.method === 'HEAD' ? undefined : body)
    } catch { response.writeHead(404); response.end('Not found') }
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createStaticServer(process.env.WEB_OUTPUT_DIR ? resolve(process.env.WEB_OUTPUT_DIR) : defaultRoot).listen(Number(process.env.PORT || 3000), '127.0.0.1')
}
