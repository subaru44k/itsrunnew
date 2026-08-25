import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const tracks = JSON.parse(await readFile(resolve(root, 'src/data/tracks.json'), 'utf8'));
const template = await readFile(resolve(root, 'dist/index.html'), 'utf8');
const origin = 'https://itsrun.info';

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const replaceMeta = (html, selector, value) => html.replace(selector, match => match.replace(/content="[^"]*"/, `content="${escapeHtml(value)}"`));

for (const track of tracks) {
  for (const locale of ['ja', 'en']) {
    const prefix = locale === 'en' ? '/en' : '';
    const path = `${prefix}/tracks/${track.id}`;
    const name = track.name[locale];
    const title = locale === 'en' ? `${name} availability and track details - ItsRun` : `${name}の利用予定・トラック情報 - いつラン`;
    const description = locale === 'en'
      ? `Check ${name}'s date-specific availability, track length, surface, individual-use information, official links and directions.`
      : `${name}の指定日ごとの利用状況、トラック距離・路面、個人利用情報、公式案内、経路を確認できます。`;
    const canonical = `${origin}${path}`;
    let html = template
      .replace(/<html lang="[^"]*"/, `<html lang="${locale}"`)
      .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
      .replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${canonical}"`);
    html = replaceMeta(html, /<meta name="description"[^>]*>/, description);
    html = replaceMeta(html, /<meta property="og:title"[^>]*>/, title);
    html = replaceMeta(html, /<meta property="og:description"[^>]*>/, description);
    html = replaceMeta(html, /<meta property="og:url"[^>]*>/, canonical);
    const structuredData = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'SportsActivityLocation', name,
      address: track.location.address,
      geo: { '@type': 'GeoCoordinates', latitude: track.location.latitude, longitude: track.location.longitude },
      url: canonical, sameAs: track.urls.official,
    }).replace(/</g, '\\u003c');
    html = html.replace('</head>', `<script type="application/ld+json">${structuredData}</script></head>`);
    const directory = resolve(root, `dist${path}`);
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'index.html'), html, 'utf8');
  }
}
console.log(`Static track route shells generated: ${tracks.length * 2}`);
