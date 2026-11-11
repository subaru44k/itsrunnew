<template>
  <dl class="course-facts">
    <div><dt>{{ english ? 'One lap' : '一周の距離' }}</dt><dd>{{ courseDistance(course, language) }}</dd></div>
    <div><dt>{{ english ? 'Surface' : '路面' }}</dt><dd>{{ courseSurface(course, language) }}</dd></div>
    <div v-if="course.distanceMarkersMeters"><dt>{{ english ? 'Distance markers' : '距離表示' }}</dt><dd>{{ english ? `Every ${course.distanceMarkersMeters} m` : `${course.distanceMarkersMeters}mごと` }}</dd></div>
    <div v-if="course.crossings"><dt>{{ english ? 'Crossings' : '横断箇所' }}</dt><dd>{{ course.crossings[language] }}</dd></div>
    <div v-if="course.hours"><dt>{{ english ? 'Usual park hours' : '通常開園時間' }}</dt><dd>{{ course.hours[language] }}</dd></div>
  </dl>
  <ul v-if="course.rules.length" class="course-rules"><li v-for="rule in course.rules" :key="rule.ja">{{ rule[language] }}</li></ul>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { courseDistance, courseSurface, type RunningCourse } from '../model/running-courses';
const props = defineProps<{ course: RunningCourse; english: boolean }>();
const language = computed(() => props.english ? 'en' : 'ja');
</script>
<style scoped>
.course-facts { margin: 14px 0; display: grid; gap: 8px; }
.course-facts div { display: grid; grid-template-columns: minmax(90px, .8fr) minmax(0, 2fr); gap: 12px; }
.course-facts dt { color: #596579; font-size: 13px; }
.course-facts dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
.course-rules { margin: 12px 0; padding-left: 20px; line-height: 1.6; }
</style>
