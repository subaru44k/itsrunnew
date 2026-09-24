import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aiFacilities } from './ai-sources';
import {
  collectAdditionalAvailability,
  personalCalendarFacilities,
} from './additional';
import { readWithLuna } from './ai-runtime';

vi.mock('./ai-sources', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ai-sources')>();
  return {
    ...actual,
    buildAiPacket: vi.fn(
      async (
        config: (typeof actual.aiFacilities)[number],
        dates: string[],
      ) => ({
        key: config.key,
        trackId: config.trackId,
        name: config.name,
        landingPageUrl: config.landing,
        sources: [
          {
            kind: 'text',
            url: config.landing,
            name: 'schedule.txt',
            content: 'explicit opening',
            hash: 'fixed',
          },
        ],
        dates: config.key === 'setagaya' ? [dates[0]] : dates,
      }),
    ),
  };
});
vi.mock('./ai-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ai-runtime')>()),
  readWithLuna: vi.fn(),
}));
const dates = ['2026-09-22', '2026-09-23'];
const now = new Date('2026-09-22T00:00:00Z');
const officialFetch = async (url: string | URL | Request) => {
  const config = personalCalendarFacilities.find(
    (c) => String(url) === c.landing,
  );
  if (config)
    return new Response(
      `<p>個人利用</p><iframe src="https://calendar.google.com/calendar/embed?src=${encodeURIComponent(config.calendarId)}"></iframe>`,
    );
  return new Response(
    'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260922\r\nDTEND;VALUE=DATE:20260923\r\nSUMMARY:個人利用 午前〇\r\nDESCRIPTION:９：００～１２：００\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n',
  );
};
describe('additional availability integration', () => {
  it('retains every facility/date, entry conditions and source identity; future Setagaya is unknown', async () => {
    vi.mocked(readWithLuna).mockImplementation(async (packet) => ({
      key: 'cached-key',
      cacheHit: true,
      usage: null,
      rows: new Map(
        packet.dates.map((date) => [
          date,
          {
            id: 'wrong-id-but-valid-date',
            date,
            status: 'partially_available',
            periods: [
              {
                start: '09:00',
                end: '17:00',
                last_entry: '16:30',
                scope: '1・2レーンのみ',
              },
            ],
            conditions: ['区内在住者のみ'],
            evidence: [
              {
                source: 'schedule.txt',
                location: 'row',
                quote_or_symbol: '9–17',
              },
            ],
            unknown_reason: null,
          },
        ]),
      ),
    }));
    const records = await collectAdditionalAvailability(dates, {
      now,
      apiKey: 'test',
      fetchImpl: officialFetch as typeof fetch,
    });
    expect(records).toHaveLength(20);
    expect(new Set(records.map((r) => r.trackId + ':' + r.date)).size).toBe(20);
    expect(
      records.find(
        (r) =>
          r.trackId === 'setagaya-general-sports-track' && r.date === dates[1],
      )?.status,
    ).toBe('unknown');
    const ai = records.find((r) => r.trackId === aiFacilities[0].trackId)!;
    expect(ai.periods[0].conditions).toEqual([
      '区内在住者のみ',
      '最終入場 16:30',
      '1・2レーンのみ',
    ]);
    expect(ai.periods[0].eligibility).toBe('unknown');
    expect(ai.source.documentId).toBe('cached-key');
    for (const c of personalCalendarFacilities) {
      expect(
        records.find((r) => r.trackId === c.trackId && r.date === dates[0])
          ?.periods[0],
      ).toMatchObject({ from: '09:00', to: '12:00' });
      expect(
        records.find((r) => r.trackId === c.trackId && r.date === dates[1])
          ?.status,
      ).toBe('unknown');
    }
  });
  it('isolates reading failures and does not publish exception text', async () => {
    vi.mocked(readWithLuna).mockRejectedValue(
      new Error('credential-like-private-diagnostic'),
    );
    const directory = await mkdtemp(join(tmpdir(), 'itsrun-additional-test-'));
    try {
      const records = await collectAdditionalAvailability(dates, {
        now,
        apiKey: 'test',
        cacheDirectory: directory,
        fetchImpl: officialFetch as typeof fetch,
      });
      expect(
        records
          .filter((r) => r.evidence.collector.startsWith('luna-'))
          .every((r) => r.status === 'unknown'),
      ).toBe(true);
      expect(JSON.stringify(records)).not.toContain('credential-like');
      expect(
        records.some(
          (r) =>
            r.evidence.collector === 'personal-ics-ichihara' &&
            r.status === 'partially_available',
        ),
      ).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('overlaps at most three AI readings and keeps facility order', async () => {
    vi.mocked(readWithLuna).mockClear();
    const releases: (() => void)[] = [];
    let active = 0;
    let peak = 0;
    vi.mocked(readWithLuna).mockImplementation(async (packet) => {
      active++;
      peak = Math.max(peak, active);
      if (releases.length < 3)
        await new Promise<void>((resolve) => releases.push(resolve));
      active--;
      return { key: packet.key, cacheHit: true, usage: null, rows: new Map() };
    });
    const collecting = collectAdditionalAvailability(dates, {
      now,
      fetchImpl: officialFetch as typeof fetch,
    });
    await vi.waitFor(() => expect(releases).toHaveLength(3), { timeout: 5000 });
    expect(readWithLuna).toHaveBeenCalledTimes(3);
    releases[0]();
    await vi.waitFor(
      () =>
        expect(vi.mocked(readWithLuna).mock.calls.length).toBeGreaterThanOrEqual(
          4,
        ),
      { timeout: 5000 },
    );
    releases[1]();
    releases[2]();
    const records = await collecting;
    expect(peak).toBe(3);
    expect(readWithLuna).toHaveBeenCalledTimes(aiFacilities.length);
    expect(
      records
        .slice(0, dates.length * aiFacilities.length)
        .map((record) => record.trackId),
    ).toEqual(
      aiFacilities.flatMap((facility) => dates.map(() => facility.trackId)),
    );
  });
});
