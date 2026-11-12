import { ref, onMounted, onScopeDispose } from 'vue';
import { runningCourses } from '../model/running-courses';
import { validateCourseAvailability, type CourseAvailabilityDocument } from '../model/course-availability';
import { isPublicProductionRuntime } from './deployment';
export const courseAvailabilityDocument=ref<CourseAvailabilityDocument|null>(null);
let pending:Promise<void>|undefined;
let loadedAt=0;
export async function loadCourseAvailability() {
  if (pending) return pending;
  if (Date.now()-loadedAt<60000) return;
  pending=(async()=>{
    try {
      const response=await fetch('/availability/running-courses.json',{cache:'no-cache',signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error('Course status unavailable');
      courseAvailabilityDocument.value=validateCourseAvailability(await response.json(),runningCourses.map(course=>course.id),new Date(),{allowFixture:!isPublicProductionRuntime()});
    } catch { courseAvailabilityDocument.value=null; }
    loadedAt=Date.now();
  })().finally(()=>{pending=undefined;});
  return pending;
}
export function useCourseAvailability() {
  const now=ref(new Date());
  let timer:ReturnType<typeof setInterval>|undefined;
  onMounted(()=>{void loadCourseAvailability();timer=setInterval(()=>{now.value=new Date();void loadCourseAvailability();},60000);});
  onScopeDispose(()=>{clearInterval(timer);});
  return {document:courseAvailabilityDocument,now};
}
