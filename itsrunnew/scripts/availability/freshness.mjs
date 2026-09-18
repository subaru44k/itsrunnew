export function validateFreshRange(manifest, datasets, trackIds, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const expected = Array.from({ length: 31 }, (_, index) => {
    const date = new Date(`${today}T00:00:00+09:00`);
    date.setUTCDate(date.getUTCDate() + index);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  });
  if (manifest.schemaVersion !== 1 || manifest.timezone !== 'Asia/Tokyo' || JSON.stringify(manifest.dates) !== JSON.stringify(expected)
    || manifest.startDate !== expected[0] || manifest.endDate !== expected.at(-1)) throw new Error('Fresh availability must cover today in JST and the following 30 consecutive days');
  const age = now.getTime() - Date.parse(manifest.generatedAt);
  if (!Number.isFinite(age) || age < -60000 || age > 6 * 3600000) throw new Error('Availability generation timestamp is stale or invalid');
  if (datasets.length !== 31) throw new Error('Missing daily availability datasets');
  const ids = [...trackIds].sort();
  for (const [index, dataset] of datasets.entries()) {
    const date = expected[index];
    if (dataset.schemaVersion !== 1 || dataset.timezone !== 'Asia/Tokyo' || dataset.date !== date || dataset.generatedAt !== manifest.generatedAt) throw new Error(`${date}: dataset metadata does not match fresh manifest`);
    if (JSON.stringify(dataset.facilities.map(item => item.trackId).sort()) !== JSON.stringify(ids)) throw new Error(`${date}: facility IDs must match tracks exactly once`);
    for (const item of dataset.facilities) {
      if (item.date !== date || item.timezone !== 'Asia/Tokyo' || item.freshness?.validForDate !== date
        || !Number.isFinite(Date.parse(item.freshness?.expiresAt)) || Date.parse(item.freshness.expiresAt) <= now.getTime()) throw new Error(`${date}/${item.trackId}: invalid date or expired availability`);
      if (!['available', 'partially_available', 'unknown', 'unavailable'].includes(item.status)) throw new Error(`${date}/${item.trackId}: invalid status`);
      if (item.evidence?.collector === 'TEST-FIXTURE-DO-NOT-PUBLISH') throw new Error('Synthetic regression data must never be deployed');
    }
  }
}
