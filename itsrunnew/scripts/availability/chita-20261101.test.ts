import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { buildAiPacket, aiFacilities, fullMonths } from './ai-sources';
import { digest } from './ai-runtime';
import { reviewedChitaReading } from './reviewed-chita';
import { collectAdditionalAvailability } from './additional';

const config = aiFacilities.find(c => c.key === 'chita')!;
const now = new Date('2026-11-01T01:00:00Z');
const raw = gunzipSync(await readFile(new URL('./fixtures/chita-20261101.html.gz', import.meta.url)));
const html = raw.toString('utf8');
const dates = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-12-01'];
const official = (body = html) => (async (input: string | URL | Request) => String(input) === config.landing ? new Response(body) : new Response('', { status: 503 })) as typeof fetch;
const packet = await buildAiPacket(config, dates, now, official());

describe('Chita official renovation replaces the monthly opening PDF', () => {
  it('adopts only the explicit closure dates across all five months without inferring reopening', () => {
    expect(digest(raw)).toBe('ce8d613b4b9bba74cde4de806bcd47326f2abf991fc6056ee1b6ba8faa0bef54');
    const allDates = [...fullMonths(['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01']), '2026-10-31', '2027-04-01', '2027-11-01'];
    const rows = reviewedChitaReading({ ...packet, dates: allDates })!.rows;
    const closedDates = allDates.filter(date => rows.get(date)!.status === 'unavailable');
    expect(closedDates).toHaveLength(150);
    expect(rows.get('2026-11-01')).toMatchObject({ status: 'unavailable', periods: [], conditions: [expect.stringContaining('専用利用')] });
    expect(rows.get('2026-11-02')).toMatchObject({ status: 'unknown', unknown_reason: 'insufficient_information', periods: [], evidence: [] });
    expect(rows.get('2026-11-03')).toMatchObject({ status: 'unavailable', conditions: [expect.stringContaining('改修工事')] });
    expect(rows.get('2027-03-31')!.status).toBe('unavailable');
    for (const date of ['2026-10-31', '2027-04-01', '2027-11-01']) expect(rows.get(date)).toMatchObject({ status: 'unknown', unknown_reason: 'outside_published_period', periods: [], evidence: [] });
    expect([...rows.values()].some(r => r.status === 'available')).toBe(false);
  });

  it('requires exact source content, URL, facility identity and no additional unreviewed document', () => {
    const s = packet.sources[0];
    const content = s.content.replace('令和９年３月３１日', '令和９年２月２８日');
    expect(content).not.toBe(s.content);
    for (const changed of [
      { ...packet, key: 'other' }, { ...packet, trackId: 'other' }, { ...packet, landingPageUrl: 'https://example.com/' },
      { ...packet, sources: [{ ...s, content, hash: digest(content) }] },
      { ...packet, sources: [{ ...s, content }] },
      { ...packet, sources: [{ ...s, url: 'https://www.chita-sports.com/other/' }] },
      { ...packet, sources: [s, s] },
    ]) expect(reviewedChitaReading(changed)).toBeNull();
  });

  it('publishes unavailable/unknown with provenance and never calls AI, including changed notice', async () => {
    const api = vi.fn(async () => { throw new Error('No AI fallback for finite closure'); });
    const records = (await collectAdditionalAvailability(dates, { now, fetchImpl: official(), apiFetchImpl: api as typeof fetch, apiKey: '' })).filter(r => r.trackId === config.trackId);
    expect(records.map(r => [r.date, r.status, r.unknownReason ?? null])).toEqual([
      ['2026-11-01', 'unavailable', null], ['2026-11-02', 'unknown', 'insufficient_information'],
      ['2026-11-03', 'unavailable', null], ['2026-12-01', 'unavailable', null],
    ]);
    expect(records[2].warnings.join()).toContain('2027年3月31日');
    expect(records[2].evidence.sourceHash).toMatch(/^sha256:/);
    expect(records[2].source.documentId).toMatch(/^reviewed-chita-20261101-/);
    const changed = (await collectAdditionalAvailability(dates, { now, fetchImpl: official(html.replaceAll('令和９年３月３１日', '令和９年２月２８日')), apiFetchImpl: api as typeof fetch, apiKey: '' })).filter(r => r.trackId === config.trackId);
    expect(changed.every(r => r.status === 'unknown' && r.unknownReason === 'source_changed')).toBe(true);
    expect(api).not.toHaveBeenCalled();
  });

  it('does not treat a missing ordinary monthly PDF as a reviewed closure', async () => {
    await expect(buildAiPacket(config, dates, now, official(html.replaceAll('陸上競技場改修工事のお知らせ', '一般開放のご案内')))).rejects.toThrow('Chita opening PDFs not found');
  });
});
