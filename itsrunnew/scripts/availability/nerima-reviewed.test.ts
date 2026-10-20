import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createPdfCollector,extractPdf,pdfSourceConfigs} from './pdf';
import {reviewedNerimaPdf,nerimaReviewedPdfHash,nerimaGuideUrl} from './nerima-reviewed';
const config=pdfSourceConfigs.find(c=>c.trackId==='nerima-general-sports-park')!;
const pdfUrl='https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/20261013souun_kaihoujoukyou.pdf';
describe('Nerima official October 13 raster weekly table',()=>{
  it('extracts Japanese text requiring bundled CMaps from the official PDF',async()=>{
    const bytes=new Uint8Array(await readFile(new URL('./fixtures/nerima-20261013.pdf',import.meta.url)));
    const pdf=await extractPdf(bytes);
    expect(pdf.text).toContain('練馬総合運動場公園陸上競技場の開放状況');
    expect(pdf.text).toContain('15:00~17:00');
  });
  it('discovers the real weekly link, verifies the legend, and preserves half/green-lane limits',async()=>{
    const fetchImpl=async(input: string|URL|Request)=>{
      if(String(input)===config.landingPageUrl)return new Response(`<a href="${pdfUrl}">陸上競技場の開放状況（直近1週間分）</a>`);
      const file=String(input)===nerimaGuideUrl?'nerima-opening-guide.pdf':'nerima-20261013.pdf';
      return new Response(await readFile(new URL(`./fixtures/${file}`,import.meta.url)),{headers:{'content-type':'application/pdf'}});
    };
    const collector=createPdfCollector(fetchImpl as typeof fetch);
    const first=await collector.collect(config,'2026-10-13',new Date('2026-10-13T07:00:00Z'));
    expect(first.status).toBe('partially_available');
    expect(first.periods[0]).toMatchObject({from:'09:00',to:'12:00',scope:'lane_subset',status:'available'});
    expect(first.periods[1].conditions.join()).toContain('緑レーンのみ');
    expect(first.periods[2]).toMatchObject({from:'15:00',to:'17:00',status:'unavailable'});
    expect(first.periods[3]).toMatchObject({from:'17:00',to:'18:00',status:'unknown'});
    for(const date of ['2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18','2026-10-19']){
      const result=await collector.collect(config,date,new Date('2026-10-13T07:00:00Z'));
      expect(result.status).toBe('unknown');
      expect(result.periods.slice(0,3).every(p=>p.status==='unavailable')).toBe(true);
      expect(result.unknownReason).toBe('insufficient_information');
    }
    expect(await collector.collect(config,'2026-10-20',new Date())).toMatchObject({status:'unknown',periods:[],unknownReason:'outside_published_period'});
    const changedLegend=createPdfCollector((async(input)=>String(input)===nerimaGuideUrl?new Response('%PDF-changed',{headers:{'content-type':'application/pdf'}}):fetchImpl(input)) as typeof fetch);
    await expect(changedLegend.collect(config,'2026-10-13',new Date())).rejects.toMatchObject({reason:'source_changed'});
  });
  it('does not apply a finite reviewed result to new PDF content or outside dates',()=>{
    expect(reviewedNerimaPdf('sha256:changed','2026-10-13')).toBeNull();
    expect(reviewedNerimaPdf(nerimaReviewedPdfHash,'2027-10-13')).toMatchObject({status:'unknown',periods:[]});
  });
});

describe('Nerima official October 16 raster weekly table', () => {
  const currentUrl = pdfUrl.replace('20261013', '20261016');
  const fetchImpl = async (input: string | URL | Request) => {
    if (String(input) === config.landingPageUrl)
      return new Response(`<a href="${currentUrl}">陸上競技場の開放状況（直近1週間分）</a>`);
    const file = String(input) === nerimaGuideUrl ? 'nerima-opening-guide.pdf' : 'nerima-20261016.pdf';
    return new Response(await readFile(new URL(`./fixtures/${file}`, import.meta.url)), {
      headers: { 'content-type': 'application/pdf' },
    });
  };

  it('verifies the actual source hash and every published slot without extending the old week', async () => {
    const collector = createPdfCollector(fetchImpl as typeof fetch);
    const now = new Date('2026-10-16T07:00:00Z');
    for (let day = 16; day <= 22; day++) {
      const result = await collector.collect(config, `2026-10-${day}`, now);
      expect(result).toMatchObject({
        pdfUrl: currentUrl,
        sourceHash: 'sha256:2bb147e1a314fe7517e8a33b3ab670470065c326f0105ebf93cdd07ffd9768f0',
        publishedAt: '2026-10-16',
        status: day >= 21 ? 'partially_available' : 'unknown',
        unknownReason: day >= 21 ? undefined : 'insufficient_information',
      });
      expect(result.periods.map(p => [p.from, p.to, p.status, p.scope])).toEqual([
        ['09:00', '12:00', day === 21 ? 'available' : 'unavailable', day === 21 ? 'lane_subset' : 'full_track'],
        ['12:00', '15:00', day >= 21 ? 'available' : 'unavailable', day >= 21 ? 'lane_subset' : 'full_track'],
        ['15:00', '17:00', 'unavailable', 'full_track'],
        ['17:00', '18:00', 'unknown', 'unknown'],
      ]);
      if (day === 21) {
        expect(result.periods[0].conditions.join()).toContain('半面のみ');
        expect(result.periods[1].conditions.join()).toContain('半面のみ');
      }
      if (day === 22) {
        expect(result.periods[1].conditions.join()).toContain('緑レーンのみ');
        expect(result.periods[1].conditions.join()).toContain('陸上競技の練習・幅跳びレーンは利用不可');
      }
    }
    for (const date of ['2026-10-15', '2026-10-23', '2027-10-21']) {
      expect(await collector.collect(config, date, now)).toMatchObject({
        status: 'unknown', periods: [], unknownReason: 'outside_published_period',
      });
    }
  });

  it('requires re-review when the legend or weekly image content changes', async () => {
    const changedGuide = createPdfCollector((async input => String(input) === nerimaGuideUrl
      ? new Response('%PDF-changed', { headers: { 'content-type': 'application/pdf' } })
      : fetchImpl(input)) as typeof fetch);
    await expect(changedGuide.collect(config, '2026-10-21', new Date())).rejects.toMatchObject({ reason: 'source_changed' });
    const changedWeek = createPdfCollector((async input => {
      const response = await fetchImpl(input);
      if (String(input) !== currentUrl) return response;
      // A valid PDF with changed bytes must not inherit the reviewed dates.
      return new Response(Buffer.concat([Buffer.from(await response.arrayBuffer()), Buffer.from('\n% changed\n')]), {
        headers: { 'content-type': 'application/pdf' },
      });
    }) as typeof fetch);
    await expect(changedWeek.collect(config, '2026-10-21', new Date())).rejects.toMatchObject({ reason: 'source_changed' });
  });
});

