<template>
  <v-container v-if="track" class="track-detail-page">
    <nav class="breadcrumbs" :aria-label="isEnglish ? 'Breadcrumb' : 'パンくずリスト'">
      <router-link :to="searchPath">{{ isEnglish ? 'Track Finder' : 'トラック検索' }}</router-link><span aria-hidden="true">/</span><span>{{ localizedName(track) }}</span>
    </nav>

    <header class="detail-hero">
      <div>
        <p class="track-eyebrow">TRACK DETAILS</p>
        <h1>{{ localizedName(track) }}</h1>
        <p>{{ track.location.address }}</p>
      </div>
      <v-btn color="white" class="back-search" prepend-icon="mdi-map-search" :to="facilityMapPath" @click="trackDetailEvent('view_on_map_click')">
        {{ isEnglish ? 'View location on map' : '地図上の位置を見る' }}
      </v-btn>
    </header>

    <section class="date-panel" :aria-label="isEnglish ? 'Use date' : '利用日'">
      <strong>{{ isEnglish ? 'Use date' : '利用日' }}</strong>
      <div class="date-actions">
        <v-btn size="small" :variant="selectedDate === today ? 'flat' : 'outlined'" color="indigo" @click="chooseDate(today, 'today')">{{ isEnglish ? 'Today' : '今日' }}</v-btn>
        <v-btn size="small" :variant="selectedDate === tomorrow ? 'flat' : 'outlined'" color="indigo" @click="chooseDate(tomorrow, 'tomorrow')">{{ isEnglish ? 'Tomorrow' : '明日' }}</v-btn>
        <label><span>{{ isEnglish ? 'Choose date' : '日付を選ぶ' }}</span><input :value="selectedDate" type="date" :min="availabilityManifest.startDate" :max="availabilityManifest.endDate" @change="onDateInput" /></label>
      </div>
    </section>

    <main class="detail-layout">
      <section :class="['availability-panel', availabilityClass]">
        <span>{{ selectedDateLabel }}</span>
        <h2><v-icon :icon="statusIcon" size="22" /> {{ statusLabel }}</h2>
        <p>{{ statusDescription }}</p>
        <ul v-if="availablePeriods.length"><li v-for="period in availablePeriods" :key="period">{{ period }}</li></ul>
        <small>{{ freshnessLabel }}</small>
      </section>

      <aside :class="['related-section', { 'related-section--urgent': availability?.status === 'unavailable' }]">
        <p v-if="availability?.status === 'unavailable'" class="alternative-eyebrow">{{ isEnglish ? 'FIND AN ALTERNATIVE' : '代わりを探す' }}</p>
        <h2>{{ relatedHeading }}</h2>
        <p class="related-intro">{{ relatedDescription }}</p>
        <router-link v-for="item in related" :key="item.track.id" class="alternative-link" :to="candidateDetailPath(item.track)" @click="trackRelatedFacility(item.track)">
          <span class="alternative-main">
            <strong>{{ localizedName(item.track) }}</strong>
            <span :class="['availability-badge', `availability--${item.availability.status.replace('_', '-')}`]">
              <v-icon :icon="statusIconFor(item.availability.status)" size="14" />{{ statusLabelFor(item.availability.status) }}
            </span>
          </span>
          <span class="alternative-distance">{{ formatDistance(item.distance) }}</span>
        </router-link>
        <v-btn class="nearby-search-action white-text" color="indigo" variant="flat" prepend-icon="mdi-map-search" :to="nearbySearchPath" @click="trackDetailEvent('view_on_map_click', { source: 'nearby_alternatives' })">
          {{ isEnglish ? 'Compare nearby tracks from here' : 'この施設を基準に周辺を比較' }}
        </v-btn>
        <p class="related-note">{{ isEnglish ? '“Needs confirmation” is not the same as unavailable. Check the official information before visiting.' : '「要確認」は利用不可ではありません。訪問前に公式情報をご確認ください。' }}</p>
      </aside>

      <div class="detail-content">
        <section class="info-section">
          <h2>{{ isEnglish ? 'Track information' : 'トラック情報' }}</h2>
          <dl class="facts">
            <div><dt>{{ isEnglish ? 'Length' : '距離' }}</dt><dd>{{ value(track.track.lengthMeters, 'm') }}</dd></div>
            <div><dt>{{ isEnglish ? 'Lanes' : 'レーン数' }}</dt><dd>{{ value(track.track.lanes) }}</dd></div>
            <div><dt>{{ isEnglish ? 'Surface' : '路面' }}</dt><dd>{{ surfaceLabel }}</dd></div>
            <div><dt>JAAF</dt><dd>{{ certificationLabel }}</dd></div>
            <div><dt>{{ isEnglish ? 'Individual use' : '個人利用' }}</dt><dd>{{ individualUseLabel }}</dd></div>
            <div><dt>{{ isEnglish ? 'Spikes' : 'スパイク' }}</dt><dd>{{ spikesLabel }}</dd></div>
            <div><dt>{{ isEnglish ? 'Fee' : '料金' }}</dt><dd>{{ feeLabel }}</dd></div>
            <div><dt>{{ isEnglish ? 'Facility info checked' : '施設情報の確認日' }}</dt><dd>{{ latestVerifiedAt }}</dd></div>
          </dl>
          <p v-if="track.individualUse.note" class="track-note">{{ track.individualUse.note }}</p>
        </section>

        <section class="source-section">
          <h2>{{ isEnglish ? 'Check before visiting' : '利用前に確認' }}</h2>
          <p>{{ isEnglish ? 'Schedules and rules can change. Please confirm the latest information from the facility.' : '予定や利用条件は変更されることがあります。お出かけ前に施設の最新情報をご確認ください。' }}</p>
          <div class="primary-actions">
            <v-btn v-if="availabilityUrl" color="amber-lighten-4" class="schedule-action" variant="flat" prepend-icon="mdi-calendar-check" :href="availabilityUrl" target="_blank" rel="noopener" @click="trackDetailEvent('availability_source_click')">{{ isEnglish ? 'View latest schedule on official site' : '最新の利用予定を公式サイトで見る' }}</v-btn>
            <v-btn color="indigo" variant="flat" class="white-text" prepend-icon="mdi-open-in-new" :href="track.urls.official" target="_blank" rel="noopener" @click="trackDetailEvent('official_site_click')">{{ isEnglish ? 'Official site' : '公式サイト' }}</v-btn>
            <v-btn color="teal-darken-2" variant="outlined" class="directions-action" prepend-icon="mdi-directions" :href="directionsUrl(track)" target="_blank" rel="noopener" @click="trackDetailEvent('directions_click')">{{ isEnglish ? 'Directions' : '経路を見る' }}</v-btn>
          </div>
        </section>
      </div>
    </main>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { availabilityDataset, availabilityForTrack, localDateKey, type AvailabilityDataset, type AvailabilityStatus } from '../model/availability';
