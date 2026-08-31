<template>
  <v-container class="oda-page">
    <header class="oda-hero">
      <p class="oda-eyebrow">ODA FIELD</p>
      <h1>{{ isEnglish ? 'Yoyogi Park Athletic Track (Oda Field)' : '織田フィールドの利用情報' }}</h1>
      <p>{{ isEnglish ? 'Current closure information and nearby tracks for an alternative workout.' : '現在の利用停止情報と、代わりに練習できそうな周辺トラックを案内します。' }}</p>
    </header>

    <v-alert type="warning" variant="tonal" class="closure-alert" icon="mdi-hammer-wrench">
      <h2>{{ isEnglish ? 'Closed through November 30, 2026 (planned)' : '2026年11月30日まで利用停止予定' }}</h2>
      <p>{{ isEnglish ? 'The track is closed from July 1 through November 30 for work related to renewal of its Class 3 JAAF certification.' : '第三種公認陸上競技場の公認更新工事のため、7月1日から11月30日まで利用停止と公式に案内されています。' }}</p>
      <p>{{ isEnglish ? 'The end date is planned. Do not assume reopening on December 1; check the latest official notice before visiting.' : '終了日は予定です。12月1日の自動的な再開を前提にせず、訪問前に最新の公式案内をご確認ください。' }}</p>
      <v-btn variant="outlined" color="deep-orange-darken-3" prepend-icon="mdi-open-in-new" href="https://www.tokyo-park.or.jp/park/yoyogi/news/2026/7_1_11_30.html" target="_blank" rel="noopener">
        {{ isEnglish ? 'View official closure notice' : '公式の利用停止案内を見る' }}
      </v-btn>
    </v-alert>

    <section class="alternative-section">
      <div class="section-heading">
        <div>
          <p class="oda-eyebrow">ALTERNATIVES</p>
          <h2>{{ isEnglish ? 'Nearby tracks for your workout' : '代わりに使える周辺トラック' }}</h2>
          <p>{{ isEnglish ? 'Availability applies to the alternative facilities below, not to Oda Field.' : '選択日の利用状況は、織田フィールドではなく下記の代替施設について表示します。' }}</p>
        </div>
        <label class="date-field">
          <span>{{ isEnglish ? 'Workout date' : '利用日' }}</span>
          <input :value="selectedDate" type="date" :min="availabilityManifest.startDate" :max="availabilityManifest.endDate" @change="onDateInput">
        </label>
      </div>

      <div class="date-shortcuts">
        <v-btn size="small" :variant="selectedDate === today ? 'flat' : 'outlined'" color="indigo" @click="chooseDate(today)">{{ isEnglish ? 'Today' : '今日' }}</v-btn>
        <v-btn size="small" :variant="selectedDate === tomorrow ? 'flat' : 'outlined'" color="indigo" @click="chooseDate(tomorrow)">{{ isEnglish ? 'Tomorrow' : '明日' }}</v-btn>
        <span>{{ dateRangeLabel }}</span>
      </div>

      <div class="alternative-grid">
        <article v-for="item in alternatives" :key="item.track.id" class="alternative-card">
          <div class="alternative-title">
            <h3>{{ localizedName(item.track) }}</h3>
            <strong>{{ formatDistance(item.distance) }}</strong>
          </div>
          <span :class="['availability-badge', `availability--${item.availability.status.replace('_', '-')}`]">
            <v-icon :icon="statusIcon(item.availability.status)" size="15" /> {{ statusLabel(item.availability.status) }}
          </span>
          <p>{{ trackSummary(item.track) }}</p>
          <div class="alternative-actions">
            <v-btn size="small" color="indigo" variant="flat" class="white-text" :to="detailPath(item.track)">{{ isEnglish ? 'Details' : '詳細を見る' }}</v-btn>
            <v-btn size="small" color="teal-darken-2" variant="outlined" :href="item.track.urls.schedule || item.track.urls.individualUse || item.track.urls.official" target="_blank" rel="noopener">{{ isEnglish ? 'Official info' : '公式情報' }}</v-btn>
          </div>
        </article>
      </div>

      <v-btn class="search-cta" color="indigo" variant="flat" prepend-icon="mdi-map-search" :to="searchPath">
        {{ isEnglish ? 'Search all tracks from Oda Field' : '織田フィールドを基準にすべてのトラックを探す' }}
      </v-btn>
      <p class="source-note">{{ isEnglish ? 'Based on official sources. Schedules can change, so check before visiting. Facilities explicitly unavailable on the selected date are omitted.' : '公式情報をもとに表示しています。当日変更もあるため、利用前にご確認ください。選択日に利用不可と確認できた施設は候補から除いています。' }}</p>
    </section>

    <v-card class="facility-card">
      <v-container>
        <h2>{{ $t('oda.info_title') }}</h2>
        <p class="headline">{{ $t('oda.official_name') }}</p>
        <div class="map-wrap">
          <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.4061911644067!2d139.69173161501527!3d35.66699913836023!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188cad8ba1d227%3A0x8b5756b02932d0b1!2z5Luj44CF5pyo5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sjp!4v1526609293873" title="Oda Field map" loading="lazy" allowfullscreen></iframe>
        </div>
        <div class="headline mt-3 mb-2">{{ $t('oda.access_title') }}</div>
        <div class="subheading">{{ $t('oda.access_1') }}</div>
        <div class="subheading">{{ $t('oda.access_2') }}</div>
        <div class="headline mt-3 mb-2">{{ $t('oda.contact') }}</div>
        <div class="subheading">{{ $t('oda.contact_1') }}</div>
        <div class="subheading">{{ $t('oda.tel') }}</div>

        <section class="experience-section">
          <h2>{{ isEnglish ? 'Runner perspective before the construction' : '平常時の使用感（工事前）' }}</h2>
          <p class="experience-note">{{ isEnglish ? 'The following is a first-hand impression written about normal operation before the current construction. It does not describe current availability.' : '以下は、現在の工事に入る前の平常利用時に書かれた体験談です。現在の開放状況を示すものではありません。' }}</p>
          <p v-for="index in opinionIndexes" :key="index" class="subheading">{{ $t(`oda.opinion_${index}`) }}</p>
        </section>
      </v-container>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { availabilityDataset, availabilityForTrack, localDateKey, type AvailabilityDataset, type AvailabilityStatus } from '@/model/availability';
