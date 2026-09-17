import { afterEach, describe, expect, it, vi } from 'vitest';
const report = {id:'report',trackId:'track',date:'2026-09-16',outcome:'available',comment:'利用できました',createdAt:'2026-09-16T01:00:00Z'};
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.resetModules();});
async function service(){vi.stubEnv('VITE_FIELD_REPORTS_API','https://api.example/');return import('./field-reports');}
describe('report API client',()=>{
  it('fails closed when API is not configured',async()=>{
    vi.stubEnv('VITE_FIELD_REPORTS_API','');const api=await import('./field-reports');
    expect(api.isFieldReportsEnabled()).toBe(false);
    await expect(api.fetchFieldReports('track','2026-09-16')).rejects.toMatchObject({code:'unavailable'});
  });
  it('rejects malformed successful responses rather than showing a false empty state',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{"reports":"bad","count":0}')));
    const api=await service();await expect(api.fetchFieldReports('track','2026-09-16')).rejects.toMatchObject({code:'unavailable'});
  });
  it('encodes the query and returns only validated results',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({reports:[report],count:1})));vi.stubGlobal('fetch',fetch);
    const api=await service();expect(await api.fetchFieldReports('track','2026-09-16')).toEqual({reports:[report],count:1});
    expect(fetch.mock.calls[0][0]).toBe('https://api.example/reports?trackId=track&date=2026-09-16');
  });
  it('recognizes gateway throttles even if response is not our JSON envelope',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('Too many requests',{status:429})));
    const api=await service();await expect(api.fetchFieldReports('track','2026-09-16')).rejects.toMatchObject({code:'rate_limited'});
  });
  it('keeps one valid in-memory anonymous ID if storage is blocked',async()=>{
    vi.stubGlobal('window',{localStorage:{getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}}});
    const api=await service();const id=api.getFieldReportsClientId();expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);expect(api.getFieldReportsClientId()).toBe(id);
  });
});