import { availabilityActionUrl } from '../model/availability-link';
import { addDateOnlyDays, availabilityManifest, loadAvailabilityDate, normalizeSelectedDate } from '../model/availability-range';
import { rankTrackAlternatives } from '../model/track-alternatives';
import { directionsUrl, distanceKm, trackById, trackDetailPath, tracks, type TrackFacility } from '../model/tracks';
import { trackProductEvent, type ProductEventName, type ProductEventParameters } from '../services/analytics';

const route = useRoute();
const router = useRouter();
const { locale } = useI18n();
const isEnglish = computed(() => locale.value === 'en');
const track = computed(() => trackById(route.params.trackId));
const today = localDateKey();
const tomorrow = addDateOnlyDays(today, 1);
const selectedDate = ref(normalizeSelectedDate(route.query.date, today));
const dataset = ref<AvailabilityDataset>(availabilityDataset);
const mapSectionHash = '#track-map-section';
function trackFinderRoute(query: Record<string, string | undefined>, hash?: string) {
  return {
    path: isEnglish.value ? '/en/' : '/',
    query,
    ...(hash ? { hash } : {}),
  };
}
function queryString(value: unknown) { return typeof value === 'string' ? value : undefined; }
const searchPath = computed(() => trackFinderRoute({ date: selectedDate.value }));
const facilityMapPath = computed(() => trackFinderRoute({
  date: selectedDate.value,
  track: track.value?.id,
  lat: queryString(route.query.lat),
  lng: queryString(route.query.lng),
}, mapSectionHash));
const nearbySearchPath = computed(() => trackFinderRoute({
  date: selectedDate.value,
  lat: track.value?.location.latitude.toFixed(4),
  lng: track.value?.location.longitude.toFixed(4),
}, mapSectionHash));
const availability = computed(() => track.value ? availabilityForTrack(track.value.id, selectedDate.value, new Date(), dataset.value) : null);
const related = computed(() => !track.value ? [] : rankTrackAlternatives(tracks
  .filter(item => item.id !== track.value?.id)
  .map(item => ({
    track: item,
    distance: distanceKm(track.value!.location, item.location),
    availability: availabilityForTrack(item.id, selectedDate.value, new Date(), dataset.value),
  }))));
