import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const appRoot = process.cwd();
const normalizedPath = resolve(appRoot, 'src/data/tracks.json');
const osmPath = resolve(appRoot, '../data/osm/tracks.json');
const expansionOsmPath = resolve(appRoot, '../data/osm/expansion-candidates.json');
const availabilityPath = resolve(appRoot, 'src/data/availability.json');
const availabilityRangePath = resolve(appRoot, 'src/data/availability');
const tracks = JSON.parse(await readFile(normalizedPath, 'utf8'));
const osm = JSON.parse(await readFile(osmPath, 'utf8'));
const expansionOsm = JSON.parse(await readFile(expansionOsmPath, 'utf8'));
const availability = JSON.parse(await readFile(availabilityPath, 'utf8'));
const availabilityManifest = JSON.parse(await readFile(resolve(availabilityRangePath, 'manifest.json'), 'utf8'));
const errors = [];
const ids = new Set();
const baselineIds = new Set([
  'nerima-general-sports-park', 'hikarigaoka-park-track', 'oizumi-chuo-park-track',
  'johoku-chuo-park-track', 'akatsuka-park-track', 'musashino-athletic-track',
  'inokashira-park-track', 'toda-sports-center-track', 'asaka-chuo-park-track',
  'niiza-general-sports-park-track', 'yoyogi-park-athletic-track',
  'tokyo-metropolitan-gymnasium-track',
]);

for (const [index, track] of tracks.entries()) {
  const label = track.id || `row ${index}`;
  if (!track.id || ids.has(track.id)) errors.push(`${label}: stable ID is missing or duplicated`);
  ids.add(track.id);
  if (!track.name?.ja || !Number.isFinite(track.location?.latitude) || !Number.isFinite(track.location?.longitude)) errors.push(`${label}: name or coordinates are missing`);
  if (track.location?.latitude < 35 || track.location?.latitude > 37 || track.location?.longitude < 138 || track.location?.longitude > 141) errors.push(`${label}: coordinates are outside the supported region`);
  if (!/^https:\/\//.test(track.urls?.official ?? '')) errors.push(`${label}: official URL must use HTTPS`);
  if (!Array.isArray(track.sources) || track.sources.length === 0) errors.push(`${label}: source provenance is missing`);
  for (const source of track.sources ?? []) {
    if (!/^https:\/\//.test(source.url) || !/^\d{4}-\d{2}-\d{2}$/.test(source.verifiedAt)) errors.push(`${label}: invalid source URL or verifiedAt`);
  }
}
for (const id of baselineIds) if (!ids.has(id)) errors.push(`${id}: existing baseline facility was removed`);

const candidates = osm.elements.filter(element => element.tags?.leisure === 'track');
const excludedByTags = candidates.filter(element => {
  const sport = element.tags?.sport ?? '';
  return /horse_racing|cycling/.test(sport) || element.tags?.access === 'private';
});
const runningTagged = candidates.filter(element => /running|athletics/.test(element.tags?.sport ?? '') || element.tags?.athletics === 'running');
const adoptedOsmIds = new Set(tracks.flatMap(track => track.externalIds?.osm ?? []));
const rawIds = new Set([...osm.elements, ...expansionOsm.elements].map(element => `${element.type}/${element.id}`));
for (const id of adoptedOsmIds) if (!rawIds.has(id)) errors.push(`${id}: normalized OSM ID is absent from raw data`);

const availabilityIds = new Set(availability.facilities.map(item => item.trackId));
for (const id of ids) if (!availabilityIds.has(id)) errors.push(`${id}: availability record is missing`);
for (const id of availabilityIds) if (!ids.has(id)) errors.push(`${id}: availability record has no Track Dataset facility`);
if (availabilityManifest.dates.length !== 31 || availabilityManifest.startDate !== availabilityManifest.dates[0] || availabilityManifest.endDate !== availabilityManifest.dates.at(-1)) {
  errors.push('availability manifest must describe an ordered 31-day range');
}
for (const date of availabilityManifest.dates) {
  const dataset = JSON.parse(await readFile(resolve(availabilityRangePath, `${date}.json`), 'utf8'));
  if (dataset.date !== date || dataset.timezone !== 'Asia/Tokyo') errors.push(`${date}: availability date or timezone mismatch`);
  const rangeIds = new Set(dataset.facilities.map(item => item.trackId));
  for (const id of ids) if (!rangeIds.has(id)) errors.push(`${date}: ${id} availability record is missing`);
  for (const id of rangeIds) if (!ids.has(id)) errors.push(`${date}: ${id} has no Track Dataset facility`);
}

if (tracks.length < 50 || tracks.length > 150) errors.push(`expected 50-150 normalized facilities, found ${tracks.length}`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Track data valid: ${tracks.length} facilities; ${candidates.length} original raw OSM objects; ${expansionOsm.elements.length} selected expansion objects; ${runningTagged.length} running/athletics-tagged; ${excludedByTags.length} explicitly excluded horse/cycling/private objects; ${adoptedOsmIds.size} adopted OSM objects.`);
}
