import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const tracks = JSON.parse(await readFile(resolve(root, 'src/data/tracks.json'), 'utf8'));
const template = await readFile(resolve(root, 'dist/index.html'), 'utf8');
const origin = 'https://itsrun.info';

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const replaceMeta = (html, selector, value) => html.replace(selector, match => match.replace(/content="[^"]*"/, `content="${escapeHtml(value)}"`));
const replaceLink = (html, selector, value) => html.replace(selector, match => match.replace(/href="[^"]*"/, `href="${escapeHtml(value)}"`));
const radians = degrees => degrees * Math.PI / 180;

function distanceKm(a, b) {
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function staticTrackDetailContent(track, locale) {
  const prefix = locale === 'en' ? '/en' : '';
  const nearby = tracks
    .filter(candidate => candidate.id !== track.id)
    .map(candidate => ({ track: candidate, distance: distanceKm(track.location, candidate.location) }))
    .sort((left, right) => left.distance - right.distance || left.track.id.localeCompare(right.track.id))
    .slice(0, 5);
  const nearbyLinks = nearby.map(item => `<li><a data-static-nearby-track href="${prefix}/tracks/${escapeHtml(item.track.id)}">${escapeHtml(item.track.name[locale])}</a> <span>${item.distance.toFixed(1)} km</span></li>`).join('');
  const heading = locale === 'en' ? 'Nearby tracks' : '近くのトラック';
  const description = locale === 'en'
    ? 'Choose a date to compare nearby alternatives by availability and distance.'
    : '日付を選び、利用状況と距離から周辺の代替候補を比較できます。';
  return `<div id="app"><main data-static-track-detail><h1>${escapeHtml(track.name[locale])}</h1><p>${escapeHtml(track.location.address)}</p><section><h2>${heading}</h2><p>${description}</p><ul>${nearbyLinks}</ul><p><a href="${prefix}/">${locale === 'en' ? 'Search all tracks' : 'すべてのトラックを探す'}</a></p></section></main></div>`;
}

function pageShell({ path, locale, title, description, alternateJa, alternateEn }) {
  const canonical = `${origin}${path}`;
  let html = template
    .replace(/<html lang="[^"]*"/, `<html lang="${locale}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = replaceMeta(html, /<meta name="description"[^>]*>/, description);
  html = replaceMeta(html, /<meta property="og:locale"[^>]*>/, locale === 'en' ? 'en_US' : 'ja_JP');
  html = replaceMeta(html, /<meta property="og:title"[^>]*>/, title);
  html = replaceMeta(html, /<meta property="og:description"[^>]*>/, description);
  html = replaceMeta(html, /<meta property="og:url"[^>]*>/, canonical);
  html = replaceMeta(html, /<meta name="twitter:title"[^>]*>/, title);
  html = replaceMeta(html, /<meta name="twitter:description"[^>]*>/, description);
  html = replaceLink(html, /<link rel="canonical"[^>]*>/, canonical);
  html = replaceLink(html, /<link rel="alternate" hreflang="ja"[^>]*>/, `${origin}${alternateJa}`);
  html = replaceLink(html, /<link rel="alternate" hreflang="en"[^>]*>/, `${origin}${alternateEn}`);
  html = replaceLink(html, /<link rel="alternate" hreflang="x-default"[^>]*>/, `${origin}${alternateJa}`);
  return html;
}

const fixedShells = [
  {
    path: '/en/', locale: 'en',
    title: 'Find tracks for individual use by date and location - ItsRun',
    description: 'When your usual venue is closed or you are training somewhere new, compare tracks for individual use by date, location, availability and facilities.',
    alternateJa: '/', alternateEn: '/en/',
  },
  {
    path: '/oda-field', locale: 'ja',
    title: '織田フィールドの利用情報｜周辺の個人利用トラック - いつラン',
    description: '織田フィールドは2026年11月30日まで利用停止予定です。周辺の個人利用できそうな陸上トラックを、選択日の利用状況と距離から比較して代わりの練習場所を探せます。',
    alternateJa: '/oda-field', alternateEn: '/en/oda-field',
  },
  {
    path: '/en/oda-field', locale: 'en',
    title: 'Oda Field closure and nearby running tracks - ItsRun',
    description: 'Oda Field is scheduled to remain closed through November 30, 2026. Compare nearby tracks by date-specific availability and distance.',
    alternateJa: '/oda-field', alternateEn: '/en/oda-field',
  },
];

for (const page of fixedShells) {
  const directory = resolve(root, `dist${page.path}`);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'index.html'), pageShell(page), 'utf8');
}

for (const track of tracks) {
  for (const locale of ['ja', 'en']) {
    const prefix = locale === 'en' ? '/en' : '';
    const path = `${prefix}/tracks/${track.id}`;
    const name = track.name[locale];
    const title = locale === 'en' ? `${name} availability and nearby tracks - ItsRun` : `${name}の利用予定・周辺トラック - いつラン`;
    const description = locale === 'en'
      ? `Check ${name}'s date-specific availability and find useful nearby alternatives ranked by availability and distance.`
      : `${name}の指定日ごとの利用状況を確認し、利用状況と距離を考慮した周辺の代替トラックを探せます。`;
    const canonical = `${origin}${path}`;
    const alternateJa = `${origin}/tracks/${track.id}`;
    const alternateEn = `${origin}/en/tracks/${track.id}`;
    let html = template
      .replace(/<html lang="[^"]*"/, `<html lang="${locale}"`)
      .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
      .replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${canonical}"`);
    html = replaceMeta(html, /<meta name="description"[^>]*>/, description);
    html = replaceMeta(html, /<meta property="og:locale"[^>]*>/, locale === 'en' ? 'en_US' : 'ja_JP');
    html = replaceMeta(html, /<meta property="og:title"[^>]*>/, title);
    html = replaceMeta(html, /<meta property="og:description"[^>]*>/, description);
    html = replaceMeta(html, /<meta property="og:url"[^>]*>/, canonical);
    html = replaceMeta(html, /<meta name="twitter:title"[^>]*>/, title);
    html = replaceMeta(html, /<meta name="twitter:description"[^>]*>/, description);
    html = replaceLink(html, /<link rel="alternate" hreflang="ja"[^>]*>/, alternateJa);
    html = replaceLink(html, /<link rel="alternate" hreflang="en"[^>]*>/, alternateEn);
    html = replaceLink(html, /<link rel="alternate" hreflang="x-default"[^>]*>/, alternateJa);
    html = html.replace(/<div id="app">[\s\S]*?<\/div>/, staticTrackDetailContent(track, locale));
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
console.log(`Static route shells generated: ${fixedShells.length + tracks.length * 2}`);