let lastDetailView = '';

watch(() => route.query.date, async value => {
  selectedDate.value = normalizeSelectedDate(value, today);
  try { dataset.value = await loadAvailabilityDate(selectedDate.value); } catch { dataset.value = availabilityDataset; }
}, { immediate: true });
watch([() => track.value?.id, selectedDate, () => dataset.value.date, () => availability.value?.status], ([trackId, date, datasetDate, status]) => {
  if (!trackId || !status || datasetDate !== date) return;
  const key = `${trackId}|${date}`;
  if (key === lastDetailView) return;
  lastDetailView = key;
  trackDetailEvent('facility_detail_view', { availability_status: status });
}, { immediate: true });

function localizedName(item: TrackFacility) { return isEnglish.value ? item.name.en : item.name.ja; }
function candidateDetailPath(item: TrackFacility) { return { path: trackDetailPath(item, locale.value), query: { date: selectedDate.value } }; }
function formatDistance(distance: number) { return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`; }
function statusIconFor(status: AvailabilityStatus) { return ({ available: 'mdi-check-circle', partially_available: 'mdi-clock-outline', unknown: 'mdi-help-circle-outline', unavailable: 'mdi-close-circle' })[status]; }
function statusLabelFor(status: AvailabilityStatus) {
  const labels: Record<AvailabilityStatus, [string, string]> = {
    available: ['利用可能', 'Available'],
    partially_available: ['一部利用可能', 'Partly available'],
    unknown: ['要確認', 'Needs confirmation'],
    unavailable: ['利用不可', 'Unavailable'],
  };
  return labels[status][isEnglish.value ? 1 : 0];
}
function chooseDate(date: string, source = 'native_date_input') {
  trackDetailEvent('date_select', { source, selected_date: date });
  void router.replace({ query: { ...route.query, date } });
}
function onDateInput(event: Event) { chooseDate((event.target as HTMLInputElement).value); }
function trackDetailEvent(name: ProductEventName, parameters: ProductEventParameters = {}) {
  trackProductEvent(name, {
    locale: isEnglish.value ? 'en' : 'ja',
    selected_date: selectedDate.value,
    track_id: track.value?.id,
    ...parameters,
  });
}
function trackRelatedFacility(item: TrackFacility) {
  trackProductEvent('facility_select', {
    locale: isEnglish.value ? 'en' : 'ja',
    selected_date: selectedDate.value,
    track_id: item.id,
    source: 'related_facility',
  });
}
function value(input: number | null, suffix = '') { return input == null ? (isEnglish.value ? 'Not confirmed' : '未確認') : `${input}${suffix}`; }
const selectedDateLabel = computed(() => new Intl.DateTimeFormat(isEnglish.value ? 'en-US' : 'ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${selectedDate.value}T12:00:00+09:00`)));
const availabilityClass = computed(() => `availability--${availability.value?.status.replace('_', '-') ?? 'unknown'}`);
const statusIcon = computed(() => statusIconFor(availability.value?.status ?? 'unknown'));
const statusLabel = computed(() => statusLabelFor(availability.value?.status ?? 'unknown'));
const statusDescription = computed(() => {
  if (!availability.value || availability.value.status === 'unknown') return isEnglish.value ? 'The selected date cannot be confirmed online. Check the official source.' : '選択日の状況をWebだけでは確定できません。公式情報をご確認ください。';
  if (availability.value.status === 'partially_available') return isEnglish.value ? 'Only the periods below are confirmed.' : '下記の時間帯のみ利用可能と確認できています。';
  if (availability.value.status === 'unavailable' && track.value?.individualUse.status === 'unavailable') return isEnglish.value ? 'Official facility rules do not accept individual use.' : '公式の施設規則で個人利用を受け付けていません。';
  if (availability.value.status === 'unavailable') return isEnglish.value ? 'An official closure or unavailable notice applies.' : '公式情報で休場・利用休止を確認しています。';
  return isEnglish.value ? 'Official information confirms an individual-use period.' : '公式情報から個人利用枠を確認できています。';
});
const availablePeriods = computed(() => availability.value?.periods.filter(period => period.status === 'available').map(period => period.from && period.to ? `${period.from}〜${period.to}` : (isEnglish.value ? 'During opening hours' : '開場時間内')) ?? []);
const relatedHeading = computed(() => availability.value?.status === 'unavailable'
  ? (isEnglish.value ? 'Nearby alternatives for this date' : 'この日の代替候補')
  : (isEnglish.value ? 'Nearby tracks for this date' : 'この日の周辺トラック'));
