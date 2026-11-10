import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { digest } from './ai-runtime';
import { createPdfCollector, extractPdf, pdfSourceConfigs } from './pdf';
import { dateKeys } from './range';
import { inKamiyugiClosure, kamiyugiNovemberClosureHash, kamiyugiNovemberClosureUrl, reviewedKamiyugiPdf } from './reviewed-kamiyugi';
const config = pdfSourceConfigs.find(c => c.trackId === 'kamiyugi-park-athletic-stadium')!;
const html = gunzipSync(await readFile(new URL('./fixtures/kamiyugi-20261110.html.gz', import.meta.url))).toString('utf8');
const pdf = await readFile(new URL('./fixtures/kamiyugi-20261109-closure.pdf', import.meta.url));
const fetchImpl = (async input => {
  if (String(input) === config.landingPageUrl) return new Response(html);
  if (String(input) === kamiyugiNovemberClosureUrl) return new Response(pdf, { headers: { 'content-type': 'application/pdf' } });
  throw new Error(`Unexpected source: ${input}`);
}) as typeof fetch;

describe('Kamiyugi official overlaid renovation closure', () => {
  it('confirms the actual original includes the year-bearing closure notice, not a meaning invented for dashes', async () => {
    expect(`sha256:${digest(pdf)}`).toBe(kamiyugiNovemberClosureHash);
    const extracted = await extractPdf(new Uint8Array(pdf));
    const text = extracted.text.replace(/\s+/g, '');
    expect(text).toContain('上柚木公園陸上競技場');
    expect(text).toContain('公認更新工事');
    expect(text).toContain('令和8年11月2日(月)~令和9年2月28日(日)');
  });
  it('discovers the original from the current official landing and retains the complete 119-day closure across the year', async () => {
    const extract = vi.fn(extractPdf), collector = createPdfCollector(fetchImpl, extract);
    const dates = [...dateKeys('2026-11-02', 62), ...dateKeys('2027-01-03', 57)];
    expect(dates.at(-1)).toBe('2027-02-28');
    for (const date of dates) {
      const r = await collector.collect(config, date, new Date('2026-11-02T02:00:00Z'));
      expect(r, date).toMatchObject({ status: 'unavailable', sourceHash: kamiyugiNovemberClosureHash, pdfUrl: kamiyugiNovemberClosureUrl, publishedAt: '2026-11-09', confidence: 'high', periods: [{ from: null, to: null, status: 'unavailable', scope: 'full_track', eligibility: 'public' }] });
      expect(r.periods[0].conditions.join()).toContain('2027年2月28日（予定）');
      expect(r.warnings?.join()).toContain('再開日');
    }
    expect(extract).not.toHaveBeenCalled();
  });
  it('does not infer a closure before the notice interval or an opening after it', async () => {
    for (const date of ['2026-11-01', '2027-03-01', '2026-11-31', '2027-02-29', '2027-11-02']) {
      expect(inKamiyugiClosure(date), date).toBe(false);
      expect(reviewedKamiyugiPdf(kamiyugiNovemberClosureHash, date), date).toBeNull();
    }
    const collector = createPdfCollector(fetchImpl);
    const before = await collector.collect(config, '2026-11-01', new Date());
    expect(before.status).toBe('unknown');
    expect(before.periods.every(p => p.conditions.includes('2026年11月2日'))).toBe(false);
    await expect(collector.collect(config, '2027-03-01', new Date())).rejects.toMatchObject({ reason: 'schedule_not_published' });
  });
  it('stops changed or replaced documents instead of using the grid beneath an unreviewed closure notice', async () => {
    expect(reviewedKamiyugiPdf('sha256:unreviewed', '2026-11-02')).toBeNull();
    const changed = createPdfCollector((async input => String(input) === config.landingPageUrl ? new Response(html) : new Response(Buffer.concat([pdf, Buffer.from('\n% changed\n')]), { headers: { 'content-type': 'application/pdf' } })) as typeof fetch);
    await expect(changed.collect(config, '2026-11-02', new Date())).rejects.toMatchObject({ reason: 'source_changed' });
    const replaced = createPdfCollector((async input => String(input) === config.landingPageUrl ? new Response(html.replace(kamiyugiNovemberClosureUrl, 'https://kamiyugi-park.jp/wp/wp-content/uploads/2027/new.pdf')) : new Response(Buffer.concat([pdf, Buffer.from('\n% changed\n')]), { headers: { 'content-type': 'application/pdf' } })) as typeof fetch);
    await expect(replaced.collect(config, '2027-01-01', new Date())).rejects.toMatchObject({ reason: 'source_changed' });
  });
});
