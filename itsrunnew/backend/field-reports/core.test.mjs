import { describe,it,expect,vi } from 'vitest';
import { createHandler, japanDate, validateInput } from './core.mjs';
const now = new Date('2026-09-16T14:00:00Z');
const body = {trackId:'track',date:'2026-09-16',outcome:'partial',comment:'1〜2レーン閉鎖',clientId:'19d9a74a-1cfa-41c0-b183-6b8aecb8fc97',website:''};
function setup() {
  const storage = {list:vi.fn().mockResolvedValue([]),save:vi.fn().mockResolvedValue(undefined)};
  const handler = createHandler({storage,trackIds:new Set(['track']),origins:['https://itsrun.info'],secret:'test',now:()=>now,uuid:()=> 'report-id'});
  const event = {rawPath:'/reports',headers:{origin:'https://itsrun.info','content-type':'application/json'},requestContext:{http:{method:'POST',sourceIp:'192.0.2.1'}},body:JSON.stringify(body)};
  return {storage,handler,event};
}
describe('field report boundary',()=>{
  it('uses JST midnight, validates actual dates and requires today',()=>{
    expect(japanDate(new Date('2026-09-16T15:00:00Z'))).toBe('2026-09-17');
    expect(validateInput({...body,date:'2026-02-30'},new Set(['track']),now)).toBe('invalid_input');
    expect(validateInput({...body,date:'2026-09-15'},new Set(['track']),now)).toBe('date_changed');
  });
  it.each([{outcome:'five_stars'},{trackId:'missing'},{comment:'a'.repeat(201)},{clientId:'spoof'},{website:'bot'},{extra:'x'},{comment:23}])('rejects invalid values %j',patch=>expect(validateInput({...body,...patch},new Set(['track']),now)).toBe('invalid_input'));
  it.each(['https://spam.example','<script>alert(1)</script>','spam@example.com','x'.repeat(20),'test\u0000'])('rejects basic spam %s',comment=>expect(validateInput({...body,comment},new Set(['track']),now)).toBe('spam'));
  it('saves structured report with atomic limit rules and no raw identifiers',async()=>{
    const {handler,storage,event} = setup(); const result = await handler(event);
    expect(result.statusCode).toBe(201);
    expect(storage.save).toHaveBeenCalledOnce();
    const [report,rules] = storage.save.mock.calls[0];
    expect(report).toMatchObject({schemaVersion:1,status:'visible',outcome:'partial'});
    expect(rules).toHaveLength(5);
    expect(rules[2]).toMatchObject({limit:3,cooldown:1800});
    expect(JSON.stringify(storage.save.mock.calls)).not.toContain('192.0.2.1');
    expect(JSON.stringify(storage.save.mock.calls)).not.toContain(body.clientId);
    expect(JSON.parse(result.body).report).not.toHaveProperty('status');
  });
  it('rejects disallowed origins, large payloads, malformed JSON and wrong date',async()=>{
    const {handler,storage,event}=setup();
    expect((await handler({...event,headers:{...event.headers,origin:'https://evil.example'}})).statusCode).toBe(403);
    expect((await handler({...event,body:'x'.repeat(5000)})).statusCode).toBe(400);
    expect((await handler({...event,body:'{'})).statusCode).toBe(400);
    expect((await handler({...event,body:JSON.stringify({...body,date:'2026-09-15'})})).statusCode).toBe(409);
    expect(storage.save).not.toHaveBeenCalled();
  });
  it('returns rate limit without pretending success; storage errors fail closed',async()=>{
    const {handler,storage,event}=setup();
    storage.save.mockRejectedValue({name:'TransactionCanceledException',CancellationReasons:[{Code:'ConditionalCheckFailed'}]});
    expect((await handler(event)).statusCode).toBe(429);
    storage.save.mockRejectedValue({name:'ServiceUnavailable'});
    expect((await handler(event)).statusCode).toBe(503);
  });
  it('hides moderated/expired records, bounds latest list, reports visible count',async()=>{
    const {handler,storage,event}=setup();
    storage.list.mockResolvedValue([{id:'hidden',status:'hidden',expiresAt:9999999999},{id:'expired',status:'visible',expiresAt:1},...Array.from({length:23},(_,i)=>({id:`${i}`,status:'visible',expiresAt:9999999999}))]);
    const response = await handler({...event,requestContext:{http:{method:'GET'}},queryStringParameters:{trackId:'track',date:body.date}});
    expect(response.headers['cache-control']).toBe('no-store');
    expect(JSON.parse(response.body)).toMatchObject({count:23});
    expect(JSON.parse(response.body).reports).toHaveLength(20);
    expect(JSON.parse(response.body).reports[0].id).toBe('0');
  });
});

it('keeps the API facility allowlist synchronized with published facilities',async()=>{
  const {readFileSync}=await import('node:fs');
  const tracks=JSON.parse(readFileSync(new URL('../../src/data/tracks.json',import.meta.url),'utf8'));
  const ids=JSON.parse(readFileSync(new URL('./track-ids.json',import.meta.url),'utf8'));
  expect(ids.sort()).toEqual(tracks.map(track=>track.id).sort());
});