const relatedDescription = computed(() => availability.value?.status === 'unavailable'
  ? (isEnglish.value ? 'This facility is unavailable on the selected date. Alternatives are ranked using both availability and distance.' : 'この競技場は選択日に利用できません。利用状況と距離を組み合わせ、役に立つ順に候補を表示しています。')
  : (isEnglish.value ? 'Compare nearby facilities ranked using both availability and distance for the selected date.' : '選択日の利用状況と距離を組み合わせ、周辺施設を役に立つ順に表示しています。'));
const freshnessLabel = computed(() => !availability.value ? '' : `${isEnglish.value ? 'Checked' : '確認'}: ${new Intl.DateTimeFormat(isEnglish.value ? 'en-US' : 'ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium' }).format(new Date(availability.value.freshness.checkedAt))}`);
const surfaceLabel = computed(() => {
  const labels: Record<string, [string, string]> = { 'all-weather': ['全天候', 'All-weather'], dirt: ['土', 'Dirt'], clay: ['クレー', 'Clay'] };
  return labels[track.value?.track.surface ?? '']?.[isEnglish.value ? 1 : 0] ?? (isEnglish.value ? 'Not confirmed' : '未確認');
});
const certificationLabel = computed(() => track.value?.certification.jaafCertified === true ? `${track.value.certification.jaafClass}${isEnglish.value ? ' class' : '種公認'}` : track.value?.certification.jaafCertified === false ? (isEnglish.value ? 'Not certified' : '非公認') : (isEnglish.value ? 'Not confirmed' : '未確認'));
const individualUseLabel = computed(() => {
  if (track.value?.individualUse.status === 'available') return isEnglish.value ? 'Available' : '利用可';
  if (track.value?.individualUse.status === 'unavailable') return isEnglish.value ? 'Not available' : '利用不可';
  if (track.value?.individualUse.status === 'temporarily-unavailable') return isEnglish.value ? 'Temporarily closed' : '一時休止中';
  return isEnglish.value ? 'Needs confirmation' : '要確認';
});
const spikesLabel = computed(() => track.value?.individualUse.spikesAllowed === true ? (isEnglish.value ? 'Allowed' : '利用可') : track.value?.individualUse.spikesAllowed === false ? (isEnglish.value ? 'Not allowed' : '利用不可') : (isEnglish.value ? 'Not confirmed' : '未確認'));
const feeLabel = computed(() => track.value?.individualUse.feeYen == null ? (isEnglish.value ? 'Check official site' : '公式サイトで確認') : track.value.individualUse.feeYen === 0 ? (isEnglish.value ? 'Free' : '無料') : `¥${track.value.individualUse.feeYen.toLocaleString()}${track.value.individualUse.feeUnit ? ` / ${track.value.individualUse.feeUnit}` : ''}`);
const latestVerifiedAt = computed(() => track.value ? track.value.sources.map(source => source.verifiedAt).sort().at(-1) ?? '—' : '—');
const availabilityUrl = computed(() => track.value ? availabilityActionUrl(track.value, availability.value) : '');
</script>

