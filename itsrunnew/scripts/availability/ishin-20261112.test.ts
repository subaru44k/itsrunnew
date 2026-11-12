import {expect,it} from 'vitest';
import current from './fixtures/ishin-20261112-packet.json';
import previous from './fixtures/ishin-20261110-packet.json';
import {type AiPacket} from './ai-runtime';
import {reviewedIshinReading} from './reviewed-ishin';
const dates=Array.from({length:61},(_,i)=>new Date(Date.UTC(2026,10,1+i)).toISOString().slice(0,10));
const p={...current,dates} as AiPacket, old={...previous,dates} as AiPacket;
it('reviews all61days and changes only November16 pesticide/opening hours',()=>{
 const rows=reviewedIshinReading(p)!.rows, before=reviewedIshinReading(old)!.rows;
 for(const date of dates) {
  const row=rows.get(date)!;
  if(date!=='2026-11-16') expect(row).toEqual(before.get(date));
  else {
   expect(row.status).toBe('partially_available');
   expect(row.periods).toMatchObject([{start:'13:00',end:'22:00'}]);
   expect(row.conditions.join()).toContain('薬剤散布');
   expect(row.conditions.join()).toContain('芝生部分は利用不可');
   expect(before.get(date)!.periods).toMatchObject([{start:'08:30',end:'17:00'}]);
  }
 }
 for(let i=0;i<p.sources.length;i++) expect(reviewedIshinReading({...p,sources:p.sources.map((s,j)=>j===i?{...s,hash:'changed'}:s)})).toBeNull();
 expect(reviewedIshinReading({...p,sources:p.sources.slice(1)})).toBeNull();
});
