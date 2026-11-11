import { createHash } from 'node:crypto';
import type { CourseAvailabilityDocument } from '../../src/model/course-availability';
import { htmlText, links, images, officialFetch } from '../availability/ai-source-utils';

const DAY = 86400000;
const hosts = ['www.seibu-green.co.jp', 'www.seibu-la.co.jp', 'www.parks.or.jp', 'www.tef.or.jp', 'www.tokyo-park.or.jp'];
export const sourceHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function articleContent(html: string) {
  const body = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1]
    ?? /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? html;
  return body.replace(/<(header|footer|nav|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
}
export function fingerprint(html: string) {
  const body = articleContent(html);
  return sourceHash({ text: htmlText(body), attachments: [...body.matchAll(/(?:href|src)=["']([^"']+\.(?:pdf|png|jpe?g)(?:\?[^"']*)?)["']/gi)].map(match => match[1]).sort() });
}
export interface Restriction { from: string; to: string|null; status: 'unavailable' | 'partially_available'; reason: {ja:string;en:string}; sourceUrl: string; reopenConfirmed: boolean }
interface Review { hash: string; note: string; restrictions?: Restriction[] }
export interface CourseSource { id:string; identity:string; normal:{url:string; tokens:string[]; hash?:string}[]; feeds:string[]; importantGroup?:string; noticePattern:string; reviews:Record<string,Review> }
export interface CourseConfig { version:number; reviewedAt:string; courses:CourseSource[] }
// Only an explicit, all-day, entire-course closure with one fully qualified date
// range is parsed automatically. Relative dates, partial closures and reopening
// claims need a reviewed record; guessing must not turn into a green marker.
export function explicitClosure(text: string, sourceUrl: string): Restriction | null {
  const normalized = text.normalize('NFKC').replace(/\s+/g, ' ');
  if (!/(?:ジョギング|ランニング)(?:・ウォーキング)?コース.{0,12}全(?:面|線|体).{0,12}(?:閉鎖|利用停止|利用休止)/.test(normalized)
    || /(?:閉鎖|利用停止|利用休止).{0,12}(?:しません|いたしません|しない|ありません|中止|検討|見送り|解除|終了)/.test(normalized) || !/(?:終日|全日)/.test(normalized) || /\d{1,2}(?:時|:\d{2})/.test(normalized)) return null;
  const ranges = [...normalized.matchAll(/(20\d{2})年(\d{1,2})月(\d{1,2})日\s*(?:から|[~〜～ー-])\s*(20\d{2})年(\d{1,2})月(\d{1,2})日/g)];
  if (ranges.length !== 1) return null;
  const date = (year:string,month:string,day:string) => `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
  const [, y,m,d,ey,em,ed] = ranges[0];
  const from = date(y,m,d), to = date(ey,em,ed);
  if (from > to || [from,to].some(value => !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) return null;
  return { from, to, status:'unavailable', sourceUrl, reopenConfirmed:false,
    reason:{ja:'公式告知でランニングコースの終日全面閉鎖を確認',en:'An official notice confirms an all-day closure of the entire running course.'} };
}
export async function collectCourseAvailability(config:CourseConfig, options:{ now?:Date; fetchImpl?:typeof fetch; previous?:CourseAvailabilityDocument|null; capture?:(url:string,body:string)=>void|Promise<void> } = {}) {
  const now = options.now ?? new Date();
  const generatedAt = now.toISOString(), expiresAt = new Date(+now + 8*DAY).toISOString();
  const cache = new Map<string,Promise<string>>();
  const assetCache = new Map<string,Promise<string>>();
  const assetHash = (url:string) => {
    if (!assetCache.has(url)) assetCache.set(url,(async()=>{const response=await officialFetch(url,hosts,options.fetchImpl??fetch);const hash=createHash('sha256').update(response.data).digest('hex');await options.capture?.(url,`sha256:${hash}`);return hash;})());
    return assetCache.get(url)!;
  };
  const noticeHash = async (html:string,url:string) => {
    const body=articleContent(html);
    const assets=[...new Set([...links(body,url).filter(item=>/\.pdf(?:[?#]|$)/i.test(item.url)),...images(body,url)].map(item=>item.url))].sort();
    if (assets.length>40) throw new Error('notice_assets_changed');
    const hashes=[];for(const asset of assets) hashes.push({url:asset,hash:await assetHash(asset)});
    return sourceHash({html:fingerprint(html),assets:hashes});
  };
  const get = (url:string) => {
    if (!cache.has(url)) cache.set(url, (async () => {
      const response = await officialFetch(url, hosts, options.fetchImpl ?? fetch);
      const body = response.data.toString('utf8');
      await options.capture?.(url, body);
      return body;
    })());
    return cache.get(url)!;
  };
  const courses = [];
  for (const configCourse of config.courses) {
    const evidence:{url:string;hash:string}[] = [], restrictions:Restriction[] = [], pending:{url:string;hash:string;title:string}[] = [];
    let reason:string|null = null;
    try {
      for (const normal of configCourse.normal) {
        const html = await get(normal.url), text = htmlText(html).normalize('NFKC').replace(/\s+/g,'');
        if (!text.includes(configCourse.identity) || !normal.tokens.every(token => text.includes(token.normalize('NFKC').replace(/\s+/g,'')))) throw new Error('normal_use_changed');
        // Normal-use text is reviewed independently from changing news on a homepage.
        // Dedicated facility pages are pinned, including references to image/PDF notices.
        if (normal.hash && fingerprint(html) !== normal.hash) throw new Error('normal_use_changed');
        evidence.push({url:normal.url,hash:fingerprint(html)});
      }
      const notices = new Map<string,string>();
      for (const feed of configCourse.feeds) {
        const html = await get(feed);
        if (!htmlText(html).includes(configCourse.identity) || !/お知らせ|重要/.test(htmlText(html))) throw new Error('notice_feed_changed');
        evidence.push({url:feed,hash:fingerprint(html)});
        for (const link of links(html,feed)) if (!new URL(link.url).pathname.endsWith('/index.html') && new RegExp(configCourse.noticePattern).test(new URL(link.url).pathname)) { const target=new URL(link.url);target.hash='';notices.set(target.href,link.label); }
        if (configCourse.importantGroup) {
          if (!html.includes(`emergency_gid = ${configCourse.importantGroup}`)) throw new Error('important_feed_changed');
        }
      }
      if (configCourse.importantGroup) {
        const endpoint='https://www.parks.or.jp/exis/c_jsdata/important.json';
        const important = JSON.parse(await get(endpoint));
        if (!important || !Array.isArray(important['10000']) || !Array.isArray(important[configCourse.importantGroup])) throw new Error('important_feed_changed');
        const selected = [...important['10000'],...important[configCourse.importantGroup]];
        evidence.push({url:endpoint,hash:sourceHash(selected)});
        for (const notice of selected) {
          if (typeof notice.url !== 'string' || typeof notice.title !== 'string') throw new Error('important_feed_changed');
          notices.set(new URL(notice.url,endpoint).href,notice.title);
        }
      }
      if (!notices.size) throw new Error('notice_feed_empty');
      // A closure must not disappear merely because it scrolls out of a news feed.
      for (const [url,review] of Object.entries(configCourse.reviews)) if (review.restrictions?.some(item=>!item.reopenConfirmed)) { if (!notices.has(url)) notices.set(url,'Retained restriction'); }
      for (const item of options.previous?.courses.find(item=>item.courseId===configCourse.id)?.restrictions ?? []) if (!item.reopenConfirmed) { if (!notices.has(item.sourceUrl)) notices.set(item.sourceUrl,'Previously confirmed restriction'); }
      if (notices.size > 100) throw new Error('notice_feed_changed');
      for (const [url,title] of notices) {
        const html = await get(url), hash = await noticeHash(html,url);
        evidence.push({url,hash});
        const review = configCourse.reviews[url];
        const prior = options.previous?.courses.find(item=>item.courseId===configCourse.id);
        const retained = prior?.evidence.some(item=>item.url===url && item.hash===hash) ? prior.restrictions.filter(item=>item.sourceUrl===url) : [];
        if (review?.hash === hash) restrictions.push(...(review.restrictions ?? []));
        else if (retained.length) restrictions.push(...retained);
        else {
          const text=htmlText(articleContent(html));
          const closure = title.includes(configCourse.identity) && text.includes(configCourse.identity) ? explicitClosure(text,url) : null;
          if (closure) restrictions.push(closure);
          else pending.push({url,hash,title});
        }
      }
      if (pending.length) reason='notice_review_required';
    } catch (error) { reason = String((error as Error).message).startsWith('Official') || String(error).includes('fetch') ? 'fetch_failed' : 'source_changed'; }
    courses.push({ courseId:configCourse.id, checkedAt:reason === 'fetch_failed' ? null : generatedAt, attemptedAt:generatedAt, expiresAt,
      normalUse:!reason, unknownReason:reason, restrictions, evidence, pending });
  }
  const content = {schemaVersion:1,timezone:'Asia/Tokyo',generatedAt,expiresAt,configHash:sourceHash(config),
    nextCheckAt:new Date(+now + (courses.some(course => course.unknownReason) ? 1 : 7)*DAY).toISOString(), courses};
  return {...content,generation:sourceHash(content).slice(0,24)};
}
