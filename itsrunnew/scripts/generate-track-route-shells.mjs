import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const tracks = JSON.parse(await readFile(resolve(root, 'src/data/tracks.json'), 'utf8'));
const template = await readFile(resolve(root, 'dist/index.html'), 'utf8');
const localeMessages = {
  ja: JSON.parse(await readFile(resolve(root, 'src/locales/ja.json'), 'utf8')),
  en: JSON.parse(await readFile(resolve(root, 'src/locales/en.json'), 'utf8')),
};
const origin = 'https://itsrun.info';

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const replaceMeta = (html, selector, value) => html.replace(selector, match => match.replace(/content="[^"]*"/, `content="${escapeHtml(value)}"`));
const replaceLink = (html, selector, value) => html.replace(selector, match => match.replace(/href="[^"]*"/, `href="${escapeHtml(value)}"`));
const radians = degrees => degrees * Math.PI / 180;
const ODA_TRACK_ID = 'yoyogi-park-athletic-track';

function staticHomeContent(locale) {
  const prefix = locale === 'en' ? '/en' : '';
  const heading = locale === 'en' ? 'Find a track near you' : '近くで走れるトラックを探す';
  const description = locale === 'en'
    ? 'Search tracks by workout date and location, then compare facilities before you visit.'
    : '利用日と場所からトラックを探し、訪問前に施設を比較できます。';
  const odaLinkLabel = locale === 'en' ? 'Oda Field closure and facility information' : '織田フィールドの利用情報';
  return `<div id="app"><main data-static-home><h1>${heading}</h1><p>${description}</p><p><a data-oda-discovery href="${prefix}/tracks/${ODA_TRACK_ID}">${odaLinkLabel}</a></p></main></div>`;
}

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
  const isOda = track.id === ODA_TRACK_ID;
  const closure = locale === 'en'
    ? '<h2>Closed through November 30, 2026 (planned)</h2><p>Oda Field is closed from July 1 through November 30 for work related to renewal of its Class 3 JAAF certification.</p><p>The end date is planned. Do not assume reopening on December 1; check the latest official notice before visiting.</p>'
    : '<h2>2026年11月30日まで利用停止予定</h2><p>第三種公認陸上競技場の公認更新工事のため、7月1日から11月30日まで利用停止と公式に案内されています。</p><p>終了日は予定です。12月1日の自動的な再開を前提にせず、訪問前に最新の公式案内をご確認ください。</p>';
  const noticeLabel = locale === 'en' ? 'View official closure notice' : '公式の利用停止案内を見る';
  const odaLocale = localeMessages[locale].oda;
  const facilityHeading = locale === 'en' ? 'Facility and access' : '施設・アクセス';
  const access = [odaLocale.access_1, odaLocale.access_2, odaLocale.contact_1, odaLocale.tel]
    .filter(Boolean)
    .map(value => `<p>${escapeHtml(value)}</p>`)
    .join('');
  const opinionsHeading = locale === 'en' ? 'Runner perspective before the construction' : '平常時の使用感（工事前）';
  const opinionNote = locale === 'en'
    ? 'These are first-hand impressions from normal operation before the current construction. They do not describe current availability.'
    : '以下は、現在の工事に入る前の平常利用時に書かれた体験談です。現在の開放状況を示すものではありません。';
  const odaClosureContent = isOda
    ? `<section data-oda-closure>${closure}<p><a href="${escapeHtml(track.urls.schedule)}">${noticeLabel}</a></p></section>`
    : '';
  const odaFacilityContent = isOda
    ? `<section><h2>${facilityHeading}</h2><p><strong>${escapeHtml(odaLocale.official_name)}</strong></p><p>${escapeHtml(track.location.address)}</p><p><a href="${escapeHtml(`https://www.google.com/maps/search/?api=1&query=${track.location.latitude},${track.location.longitude}`)}">${locale === 'en' ? 'Open map' : '地図を見る'}</a></p>${access}</section>`
    : '';
  const opinions = Object.entries(odaLocale)
    .filter(([key, value]) => /^opinion_\d+$/.test(key) && String(value).trim())
    .sort(([left], [right]) => left.localeCompare(right, 'en', { numeric: true }))
    .map(([, value]) => `<p>${escapeHtml(value)}</p>`)
    .join('');
  const odaOpinionsContent = isOda ? `<section><h2>${opinionsHeading}</h2><p>${opinionNote}</p>${opinions}</section>` : '';
  const nearbyContent = `<section><h2>${heading}</h2><p>${description}</p><ul>${nearbyLinks}</ul><p><a href="${prefix}/">${locale === 'en' ? 'Search all tracks' : 'すべてのトラックを探す'}</a></p></section>`;
  return `<div id="app"><main data-static-track-detail><h1>${escapeHtml(track.name[locale])}</h1><p>${escapeHtml(track.location.address)}</p>${odaClosureContent}${nearbyContent}${odaFacilityContent}${odaOpinionsContent}</main></div>`;
}

function pageShell({ path, locale, title, description, alternateJa, alternateEn, body }) {
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
  if (body) html = html.replace(/<div id="app">[\s\S]*?<\/div>/, body);
  return html;
}

const fixedShells = [
  {
    path: '/', locale: 'ja',
    title: '個人利用できる陸上競技場・トラック検索｜日付・現在地から探す - いつラン',
    description: 'いつもの競技場が使えない日や、転居・合宿先での練習場所探しに。個人利用できそうな陸上競技場やトラックを、利用日と現在地・任意地点から検索し、距離・利用状況・設備を比較できます。',
    alternateJa: '/', alternateEn: '/en/', body: staticHomeContent('ja'),
  },
  {
    path: '/en/', locale: 'en',
    title: 'Find tracks for individual use by date and location - ItsRun',
    description: 'When your usual venue is closed or you are training somewhere new, compare tracks for individual use by date, location, availability and facilities.',
    alternateJa: '/', alternateEn: '/en/', body: staticHomeContent('en'),
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
    const isOda = track.id === ODA_TRACK_ID;
    const title = isOda
      ? (locale === 'en' ? 'Oda Field (Yoyogi Park Athletic Track) closure and nearby tracks - ItsRun' : '織田フィールド（代々木公園陸上競技場）の利用情報｜利用停止と周辺トラック - いつラン')
      : (locale === 'en' ? `${name} availability and nearby tracks - ItsRun` : `${name}の利用予定・周辺トラック - いつラン`);
    const description = isOda
      ? (locale === 'en' ? 'Oda Field is scheduled to remain closed through November 30, 2026. Check the selected date and compare nearby tracks before your workout.' : '織田フィールド（代々木公園陸上競技場）は2026年11月30日まで利用停止予定です。指定日の状況と周辺の代替トラックを確認できます。')
      : (locale === 'en'
        ? `Check ${name}'s date-specific availability and find useful nearby alternatives ranked by availability and distance.`
        : `${name}の指定日ごとの利用状況を確認し、利用状況と距離を考慮した周辺の代替トラックを探せます。`);
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
      description,
      address: track.location.address,
      geo: { '@type': 'GeoCoordinates', latitude: track.location.latitude, longitude: track.location.longitude },
      url: canonical, sameAs: track.urls.official,
    }).replace(/</g, '\\u003c');
    html = html.replace('</head>', `<script id="track-structured-data" type="application/ld+json">${structuredData}</script></head>`);
    const directory = resolve(root, `dist${path}`);
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'index.html'), html, 'utf8');
  }
}
console.log(`Static route shells generated: ${fixedShells.length + tracks.length * 2}`);
