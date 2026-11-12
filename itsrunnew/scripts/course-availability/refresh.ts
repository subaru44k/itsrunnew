import { collectCourseAvailability, sourceHash, type CourseConfig } from './collector';
import { validateCourseAvailability, type CourseAvailabilityDocument } from '../../src/model/course-availability';
export async function refreshCourseAvailability(config:CourseConfig, options:{now?:Date;previous?:unknown;force?:boolean;fetchImpl?:typeof fetch;capture?:(url:string,body:string)=>void|Promise<void>}={}) {
  const now=options.now??new Date();
  let previous:CourseAvailabilityDocument|null=null;
  try { previous=validateCourseAvailability(options.previous,config.courses.map(item=>item.id),now,{allowExpired:true}); } catch { /* Never reuse malformed or fixture publications. */ }
  if (!options.force && previous && previous.configHash===sourceHash(config) && Date.parse(previous.nextCheckAt)>+now && Date.parse(previous.expiresAt)>+now) return {document:previous,reused:true};
  const document=await collectCourseAvailability(config,{...options,now,previous});
  validateCourseAvailability(document,config.courses.map(item=>item.id),now);
  return {document,reused:false};
}
