import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const tracks = JSON.parse(await readFile(resolve(root, 'src/data/tracks.json'), 'utf8'));
const origin = 'https://itsrun.info';
const staticPairs = [
  ['', ''], ['oda-field', 'oda-field'], ['yumenoshima', 'yumenoshima'],
  ['komazawa', 'komazawa'], ['todoroki', 'todoroki'], ['pace/marathon', 'pace/marathon'],
  ['nozomiantena/index', 'nozomiantena/index'], ['ryuji-miura/index', 'ryuji-miura/index'], ['about', 'about'], ['tracks/guide', 'tracks/guide'], ['privacy', 'privacy'],
];

function entry(jaPath, enPath) {
  const ja = `${origin}/${jaPath}`;
  const en = `${origin}/en/${enPath}`;
  return [ja, en].map((loc, index) => `  <url><loc>${loc}</loc>${index === 0 ? '<changefreq>daily</changefreq>' : ''}<xhtml:link rel="alternate" hreflang="ja" href="${ja}"/><xhtml:link rel="alternate" hreflang="en" href="${en}"/><xhtml:link rel="alternate" hreflang="x-default" href="${ja}"/></url>`).join('\n');
}

const entries = staticPairs.map(([ja, en]) => entry(ja, en));
for (const track of tracks) entries.push(entry(`tracks/${track.id}`, `tracks/${track.id}`));
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
await writeFile(resolve(root, 'public/sitemap.xml'), xml, 'utf8');
console.log(`Sitemap generated: ${staticPairs.length * 2 + tracks.length * 2} URLs`);
