import { appendFileSync, readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../src/data/availability/manifest.json', import.meta.url), 'utf8'));
const tracks = JSON.parse(readFileSync(new URL('../src/data/tracks.json', import.meta.url), 'utf8'));
const counts = { available: 0, partially_available: 0, unavailable: 0, unknown: 0 };

for (const date of manifest.dates) {
  const dataset = JSON.parse(readFileSync(new URL(`../src/data/availability/${date}.json`, import.meta.url), 'utf8'));
  for (const facility of dataset.facilities) counts[facility.status] += 1;
}

const environment = process.env.DEPLOY_ENVIRONMENT ?? 'Preview';
const defaultUrl = process.env.PREVIEW_URL ?? 'https://d2xryux7a95b54.cloudfront.net';
const summary = `## ItsRun ${environment} deployment

| Item | Result |
|---|---|
| Trigger | ${process.env.DEPLOY_TRIGGER ?? 'local'} |
| Commit | \`${process.env.DEPLOYED_COMMIT ?? 'local'}\` |
| Availability collection | ${process.env.AVAILABILITY_RESULT ?? 'not run'} |
| Local smoke | ${process.env.LOCAL_SMOKE_RESULT ?? 'not run'} |
| Availability range | ${manifest.startDate} – ${manifest.endDate} (${manifest.dates.length} days) |
| Tracks | ${tracks.length} |
| Availability totals | available ${counts.available}, partial ${counts.partially_available}, unavailable ${counts.unavailable}, unknown ${counts.unknown} |
| S3 deployment | ${process.env.DEPLOY_RESULT ?? 'not run'} |
| Changed / removed files | ${process.env.CHANGED_FILES ?? 'unknown'} / ${process.env.REMOVED_FILES ?? 'unknown'} |
| Invalidation paths | ${process.env.INVALIDATION_PATHS ?? 'unknown'} |
| CloudFront invalidation | ${process.env.INVALIDATION_ID || 'not created'} |
| Published byte comparison | ${process.env.PUBLISHED_BYTES_RESULT ?? 'not run'} |
| CloudFront smoke | ${process.env.CLOUDFRONT_SMOKE_RESULT ?? 'not run'} |
| URL | ${process.env.DEPLOY_URL ?? defaultUrl} |
`;

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
else process.stdout.write(summary);
