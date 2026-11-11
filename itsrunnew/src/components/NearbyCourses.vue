<template>
  <section v-if="nearby.length" class="nearby-courses" data-nearby-courses>
    <h3>{{ english ? 'Nearby running courses' : '近くのランニングコース' }}</h3>
    <CanonicalLink v-for="item in nearby" :key="item.course.id" class="course-link" :to="{ path: placePath(item.course, language), query: { date, lat, lng } }" @click="trackProductEvent('facility_select', { course_id: item.course.id, place_kind: 'course', source: 'related_course', locale: language })">
      <span><strong>{{ item.course.name[language] }}</strong><small>{{ status(item.course.id) }}</small><small>{{ courseDistance(item.course, language) }} · {{ courseSurface(item.course, language) }}</small><small v-if="item.course.rules.length">{{ item.course.rules[0][language] }}</small></span>
      <small class="course-distance">{{ item.distance.toFixed(1) }} km<br>{{ english ? 'straight line' : '直線距離' }}</small>
    </CanonicalLink>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { courseAvailability } from '../model/course-availability';
import { localDateKey } from '../model/availability';
import { useCourseAvailability } from '../services/course-availability';
import CanonicalLink from './CanonicalLink.vue';
import { courseDistance, courseSurface, nearestCourses, placePath, type TrainingPlace } from '../model/running-courses';
import { trackProductEvent } from '../services/analytics';
const props = defineProps<{ origin: TrainingPlace['location']; excludeId?: string; english: boolean; date?: string; lat?: string; lng?: string }>();
const language = computed(() => props.english ? 'en' : 'ja');
const {document,now}=useCourseAvailability();
const status=(id:string)=>({available:['利用可','Available'],unavailable:['利用不可','Unavailable'],partially_available:['一部利用可','Partly available'],unknown:['要確認','Needs confirmation']})[courseAvailability(id,props.date??localDateKey(now.value),document.value,now.value).status][props.english?1:0];
const nearby = computed(() => nearestCourses(props.origin, props.excludeId));
</script>
<style scoped>
.nearby-courses { margin-top: 20px; padding-top: 14px; border-top: 1px solid #d9dce8; }
.nearby-courses h3 { font-size: 17px; }
.nearby-courses p { color: #596579; font-size: 13px; margin: 6px 0; }
.course-link { display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid #d9dce8; text-decoration: none; }
.course-link strong { color: #283593; }
.course-link small { display: block; color: #596579; margin-top: 4px; }
.course-distance { flex: 0 0 auto; text-align: right; }
</style>
