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
