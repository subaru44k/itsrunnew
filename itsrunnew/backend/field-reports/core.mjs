import { createHmac, randomUUID } from 'node:crypto';
export const japanDate = (now = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(now);
export const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value;
export function validateInput(body, trackIds, now) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['trackId','date','outcome','comment','clientId','website'].includes(k))) return 'invalid_input';
  if (!trackIds.has(body.trackId) || !validDate(body.date) || !['available','partial','unavailable'].includes(body.outcome) || typeof body.clientId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.clientId)) return 'invalid_input';
  if (body.date !== japanDate(now)) return 'date_changed';
  if (typeof body.comment !== 'string' || body.comment.length > 200 || (body.website !== undefined && body.website !== '')) return 'invalid_input';
  if (/[\x00-\x08\x0b-\x1f\x7f]|https?:|www\.|<[^>]*>|\S+@\S+\.\S+|(.)\1{19}/iu.test(body.comment)) return 'spam';
  return null;
}
export function publicReport(item) {
  return Object.fromEntries(['id','trackId','date','outcome','comment','createdAt'].map(key => [key,item[key]]));
}
export function createHandler({ storage, trackIds, origins, secret, now = () => new Date(), uuid = randomUUID }) {
  return async event => {
    const origin = event.headers?.origin;
    const headers = { 'content-type':'application/json', 'cache-control':'no-store', 'x-robots-tag':'noindex, nofollow', 'vary':'Origin', ...(origins.includes(origin) ? {'access-control-allow-origin':origin} : {}) };
    const reply = (statusCode, data) => ({statusCode,headers,body:JSON.stringify(data)});
    const method = event.requestContext?.http?.method;
    if (event.rawPath !== '/reports') return reply(404,{error:'not_found'});
    try {
      if (method === 'GET') {
        const {trackId,date} = event.queryStringParameters ?? {};
        if (!trackIds.has(trackId) || !validDate(date)) return reply(400,{error:'invalid_input'});
        const rows = await storage.list(`REPORT#${trackId}#${date}`);
        const visible = rows.filter(row => row.status === 'visible' && row.expiresAt > Math.floor(now().getTime()/1000));
        return reply(200,{ reports:visible.slice(0,20).map(publicReport), count:visible.length });
      }
      if (method !== 'POST') return reply(405,{error:'method_not_allowed'});
      if (!origins.includes(origin)) return reply(403,{error:'forbidden'});
      if (!/^application\/json(?:;|$)/i.test(event.headers?.['content-type'] ?? '')) return reply(415,{error:'invalid_input'});
      if (event.isBase64Encoded || typeof event.body !== 'string' || Buffer.byteLength(event.body) > 4096) return reply(400,{error:'invalid_input'});
      let body;
      try { body = JSON.parse(event.body); } catch { return reply(400,{error:'invalid_input'}); }
      const date = now();
      const error = validateInput(body,trackIds,date);
      if (error) return reply(error === 'date_changed' ? 409 : 400,{error});
      const ip = event.requestContext?.http?.sourceIp;
      if (!ip || !secret) return reply(503,{error:'unavailable'});
      const hash = value => createHmac('sha256',secret).update(`${body.date}|${value}`).digest('hex');
      const ipHash = hash(`ip|${ip}`);
      const clientHash = hash(`client|${body.clientId}`);
      const seconds = Math.floor(date.getTime()/1000);
      const report = {id:uuid(),trackId:body.trackId,date:body.date,outcome:body.outcome,comment:body.comment.trim(),createdAt:date.toISOString(),status:'visible',schemaVersion:1,expiresAt:seconds+365*86400};
      const rules = [
        {key:`IPMIN#${ipHash}#${Math.floor(seconds/60)}`,limit:5},
        {key:`IPDAY#${ipHash}`,limit:30},
        {key:`CLIENT#${clientHash}#${body.trackId}`,limit:3,cooldown:1800},
        {key:`IPTRACK#${ipHash}#${body.trackId}`,limit:10,cooldown:60},
        {key:`CAP#${body.trackId}#${body.date}`,limit:200},
      ];
      await storage.save(report,rules,seconds);
      return reply(201,{report:publicReport(report)});
    } catch (error) {
      if (error?.name === 'TransactionCanceledException' && error.CancellationReasons?.some(reason => reason.Code === 'ConditionalCheckFailed')) return {...reply(429,{error:'rate_limited'}),headers:{...headers,'retry-after':'1800'}};
      // Never log request bodies, network identifiers or comments.
      console.error('field_reports_failure', error?.name ?? 'UnknownError');
      return reply(503,{error:'unavailable'});
    }
  };
}
