import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import current from './fixtures/ishin-20261110-packet.json';
import previous from './fixtures/ishin-20261102-packet.json';
import {type AiPacket} from './ai-runtime';
import {sourceInputs} from './ai-source-utils';
import {reviewedIshinReading} from './reviewed-ishin';
it('binds the current official HTML and preserves all 61 reviewed days after only New!! removal',async()=>{
 const p=current as AiPacket, old=previous as AiPacket;
 const html=gunzipSync(readFileSync(new URL('./fixtures/ishin-20261110.html.gz',import.meta.url)));
 expect((await sourceInputs(p.sources[0].name,p.sources[0].url,html))[0]).toEqual(p.sources[0]);
 expect(p.sources[0].content).toBe(old.sources[0].content.replace('New!!\n',''));
 expect(p.sources.slice(1)).toEqual(old.sources.slice(1));
 expect(reviewedIshinReading(p)?.rows).toEqual(reviewedIshinReading(old)?.rows);
 expect(reviewedIshinReading(p)?.rows.get('2026-11-26')?.conditions.join()).toContain('5・6・7・8レーン');
 for(let i=0;i<p.sources.length;i++)expect(reviewedIshinReading({...p,sources:p.sources.map((s,j)=>j===i?{...s,hash:'changed'}:s)})).toBeNull();
});
