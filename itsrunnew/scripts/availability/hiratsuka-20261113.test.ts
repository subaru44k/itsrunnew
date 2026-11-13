import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
import { buildAiPacket, aiFacilities } from './ai-sources'; import { digest } from './ai-runtime'; import { readHiratsukaTable } from './hiratsuka-table';
const raw = gunzipSync(readFileSync(new URL('./fixtures/hiratsuka-20261113.html.gz', import.meta.url))).toString();
const dates=Array.from({length:12},(_,i)=>`2026-11-${12+i}`);
const packet=await buildAiPacket(aiFacilities.find(c=>c.key==='hiratsuka')!,dates,new Date('2026-11-13T05:00:00Z'),async()=>new Response(raw));
it('reads all 30 slots including the explicitly corrected closed morning on November 19',()=>{
 const result=readHiratsukaTable(packet)!;expect(result.publishedAt).toBe('2026-11-13');
 for(let day=13;day<=22;day++){
  const row=result.rows.get(`2026-11-${day}`)!;
  expect(row.status).toBe(day===14?'unavailable':[19,21,22].includes(day)?'partially_available':'available');
  const full=[['08:00','12:00'],['12:00','13:00'],['13:00',day===13||day===20?'20:00':'19:00']];
  expect(row.periods.map(p=>[p.start,p.end])).toEqual(day===14?[]:day===19||day===21?full.slice(1):day===22?full.slice(0,1):full);
 }
 expect(result.rows.get('2026-11-19')!.conditions.join()).toContain('午前は利用不可に変更');
 for(const day of ['12','23'])expect(result.rows.get(`2026-11-${day}`)!.unknown_reason).toBe('outside_published_period');
});
it('rejects missing/mismatched correction notes, new marked symbols, wrong weekdays and changed renovation',()=>{
 const original=packet.sources[0].content;
 for(const content of [original.replace('に変更となりました。','に変更予定です。'),original.replace('※不可\n可','※可\n可'),original.replace('※不可\nに変更となりました。',''),original.replace('19日(木曜日)','19日(金曜日)'),original.replace('12月14日','12月13日')]){
  expect(readHiratsukaTable({...packet,sources:[{...packet.sources[0],content,hash:digest(content)}]})).toBeNull();
 }
});
