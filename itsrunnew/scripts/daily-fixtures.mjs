// Synthetic data is written only inside daily-check.mjs's disposable workspace.
export function makeDailyFixture(tracks, baseline, scenario, now = new Date()) {
  if (!['mixed', 'unknown'].includes(scenario)) throw new Error(`Unknown fixture: ${scenario}`);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const dates = Array.from({ length: 31 }, (_, index) => {
    const date = new Date(`${today}T00:00:00+09:00`);
    date.setUTCDate(date.getUTCDate() + index);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  });
  const records = new Map(baseline.facilities.map(item => [item.trackId, item]));
  const statuses = ['available', 'partially_available', 'unknown', 'unavailable'];
  const datasets = dates.map((date, day) => ({
    schemaVersion: 1, timezone: 'Asia/Tokyo', date, generatedAt: now.toISOString(),
    facilities: tracks.map((track, index) => {
      const record = structuredClone(records.get(track.id));
      if (!record) throw new Error(`Fixture baseline is missing ${track.id}`);
      let status = scenario === 'unknown' ? 'unknown' : statuses[(index + day) % statuses.length];
      if (scenario === 'mixed' && track.id === 'toda-sports-center-track') status = day === 0 ? 'unavailable' : 'available';
      return {
        ...record, date, status, periods: [], unknownReason: status === 'unknown' ? 'fetch_failed' : null,
        freshness: { fetchedAt: now.toISOString(), parsedAt: now.toISOString(), checkedAt: now.toISOString(), validForDate: date,
          expiresAt: new Date(new Date(`${date}T00:00:00+09:00`).getTime() + 86400000).toISOString() },
        evidence: { ...record.evidence, collector: 'TEST-FIXTURE-DO-NOT-PUBLISH' },
        warnings: ['Synthetic daily regression fixture; never publish.'],
      };
    }),
  }));
  return { manifest: { schemaVersion: 1, timezone: 'Asia/Tokyo', generatedAt: now.toISOString(), startDate: dates[0], endDate: dates.at(-1), dates }, datasets };
}
