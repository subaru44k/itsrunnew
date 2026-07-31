import { readFile, readdir } from 'node:fs/promises'
import { resolve, relative, dirname, join } from 'node:path'

const argument = process.argv.indexOf('--web-dir')
const root = resolve(argument === -1 ? 'web/.output/public' : process.argv[argument + 1])
const compatibility = new Set(['/komazawa_olympic', '/en/komazawa_olympic'])
const expectedRoutes = new Set([
  '/', '/yumenoshima', '/komazawa', '/todoroki', '/pace/marathon', '/nozomiantena',
  '/en', '/en/yumenoshima', '/en/komazawa', '/en/todoroki', '/en/pace/marathon', '/en/nozomiantena',
])

async function findIndexes(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const result = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await findIndexes(path))
    else if (entry.name === 'index.html') result.push(path)
  }
  return result
}

function routeFor(file) {
  const path = `/${relative(root, dirname(file)).replaceAll('\\', '/')}`
  return path === '/.' ? '/' : path
}
function hrefFor(html, rel, hreflang) {
  const pattern = hreflang
    ? new RegExp(`<link[^>]+rel="${rel}"[^>]+href="([^"]+)"[^>]+hreflang="${hreflang}"`)
    : new RegExp(`<link[^>]+rel="${rel}"[^>]+href="([^"]+)"`)
  return html.match(pattern)?.[1]
}
function normalize(path) {
  return path === '/' ? '/' : path.replace(/\/$/, '')
}

const actualRoutes = new Set()
for (const file of await findIndexes(root)) {
  const route = routeFor(file)
  if (compatibility.has(route)) continue
  actualRoutes.add(route)
  const html = await readFile(file, 'utf8')
  const lang = html.match(/<html[^>]+lang="([^"]+)"/)?.[1]
  const expectedLang = route.startsWith('/en') ? 'en-US' : 'ja-JP'
  if (lang !== expectedLang) throw new Error(`${route}: expected html lang ${expectedLang}, got ${lang || 'missing'}`)
  const canonical = hrefFor(html, 'canonical')
  if (canonical !== normalize(route)) throw new Error(`${route}: canonical mismatch (${canonical || 'missing'})`)
  const ja = hrefFor(html, 'alternate', 'ja')
  const en = hrefFor(html, 'alternate', 'en')
  const xDefault = hrefFor(html, 'alternate', 'x-default')
  const base = route.startsWith('/en') ? route.slice(3) || '/' : route
  const expectedEn = base === '/' ? '/en' : `/en${base}`
  if (ja !== normalize(base) || en !== normalize(expectedEn) || xDefault !== normalize(base)) {
    throw new Error(`${route}: alternate mismatch ja=${ja || 'missing'} en=${en || 'missing'} x-default=${xDefault || 'missing'}`)
  }
}
for (const route of expectedRoutes) {
  if (!actualRoutes.has(route)) throw new Error(`${route}: expected generated index.html is missing`)
}
for (const route of actualRoutes) {
  if (!expectedRoutes.has(route)) throw new Error(`${route}: unexpected normal generated route`)
}
console.log(`Generated SEO metadata verified under ${root}`)