<style scoped>
.track-detail-page { max-width: 1080px; padding-block: 24px 56px; }.breadcrumbs { display: flex; gap: 8px; margin-bottom: 12px; color: #666; font-size: 13px; }.detail-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; padding: 24px; color: white; background: linear-gradient(135deg,#283593,#00897b); border-radius: 12px; }.detail-hero h1 { margin: 3px 0 8px; font-size: clamp(27px,5vw,40px); }.detail-hero p { margin: 0; }.track-eyebrow { font-size: 12px; font-weight: 800; letter-spacing: .14em; }.back-search { min-height: 44px; color: #283593!important; font-weight: 700; }.date-panel { padding: 14px; margin: 14px 0; border: 1px solid #d9dce8; border-radius: 10px; }.date-actions { display: flex; align-items: end; flex-wrap: wrap; gap: 8px; margin-top: 8px; }.date-actions label { display: flex; color: #555; font-size: 12px; flex-direction: column; }.date-actions input { min-height: 36px; padding: 5px 9px; border: 1px solid #9da3b4; border-radius: 5px; }.detail-layout { display: grid; grid-template-areas: 'availability related' 'content related'; grid-template-columns: minmax(0,2fr) minmax(280px,1fr); gap: 0 20px; }.availability-panel,.info-section,.source-section,.related-section { padding: 20px; margin-bottom: 16px; border: 1px solid #d9dce8; border-radius: 12px; background: white; }.availability-panel { grid-area: availability; border-left: 6px solid; }.availability-panel h2 { display: flex; align-items: center; gap: 6px; margin: 5px 0; }.detail-content { grid-area: content; }.availability--available { border-left-color:#00897b;background:#e0f2f1}.availability--partially-available{border-left-color:#f9a825;background:#fff8e1}.availability--unknown{border-left-color:#78909c;background:#eceff1}.availability--unavailable{border-left-color:#c62828;background:#ffebee}.facts { margin:0 }.facts div { display:grid; grid-template-columns:130px 1fr; gap:12px; padding:9px 0; border-bottom:1px solid #eceef3 }.facts dt{color:#666}.facts dd{margin:0;font-weight:600}.track-note{padding:10px;background:#fff8e1;border-radius:6px}.primary-actions{display:flex;flex-wrap:wrap;gap:8px}.primary-actions .v-btn{min-height:44px}.schedule-action{color:#4e342e!important;border:1px solid #d99000}.white-text{color:white!important}.directions-action{color:#00695c!important}.related-section { grid-area:related;height:fit-content }.related-section--urgent { border:2px solid #c62828;background:#fff8f7;box-shadow:0 4px 16px rgba(120,20,20,.12) }.related-section h2 { margin:0 0 8px;font-size:21px }.alternative-eyebrow { margin:0 0 4px;color:#a51f1f;font-size:12px;font-weight:800;letter-spacing:.1em }.related-intro { margin:0 0 10px;color:#555 }.alternative-link { display:flex;min-height:64px;align-items:flex-start;justify-content:space-between;gap:10px;padding:12px 2px;border-bottom:1px solid #dfe2eb;text-decoration:none }.alternative-main { display:flex;min-width:0;align-items:flex-start;flex-direction:column;gap:6px }.alternative-main strong { color:#283593;line-height:1.35 }.availability-badge { display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border-radius:999px;font-size:12px;font-weight:800;white-space:nowrap }.availability-badge.availability--available { color:#00695c;background:#e0f2f1 }.availability-badge.availability--partially-available { color:#7a4d00;background:#fff3cd }.availability-badge.availability--unknown { color:#455a64;background:#eceff1 }.availability-badge.availability--unavailable { color:#8e1717;background:#ffebee }.alternative-distance { color:#555;white-space:nowrap }.nearby-search-action { width:100%;height:auto!important;min-height:48px;margin-top:16px;white-space:normal }.nearby-search-action :deep(.v-btn__content) { white-space:normal }.related-note { margin:10px 0 0;color:#666;font-size:12px;line-height:1.5 }@media(max-width:700px){.track-detail-page{padding:12px 10px 40px}.detail-hero{align-items:stretch;flex-direction:column}.back-search{align-self:flex-start}.detail-layout{grid-template-areas:'availability' 'related' 'content';grid-template-columns:1fr}.related-section{padding:18px}.facts div{grid-template-columns:110px 1fr}}
</style>
