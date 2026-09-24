import { makeRecord, unknownRecord } from './collectors';
import type { TrackAvailability } from '../../src/model/availability';
import { aiFacilities, buildAiPacket } from './ai-sources';
import { aiReadingConfig, digest, readWithLuna } from './ai-runtime';
import { officialFetch, htmlText, decodeEntities } from './ai-source-utils';
import { parsePersonalIcs } from './personal-ics';

export const personalCalendarFacilities = [
  {
    key: 'kobe' as const,
    trackId: 'kobe-sports-park-auxiliary-stadium',
    landing: 'https://www.kobe-park.or.jp/sougou/facilities/auxiliary_field',
    hosts: ['www.kobe-park.or.jp', 'calendar.google.com'],
    calendarId:
      '6839e510499b92515acff5b1a86d68201ee1ad7fd0f714261f0e08a58c18f272@group.calendar.google.com',
  },
  {
    key: 'ichihara' as const,
    trackId: 'ichihara-za-oripri-stadium',
    landing: 'https://vonds.net/access/',
    hosts: ['vonds.net', 'calendar.google.com'],
    calendarId: 'rinkai20112025@gmail.com',
  },
];
export const additionalTrackIds = [
  ...aiFacilities,
  ...personalCalendarFacilities,
].map((c) => c.trackId);
const MAX_CONCURRENT_AI_READINGS = 3;
export async function collectAdditionalAvailability(
  dates: string[],
  options: {
    now?: Date;
    fetchImpl?: typeof fetch;
    apiFetchImpl?: typeof fetch;
    apiKey?: string;
    cacheDirectory?: string;
  } = {},
) {
  const now = options.now ?? new Date();
  const fetchImpl = options.fetchImpl ?? fetch;
  const aiRecords: Promise<TrackAvailability[]>[] = [];
  const activeReadings = new Set<Promise<TrackAvailability[]>>();
  for (const config of aiFacilities) {
    const reading = aiReadingConfig(config.key);
    const base = {
      trackId: config.trackId,
      now,
      url: config.landing,
      landingPageUrl: config.landing,
      publicationFormat: 'structured_html' as const,
      collector: reading.collector,
      parserVersion: reading.version,
    };
    const unavailable = (error: unknown) => {
      // Deliberately fixed public warning; API/request internals never enter the website.
      console.warn(
        `AI availability ${config.key}: unavailable (${error instanceof Error && /^AI |^Official |^Too many |^.*not found$/.test(error.message) ? error.message : 'source or reading failed'})`,
      );
      return dates.map((date) =>
        unknownRecord({
          ...base,
          date,
          unknownReason: 'extraction_failed',
          warnings: [
            '公式資料から利用時間を確認できませんでした。公式情報をご確認ください。',
          ],
        }),
      );
    };
    let packet: Awaited<ReturnType<typeof buildAiPacket>>;
    try {
      // Keep official source requests sequential; only overlap model readings.
      packet = await buildAiPacket(config, dates, now, fetchImpl);
    } catch (error) {
      aiRecords.push(Promise.resolve(unavailable(error)));
      continue;
    }
    if (activeReadings.size >= MAX_CONCURRENT_AI_READINGS)
      await Promise.race(activeReadings);
    const task = (async (): Promise<TrackAvailability[]> => {
      try {
        const result = await readWithLuna(packet, {
          apiKey: options.apiKey,
          fetchImpl: options.apiFetchImpl,
          cacheDirectory: options.cacheDirectory,
        });
        const sourceHash = `sha256:${digest(JSON.stringify(packet.sources.map((s) => ({ url: s.url, hash: s.hash }))))}`;
        console.log(
          `AI availability ${config.key}: ${result.cacheHit ? 'cache hit' : 'one inference'}; valid dates=${result.rows.size}/${packet.dates.length}`,
        );
        const facilityRecords: TrackAvailability[] = [];
        for (const date of dates) {
          const row = result.rows.get(date);
          if (!row || row.status === 'unknown') {
            facilityRecords.push(
              unknownRecord({
                ...base,
                date,
                unknownReason: row
                  ? 'insufficient_information'
                  : 'outside_published_period',
                sourceHash,
                fetchedAt: now.toISOString(),
                documentId: result.key,
              }),
            );
            continue;
          }
          facilityRecords.push(
            makeRecord({
              ...base,
              date,
              status: row.status,
              url:
                packet.sources.find((s) =>
                  row.evidence.some((e) => e.source === s.name),
                )?.url ??
                packet.sources.find((s) => s.kind === 'image')?.url ??
                packet.sources[0].url,
              sourceHash,
              fetchedAt: now.toISOString(),
              documentId: result.key,
              publicationFormat: packet.sources.some((s) =>
                /\.pdf(?:\?|$)/i.test(s.url),
              )
                ? 'pdf'
                : 'structured_html',
              confidence: 'medium',
              periods: row.periods.map((p) => ({
                from: p.start,
                to: p.end,
                status: 'available',
                scope: 'unknown',
                eligibility: 'unknown',
                conditions: [
                  ...row.conditions,
                  ...(p.last_entry ? [`最終入場 ${p.last_entry}`] : []),
                  p.scope,
                ],
              })),
              warnings: [
                ...row.conditions,
                '予定や利用条件は変更されることがあります。お出かけ前に施設の最新情報をご確認ください。',
              ],
            }),
          );
        }
        return facilityRecords;
      } catch (error) {
        return unavailable(error);
      }
    })();
    activeReadings.add(task);
    void task.then(
      () => activeReadings.delete(task),
      () => activeReadings.delete(task),
    );
    aiRecords.push(task);
  }
  const records = (await Promise.all(aiRecords)).flat();
  for (const config of personalCalendarFacilities) {
    const base = {
      trackId: config.trackId,
      now,
      url: config.landing,
      landingPageUrl: config.landing,
      publicationFormat: 'calendar_ics' as const,
      collector: `personal-ics-${config.key}`,
      parserVersion: '1.0.0',
    };
    try {
      const landing = await officialFetch(
        config.landing,
        config.hosts,
        fetchImpl,
      );
      const html = decodeEntities(landing.data.toString('utf8'));
      // Calendar ownership is established by the current official embedding, not just a remembered ID.
      const embedded = [
        ...html.matchAll(
          /(?:src|href)=["']([^"']*calendar\.google\.com[^"']*)["']/gi,
        ),
      ].map((m) => m[1]);
      const owns = embedded.some((url) => {
        try {
          return new URL(url).searchParams
            .getAll('src')
            .some(
              (id) =>
                id === config.calendarId ||
                Buffer.from(id, 'base64').toString('utf8') ===
                  config.calendarId,
            );
        } catch {
          return false;
        }
      });
      if (!owns || !/個人利用|一般・個人利用/.test(htmlText(html)))
        throw new Error('Personal calendar ownership changed');
      const url = `https://calendar.google.com/calendar/ical/${encodeURIComponent(config.calendarId)}/public/basic.ics`;
      const source = await officialFetch(url, config.hosts, fetchImpl);
      const text = source.data.toString('utf8');
      const sourceHash = `sha256:${digest(source.data)}`;
      for (const date of dates) {
        const parsed = parsePersonalIcs(text, date, config.key);
        records.push(
          makeRecord({
            ...base,
            date,
            status: parsed.status,
            periods: parsed.periods,
            unknownReason:
              parsed.status === 'unknown' ? 'outside_published_period' : null,
            sourceHash,
            fetchedAt: now.toISOString(),
            confidence: 'high',
            warnings: parsed.warnings,
          }),
        );
      }
    } catch {
      for (const date of dates)
        records.push(
          unknownRecord({
            ...base,
            date,
            unknownReason: 'fetch_failed',
            warnings: ['個人利用カレンダーを確認できませんでした。'],
          }),
        );
    }
  }
  return records;
}
