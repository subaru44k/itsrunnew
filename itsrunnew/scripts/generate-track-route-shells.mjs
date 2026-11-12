import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const tracks = JSON.parse(await readFile(resolve(root, 'src/data/tracks.json'), 'utf8'));
const courses = JSON.parse(await readFile(resolve(root, 'src/data/running-courses.json'), 'utf8'));
const legacyFacilityGuides = JSON.parse(await readFile(resolve(root, 'src/data/legacy-facility-guides.json'), 'utf8'));
const pageMetadata = JSON.parse(await readFile(resolve(root, 'src/data/page-metadata.json'), 'utf8'));
const template = await readFile(resolve(root, 'dist/index.html'), 'utf8');
const localeMessages = {
  ja: JSON.parse(await readFile(resolve(root, 'src/locales/ja.json'), 'utf8')),
  en: JSON.parse(await readFile(resolve(root, 'src/locales/en.json'), 'utf8')),
};
const facilityGuidance = JSON.parse(await readFile(resolve(root, 'src/data/facility-guidance.json'), 'utf8'));
const origin = 'https://itsrun.info';

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const replaceMeta = (html, selector, value) => html.replace(selector, match => match.replace(/content="[^"]*"/, `content="${escapeHtml(value)}"`));
const replaceLink = (html, selector, value) => html.replace(selector, match => match.replace(/href="[^"]*"/, `href="${escapeHtml(value)}"`));
const radians = degrees => degrees * Math.PI / 180;
const ODA_TRACK_ID = 'yoyogi-park-athletic-track';

function staticHomeContent(locale) {
  const prefix = locale === 'en' ? '/en' : '';
  const heading = locale === 'en' ? 'Find a training place near you' : '近くで走れる練習場所を探す';
  const description = locale === 'en'
    ? 'Compare athletic tracks and running courses by location.'
    : '陸上トラックとランニングコースを、場所から探せます。';
  const odaLinkLabel = locale === 'en' ? 'Oda Field closure and facility information' : '織田フィールドの利用情報';
  return `<div id="app"><main data-static-home><h1>${heading}</h1><p>${description}</p><p><a data-oda-discovery href="${prefix}/tracks/${ODA_TRACK_ID}">${odaLinkLabel}</a></p><ul>${courses.map(course => `<li><a href="${prefix}/courses/${course.id}">${escapeHtml(course.name[locale])}</a></li>`).join('')}</ul></main></div>`;
}

function distanceKm(a, b) {
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function staticLegacyGuide(track, locale) {
  const guide = legacyFacilityGuides[track.id];
  if (!guide) return '';
  const copy = localeMessages[locale][guide.localeKey];
  const access = [copy.access_1, copy.contact_1, copy.tel].filter(Boolean).map(value => `<p>${escapeHtml(value)}</p>`).join('');
  const opinions = Object.entries(copy).filter(([key]) => /^opinion_\d+$/.test(key)).map(([, value]) => `<p>${escapeHtml(value)}</p>`).join('');
  const note = locale === 'en' ? 'These impressions are from the former facility page and do not describe current availability or conditions. Check the latest official information before visiting.' : '以下は旧施設ページの体験談です。現在の利用状況や設備・混雑を示すものではありません。訪問前に最新の公式情報をご確認ください。';
  return `<section data-legacy-facility><h2>${locale === 'en' ? 'Facility and access' : '施設・アクセス'}</h2><p>${escapeHtml(copy.official_name)}</p>${access}<p><a href="${escapeHtml(`https://www.google.com/maps/search/?api=1&query=${track.location.latitude},${track.location.longitude}`)}">${locale === 'en' ? 'Open map' : '地図を見る'}</a></p></section>${opinions ? `<section><h2>${locale === 'en' ? 'Past runner impressions' : '過去の使用感'}</h2><p>${note}</p>${opinions}</section>` : ''}`;
}

function staticTrackDetailContent(track, locale) {
  const prefix = locale === 'en' ? '/en' : '';
  const nearby = tracks
    .filter(candidate => candidate.id !== track.id)
    .map(candidate => ({ track: candidate, distance: distanceKm(track.location, candidate.location) }))
    .sort((left, right) => left.distance - right.distance || left.track.id.localeCompare(right.track.id))
    .slice(0, 5);
  const useHeading = locale === 'en' ? 'Individual-use schedule and confirmation' : '個人利用スケジュール・確認方法';
  const useAnswer = locale === 'en'
    ? 'Confirmed individual-use dates and periods are shown when available. If future dates cannot be confirmed, check the official schedule or contact the facility before visiting. Unconfirmed does not mean unavailable.'
    : '確認できた個人利用予定・時間帯を掲載します。今後の利用可否を確認できない場合は、訪問前に公式の予定や施設の問い合わせ先で確認してください。要確認は利用不可という意味ではありません。';
  const guidance = facilityGuidance[track.id]?.[locale];
  const guidanceContent = guidance ? `<section data-facility-guidance><h2>${locale === 'en' ? 'Before you visit' : '利用前の確認事項'}</h2>${guidance.paragraphs.map(text => `<p>${escapeHtml(text)}</p>`).join('')}<ul>${guidance.links.map(link => `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></li>`).join('')}</ul><p>${locale === 'en' ? 'Guidance checked' : '案内の確認日'}: ${facilityGuidance[track.id].verifiedAt}</p></section>` : '';
  const useContent = `<section><h2>${useHeading}</h2><p>${useAnswer}</p>${track.individualUse.note ? `<p>${escapeHtml(track.individualUse.note)}</p>` : ''}<a href="${escapeHtml(track.urls.schedule || track.urls.individualUse || track.urls.official)}">${locale === 'en' ? 'Official schedule / contact information' : '公式の利用予定・問い合わせ先を確認'}</a></section>`;
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
  const paceContent = `<section data-static-pace-discovery><h2>${locale === 'en' ? 'Plan your training pace' : '練習のペースを確認する'}</h2><p>${locale === 'en' ? 'Use a marathon goal or pace per km to check times for 300 m, 400 m, 1 km and longer runs.' : 'マラソンの目標タイムや1kmペースから、300m・400m・1kmなどの練習での所要時間を確認できます。'}</p><a href="${prefix}/pace/marathon#pace-detail">${locale === 'en' ? 'Check the marathon pace table' : 'マラソンペース表で確認する'}</a></section>`;
  const nearbyContent = `<section><h2>${heading}</h2><p>${description}</p><ul>${nearbyLinks}</ul><p><a href="${prefix}/">${locale === 'en' ? 'Search all tracks' : 'すべてのトラックを探す'}</a></p></section>`;
  return `<div id="app"><main data-static-track-detail><h1>${escapeHtml(track.name[locale])}</h1><p>${escapeHtml(track.location.address)}</p>${odaClosureContent}${guidanceContent}${useContent}${nearbyContent}${staticNearbyCourses(track, locale)}${paceContent}${odaFacilityContent}${odaOpinionsContent}${staticLegacyGuide(track, locale)}</main></div>`;
}

function courseLength(course, locale) {
  return `${course.approximate ? (locale === 'en' ? 'approx. ' : '約') : ''}${course.lapMeters.map(value => value.toLocaleString(locale === 'en' ? 'en-US' : 'ja-JP')).join(' / ')} m`;
}
function staticNearbyCourses(place, locale) {
  const nearby = courses.filter(course => course.id !== place.id).map(course => ({ course, distance: distanceKm(place.location, course.location) })).filter(item => item.distance <= 15).sort((a, b) => a.distance - b.distance || a.course.id.localeCompare(b.course.id)).slice(0, 3);
  if (!nearby.length) return '';
  const prefix = locale === 'en' ? '/en' : '';
  return `<section data-static-nearby-courses><h2>${locale === 'en' ? 'Nearby running courses' : '近くのランニングコース'}</h2><p>${locale === 'en' ? 'Usual course conditions; day restrictions are unconfirmed.' : '通常のコース情報です。指定日の利用規制は未確認です。'}</p><ul>${nearby.map(({ course, distance }) => `<li><a href="${prefix}/courses/${course.id}">${escapeHtml(course.name[locale])}</a> ${courseLength(course, locale)} · ${distance.toFixed(1)} km${course.rules.map(rule => `<p>${escapeHtml(rule[locale])}</p>`).join('')}</li>`).join('')}</ul></section>`;
}
function staticCourseContent(course, locale) {
  const prefix = locale === 'en' ? '/en' : '';
  const facts = [
    [locale === 'en' ? 'One lap' : '一周の距離', courseLength(course, locale)],
    [locale === 'en' ? 'Surface' : '路面', course.surface === 'rubber-chip' ? (locale === 'en' ? 'Rubber chip' : 'ゴムチップ') : course.surface === 'special-paving' ? (locale === 'en' ? 'Special paving (material unconfirmed)' : '特殊舗装（材質未確認）') : (locale === 'en' ? 'Surface unconfirmed' : '路面未確認')],
    ...(course.distanceMarkersMeters ? [[locale === 'en' ? 'Distance markers' : '距離表示', `${course.distanceMarkersMeters} m`]] : []),
    ...(course.crossings ? [[locale === 'en' ? 'Crossings' : '横断箇所', course.crossings[locale]]] : []),
    ...(course.hours ? [[locale === 'en' ? 'Usual park hours' : '通常開園時間', course.hours[locale]]] : []),
  ];
  const nearbyTracks = tracks.map(track => ({ track, distance: distanceKm(course.location, track.location) })).sort((a, b) => a.distance - b.distance || a.track.id.localeCompare(b.track.id)).slice(0, 3);
  return `<div id="app"><main data-static-course-detail><nav><a href="${prefix}/">${locale === 'en' ? 'Find a training place' : '練習場所を探す'}</a></nav><p>${locale === 'en' ? 'Running course' : 'ランニングコース'}</p><h1>${escapeHtml(course.name[locale])}</h1><p>${escapeHtml(course.location.address)}</p><dl>${facts.map(([label, value]) => `<dt>${label}</dt><dd>${escapeHtml(value)}</dd>`).join('')}</dl><ul>${course.rules.map(rule => `<li>${escapeHtml(rule[locale])}</li>`).join('')}</ul><p>${locale === 'en' ? 'These are usual conditions. Check official notices for event or construction restrictions before visiting.' : '通常の利用条件です。工事・行事による当日の規制は公式のお知らせで確認してください。'}</p><p><a href="${escapeHtml(course.urls.map)}">${locale === 'en' ? 'Official course map' : '公式のコース図'}</a> · <a href="${escapeHtml(course.urls.official)}">${locale === 'en' ? 'Official information' : '公式のお知らせ・利用案内'}</a></p><h2>${locale === 'en' ? 'Nearby tracks' : '近くの陸上トラック'}</h2><ul>${nearbyTracks.map(({ track }) => `<li><a href="${prefix}/tracks/${track.id}">${escapeHtml(track.name[locale])}</a></li>`).join('')}</ul>${staticNearbyCourses(course, locale)}<h2>${locale === 'en' ? 'Sources and checked dates' : '出典・確認日'}</h2><ul>${course.sources.map(source => `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.label[locale])}</a> ${source.verifiedAt}</li>`).join('')}</ul></main></div>`;
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

const fixedShells = Object.entries(pageMetadata).flatMap(([key, page]) => ['ja', 'en'].map(locale => {
  const prefix = locale === 'en' ? '/en' : '';
  const path = page.path ? `${prefix}/${page.path}` : (locale === 'en' ? '/en/' : '/');
  return {
    path,
    locale,
    title: page[`${locale}Title`],
    description: page[`${locale}Description`],
    alternateJa: page.path ? `/${page.path}` : '/',
    alternateEn: page.path ? `/en/${page.path}` : '/en/',
    body: key === 'tracks' ? staticHomeContent(locale) : undefined,
  };
}));

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
    const guidance = facilityGuidance[track.id]?.[locale];
    const title = guidance?.title ?? (isOda
      ? (locale === 'en' ? 'Oda Field (Yoyogi Park Athletic Track) closure and nearby tracks - ItsRun' : '織田フィールド（代々木公園陸上競技場）の利用情報｜利用停止と周辺トラック - いつラン')
      : (locale === 'en' ? `${name} individual-use schedule and confirmation - ItsRun` : `${name}の個人利用スケジュール・確認方法 - いつラン`));
    const description = guidance?.description ?? (isOda
      ? (locale === 'en' ? 'Oda Field is scheduled to remain closed through November 30, 2026. Check the selected date and compare nearby tracks before your workout.' : '織田フィールド（代々木公園陸上競技場）は2026年11月30日まで利用停止予定です。指定日の状況と周辺の代替トラックを確認できます。')
      : (locale === 'en'
        ? `Check ${name}'s confirmed individual-use dates, available periods and how to confirm unpublished schedules. Compare nearby tracks for your chosen date.`
        : `${name}の個人利用について、確認済みの予定・利用可能時間と、予定が分からない場合の確認方法を案内します。指定日の利用状況や周辺施設も確認できます。`));
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
for (const course of courses) for (const locale of ['ja', 'en']) {
  const prefix = locale === 'en' ? '/en' : '';
  const path = `${prefix}/courses/${course.id}`;
  const title = locale === 'en' ? `${course.name.en} | Running course - ItsRun` : `${course.name.ja}の距離・路面・利用条件 - いつラン`;
  const description = locale === 'en' ? `Compare ${course.name.en}'s lap distance, surface and usual conditions. View the official map and nearby tracks.` : `${course.name.ja}の一周距離・路面・通常の利用条件を確認できます。公式コース図や近くの陸上トラックも探せます。`;
  let html = pageShell({ path, locale, title, description, alternateJa: `/courses/${course.id}`, alternateEn: `/en/courses/${course.id}`, body: staticCourseContent(course, locale) });
  const structuredData = JSON.stringify({ '@context': 'https://schema.org', '@type': 'SportsActivityLocation', name: course.name[locale], description, address: course.location.address, geo: { '@type': 'GeoCoordinates', latitude: course.location.latitude, longitude: course.location.longitude }, url: `${origin}${path}`, sameAs: course.urls.official }).replace(/</g, '\\u003c');
  html = html.replace('</head>', `<script id="track-structured-data" type="application/ld+json">${structuredData}</script></head>`);
  const directory = resolve(root, `dist${path}`);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'index.html'), html, 'utf8');
}
console.log(`Static route shells generated: ${fixedShells.length + (tracks.length + courses.length) * 2}`);