describe('Nerima official October 20 raster weekly table', () => {
  const currentUrl = pdfUrl.replace('20261013', '20261020');
  const fetchImpl = async (input: string | URL | Request) => {
    if (String(input) === config.landingPageUrl)
      return new Response(`<a href="${currentUrl}">陸上競技場の開放状況（直近1週間分）</a>`);
    const file = String(input) === nerimaGuideUrl ? 'nerima-opening-guide.pdf' : 'nerima-20261020.pdf';
    return new Response(await readFile(new URL(`./fixtures/${file}`, import.meta.url)), {
      headers: { 'content-type': 'application/pdf' },
    });
  };

  it('verifies the actual source hash and every published slot without extending the old week', async () => {
    const collector = createPdfCollector(fetchImpl as typeof fetch);
    const now = new Date('2026-10-20T07:00:00Z');
    for (let day = 20; day <= 26; day++) {
      const result = await collector.collect(config, `2026-10-${day}`, now);
      expect(result).toMatchObject({
        pdfUrl: currentUrl,
        sourceHash: 'sha256:635046cef4cf10eccc7d765c02b325a3e456abd41b815d4aa4362f7a94c5ddd1',
        publishedAt: '2026-10-20',
        status: [20, 21, 22, 26].includes(day) ? 'partially_available' : 'unknown',
        unknownReason: [20, 21, 22, 26].includes(day) ? undefined : 'insufficient_information',
      });
      expect(result.periods.map(p => [p.from, p.to, p.status, p.scope])).toEqual([
        ['09:00', '12:00', day === 20 || day === 21 ? 'available' : 'unavailable', day === 21 ? 'lane_subset' : 'full_track'],
        ['12:00', '15:00', [20, 21, 22, 26].includes(day) ? 'available' : 'unavailable', [20, 21, 22, 26].includes(day) ? 'lane_subset' : 'full_track'],
        ['15:00', '17:00', day === 20 ? 'available' : 'unavailable', 'full_track'],
        ['17:00', '18:00', 'unknown', 'unknown'],
      ]);
      if (day === 20) {
        expect(result.periods[0].conditions.join()).toContain('ボール類の使用不可');
        expect(result.periods[2].conditions.join()).toContain('ボール類の使用不可');
      }
      if (day === 21) {
        expect(result.periods[0].conditions.join()).toContain('半面のみ');
        expect(result.periods[1].conditions.join()).toContain('半面のみ');
      }
      if ([20, 22, 26].includes(day)) {
        expect(result.periods[1].conditions.join()).toContain('緑レーンのみ');
        expect(result.periods[1].conditions.join()).toContain('陸上競技の練習・幅跳びレーンは利用不可');
      }
    }
    for (const date of ['2026-10-19', '2026-10-27', '2027-10-21']) {
      expect(await collector.collect(config, date, now)).toMatchObject({
        status: 'unknown', periods: [], unknownReason: 'outside_published_period',
      });
    }
  });

  it('requires re-review when the legend or weekly image content changes', async () => {
    const changedGuide = createPdfCollector((async input => String(input) === nerimaGuideUrl
      ? new Response('%PDF-changed', { headers: { 'content-type': 'application/pdf' } })
      : fetchImpl(input)) as typeof fetch);
    await expect(changedGuide.collect(config, '2026-10-21', new Date())).rejects.toMatchObject({ reason: 'source_changed' });
    const changedWeek = createPdfCollector((async input => {
      const response = await fetchImpl(input);
      if (String(input) !== currentUrl) return response;
      // A valid PDF with changed bytes must not inherit the reviewed dates.
      return new Response(Buffer.concat([Buffer.from(await response.arrayBuffer()), Buffer.from('\n% changed\n')]), {
        headers: { 'content-type': 'application/pdf' },
      });
    }) as typeof fetch);
    await expect(changedWeek.collect(config, '2026-10-21', new Date())).rejects.toMatchObject({ reason: 'source_changed' });
  });
});
