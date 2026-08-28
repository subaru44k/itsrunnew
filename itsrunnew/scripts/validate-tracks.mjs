import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const appRoot = process.cwd();
const normalizedPath = resolve(appRoot, 'src/data/tracks.json');
const osmPath = resolve(appRoot, '../data/osm/tracks.json');
const expansionOsmPath = resolve(appRoot, '../data/osm/expansion-candidates.json');
const coverageFollowupOsmPath = resolve(appRoot, '../data/osm/coverage-followup-2026-08.json');
const availabilityPath = resolve(appRoot, 'src/data/availability.json');
const availabilityRangePath = resolve(appRoot, 'src/data/availability');
const availabilityResearchPath = resolve(appRoot, '../research/availability/availability-sources.json');
const sourceAuditPath = resolve(appRoot, '../research/track-expansion/track-source-audit.json');
const tracks = JSON.parse(await readFile(normalizedPath, 'utf8'));
const osm = JSON.parse(await readFile(osmPath, 'utf8'));
const expansionOsm = JSON.parse(await readFile(expansionOsmPath, 'utf8'));
const coverageFollowupOsm = JSON.parse(await readFile(coverageFollowupOsmPath, 'utf8'));
const availability = JSON.parse(await readFile(availabilityPath, 'utf8'));
const availabilityManifest = JSON.parse(await readFile(resolve(availabilityRangePath, 'manifest.json'), 'utf8'));
const availabilityResearch = JSON.parse(await readFile(availabilityResearchPath, 'utf8'));
const sourceAudit = JSON.parse(await readFile(sourceAuditPath, 'utf8'));
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
  if (track.location?.latitude < 24 || track.location?.latitude > 46 || track.location?.longitude < 122 || track.location?.longitude > 146) errors.push(`${label}: coordinates are outside Japan's supported bounds`);
  if (!/^https:\/\//.test(track.urls?.official ?? '')) errors.push(`${label}: official URL must use HTTPS`);
  if (!Array.isArray(track.sources) || track.sources.length === 0) errors.push(`${label}: source provenance is missing`);
  for (const source of track.sources ?? []) {
    if (!/^https:\/\//.test(source.url) || !/^\d{4}-\d{2}-\d{2}$/.test(source.verifiedAt)) errors.push(`${label}: invalid source URL or verifiedAt`);
  }
}
for (const id of baselineIds) if (!ids.has(id)) errors.push(`${id}: existing baseline facility was removed`);

const researchIds = new Set(availabilityResearch.facilities.map(item => item.trackId));
if (availabilityResearch.dataset.trackCount !== tracks.length) errors.push('availability research trackCount does not match Track Dataset');
for (const id of ids) if (!researchIds.has(id)) errors.push(`${id}: availability research record is missing`);
for (const id of researchIds) if (!ids.has(id)) errors.push(`${id}: availability research record has no Track Dataset facility`);
const classifiedResearchCount = Object.values(availabilityResearch.research.classificationCounts).reduce((sum, count) => sum + count, 0);
if (classifiedResearchCount !== tracks.length) errors.push('availability research classification counts do not match Track Dataset');
const implementedResearchCount = availabilityResearch.facilities.filter(item => item.automation?.implementation?.status === 'supported').length;
if (implementedResearchCount !== availabilityResearch.research.implementationCoverage.currentCollectors) errors.push('availability research implementation metadata does not match current collector count');

const auditIds = new Set();
const includedAuditIds = new Set();
for (const record of sourceAudit.records) {
  if (!record.trackId || auditIds.has(record.trackId)) errors.push(`${record.trackId ?? 'audit row'}: source audit ID is missing or duplicated`);
  auditIds.add(record.trackId);
  if (!/^https:\/\//.test(record.identity?.sourceUrl ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(record.identity?.verifiedAt ?? '')) errors.push(`${record.trackId}: source audit identity evidence is invalid`);
  if (!/^https:\/\//.test(record.coordinates?.sourceUrl ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(record.coordinates?.verifiedAt ?? '')) errors.push(`${record.trackId}: source audit coordinate evidence is invalid`);
  if (!['include', 'exclude'].includes(record.decision)) errors.push(`${record.trackId}: source audit decision is invalid`);
  if (record.decision === 'include') includedAuditIds.add(record.trackId);
  if (record.decision === 'exclude' && ids.has(record.trackId)) errors.push(`${record.trackId}: excluded source audit candidate remains in Track Dataset`);
}
for (const id of ids) if (!includedAuditIds.has(id)) errors.push(`${id}: included source audit record is missing`);
for (const id of includedAuditIds) if (!ids.has(id)) errors.push(`${id}: included source audit record has no Track Dataset facility`);
if (sourceAudit.scope.publishedAfterAudit !== tracks.length || sourceAudit.scope.candidatesReviewed !== sourceAudit.records.length) errors.push('source audit scope counts do not match its records or Track Dataset');
const publicUrls = new Set(tracks.flatMap(track => [track.urls?.official, track.urls?.individualUse, track.urls?.schedule, ...(track.sources ?? []).map(source => source.url)].filter(Boolean)));
for (const url of sourceAudit.liveSourceReview.brokenOrGuardedPublicUrlsRemoved ?? []) if (publicUrls.has(url)) errors.push(`${url}: guarded or broken URL remains in public Track Dataset`);

const candidates = osm.elements.filter(element => element.tags?.leisure === 'track');
const excludedByTags = candidates.filter(element => {
  const sport = element.tags?.sport ?? '';
  return /horse_racing|cycling/.test(sport) || element.tags?.access === 'private';
});
const runningTagged = candidates.filter(element => /running|athletics/.test(element.tags?.sport ?? '') || element.tags?.athletics === 'running');
const adoptedOsmIds = new Set(tracks.flatMap(track => track.externalIds?.osm ?? []));
const rawIds = new Set([...osm.elements, ...expansionOsm.elements, ...coverageFollowupOsm.elements].map(element => `${element.type}/${element.id}`));
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
  console.log(`Track data valid: ${tracks.length} facilities; ${candidates.length} original raw OSM objects; ${expansionOsm.elements.length} selected expansion objects; ${coverageFollowupOsm.elements.length} coverage-followup objects; ${runningTagged.length} running/athletics-tagged; ${excludedByTags.length} explicitly excluded horse/cycling/private objects; ${adoptedOsmIds.size} adopted OSM objects.`);
}
