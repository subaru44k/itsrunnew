<template>
  <section class="course-status" :class="`course-status--${result.status}`" aria-live="polite">
    <strong>{{ label }}<span> · {{ targetDate }}</span></strong>
    <p>{{ result.reason[language] }}</p>
    <small v-if="result.checkedAt">{{ english ? 'Official information checked' : '公式情報の確認' }}: {{ checked }}</small>
    <a v-if="result.sourceUrl" :href="result.sourceUrl" target="_blank" rel="noopener">{{ english ? 'Restriction notice' : '利用制限の公式告知' }} ↗</a>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { localDateKey } from '../model/availability';
import { courseAvailability } from '../model/course-availability';
import { useCourseAvailability } from '../services/course-availability';
const props=defineProps<{courseId:string;date?:string;english:boolean}>();
const {document,now}=useCourseAvailability();
const language=computed(()=>props.english?'en':'ja');
const targetDate=computed(()=>props.date??localDateKey(now.value));
const result=computed(()=>courseAvailability(props.courseId,targetDate.value,document.value,now.value));
const label=computed(()=>({available:['利用可','Available'],partially_available:['一部利用可','Partly available'],unavailable:['利用不可','Unavailable'],unknown:['要確認','Needs confirmation']})[result.value.status][props.english?1:0]);
const checked=computed(()=>result.value.checkedAt?new Intl.DateTimeFormat(props.english?'en-US':'ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric'}).format(new Date(result.value.checkedAt)):'');
</script>
<style scoped>
.course-status{padding:12px;margin:12px 0;border-left:4px solid #78909c;background:#eceff1;border-radius:6px;}
.course-status--available{border-color:#00897b;background:#e0f2f1;color:#00695c;}.course-status--unavailable{border-color:#c62828;background:#ffebee;color:#8e1717;}.course-status--partially_available{border-color:#f9a825;background:#fff8e1;color:#7a4d00;}
.course-status strong{font-size:16px;}.course-status strong span{font-size:13px;font-weight:400;}.course-status p{margin:4px 0;font-size:13px;}.course-status small{display:block;}.course-status a{display:inline-flex;min-height:36px;align-items:center;font-size:13px;}
</style>