import { addDateOnlyDays, availabilityManifest, loadAvailabilityDate, normalizeSelectedDate } from '@/model/availability-range';
import { distanceKm, trackById, trackDetailPath, tracks, type TrackFacility } from '@/model/tracks';

const { locale, t } = useI18n();
const route = useRoute();
const router = useRouter();
const isEnglish = computed(() => locale.value === 'en');
const today = localDateKey();
const tomorrow = addDateOnlyDays(today, 1);
const selectedDate = ref(normalizeSelectedDate(route.query.date, today));
const dataset = ref<AvailabilityDataset>(availabilityDataset);
const oda = trackById('yoyogi-park-athletic-track')!;
const opinionIndexes = computed(() => [1, 2, 3, 4].filter(index => String(t(`oda.opinion_${index}`)).trim()));

watch(() => route.query.date, async value => {
  const normalized = normalizeSelectedDate(value, today);
  selectedDate.value = normalized;
  if (value && value !== normalized) {
    await router.replace({ path: route.path, query: { ...route.query, date: normalized } });
    return;
  }
  try { dataset.value = await loadAvailabilityDate(normalized); } catch { dataset.value = availabilityDataset; }
}, { immediate: true });

const alternatives = computed(() => tracks
  .filter(track => track.id !== oda.id)
  .map(track => ({
    track,
    distance: distanceKm(oda.location, track.location),
    availability: availabilityForTrack(track.id, selectedDate.value, new Date(), dataset.value),
  }))
  .filter(item => item.availability.status !== 'unavailable')
  .sort((a, b) => a.distance - b.distance)
  .slice(0, 4));
const searchPath = computed(() => ({
  path: isEnglish.value ? '/en/' : '/',
  query: { date: selectedDate.value, lat: oda.location.latitude.toFixed(4), lng: oda.location.longitude.toFixed(4) },
}));
const dateRangeLabel = computed(() => isEnglish.value
  ? `Searchable: ${availabilityManifest.startDate} – ${availabilityManifest.endDate}`
  : `検索可能期間：${availabilityManifest.startDate.replaceAll('-', '/')}〜${availabilityManifest.endDate.replaceAll('-', '/')}`);

