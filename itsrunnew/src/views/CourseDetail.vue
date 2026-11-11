<template>
  <v-container v-if="course" class="course-detail-page">
    <nav class="breadcrumbs"><CanonicalLink :to="searchPath">{{ english ? 'Find a training place' : '練習場所を探す' }}</CanonicalLink><span aria-hidden="true"> / </span><span>{{ course.name[language] }}</span></nav>
    <header><p class="course-type">{{ english ? 'RUNNING COURSE' : 'ランニングコース' }}</p><h1>{{ course.name[language] }}</h1><p>{{ course.location.address }}</p></header>
    <main>
      <section class="course-panel" aria-labelledby="course-facts-heading">
        <h2 id="course-facts-heading">{{ english ? 'Course information' : 'コース情報' }}</h2>
        <CourseStatus :course-id="course.id" :date="typeof route.query.date === 'string' ? route.query.date : undefined" :english="english" />
        <CourseFacts :course="course" :english="english" />
        <p class="course-note">{{ english ? 'Check official notices before visiting.' : 'お出かけ前に公式のお知らせもご確認ください。' }}</p>
        <div class="course-actions">
          <v-btn color="indigo" variant="flat" :href="course.urls.map" target="_blank" rel="noopener" @click="outbound('official_site_click', 'course_map')">{{ english ? 'Official course map' : '公式のコース図' }} ↗</v-btn>
          <v-btn color="teal-darken-2" variant="outlined" :href="directionsUrl(course)" target="_blank" rel="noopener" @click="outbound('directions_click', 'course_detail')">{{ english ? 'Directions to park' : '公園への経路' }} ↗</v-btn>
          <v-btn variant="text" :href="course.urls.official" target="_blank" rel="noopener" @click="outbound('official_site_click', 'course_notices')">{{ english ? 'Official information' : '公式のお知らせ・利用案内' }} ↗</v-btn>
        </div>
        <p class="course-note">{{ english ? 'Map and directions use a representative park location. Find the course entrance on the official map.' : '地図・経路は公園の代表地点です。走り始める場所は公式のコース図で確認できます。' }}</p>
        <CanonicalLink :to="mapPath">{{ english ? 'Compare nearby places on map' : '周辺の練習場所を地図で比較する' }} →</CanonicalLink>
      </section>
      <section class="course-panel" aria-labelledby="nearby-tracks-heading">
        <h2 id="nearby-tracks-heading">{{ english ? 'Nearby tracks' : '近くの陸上トラック' }}</h2>
        <CanonicalLink v-for="item in nearbyTracks" :key="item.track.id" class="nearby-track" :to="{ path: placePath(item.track, language), query: { date: route.query.date } }" @click="trackProductEvent('facility_select', { track_id: item.track.id, place_kind: 'track', source: 'course_detail', locale: language })">
          <span><strong>{{ item.track.name[language] }}</strong><small>{{ english ? 'View individual-use schedule' : '個人利用の予定を見る' }}</small></span><small>{{ item.distance.toFixed(1) }} km {{ english ? '(straight line)' : '（直線距離）' }}</small>
        </CanonicalLink>
        <NearbyCourses :origin="course.location" :exclude-id="course.id" :english="english" :date="typeof route.query.date === 'string' ? route.query.date : undefined" />
      </section>
      <details class="course-panel course-sources"><summary>{{ english ? 'Sources and checked dates' : '出典・確認日' }}</summary><ul><li v-for="source in course.sources" :key="source.url"><a :href="source.url" target="_blank" rel="noopener">{{ source.label[language] }} ↗</a> <small>{{ source.verifiedAt }}</small></li></ul></details>
    </main>
  </v-container>
</template>
<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import CanonicalLink from '../components/CanonicalLink.vue';
import CourseFacts from '../components/CourseFacts.vue';
import CourseStatus from '../components/CourseStatus.vue';
import NearbyCourses from '../components/NearbyCourses.vue';
import { courseById, placePath } from '../model/running-courses';
import { directionsUrl, distanceKm, tracks } from '../model/tracks';
import { trackProductEvent } from '../services/analytics';
const route = useRoute();
const { locale } = useI18n();
const english = computed(() => locale.value === 'en');
const language = computed(() => english.value ? 'en' : 'ja');
const course = computed(() => courseById(route.params.courseId));
const searchPath = computed(() => ({ path: english.value ? '/en/' : '/', query: { date: route.query.date, kind: 'course', lat: route.query.lat, lng: route.query.lng } }));
const mapPath = computed(() => ({ path: english.value ? '/en/' : '/', query: { date: route.query.date, track: course.value?.id, lat: course.value?.location.latitude.toFixed(5), lng: course.value?.location.longitude.toFixed(5) }, hash: '#track-map-section' }));
const nearbyTracks = computed(() => !course.value ? [] : tracks.map(track => ({ track, distance: distanceKm(course.value!.location, track.location) })).sort((a, b) => a.distance - b.distance || a.track.id.localeCompare(b.track.id)).slice(0, 3));
watch(() => course.value?.id, id => { if (id) trackProductEvent('facility_detail_view', { course_id: id, place_kind: 'course', locale: language.value }); }, { immediate: true });
function outbound(name: 'official_site_click' | 'directions_click', source: string) { trackProductEvent(name, { course_id: course.value?.id, place_kind: 'course', source, locale: language.value }); }
</script>
<style scoped>
.course-detail-page { max-width: 1050px; padding-block: 24px 40px; }
.breadcrumbs { color: #596579; font-size: 13px; margin-bottom: 20px; }
header { margin-bottom: 20px; }
header h1 { font-size: clamp(25px, 4vw, 36px); line-height: 1.4; margin-bottom: 8px; }
.course-type { color: #6a3e8a; font-weight: 700; font-size: 13px; }
.course-panel { padding: 20px; margin: 16px 0; border: 1px solid #d9dce8; border-radius: 12px; background: white; }
.course-panel h2 { font-size: 21px; }
.course-actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0; }
.course-actions .v-btn--variant-flat { color: white !important; }
.course-actions .v-btn { min-height: 44px; height: auto; white-space: normal; }
.course-note { color: #596579; font-size: 13px; line-height: 1.6; margin-block: 12px; }
.nearby-track { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 0; text-decoration: none; border-bottom: 1px solid #d9dce8; }
.nearby-track small { display: block; color: #596579; margin-top: 4px; }
.course-sources summary { cursor: pointer; font-weight: 600; }
.course-sources ul { padding-left: 20px; margin-top: 12px; }
.course-sources li { margin: 8px 0; }
.course-sources a { overflow-wrap: anywhere; }
@media (max-width: 599px) { .course-panel { padding: 16px; }.nearby-track { align-items: flex-start; flex-direction: column; } }
</style>
