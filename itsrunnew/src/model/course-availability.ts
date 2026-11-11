import type { AvailabilityStatus } from './availability';
import type { LocaleName } from './tracks';
export interface CourseRestriction { from:string;to:string|null;status:'unavailable'|'partially_available';reason:LocaleName;sourceUrl:string;reopenConfirmed:boolean }
export interface CourseAvailabilityRecord { courseId:string;checkedAt:string|null;attemptedAt:string;expiresAt:string;normalUse:boolean;unknownReason:string|null;restrictions:CourseRestriction[];evidence:{url:string;hash:string}[];pending:{url:string;hash:string;title:string}[] }
export interface CourseAvailabilityDocument {schemaVersion:1;timezone:'Asia/Tokyo';generatedAt:string;expiresAt:string;nextCheckAt:string;configHash:string;generation:string;fixture?:boolean;courses:CourseAvailabilityRecord[]}
const dateKey = (date:Date) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const isDate = (value:unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const isTimestamp = (value:unknown):value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const url = (value:unknown): value is string => typeof value === 'string' && /^https:\/\/(?:www\.)?(?:seibu-green\.co\.jp|seibu-la\.co\.jp|parks\.or\.jp|tef\.or\.jp|tokyo-park\.or\.jp)\//.test(value);
export function validateCourseAvailability(input:unknown, ids:string[], now=new Date(), options:{allowExpired?:boolean;allowFixture?:boolean}={}) : CourseAvailabilityDocument {
  const value=input as CourseAvailabilityDocument;
  if (!value || value.schemaVersion!==1 || value.timezone!=='Asia/Tokyo' || !isTimestamp(value.generatedAt) || !isTimestamp(value.expiresAt) || !isTimestamp(value.nextCheckAt)
    || Date.parse(value.generatedAt)>+now+60000 || Date.parse(value.expiresAt)<=Date.parse(value.generatedAt) || Date.parse(value.expiresAt)-Date.parse(value.generatedAt)>8*86400000
    || Date.parse(value.nextCheckAt)>Date.parse(value.expiresAt) || Date.parse(value.nextCheckAt)<=Date.parse(value.generatedAt)
    || (!options.allowExpired && Date.parse(value.expiresAt)<=+now) || (value.fixture && !options.allowFixture) || !/^[a-f0-9]{64}$/.test(value.configHash) || !/^[a-f0-9]{24}$/.test(value.generation)
    || !Array.isArray(value.courses) || JSON.stringify(value.courses.map(record=>record.courseId).sort())!==JSON.stringify([...ids].sort())) throw new Error('Invalid running course status document');
  for (const record of value.courses) {
    if (typeof record.normalUse!=='boolean' || !(record.unknownReason===null || typeof record.unknownReason==='string') || (record.normalUse && record.unknownReason!==null)
      || !isTimestamp(record.attemptedAt) || record.attemptedAt!==value.generatedAt || record.expiresAt!==value.expiresAt || (record.checkedAt!==null && (!isTimestamp(record.checkedAt) || record.checkedAt!==value.generatedAt))
      || (record.normalUse && !record.checkedAt) || !Array.isArray(record.restrictions) || !Array.isArray(record.evidence) || !Array.isArray(record.pending)) throw new Error('Invalid course status record');
    if (record.normalUse && (!record.evidence.length || record.pending.length>0)) throw new Error('Normal use requires official evidence');
    for (const source of [...record.evidence,...record.pending]) if (!url(source.url) || !/^[a-f0-9]{64}$/.test(source.hash)) throw new Error('Invalid course source');
    for (const restriction of record.restrictions) if (!isDate(restriction.from) || (restriction.to!==null && (!isDate(restriction.to) || restriction.from>restriction.to)) || !['unavailable','partially_available'].includes(restriction.status)
      || !url(restriction.sourceUrl) || !restriction.reason?.ja || !restriction.reason?.en || typeof restriction.reopenConfirmed!=='boolean') throw new Error('Invalid course restriction');
  }
  return value;
}
export function courseAvailability(id:string,date:string,document:CourseAvailabilityDocument|null,now=new Date()):{status:AvailabilityStatus;reason:LocaleName;sourceUrl?:string;checkedAt?:string} {
  const unknown = (ja='最新の公式情報を確認できません。',en='The latest official information could not be confirmed.') => ({status:'unknown' as const,reason:{ja,en}});
  if (!isDate(date) || !document || !isTimestamp(document.expiresAt) || +now>=Date.parse(document.expiresAt) || Date.parse(document.generatedAt)>+now+60000) return unknown();
  const record=document.courses.find(course=>course.courseId===id);
  if (!record || !record.normalUse || record.unknownReason) return unknown(record?.unknownReason==='notice_review_required' ? '新しい公式告知を確認中です。' : undefined,record?.unknownReason==='notice_review_required' ? 'A new official notice needs review.' : undefined);
  const active=record.restrictions.filter(restriction=>restriction.from<=date && (restriction.to===null || restriction.to>=date)).sort((a,b)=>Number(b.status==='unavailable')-Number(a.status==='unavailable'));
  if (active.length) return {status:active[0].status,reason:active[0].reason,sourceUrl:active[0].sourceUrl,checkedAt:record.checkedAt!};
  if (record.restrictions.some(restriction=>restriction.to!==null && restriction.to<date && !restriction.reopenConfirmed)) return unknown('工事などの終了後、再開を確認できていません。','Reopening after a restriction has not been confirmed.');
  if (!record.checkedAt || date<dateKey(new Date(record.checkedAt)) || date>dateKey(new Date(document.nextCheckAt))) return unknown('この日までの利用状況は未確認です。','Conditions for this date have not been confirmed.');
  return {status:'available',reason:{ja:'公式の通常開放案内とお知らせを確認しています。',en:'Official normal-use information and notices have been checked.'},checkedAt:record.checkedAt};
}