function chooseDate(date: string) { void router.replace({ path: route.path, query: { ...route.query, date } }); }
function onDateInput(event: Event) { chooseDate((event.target as HTMLInputElement).value); }
function localizedName(track: TrackFacility) { return isEnglish.value ? track.name.en : track.name.ja; }
function detailPath(track: TrackFacility) { return { path: trackDetailPath(track, locale.value), query: { date: selectedDate.value } }; }
function formatDistance(distance: number) { return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`; }
function statusIcon(status: AvailabilityStatus) { return ({ available: 'mdi-check-circle', partially_available: 'mdi-clock-outline', unknown: 'mdi-help-circle-outline', unavailable: 'mdi-close-circle' })[status]; }
function statusLabel(status: AvailabilityStatus) {
  const labels: Record<AvailabilityStatus, [string, string]> = {
    available: ['利用可能', 'Available'], partially_available: ['一部利用可能', 'Partly available'],
    unknown: ['要確認', 'Needs confirmation'], unavailable: ['利用不可', 'Unavailable'],
  };
  return labels[status][isEnglish.value ? 1 : 0];
}
function trackSummary(track: TrackFacility) {
  const surface = ({ 'all-weather': ['全天候', 'All-weather'], dirt: ['土', 'Dirt'], clay: ['クレー', 'Clay'] } as Record<string, [string, string]>)[track.track.surface ?? '']?.[isEnglish.value ? 1 : 0];
  return [track.track.lengthMeters ? `${track.track.lengthMeters}m` : null, track.track.lanes ? `${track.track.lanes}${isEnglish.value ? ' lanes' : 'レーン'}` : null, surface].filter(Boolean).join('・');
}
</script>

<style scoped>
.oda-page { max-width: 1080px; padding-block: 24px 48px; }
.oda-hero { padding: 24px; color: white; background: linear-gradient(135deg,#283593,#00897b); border-radius: 12px; }
.oda-hero h1 { margin: 3px 0 8px; font-size: clamp(28px,5vw,42px); line-height: 1.2; }
.oda-hero p { max-width: 760px; margin: 0; }
.oda-eyebrow { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: .14em; opacity: .85; }
.closure-alert { padding: 18px; margin: 16px 0; }
.closure-alert h2 { margin: 0 0 8px; font-size: 22px; }
.closure-alert p { margin: 0 0 10px; }
.closure-alert .v-btn { min-height: 44px; }
.alternative-section { padding: 22px; margin: 16px 0; border: 1px solid #d9dce8; border-radius: 12px; background: #f7f8fc; }
.section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
.section-heading h2 { margin: 3px 0 6px; }
.section-heading p { margin: 0; }
.date-field { display: flex; min-width: 190px; color: #555; font-size: 12px; flex-direction: column; gap: 3px; }
.date-field input { min-height: 38px; padding: 6px 9px; border: 1px solid #9da3b4; border-radius: 5px; background: white; font: inherit; font-size: 14px; }
.date-shortcuts { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
.date-shortcuts span { color: #666; font-size: 13px; }
.alternative-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
.alternative-card { padding: 16px; border: 1px solid #d9dce8; border-radius: 10px; background: white; }
.alternative-title { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
.alternative-title h3 { margin: 0; font-size: 17px; }
.alternative-title strong { color: #555; white-space: nowrap; }
.availability-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; margin-top: 9px; border-radius: 999px; font-size: 13px; font-weight: 700; }
.availability--available { color:#00695c;background:#e0f2f1 }.availability--partially-available { color:#8a5700;background:#fff3cd }.availability--unknown { color:#455a64;background:#eceff1 }.availability--unavailable { color:#b71c1c;background:#ffebee }
.alternative-card p { margin: 10px 0; color: #555; }
.alternative-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.alternative-actions .v-btn,.search-cta { min-height: 44px; }
.white-text,.search-cta { color: white!important; }
.search-cta { margin-top: 16px; }
.source-note { margin: 10px 0 0; color: #666; font-size: 13px; }
.facility-card { margin-top: 16px; }
.facility-card h2 { margin-bottom: 8px; }
.map-wrap { position: relative; width: 100%; max-width: 800px; padding-top: min(75%,600px); margin: 0 auto; overflow: hidden; border-radius: 8px; }
.map-wrap iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.experience-section { padding-top: 18px; margin-top: 20px; border-top: 1px solid #e0e0e0; }
.experience-section h2 { margin-bottom: 6px; }
.experience-note { padding: 10px 12px; color: #5d4037; background: #fff8e1; border-radius: 6px; }
.experience-section .subheading { margin-bottom: 12px; }
@media(max-width:700px){.oda-page{padding:12px 10px 40px}.section-heading{align-items:stretch;flex-direction:column}.date-field{min-width:0}.alternative-grid{grid-template-columns:1fr}.alternative-section{padding:16px}.search-cta{width:100%;height:auto!important;min-height:48px;white-space:normal}.search-cta :deep(.v-btn__content){white-space:normal}.map-wrap{padding-top:90%}}
</style>
