import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
const root = new URL('../../web/.output/public/', import.meta.url)
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }
const server = createServer(async (request, response) => {
  const safe = normalize(request.url?.split('?')[0] ?? '/').replace(/^\.\.(\/|\\)/, '')
  const route = safe === '/' ? '/index.html' : (extname(safe) ? safe : `${safe.replace(/\/$/, '')}/index.html`)
  const candidate = new URL(`.${route}`, root)
  try { const body = await readFile(candidate); response.writeHead(200, { 'content-type': mime[extname(candidate.pathname)] ?? 'application/octet-stream' }); response.end(body) } catch { response.writeHead(404); response.end('Not found') }
})
server.listen(Number(process.env.PORT || 3000), '127.0.0.1')
