import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildAiPacket, aiFacilities } from './ai-sources';
import { digest } from './ai-runtime';
import { readHiratsukaTable } from './hiratsuka-table';
const config = aiFacilities.find(c => c.key === 'hiratsuka')!;
const dates = Array.from({length: 12}, (_, i) => `2026-11-${10+i}`);
const raw = gunzipSync(readFileSync(new URL('./fixtures/hiratsuka-20261112.html.gz', import.meta.url)));
const packet = await buildAiPacket(config, dates, new Date('2026-11-12T01:30:00Z'), (async () => new Response(raw.toString())) as typeof fetch);
it('reads every official slot following the reviewed renovation notice', () => {
 const result = readHiratsukaTable(packet)!;
 expect(result.publishedAt).toBe('2026-11-12');
 for (let day=11;day<=20;day++) {
  const row=result.rows.get(`2026-11-${day}`)!;
  expect(row.status).toBe(day===12?'partially_available':day===14?'unavailable':'available');
  expect(row.periods.map(p=>[p.start,p.end])).toEqual(day===12?[['14:00','19:00']]:day===14?[]:[['08:00','12:00'],['12:00','13:00'],['13:00',day===13||day===20?'20:00':'19:00']]);
  if(day!==12&&day!==14) expect(row.conditions.join()).toContain('スパイク');
 }
 for(const day of ['10','21']) expect(result.rows.get(`2026-11-${day}`)!.unknown_reason).toBe('outside_published_period');
});
it('rejects changed renovation dates, unknown notices and changed legends', () => {
 for(const content of [packet.sources[0].content.replace('12月14日','12月13日'),packet.sources[0].content.replace('★お知らせ★','別のお知らせ'),packet.sources[0].content.replace('ご利用できます。','ご利用できません。')]) {
  expect(readHiratsukaTable({...packet,sources:[{...packet.sources[0],content,hash:digest(content)}]})).toBeNull();
 }
});
